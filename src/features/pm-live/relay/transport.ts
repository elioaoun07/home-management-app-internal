// src/features/pm-live/relay/transport.ts
// The phone's transport for the shared Command Center views (R63, DLV-104).
//
// Reads come from the relay rows the laptop bridge publishes (scoped by RLS to the
// signed-in owner, and by id to one installation); commands are phone-generated
// relay rows the bridge claims and answers with a receipt. Nothing here talks to
// the laptop directly, and nothing here writes a checklist.
//
// Cache rules: a saved copy is bound to owner, installation and schema; every
// other copy is deleted before anything is shown; a complete live read replaces
// the saved rows (absent rows disappear); a failed read keeps the same owner's
// saved rows and says they are saved.
import type { SupabaseClient } from "@supabase/supabase-js";

import { PendingCommand, PmError, deskOnly, type ConnectionState, type Transport, type TransportEvent } from "../../../../scripts/pm/app/transport";
import type { RunSummary, Snapshot, V2Catalogue, V2Queue, V2RunDetail, V2RunSummary } from "../../../../scripts/pm/app/types";
import {
  RELAY_SCHEMA,
  ROW_KINDS,
  assembleSnapshot,
  bridgeLiveness,
  parseRowId,
  receiptState,
  rowId,
  workerAvailability,
} from "../../../../scripts/pm/relay-shared.mjs";
import { LEGACY_CACHE_KEYS, cacheKey, createIndexedDbStore, loadOwnerCache, purgeForeignOwners, type KeyValueStore } from "./cache";
import { createCommandTracker, type CommandRow, type SyncStorage } from "./commands";

type Row = { id: string; payload: unknown };
type Payload = Record<string, unknown>;

const EVENT_FOR_KIND: Record<string, TransportEvent["type"]> = {
  [ROW_KINDS.MANIFEST]: "data",
  [ROW_KINDS.DOC]: "data",
  [ROW_KINDS.V1RUNS]: "delivery",
  [ROW_KINDS.V2RUNS]: "delivery",
  [ROW_KINDS.V2RUN]: "delivery",
  [ROW_KINDS.ATTENTION]: "delivery",
  [ROW_KINDS.HEARTBEAT]: "connection",
  [ROW_KINDS.CAPABILITIES]: "connection",
};

/** The installation whose bridge was seen most recently; ties go to the first. */
export function chooseInstallation(rows: Row[]) {
  let best: { id: string; seenAt: string } | null = null;
  for (const row of rows) {
    const parsed = parseRowId(row.id);
    if (!parsed || parsed.kind !== ROW_KINDS.HEARTBEAT) continue;
    const seenAt = String((row.payload as Payload | null)?.seenAt || "");
    if (!best || seenAt > best.seenAt) best = { id: parsed.installation_id, seenAt };
  }
  if (best) return best.id;
  const any = rows.map((row) => parseRowId(row.id)).find(Boolean);
  return any ? any.installation_id : null;
}

/** A complete read's rows for one installation — rows it does not contain are gone. */
export function replaceRows(rows: Row[], installationId: string) {
  const map = new Map<string, unknown>();
  for (const row of rows) {
    const parsed = parseRowId(row.id);
    if (parsed && parsed.installation_id === installationId) map.set(row.id, row.payload);
  }
  return map;
}

export function createRelayTransport({
  supabase,
  cacheStore = createIndexedDbStore(),
  storage = typeof window !== "undefined" ? window.localStorage : null,
  now = () => Date.now(),
  reload = () => {
    if (typeof location !== "undefined") location.reload();
  },
  commandWaitMs = 15000,
}: {
  supabase: SupabaseClient;
  cacheStore?: KeyValueStore;
  storage?: SyncStorage | null;
  now?: () => number;
  reload?: () => void;
  commandWaitMs?: number;
}): Transport & { ready: () => Promise<void>; ownerId: () => string | null; installationId: () => string | null } {
  const listeners = new Set<(event: TransportEvent) => void>();
  const emit = (event: TransportEvent) => listeners.forEach((listener) => listener(event));
  let ownerId: string | null = null;
  let installationId: string | null = null;
  let rows = new Map<string, unknown>();
  let liveLoaded = false;
  let loadFailed = false;
  let subscribed = false;
  let everSubscribed = false;
  let savedAt: string | null = null;
  let tracker: ReturnType<typeof createCommandTracker> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveReady: () => void = () => undefined;
  const readyPromise = new Promise<void>((resolve) => (resolveReady = resolve));

  const payloadOf = <T>(kind: string, key: string | null = null): T | null => {
    if (!installationId) return null;
    return (rows.get(rowId(installationId, kind, key)) as T) ?? null;
  };

  function scheduleSave() {
    if (!ownerId || !installationId || !liveLoaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    const owner = ownerId;
    const installation = installationId;
    saveTimer = setTimeout(() => {
      savedAt = new Date(now()).toISOString();
      void cacheStore.set(cacheKey(owner, installation), { savedAt, installation_id: installation, rows: Object.fromEntries(rows) }).catch(() => undefined);
    }, 1500);
  }

  async function fetchRows(ids: string[]) {
    if (!ownerId || !ids.length) return [];
    const { data, error } = await supabase.from("pm_live").select("id, payload").eq("user_id", ownerId).in("id", ids);
    if (error || !data) return [];
    for (const row of data as Row[]) rows.set(row.id, row.payload);
    return data as Row[];
  }

  async function fullLoad() {
    if (!ownerId) return;
    const { data, error } = await supabase.from("pm_live").select("id, payload").eq("user_id", ownerId).like("id", "cc:%");
    if (error || !data) {
      // Keep this owner's saved rows, and say they are saved.
      loadFailed = true;
      emit({ type: "connection" });
      return;
    }
    const all = data as Row[];
    const chosen = chooseInstallation(all);
    loadFailed = false;
    liveLoaded = true;
    if (chosen) {
      installationId = chosen;
      rows = replaceRows(all, chosen);
    } else {
      rows = new Map();
    }
    scheduleSave();
    emit({ type: "data" });
    emit({ type: "delivery" });
    emit({ type: "connection" });
  }

  const commandClient = {
    insert: async (row: { id: string; type: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase.from("pm_commands").insert(row);
      return { error: error ? { code: error.code, message: error.message } : null };
    },
    status: async (id: string) => {
      const { data, error } = await supabase.from("pm_commands").select("id, status, result, error").eq("id", id).maybeSingle();
      return { row: (data as CommandRow | null) ?? null, error: error ? { message: error.message } : null };
    },
  };

  async function send(type: string, id: string, payload: Payload) {
    await readyPromise;
    if (!tracker || !ownerId) throw new PmError("Sign in", 401);
    let outcome;
    try {
      outcome = await tracker.send(id, type, payload, commandWaitMs);
    } catch (error) {
      throw new PmError(error instanceof Error ? error.message : "Refused", 409);
    }
    emit({ type: "connection" });
    if (!outcome.settled) throw new PendingCommand(id, outcome.state === "acknowledged" ? "acknowledged" : outcome.state === "sent" ? "sent" : "unsent");
    const receipt = receiptState(outcome.row);
    if (receipt.state === "done") {
      const result = { ...((outcome.row.result as Payload | null) || {}) };
      delete result.receipt;
      return result;
    }
    if (receipt.state === "refused") throw new PmError(outcome.row.error || "Refused", 409);
    throw new PendingCommand(id, receipt.state === "expired" ? "expired" : "unknown");
  }

  async function start() {
    const { data } = await supabase.auth.getSession();
    ownerId = data.session?.user?.id ?? null;
    // Nothing from another account — or from the unscoped earlier cache — survives.
    await purgeForeignOwners(cacheStore, ownerId).catch(() => undefined);
    for (const key of LEGACY_CACHE_KEYS) storage?.removeItem(key);
    if (!ownerId) {
      resolveReady();
      emit({ type: "connection" });
      return;
    }
    const saved = await loadOwnerCache(cacheStore, ownerId).catch(() => null);
    if (saved) {
      installationId = saved.installation_id;
      rows = new Map(Object.entries(saved.rows));
      savedAt = saved.savedAt;
    }
    tracker = createCommandTracker({ client: commandClient, storage, ownerId });
    await fullLoad();
    resolveReady();
    void tracker.resume().then(() => emit({ type: "connection" }));
  }

  return {
    capabilities: { kind: "relay", planWrites: false, capture: true, v1Launch: false, v1Detail: false, v2: true, pairing: false, apply: true, referenceTools: false },

    ready: () => readyPromise,
    ownerId: () => ownerId,
    installationId: () => installationId,

    start() {
      let stopped = false;
      const channels: ReturnType<SupabaseClient["channel"]>[] = [];
      const cleanup: (() => void)[] = [];
      void start().then(() => {
        if (stopped || !ownerId) return;
        const owner = ownerId;
        const live = supabase
          .channel("pm-relay-live-" + owner)
          .on("postgres_changes", { event: "*", schema: "public", table: "pm_live", filter: "user_id=eq." + owner }, (change) => {
            const record = (change.eventType === "DELETE" ? change.old : change.new) as Partial<Row> | undefined;
            const parsed = record && record.id ? parseRowId(record.id) : null;
            if (!parsed || (installationId && parsed.installation_id !== installationId)) return;
            if (!installationId) installationId = parsed.installation_id;
            if (change.eventType === "DELETE") rows.delete(String(record!.id));
            else if (record!.payload != null) rows.set(String(record!.id), record!.payload);
            else void fetchRows([String(record!.id)]).then(() => emit({ type: EVENT_FOR_KIND[parsed.kind] || "data" }));
            scheduleSave();
            emit({ type: EVENT_FOR_KIND[parsed.kind] || "data" });
          })
          .subscribe((status) => {
            const wasSubscribed = subscribed;
            subscribed = status === "SUBSCRIBED";
            // Back from a dropped connection, or first contact after an offline start:
            // re-read everything and every open receipt.
            if (subscribed && !wasSubscribed && (everSubscribed || loadFailed || !liveLoaded)) void fullLoad().then(() => tracker?.resume());
            if (subscribed) everSubscribed = true;
            emit({ type: "connection" });
          });
        const receipts = supabase
          .channel("pm-relay-receipts-" + owner)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pm_commands", filter: "user_id=eq." + owner }, (change) => {
            const row = change.new as CommandRow | undefined;
            if (row && row.id) tracker?.notify(row);
            emit({ type: "connection" });
          })
          .subscribe();
        channels.push(live, receipts);
        const auth = supabase.auth.onAuthStateChange((_event, session) => {
          const next = session?.user?.id ?? null;
          if (next === owner) return;
          // Another account, or signed out: nothing of this owner's may remain on screen.
          tracker?.clear();
          void purgeForeignOwners(cacheStore, next).finally(reload);
        });
        cleanup.push(() => auth.data.subscription.unsubscribe());
        if (typeof window !== "undefined") {
          const online = () => void fullLoad().then(() => tracker?.resume());
          const visible = () => {
            if (document.visibilityState === "visible") online();
          };
          window.addEventListener("online", online);
          document.addEventListener("visibilitychange", visible);
          cleanup.push(() => window.removeEventListener("online", online));
          cleanup.push(() => document.removeEventListener("visibilitychange", visible));
        }
        const tick = setInterval(() => emit({ type: "connection" }), 5000);
        cleanup.push(() => clearInterval(tick));
      });
      return () => {
        stopped = true;
        channels.forEach((channel) => void supabase.removeChannel(channel));
        cleanup.forEach((fn) => fn());
        if (saveTimer) clearTimeout(saveTimer);
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    connection(): ConnectionState {
      const heartbeat = payloadOf<Payload>(ROW_KINDS.HEARTBEAT);
      const liveness = bridgeLiveness(heartbeat as { seenAt?: string } | null, now());
      const worker = workerAvailability(heartbeat as { availability?: unknown } | null, liveness);
      return {
        online: Boolean(ownerId) && liveLoaded && !loadFailed,
        bridge: { state: liveness.state as "online", seenAt: liveness.seenAt },
        lastAck: tracker ? tracker.lastAck() : { at: null, state: null },
        worker: { state: worker.state, detail: worker.detail ?? null },
        stale: !liveLoaded || loadFailed,
        savedAt,
      };
    },

    async snapshot(): Promise<Snapshot> {
      await readyPromise;
      if (!ownerId) throw new PmError("Sign in", 401);
      const manifest = payloadOf<Payload>(ROW_KINDS.MANIFEST);
      if (!manifest || !installationId) throw new PmError("No laptop has published yet", 503);
      const docs = () =>
        new Map(
          [...rows.entries()]
            .filter(([id]) => parseRowId(id)?.kind === ROW_KINDS.DOC)
            .map(([, payload]) => [String((payload as Payload).relPath), payload as { relPath: string; raw: string; sha: string }]),
        );
      let assembled = assembleSnapshot(manifest, docs());
      if (!assembled.ok && assembled.missing.length && !loadFailed) {
        await fetchRows(assembled.missing.map((relPath: string) => rowId(installationId!, ROW_KINDS.DOC, relPath)));
        assembled = assembleSnapshot(manifest, docs());
      }
      if (!assembled.ok || !assembled.snapshot) throw new PmError("Project incomplete", 503);
      const stale = !liveLoaded || loadFailed;
      return { ...assembled.snapshot, offline: stale, cachedAt: stale ? savedAt : null };
    },

    async v1Runs(): Promise<{ sessions: RunSummary[] }> {
      await readyPromise;
      const payload = payloadOf<{ sessions?: RunSummary[] }>(ROW_KINDS.V1RUNS);
      return { sessions: payload?.sessions || [] };
    },

    async dispatchMode() {
      await readyPromise;
      const capabilities = payloadOf<{ mode?: string }>(ROW_KINDS.CAPABILITIES);
      if (!capabilities?.mode) throw new PmError("No laptop has published yet", 503);
      return { mode: capabilities.mode };
    },

    async mutate<T>(op: string, body: unknown): Promise<T> {
      const input = (body || {}) as Payload;
      // Inbox capture is the one checklist-area write the phone relays.
      if (op === "append" && input.file === "0 - Inbox.md") {
        const text = String(input.line || "").replace(/^\s*-\s*\[ \]\s*/u, "").trim();
        if (!text) throw new PmError("Empty", 400);
        await send("capture", crypto.randomUUID(), { text });
        return { ok: true } as T;
      }
      throw deskOnly();
    },

    read: async () => {
      throw deskOnly();
    },
    post: async () => {
      throw deskOnly();
    },

    async v2Session() {
      await readyPromise;
      return { paired: Boolean(ownerId), actor: ownerId ? "remote" : null, csrf: null };
    },
    v2Pair: async () => {
      throw deskOnly();
    },

    async v2Runs(): Promise<{ runs: V2RunSummary[] }> {
      await readyPromise;
      return { runs: payloadOf<{ runs?: V2RunSummary[] }>(ROW_KINDS.V2RUNS)?.runs || [] };
    },

    async v2Run(id: string): Promise<V2RunDetail> {
      await readyPromise;
      let payload = payloadOf<V2RunDetail & { schema?: string }>(ROW_KINDS.V2RUN, id);
      if (!payload && installationId && !loadFailed) {
        await fetchRows([rowId(installationId, ROW_KINDS.V2RUN, id)]);
        payload = payloadOf<V2RunDetail & { schema?: string }>(ROW_KINDS.V2RUN, id);
      }
      if (!payload) throw new PmError("Unknown run", 404);
      const detail = { ...payload } as V2RunDetail & { schema?: string };
      delete detail.schema;
      return detail;
    },

    // The laptop publishes the queue with the runs row; an item's pre-launch verdict
    // needs the laptop's store and is not relayed, so the phone shows it once queued.
    async v2Queue(): Promise<V2Queue | null> {
      await readyPromise;
      return payloadOf<{ queue?: V2Queue | null }>(ROW_KINDS.V2RUNS)?.queue || null;
    },
    v2Assess: async () => null,
    // Allowance settings are read and changed on the laptop server only.
    v2Allowances: async () => null,
    v2TestGate: async () => null,

    async v2Executors(): Promise<V2Catalogue> {
      await readyPromise;
      const capabilities = payloadOf<{ catalogue?: V2Catalogue | null }>(ROW_KINDS.CAPABILITIES);
      return capabilities?.catalogue || { executors: [], policy: null, refusals: [{ code: "no-capabilities", detail: null }] };
    },

    async v2Command<T>(path: string, body: Record<string, unknown>): Promise<T> {
      await readyPromise;
      const id = String(body.command_id || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) throw new PmError("Command id required", 400);
      if (!installationId) throw new PmError("No laptop has published yet", 503);
      const forwarded = { ...body };
      delete forwarded.command_id;
      return (await send("v2-" + path, id, { schema: RELAY_SCHEMA, installation_id: installationId, body: forwarded })) as T;
    },

    v1SessionHref: (sessionId) => "/pm/live?ui=legacy&view=delivery&session=" + encodeURIComponent(sessionId),
  };
}
