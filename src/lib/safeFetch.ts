// src/lib/safeFetch.ts
// Centralized fetch wrapper with timeout + offline detection.
//
// Solves the "hanging fetch" problem: when you cut WiFi mid-request,
// the browser holds the TCP connection open for 30-60 seconds. During
// that time the promise never resolves or rejects, so the offline queue
// logic never runs. This wrapper forces the fetch to abort after a
// configurable timeout and immediately falls back to the offline path.

import { isReallyOnline, markOffline } from "@/lib/connectivityManager";

/** Default timeout for mutation requests (POST/PATCH/DELETE) */
const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Custom error thrown when a fetch is aborted due to:
 *  - timeout expiring
 *  - browser firing the `offline` event while request was in-flight
 *  - connectivity manager already knowing we're offline
 */
export class OfflineError extends Error {
  constructor(message = "Request failed — network unavailable") {
    super(message);
    this.name = "OfflineError";
  }
}

/**
 * Returns true if the error indicates no network connectivity.
 * Works for AbortError, TypeError ("Failed to fetch"), and our own OfflineError.
 */
export function isOfflineError(err: unknown): boolean {
  if (err instanceof OfflineError) return true;
  if (err instanceof TypeError) return true; // "Failed to fetch" / "NetworkError"
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      /network|failed to fetch|load failed/i.test(err.message))
  )
    return true;
  // Duck-type fallback for non-Error objects (e.g. cross-realm or serialized errors)
  const any = err as Record<string, unknown>;
  if (any?.name === "AbortError" || any?.name === "OfflineError") return true;
  return false;
}

export interface SafeFetchOptions extends RequestInit {
  /** Override the default timeout (ms). Set to 0 to disable. */
  timeoutMs?: number;
}

/**
 * Fetch with built-in offline protection:
 *
 * 1. **Pre-flight check**: If `isReallyOnline()` is false, throws `OfflineError`
 *    immediately — no network request is even attempted.
 *
 * 2. **AbortController timeout**: If the response doesn't arrive within
 *    `timeoutMs` (default 5 s), the request is aborted and `OfflineError` is
 *    thrown so the caller can fall back to the offline queue.
 *
 * 3. **`offline` event listener**: If the browser fires its `offline` event
 *    while the request is in-flight, the request is aborted immediately
 *    (typically < 1 s after WiFi toggle).
 *
 * 4. **`markOffline()` on failure**: When a timeout or network error is
 *    detected, the connectivity manager is notified so the rest of the app
 *    immediately knows we're offline (UI pill, probing cadence, etc.).
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: SafeFetchOptions,
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  // ── Pre-flight: skip the network call entirely if we know we're offline ──
  if (!isReallyOnline()) {
    console.log(
      `[OFFLINE] safeFetch: pre-flight OFFLINE for ${typeof input === "string" ? input : "Request"}`,
    );
    throw new OfflineError("Pre-flight: connectivity manager reports offline");
  }

  console.log(
    `[OFFLINE] safeFetch: attempting ${fetchInit.method || "GET"} ${typeof input === "string" ? input : "Request"} (timeout: ${timeoutMs}ms)`,
  );

  const controller = new AbortController();

  // If the caller already provided a signal, chain them so either can abort.
  if (fetchInit.signal) {
    const externalSignal = fetchInit.signal;
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener(
        "abort",
        () => controller.abort(externalSignal.reason),
        { once: true },
      );
    }
  }

  // ── Trigger 1: Hard timeout ──
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  // ── Trigger 2: Browser offline event (fires nearly instantly on WiFi toggle) ──
  const offlineHandler = () => controller.abort();
  if (typeof window !== "undefined") {
    window.addEventListener("offline", offlineHandler, { once: true });
  }

  try {
    const response = await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });

    // Successful response — clean up and return
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", offlineHandler);
    }

    console.log(
      `[OFFLINE] safeFetch: got response ${response.status} for ${typeof input === "string" ? input : "Request"}`,
    );
    return response;
  } catch (err) {
    // Clean up listeners
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", offlineHandler);
    }

    // Convert any abort / network error into OfflineError and tell the
    // connectivity manager so the entire app transitions to offline mode.
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      console.log(
        `[OFFLINE] safeFetch: ABORTED (timeout/offline event) for ${typeof input === "string" ? input : "Request"}`,
      );
      markOffline();
      throw new OfflineError("Request aborted — treating as offline");
    }

    if (err instanceof TypeError) {
      console.log(
        `[OFFLINE] safeFetch: TypeError "${err.message}" for ${typeof input === "string" ? input : "Request"}`,
      );
      // "Failed to fetch", "NetworkError when attempting to fetch resource"
      markOffline();
      throw new OfflineError(`Network error: ${err.message}`);
    }

    // Unknown error — don't swallow it
    throw err;
  }
}
