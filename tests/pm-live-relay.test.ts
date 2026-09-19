// Command Center Phase 4 — the phone side of the relay (DLV-104, R63).
//
// Owner/installation/schema-bound cache, durable command intents with receipt
// recovery, and the relay transport the shared views mount on /pm/live — driven
// with an in-memory Supabase double. No network, no production data.
import { describe, expect, it } from "vitest";

import { RELAY_SCHEMA, ROW_KINDS, rowId } from "../scripts/pm/relay-shared.mjs";
import { PendingCommand } from "../scripts/pm/app/transport";
import { LEGACY_CACHE_KEYS, cacheKey, createMemoryStore, keysToPurge, loadOwnerCache, purgeForeignOwners } from "../src/features/pm-live/relay/cache";
import { createCommandTracker, type CommandRow } from "../src/features/pm-live/relay/commands";
import { chooseInstallation, createRelayTransport, replaceRows } from "../src/features/pm-live/relay/transport";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const OWNER_A = "aaaaaaaa-0000-4000-8000-000000000001";
const OWNER_B = "bbbbbbbb-0000-4000-8000-000000000002";
const INST = "inst-0123456789ab";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

describe("owner-bound cache", () => {
  it("purges every copy that is not this owner's under this schema", async () => {
    const store = createMemoryStore();
    const own = cacheKey(OWNER_A, INST);
    const other = cacheKey(OWNER_B, INST);
    const oldSchema = "pm-relay-cache:pm-relay@1:" + OWNER_A + ":" + INST;
    for (const key of [own, other, oldSchema]) await store.set(key, { savedAt: "2026-09-12T10:00:00Z", installation_id: INST, rows: { x: 1 } });
    expect(keysToPurge([own, other, oldSchema, "unrelated"], OWNER_A).sort()).toEqual([oldSchema, other].sort());
    await purgeForeignOwners(store, OWNER_A);
    expect(await store.keys()).toEqual([own]);
    expect((await loadOwnerCache(store, OWNER_A))!.rows).toEqual({ x: 1 });
    await purgeForeignOwners(store, null);
    expect(await store.keys()).toEqual([]);
  });

  it("keeps only the chosen installation's rows from a complete read", () => {
    const rows = [
      { id: rowId(INST, ROW_KINDS.HEARTBEAT), payload: { seenAt: "2026-09-12T10:00:00Z" } },
      { id: rowId("inst-ffffffffffff", ROW_KINDS.HEARTBEAT), payload: { seenAt: "2026-09-11T10:00:00Z" } },
      { id: rowId("inst-ffffffffffff", ROW_KINDS.V2RUNS), payload: { runs: [] } },
      { id: "tasks", payload: {} },
    ];
    expect(chooseInstallation(rows)).toBe(INST);
    expect([...replaceRows(rows, INST).keys()]).toEqual([rowId(INST, ROW_KINDS.HEARTBEAT)]);
  });
});

function fakeCommandClient() {
  const rows = new Map<string, CommandRow & { type: string; payload: Loose }>();
  const inserts: string[] = [];
  let offline = false;
  return {
    rows,
    inserts,
    setOffline: (value: boolean) => (offline = value),
    client: {
      insert: async (row: { id: string; type: string; payload: Loose }) => {
        inserts.push(row.id);
        if (offline) return { error: { message: "TypeError: Failed to fetch" } };
        if (rows.has(row.id)) return { error: { code: "23505", message: "duplicate key" } };
        rows.set(row.id, { id: row.id, type: row.type, payload: row.payload, status: "pending", result: null, error: null });
        return { error: null };
      },
      status: async (id: string) => ({ row: rows.get(id) ?? null, error: null }),
    },
  };
}

describe("durable command intents", () => {
  it("reuses one command id across retries and never reports a timeout as a failure", async () => {
    const fake = fakeCommandClient();
    const storage = memoryStorage();
    const tracker = createCommandTracker({ client: fake.client, storage, ownerId: OWNER_A, pollMs: 5 });
    const first = await tracker.send("11111111-1111-4111-8111-111111111111", "v2-decision", { body: {} }, 30);
    expect(first).toMatchObject({ settled: false, state: "sent" });

    // The bridge claims it: acknowledged, still not a failure.
    Object.assign(fake.rows.get("11111111-1111-4111-8111-111111111111")!, { status: "claimed" });
    const second = await tracker.send("11111111-1111-4111-8111-111111111111", "v2-decision", { body: {} }, 30);
    expect(second).toMatchObject({ settled: false, state: "acknowledged" });
    expect(fake.rows.size).toBe(1);

    // Its receipt arrives over realtime while a retry waits.
    const waiting = tracker.send("11111111-1111-4111-8111-111111111111", "v2-decision", { body: {} }, 2000);
    const row = fake.rows.get("11111111-1111-4111-8111-111111111111")!;
    Object.assign(row, { status: "done", result: { ok: true, decision_id: "d-1" } });
    tracker.notify(row);
    expect(await waiting).toMatchObject({ settled: true, state: "done" });
    expect(tracker.lastAck().state).toBe("done");

    // A reload finds the settled intent without sending again.
    const reloaded = createCommandTracker({ client: fake.client, storage, ownerId: OWNER_A, pollMs: 5 });
    const replay = await reloaded.send("11111111-1111-4111-8111-111111111111", "v2-decision", { body: {} }, 30);
    expect(replay).toMatchObject({ settled: true, state: "done" });
    expect(fake.inserts).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });

  it("keeps an intent sent while offline and lands it once on resume", async () => {
    const fake = fakeCommandClient();
    const tracker = createCommandTracker({ client: fake.client, storage: memoryStorage(), ownerId: OWNER_A, pollMs: 5 });
    fake.setOffline(true);
    expect(await tracker.send("22222222-2222-4222-8222-222222222222", "v2-control", { body: { action: "pause" } }, 20)).toMatchObject({ settled: false, state: "unsent" });
    expect(fake.rows.size).toBe(0);
    fake.setOffline(false);
    await tracker.resume();
    await tracker.resume();
    expect(fake.rows.size).toBe(1);
    expect(tracker.intents()[0].phase).toBe("sent");
  });

  it("settles on refused and unknown receipts", async () => {
    const fake = fakeCommandClient();
    const tracker = createCommandTracker({ client: fake.client, storage: null, ownerId: OWNER_A, pollMs: 5 });
    const id = "33333333-3333-4333-8333-333333333333";
    const pending = tracker.send(id, "v2-apply", {}, 500);
    await new Promise((resolve) => setTimeout(resolve, 10));
    Object.assign(fake.rows.get(id)!, { status: "claimed", result: { outcome_unknown: true } });
    expect(await pending).toMatchObject({ settled: true, state: "unknown" });
  });
});

// ---------------------------------------------------------------------------
// The relay transport over a Supabase double
// ---------------------------------------------------------------------------

function fakeSupabase({ ownerId, liveRows, failSelect = false }: { ownerId: string | null; liveRows: Loose[]; failSelect?: boolean }) {
  const commands = new Map<string, Loose>();
  const state = { failSelect, liveRows };
  const from = (table: string) => {
    const filters: [string, string, unknown][] = [];
    let op = "select";
    let insertRow: Loose | null = null;
    let single = false;
    const run = () => {
      if (table === "pm_live") {
        if (state.failSelect) return { data: null, error: { message: "network" } };
        const data = state.liveRows.filter((row) =>
          filters.every(([kind, col, value]) =>
            kind === "eq" ? row[col] === value : kind === "in" ? (value as unknown[]).includes(row[col]) : String(row[col]).startsWith(String(value).replace(/%$/u, "")),
          ),
        );
        return { data: data.map((row) => ({ id: row.id, payload: row.payload })), error: null };
      }
      if (op === "insert") {
        if (commands.has(insertRow!.id)) return { data: null, error: { code: "23505", message: "duplicate" } };
        commands.set(insertRow!.id, { ...insertRow, user_id: ownerId, status: "pending", result: null, error: null });
        return { data: null, error: null };
      }
      const rows = [...commands.values()].filter((row) => filters.every(([, col, value]) => row[col] === value));
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const api: Loose = {
      select: () => api,
      eq: (col: string, value: unknown) => (filters.push(["eq", col, value]), api),
      in: (col: string, value: unknown[]) => (filters.push(["in", col, value]), api),
      like: (col: string, value: string) => (filters.push(["like", col, value]), api),
      insert: (row: Loose) => ((op = "insert"), (insertRow = row), api),
      maybeSingle: () => ((single = true), api),
      then: (resolve: (value: unknown) => void) => resolve(run()),
    };
    return api;
  };
  const channel = { on: () => channel, subscribe: (callback?: (status: string) => void) => (callback?.("SUBSCRIBED"), channel) };
  return {
    commands,
    state,
    client: {
      auth: {
        getSession: async () => ({ data: { session: ownerId ? { user: { id: ownerId } } : null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from,
      channel: () => channel,
      removeChannel: async () => undefined,
    },
  };
}

function publishedRows(ownerId: string, { seenAt = new Date().toISOString(), runs = ["r-live"] } = {}) {
  const raw = "# Budget — Checklist\n\n## Now\n\n- [ ] **BUD-14** quick-amount control emits 20 _(friction - S)_\n";
  const sha = "sha256:budget";
  const row = (kind: string, payload: Loose, key: string | null = null) => ({ id: rowId(INST, kind, key), user_id: ownerId, payload: { schema: RELAY_SCHEMA, ...payload } });
  return [
    row(ROW_KINDS.MANIFEST, { installation_id: INST, generatedAt: seenAt, files: [{ relPath: "Budget/4 - Checklist.md", sha, bytes: raw.length, mtimeMs: 1 }], cancelledLog: "" }),
    row(ROW_KINDS.DOC, { relPath: "Budget/4 - Checklist.md", raw, sha, mtimeMs: 1 }, "Budget/4 - Checklist.md"),
    row(ROW_KINDS.HEARTBEAT, { installation_id: INST, seenAt, availability: { state: "ready", executors: [] } }),
    row(ROW_KINDS.CAPABILITIES, { mode: "v2", catalogue: { executors: [], policy: null, refusals: [] } }),
    row(ROW_KINDS.V2RUNS, { runs: runs.map((run_id) => ({ run_id })) }),
    ...runs.map((run_id) => row(ROW_KINDS.V2RUN, { ok: true, run: { run_id } }, run_id)),
  ];
}

describe("relay transport", () => {
  it("shows no previous owner's copy after an account switch", async () => {
    const cacheStore = createMemoryStore();
    await cacheStore.set(cacheKey(OWNER_A, INST), { savedAt: "2026-09-11T10:00:00Z", installation_id: INST, rows: Object.fromEntries(publishedRows(OWNER_A, { runs: ["r-owner-a"] }).map((row) => [row.id, row.payload])) });
    const storage = memoryStorage();
    storage.setItem(LEGACY_CACHE_KEYS[0], "{\"tasks\":{}}");
    // Signed in as B, offline: nothing of A's may appear.
    const supabase = fakeSupabase({ ownerId: OWNER_B, liveRows: [], failSelect: true });
    const transport = createRelayTransport({ supabase: supabase.client as never, cacheStore, storage, commandWaitMs: 20 });
    const stop = transport.start();
    await transport.ready();
    await expect(transport.v2Run("r-owner-a")).rejects.toMatchObject({ status: 404 });
    await expect(transport.snapshot()).rejects.toBeTruthy();
    expect(await cacheStore.keys()).toEqual([]);
    expect(storage.getItem(LEGACY_CACHE_KEYS[0])).toBeNull();
    stop();
  });

  it("reads the V2 queue from the relayed runs row and leaves the pre-launch verdict to the laptop", async () => {
    const queue = {
      limits: { maxWriters: 2, maxJobs: 3, fleetAllowance: null, unit: "usd" },
      writers: { used: 1, max: 2 },
      jobs: { used: 1, max: 3 },
      running: [],
      waiting: [],
      decisions: [],
      candidates: [],
      applying: null,
      pairs: [],
      unknown: { jobs: [], reservationsWithoutAmount: 0 },
      nativeAgents: 0,
    };
    const rows = publishedRows(OWNER_A).map((row) => (row.id === rowId(INST, ROW_KINDS.V2RUNS) ? { ...row, payload: { ...row.payload, queue } } : row));
    const live = fakeSupabase({ ownerId: OWNER_A, liveRows: rows });
    const transport = createRelayTransport({ supabase: live.client as never, cacheStore: createMemoryStore(), storage: memoryStorage(), commandWaitMs: 20 });
    const stop = transport.start();
    await transport.ready();
    expect(await transport.v2Queue()).toMatchObject({ writers: { used: 1, max: 2 }, jobs: { used: 1, max: 3 } });
    expect(await transport.v2Assess("Budget/4 - Checklist.md", "BUD-14")).toBeNull();
    stop();
  });

  it("replaces saved rows with a complete read, and keeps them, marked saved, when the read fails", async () => {
    const cacheStore = createMemoryStore();
    await cacheStore.set(cacheKey(OWNER_A, INST), { savedAt: "2026-09-11T10:00:00Z", installation_id: INST, rows: Object.fromEntries(publishedRows(OWNER_A, { runs: ["r-gone", "r-live"] }).map((row) => [row.id, row.payload])) });

    const live = fakeSupabase({ ownerId: OWNER_A, liveRows: publishedRows(OWNER_A, { runs: ["r-live"] }) });
    const fresh = createRelayTransport({ supabase: live.client as never, cacheStore, storage: memoryStorage(), commandWaitMs: 20 });
    const stopFresh = fresh.start();
    await fresh.ready();
    expect((await fresh.v2Runs()).runs.map((run) => run.run_id)).toEqual(["r-live"]);
    await expect(fresh.v2Run("r-gone")).rejects.toMatchObject({ status: 404 });
    expect((await fresh.snapshot()).offline).toBe(false);
    expect(fresh.connection()).toMatchObject({ online: true, stale: false });
    stopFresh();

    const failing = fakeSupabase({ ownerId: OWNER_A, liveRows: [], failSelect: true });
    const offline = createRelayTransport({ supabase: failing.client as never, cacheStore, storage: memoryStorage(), commandWaitMs: 20 });
    const stopOffline = offline.start();
    await offline.ready();
    const snapshot = await offline.snapshot();
    expect(snapshot).toMatchObject({ offline: true, cachedAt: "2026-09-11T10:00:00Z" });
    expect(snapshot.files.map((file) => file.relPath)).toEqual(["Budget/4 - Checklist.md"]);
    expect(offline.connection()).toMatchObject({ online: false, stale: true, savedAt: "2026-09-11T10:00:00Z" });
    stopOffline();
  });

  it("binds a V2 command to its installation, reports a missing receipt as pending, and resolves the same id later", async () => {
    const supabase = fakeSupabase({ ownerId: OWNER_A, liveRows: publishedRows(OWNER_A) });
    const transport = createRelayTransport({ supabase: supabase.client as never, cacheStore: createMemoryStore(), storage: memoryStorage(), commandWaitMs: 30 });
    const stop = transport.start();
    await transport.ready();
    const command_id = "44444444-4444-4444-8444-444444444444";
    const body = { run_id: "r-live", plan_id: "p-1", plan_revision: 1, contract_revision: 1, decision: "approve", command_id };
    const pending = (await transport.v2Command("decision", body).catch((error: unknown) => error)) as PendingCommand;
    expect(pending).toBeInstanceOf(PendingCommand);
    expect(pending.state).toBe("sent");
    const row = supabase.commands.get(command_id)!;
    expect(row).toMatchObject({ type: "v2-decision", payload: { schema: RELAY_SCHEMA, installation_id: INST, body: { run_id: "r-live", decision: "approve", contract_revision: 1 } } });
    expect(row.payload.body.command_id).toBeUndefined();

    Object.assign(row, { status: "done", result: { ok: true, decision_id: "d-1", receipt: { installation_id: INST } } });
    await expect(transport.v2Command("decision", body)).resolves.toEqual({ ok: true, decision_id: "d-1" });
    expect(supabase.commands.size).toBe(1);

    Object.assign(row, { status: "failed", error: "plan-superseded" });
    stop();
  });

  it("keeps bridge, acknowledgement and worker availability apart", async () => {
    const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const supabase = fakeSupabase({ ownerId: OWNER_A, liveRows: publishedRows(OWNER_A, { seenAt: stale }) });
    const transport = createRelayTransport({ supabase: supabase.client as never, cacheStore: createMemoryStore(), storage: memoryStorage(), commandWaitMs: 20 });
    const stop = transport.start();
    await transport.ready();
    const connection = transport.connection();
    expect(connection.online).toBe(true);
    expect(connection.bridge.state).toBe("stale");
    expect(connection.worker.state).toBe("unknown");
    expect(connection.lastAck.at).toBeNull();
    // Checklist writes stay at the desk; capture is relayed.
    expect(transport.capabilities).toMatchObject({ kind: "relay", planWrites: false, capture: true, v1Detail: false, apply: true, pairing: false });
    await expect(transport.mutate("toggle", {})).rejects.toMatchObject({ status: 501 });
    stop();
  });
});
