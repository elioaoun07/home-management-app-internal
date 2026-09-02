// src/lib/safeFetch.ts
// Centralized fetch wrapper with timeout + verified offline detection.

import {
  isReallyOnline,
  markOffline,
  probeNow,
} from "@/lib/connectivityManager";

/**
 * CRUD latency budget. Long-running calls such as AI generation and uploads
 * must pass an explicit timeoutMs.
 */
const DEFAULT_TIMEOUT_MS = 8_000;

/** Thrown only when connectivity is known to be unavailable. */
export class OfflineError extends Error {
  constructor(message = "Request failed — network unavailable") {
    super(message);
    this.name = "OfflineError";
  }
}

/** A request exceeded its latency budget, but the network may still be fine. */
export class RequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "RequestTimeoutError";
  }
}

/**
 * Returns true only when an error indicates unavailable connectivity.
 * Timeouts and caller cancellations deliberately return false: neither proves
 * that the device is offline and neither should enqueue a duplicate mutation.
 */
export function isOfflineError(err: unknown): boolean {
  if (err instanceof OfflineError) return true;
  if (
    err instanceof Error &&
    /networkerror|network request failed|failed to fetch|fetch failed|load failed/i.test(
      err.message,
    )
  ) {
    return true;
  }

  // Cross-realm or serialized OfflineError.
  const candidate = err as Record<string, unknown>;
  return candidate?.name === "OfflineError";
}

export interface SafeFetchOptions extends RequestInit {
  /** Override the default timeout (ms). Set to 0 to disable. */
  timeoutMs?: number;
}

/**
 * Fetch with four protections:
 *
 * 1. Skip immediately when the connectivity manager already knows we are
 *    offline.
 * 2. Abort after the request's latency budget. A timeout triggers a real
 *    health probe instead of immediately showing Offline mode.
 * 3. Abort and mark offline immediately when the browser fires `offline`.
 * 4. Mark offline on fetch-level network failures, while preserving caller
 *    cancellations and unrelated errors as-is.
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: SafeFetchOptions,
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  if (!isReallyOnline()) {
    throw new OfflineError("Pre-flight: connectivity manager reports offline");
  }

  const controller = new AbortController();
  const externalSignal = fetchInit.signal;
  let abortSource: "timeout" | "browser-offline" | null = null;
  let externalAbortHandler: (() => void) | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalAbortHandler = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", externalAbortHandler, {
        once: true,
      });
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abortSource = "timeout";
      controller.abort();
    }, timeoutMs);
  }

  const offlineHandler = () => {
    abortSource = "browser-offline";
    controller.abort();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("offline", offlineHandler, { once: true });
  }

  const cleanup = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener("abort", externalAbortHandler);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", offlineHandler);
    }
  };

  try {
    return await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });
  } catch (err) {
    if (abortSource === "timeout") {
      // A slow API/model/TTS endpoint is not evidence of lost connectivity.
      // The de-duplicated probe changes global state only if /api/health also
      // fails.
      void probeNow();
      throw new RequestTimeoutError(timeoutMs);
    }

    if (abortSource === "browser-offline") {
      markOffline();
      throw new OfflineError("Browser reported that the network is offline");
    }

    // The caller chose to cancel. Preserve that cancellation without changing
    // global connectivity state.
    if (externalSignal?.aborted) {
      throw externalSignal.reason ?? err;
    }

    if (
      err instanceof TypeError &&
      /networkerror|network request failed|failed to fetch|fetch failed|load failed/i.test(
        err.message,
      )
    ) {
      markOffline();
      throw new OfflineError(`Network error: ${err.message}`);
    }

    throw err;
  } finally {
    cleanup();
  }
}
