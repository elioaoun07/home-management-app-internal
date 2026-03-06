// src/lib/connectivityManager.ts
// Active connectivity detection that doesn't trust navigator.onLine
//
// Problem: On many devices/browsers, navigator.onLine stays `true` for seconds
// (or forever) after WiFi is toggled off. This module uses real HTTP probes
// to detect actual connectivity, and exposes a shared reactive signal.

const PROBE_URL = "/api/health";
const PROBE_TIMEOUT_MS = 3000;

/** How often to probe when we think we're online (ms) */
const ONLINE_PROBE_INTERVAL = 30_000; // 30s

/** How often to probe when we think we're offline (ms) */
const OFFLINE_PROBE_INTERVAL = 5_000; // 5s — check more often to detect recovery

/** Custom event fired when our real connectivity state changes */
const CONNECTIVITY_EVENT = "connectivity-changed";

type ConnectivityState = {
  /** True when we have verified or believe we can reach the server */
  online: boolean;
  /** Timestamp of last successful probe */
  lastOnline: number;
  /** Timestamp of last failed probe */
  lastOffline: number;
};

let state: ConnectivityState = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastOnline: Date.now(),
  lastOffline: 0,
};

let probeTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

// ── Public API ──────────────────────────────────────────────

/** Is the app actually online (based on active probes, not just navigator.onLine)? */
export function isReallyOnline(): boolean {
  return state.online;
}

/**
 * Called by any code that detected a network failure (e.g. fetch timeout).
 * Immediately transitions to offline state without waiting for a probe.
 */
export function markOffline(): void {
  if (!state.online) return; // already offline
  state.online = false;
  state.lastOffline = Date.now();
  notify();
  // Switch to faster polling to detect recovery
  restartProbing();
}

/**
 * Force a connectivity probe right now this instant.
 * Returns the result.
 */
export async function probeNow(): Promise<boolean> {
  const result = await doProbe();
  const changed = result !== state.online;
  state.online = result;
  if (result) {
    state.lastOnline = Date.now();
  } else {
    state.lastOffline = Date.now();
  }
  if (changed) {
    notify();
    restartProbing();
  }
  return result;
}

/** Start the background probing loop. Call once from SyncProvider. */
export function startProbing(): void {
  if (started) return;
  started = true;

  // Listen to browser online/offline events as hints (but verify with probe)
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("offline", handleBrowserOffline);
  }

  // Start interval
  restartProbing();

  // Do an immediate probe on startup so the state is accurate from the start
  probeNow();
}

/** Stop probing (cleanup). */
export function stopProbing(): void {
  started = false;
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleBrowserOnline);
    window.removeEventListener("offline", handleBrowserOffline);
  }
}

// ── Internals ───────────────────────────────────────────────

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONNECTIVITY_EVENT, { detail: { online: state.online } }),
    );
  }
}

function restartProbing() {
  if (probeTimer) clearInterval(probeTimer);
  const interval = state.online
    ? ONLINE_PROBE_INTERVAL
    : OFFLINE_PROBE_INTERVAL;
  probeTimer = setInterval(async () => {
    const result = await doProbe();
    const changed = result !== state.online;
    state.online = result;
    if (result) {
      state.lastOnline = Date.now();
    } else {
      state.lastOffline = Date.now();
    }
    if (changed) {
      notify();
      restartProbing(); // adjust interval
    }
  }, interval);
}

/**
 * Perform a lightweight HEAD request to /api/health to test real connectivity.
 * Returns true if the server responds within PROBE_TIMEOUT_MS.
 */
async function doProbe(): Promise<boolean> {
  // Quick check: if browser says offline, trust it (it's never wrong in that direction)
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(PROBE_URL, {
      method: "HEAD",
      signal: controller.signal,
      // Bypass service worker cache – we need a real network response
      cache: "no-store",
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

function handleBrowserOnline() {
  // Browser thinks we're online — verify with a probe
  // Small delay for network stack to actually be ready
  setTimeout(() => probeNow(), 500);
}

function handleBrowserOffline() {
  // Browser says offline — trust this immediately (it's never a false negative)
  state.online = false;
  state.lastOffline = Date.now();
  notify();
  restartProbing();
}
