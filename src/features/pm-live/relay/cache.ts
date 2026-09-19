// src/features/pm-live/relay/cache.ts
// Owner-, installation- and schema-bound offline copy of the relay rows.
//
// Command Center Phase 4 (DLV-104): a saved copy belongs to exactly one owner and
// one laptop installation under one relay schema. Anything else found on the
// device — another account's copy, an older schema, the unscoped legacy cache — is
// deleted before a single row is shown.
import { RELAY_SCHEMA } from "../../../../scripts/pm/relay-shared.mjs";

export const RELAY_CACHE_PREFIX = "pm-relay-cache:";
/** Unscoped caches from the earlier /pm/live app. They name no owner, so they never survive a relay start. */
export const LEGACY_CACHE_KEYS = ["pm-live-cache-v2", "pm-live-cache-v1"];

export interface RelayCacheEntry {
  savedAt: string;
  installation_id: string;
  rows: Record<string, unknown>;
}

export interface KeyValueStore {
  keys(): Promise<string[]>;
  get(key: string): Promise<RelayCacheEntry | undefined>;
  set(key: string, value: RelayCacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

export function cacheKey(ownerId: string, installationId: string) {
  return RELAY_CACHE_PREFIX + RELAY_SCHEMA + ":" + ownerId + ":" + installationId;
}

export function parseCacheKey(key: string): { schema: string; ownerId: string; installationId: string } | null {
  if (!key.startsWith(RELAY_CACHE_PREFIX)) return null;
  const rest = key.slice(RELAY_CACHE_PREFIX.length);
  const [schema, ownerId, installationId] = [rest.slice(0, rest.indexOf(":")), ...rest.slice(rest.indexOf(":") + 1).split(":")];
  if (!schema || !ownerId || !installationId) return null;
  return { schema, ownerId, installationId };
}

/** Keys that must not survive for this owner: other owners, other schemas, malformed. */
export function keysToPurge(keys: string[], ownerId: string | null) {
  return keys.filter((key) => {
    if (!key.startsWith(RELAY_CACHE_PREFIX)) return false;
    const parsed = parseCacheKey(key);
    return !parsed || !ownerId || parsed.ownerId !== ownerId || parsed.schema !== RELAY_SCHEMA;
  });
}

export async function purgeForeignOwners(store: KeyValueStore, ownerId: string | null) {
  const doomed = keysToPurge(await store.keys(), ownerId);
  await Promise.all(doomed.map((key) => store.delete(key)));
  return doomed;
}

/** The newest saved copy this owner has, from any of their installations. */
export async function loadOwnerCache(store: KeyValueStore, ownerId: string) {
  let best: RelayCacheEntry | null = null;
  for (const key of await store.keys()) {
    const parsed = parseCacheKey(key);
    if (!parsed || parsed.ownerId !== ownerId || parsed.schema !== RELAY_SCHEMA) continue;
    const entry = await store.get(key);
    if (entry && (!best || entry.savedAt > best.savedAt)) best = entry;
  }
  return best;
}

export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, RelayCacheEntry>();
  return {
    keys: async () => [...map.keys()],
    get: async (key) => map.get(key),
    set: async (key, value) => void map.set(key, value),
    delete: async (key) => void map.delete(key),
  };
}

/** IndexedDB-backed store; falls back to memory where IndexedDB is unavailable (private mode, tests). */
export function createIndexedDbStore(name = "pm-relay"): KeyValueStore {
  if (typeof indexedDB === "undefined") return createMemoryStore();
  let opened: Promise<IDBDatabase> | null = null;
  const db = () =>
    (opened ||= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("entries");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  const run = async <T,>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) => {
    const database = await db();
    return new Promise<T>((resolve, reject) => {
      const request = work(database.transaction("entries", mode).objectStore("entries"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  const fallback = createMemoryStore();
  const guard = async <T,>(work: () => Promise<T>, backup: () => Promise<T>) => {
    try {
      return await work();
    } catch {
      return backup();
    }
  };
  return {
    keys: () => guard(async () => (await run("readonly", (store) => store.getAllKeys())).map(String), fallback.keys),
    get: (key) => guard(() => run("readonly", (store) => store.get(key) as IDBRequest<RelayCacheEntry | undefined>), () => fallback.get(key)),
    set: (key, value) => guard(async () => void (await run("readwrite", (store) => store.put(value, key))), () => fallback.set(key, value)),
    delete: (key) => guard(async () => void (await run("readwrite", (store) => store.delete(key))), () => fallback.delete(key)),
  };
}
