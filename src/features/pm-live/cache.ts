// src/features/pm-live/cache.ts
// Offline cold-open cache for the legacy /pm/live view (?ui=legacy). The page is
// an installed PWA whose service worker serves it offline, so without this it
// would open to an empty shell whenever the phone is out of signal.
//
// Command Center Phase 4 (DLV-104): the copy is bound to one owner. The earlier
// unscoped copy is deleted, and so is any other owner's, before anything is read.
// The writer trims and size-guards: localStorage is a shared ~5 MB origin budget.

import type { PmLiveSnapshots } from "./store";
import type { SessionSnapshot } from "./types";

const CACHE_PREFIX = "pm-live-cache-v3:";
const UNSCOPED_KEYS = ["pm-live-cache-v2", "pm-live-cache-v1"];
const MAX_CACHE_BYTES = 1_500_000;
/** The live snapshot keeps 40 tail events; the cache only needs enough to show context. */
const CACHED_EVENTS_TAIL = 10;

export interface CachedState extends PmLiveSnapshots {
  cachedAt: string;
}

export const cacheKeyFor = (ownerId: string) => CACHE_PREFIX + ownerId;

/** Remove every cached copy that is not this owner's. With no owner, remove them all. */
export function purgeOtherOwners(ownerId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    for (const key of UNSCOPED_KEYS) storage.removeItem(key);
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(CACHE_PREFIX) && (!ownerId || key !== cacheKeyFor(ownerId))) doomed.push(key);
    }
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    // storage unavailable: nothing was cached either
  }
}

export function loadCache(ownerId: string): Partial<PmLiveSnapshots> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKeyFor(ownerId));
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

export function saveCache(ownerId: string, snapshots: PmLiveSnapshots) {
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
      window.localStorage.removeItem(cacheKeyFor(ownerId));
      return;
    }
    window.localStorage.setItem(cacheKeyFor(ownerId), serialized);
  } catch {
    // best-effort; a full quota or private-mode failure just skips offline caching
  }
}
