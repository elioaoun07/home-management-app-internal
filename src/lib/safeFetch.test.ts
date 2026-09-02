import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectivity = vi.hoisted(() => ({
  isReallyOnline: vi.fn(() => true),
  markOffline: vi.fn(),
  probeNow: vi.fn(async () => true),
}));

vi.mock("@/lib/connectivityManager", () => connectivity);

import {
  isOfflineError,
  OfflineError,
  RequestTimeoutError,
  safeFetch,
} from "./safeFetch";

function installAbortingFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    ),
  );
}

describe("safeFetch connectivity classification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectivity.isReallyOnline.mockReturnValue(true);
    connectivity.probeNow.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("treats an endpoint timeout as latency, not offline", async () => {
    installAbortingFetch();

    const request = safeFetch("/api/slow", { timeoutMs: 25 });
    const rejection =
      expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(25);
    await rejection;

    expect(connectivity.markOffline).not.toHaveBeenCalled();
    expect(connectivity.probeNow).toHaveBeenCalledOnce();
    expect(isOfflineError(new RequestTimeoutError(25))).toBe(false);
  });

  it("preserves a caller cancellation without changing connectivity", async () => {
    installAbortingFetch();
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");

    const request = safeFetch("/api/cancelled", {
      signal: controller.signal,
      timeoutMs: 100,
    });
    controller.abort(reason);

    await expect(request).rejects.toBe(reason);
    expect(connectivity.markOffline).not.toHaveBeenCalled();
    expect(connectivity.probeNow).not.toHaveBeenCalled();
  });

  it("marks offline when the browser reports an offline event", async () => {
    const browser = new EventTarget();
    vi.stubGlobal("window", browser);
    installAbortingFetch();

    const request = safeFetch("/api/write", { timeoutMs: 100 });
    browser.dispatchEvent(new Event("offline"));

    await expect(request).rejects.toBeInstanceOf(OfflineError);
    expect(connectivity.markOffline).toHaveBeenCalledOnce();
  });

  it("marks offline on a fetch-level network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(safeFetch("/api/write")).rejects.toBeInstanceOf(OfflineError);
    expect(connectivity.markOffline).toHaveBeenCalledOnce();
  });
});
