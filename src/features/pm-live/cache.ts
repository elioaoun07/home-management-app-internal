// src/features/pm-live/cache.ts
// Offline cold-open cache for /pm/live. The page is an installed PWA whose
// service worker serves it offline, so without this it would open to an empty
// shell whenever the phone is out of signal.
//
// The payload grew when rollups/history landed, so the writer now trims and
// size-guards instead of blindly stringifying: localStorage is a shared ~5 MB
// origin budget, and this page must never be the thing that evicts it.

import type { PmLiveSnapshots } from "./store";
import type { SessionSnapshot } from "./types";

const CACHE_KEY = "pm-live-cache-v2"; // v1 predates the rollups/history rows
const MAX_CACHE_BYTES = 1_500_000;
/** The live snapshot keeps 40 tail events; the cache only needs enough to show context. */
const CACHED_EVENTS_TAIL = 10;

export interface CachedState extends PmLiveSnapshots {
  cachedAt: string;
}

export function loadCache(): Partial<PmLiveSnapshots> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedState;
    return {
      tasks: parsed.tasks ?? null,
      rollups: parsed.rollups ?? null,
      history: parsed.history ?? null,
      fleet: parsed.fleet ?? null,
      sessions: parsed.sessions ?? {},
      bridge: parsed.bridge ?? null,
    };
  } catch {
    return null;
  }
}

function trimSessions(sessions: Record<string, SessionSnapshot>): Record<string, SessionSnapshot> {
  const out: Record<string, SessionSnapshot> = {};
  for (const [id, session] of Object.entries(sessions || {})) {
    out[id] = { ...session, eventsTail: (session.eventsTail || []).slice(-CACHED_EVENTS_TAIL) };
  }
  return out;
}

export function saveCache(snapshots: PmLiveSnapshots) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedState = {
      ...snapshots,
      sessions: trimSessions(snapshots.sessions),
      cachedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    // Better to cold-open empty than to blow the origin's quota and take other
    // features' caches down with us.
    if (serialized.length > MAX_CACHE_BYTES) {
      window.localStorage.removeItem(CACHE_KEY);
      return;
    }
    window.localStorage.setItem(CACHE_KEY, serialized);
  } catch {
    // best-effort; a full quota or private-mode failure just skips offline caching
  }
}
