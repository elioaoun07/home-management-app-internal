// Command Center Phase 4 — the phone relay's recovery and security contract (DLV-104, R63).
//
// Pure cores are tested directly. The bridge itself is driven with an in-memory
// Supabase double (same query shapes the bridge uses, a status CHECK that can be
// "before" or "after" the owner's migration, injectable failures) over the REAL V2
// journey, store and routes from the Phase 3/4 fixtures. Nothing reaches Supabase,
// a provider, a container or production.
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBridge } from "../scripts/pm/bridge.mjs";
import { walk } from "../scripts/pm/scan.mjs";
import {
  RELAY_SCHEMA,
  ROW_KINDS,
  assembleSnapshot,
  attentionItems,
  bridgeLiveness,
  parseRowId,
  receiptState,
  rowId,
  workerAvailability,
} from "../scripts/pm/relay-shared.mjs";
import {
  acquireRelayLock,
  availabilitySummary,
  buildCorpusRows,
  capRunDetail,
  createAttentionLedger,
  createCommandJournal,
  findSecrets,
  reconcileClaimedCommand,
} from "../scripts/pm/relay.mjs";
import { createDeliveryContext } from "../scripts/delivery/server-routes.mjs";
import { openStore } from "../scripts/delivery-v2/store.mjs";
import { setDispatchMode } from "../scripts/delivery-v2/entry.mjs";
import { PM_REL, BOOK, SELECT, bookPathIn, journeyFor, makeHarness, plannedRun, seedRoot, writePolicy, type Loose } from "./delivery-v2/fixtures/v2-harness";

const INST = "inst-0123456789ab";
const OWNER = "8a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";

// ---------------------------------------------------------------------------
// Pure cores
// ---------------------------------------------------------------------------

describe("relay rows", () => {
  it("scopes every row to one installation and parses it back", () => {
    const id = rowId(INST, ROW_KINDS.DOC, "Budget/4 - Checklist.md");
    expect(id).toBe("cc:inst-0123456789ab:doc:Budget/4 - Checklist.md");
    expect(parseRowId(id)).toEqual({ installation_id: INST, kind: "doc", key: "Budget/4 - Checklist.md" });
    expect(parseRowId("tasks")).toBeNull();
    expect(() => rowId("laptop", ROW_KINDS.HEARTBEAT)).toThrow();
  });

  it("assembles a snapshot only when every document matches the manifest", () => {
    const data = { generatedAt: "2026-09-12T10:00:00.000Z", cancelledLog: "", files: [{ relPath: "a.md", raw: "A", mtimeMs: 1 }, { relPath: "b.md", raw: "B", mtimeMs: 2 }] };
    const rows = buildCorpusRows({ data, installation_id: INST });
    const docs = new Map(rows.upserts.map((row) => [row.payload.relPath, row.payload]));
    expect(assembleSnapshot(rows.manifest.payload, docs)).toMatchObject({ ok: true, snapshot: { files: [{ relPath: "a.md", raw: "A" }, { relPath: "b.md", raw: "B" }] } });
    docs.set("b.md", { ...docs.get("b.md")!, raw: "B2", sha: "sha256:other" });
    expect(assembleSnapshot(rows.manifest.payload, docs)).toMatchObject({ ok: false, missing: ["b.md"] });
    docs.delete("a.md");
    expect(assembleSnapshot(rows.manifest.payload, docs).ok).toBe(false);
  });

  it("re-sends only changed documents and deletes the ones that disappeared", () => {
    const first = buildCorpusRows({ data: { generatedAt: "t1", files: [{ relPath: "a.md", raw: "A" }, { relPath: "b.md", raw: "B" }] }, installation_id: INST });
    const second = buildCorpusRows({ data: { generatedAt: "t2", files: [{ relPath: "a.md", raw: "A" }, { relPath: "c.md", raw: "C" }] }, installation_id: INST, previous: first.shas });
    expect(second.upserts.map((row) => row.payload.relPath)).toEqual(["c.md"]);
    expect(second.deletes).toEqual([rowId(INST, ROW_KINDS.DOC, "b.md")]);
    expect(second.manifest.payload.files.map((file: Loose) => file.relPath)).toEqual(["a.md", "c.md"]);
  });

  it("caps a large run detail and names what it dropped", () => {
    const detail = { ok: true, events: Array.from({ length: 400 }, (_, i) => ({ seq: i, kind: "x", data: "y".repeat(400) })), activity: [], messages: [], plans: [], applications: [] };
    const capped = capRunDetail(detail, 20_000);
    expect(capped.events.length).toBe(15);
    expect(capped.truncated).toContain("events");
  });
});

describe("receipts", () => {
  it("distinguishes not acknowledged, acknowledged, done, refused and unknown", () => {
    expect(receiptState(null).state).toBe("unsent");
    expect(receiptState({ status: "pending" }).state).toBe("sent");
    expect(receiptState({ status: "claimed" }).state).toBe("acknowledged");
    expect(receiptState({ status: "claimed", result: { outcome_unknown: true } }).state).toBe("unknown");
    expect(receiptState({ status: "done", result: { ok: true } })).toMatchObject({ state: "done" });
    expect(receiptState({ status: "failed", error: "stale" })).toMatchObject({ state: "refused", error: "stale" });
    expect(receiptState({ status: "unknown" }).state).toBe("unknown");
  });
});

describe("secret guard", () => {
  it("names secret values and credential shapes, never the values themselves", () => {
    const env = { CRON_SECRET: "cron-secret-value-123456", ANTHROPIC_API_KEY: undefined };
    const serviceJwt =
      "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase" })).toString("base64url") + ".c2lnbmF0dXJlLXZhbHVl";
    const hits = findSecrets("x cron-secret-value-123456 " + serviceJwt + " sk-ant-api03-abcdefghijklmnopqrstuvwxyz", env, ["bridge-token-abcdefgh"]);
    expect(hits).toEqual(expect.arrayContaining(["env:CRON_SECRET", "shape:service-role-jwt", "shape:anthropic-key"]));
    expect(hits.join(" ")).not.toContain("cron-secret-value");
    expect(findSecrets("the variable is called CRON_SECRET", env)).toEqual([]);
    expect(findSecrets("token bridge-token-abcdefgh", env, ["bridge-token-abcdefgh"])).toEqual(["credential:0"]);
  });
});

describe("command journal and reconciliation", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pm-relay-journal-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("executes only what never started, reports what was effected, and never re-runs", () => {
    const journal = createCommandJournal({ dir });
    const v1 = { id: "c-v1", type: "pause" };
    const v2 = { id: "c-v2", type: "v2-decision" };
    expect(reconcileClaimedCommand(v1, journal).action).toBe("skip");
    journal.record(v1.id, "claimed", { type: v1.type });
    expect(reconcileClaimedCommand(v1, journal).action).toBe("execute");
    journal.record(v1.id, "started", { type: v1.type });
    expect(reconcileClaimedCommand(v1, journal)).toMatchObject({ action: "unknown", outcome: { outcome_unknown: true } });

    journal.record(v2.id, "claimed", { type: v2.type });
    journal.record(v2.id, "started", { type: v2.type });
    expect(reconcileClaimedCommand(v2, journal, { commandState: () => ({ recorded: false }) }).action).toBe("unknown");
    expect(reconcileClaimedCommand(v2, journal, { commandState: () => ({ recorded: true, outcome: { ok: true, decision_id: "d-1" } }) })).toMatchObject({
      action: "report",
      recovered: true,
      outcome: { ok: true, decision_id: "d-1" },
    });
    journal.record(v2.id, "effected", { outcome: { ok: true, decision_id: "d-1" } });
    expect(reconcileClaimedCommand(v2, journal)).toMatchObject({ action: "report", outcome: { decision_id: "d-1" } });
    journal.record(v2.id, "reported");
    expect(reconcileClaimedCommand(v2, journal).action).toBe("skip");

    // Survives a restart, including a torn final line from a crash.
    writeFileSync(journal.path, "{\"id\":\"c-torn\",\"phase\":\"clai", { flag: "a" });
    const reloaded = createCommandJournal({ dir });
    expect(reloaded.stateOf("c-v2")!.phases).toEqual(["claimed", "started", "effected", "reported"]);
    expect(reloaded.stateOf("c-torn")).toBeNull();
  });

  it("holds one drainer per checkout", () => {
    expect(acquireRelayLock({ dir, pid: 101, installation_id: INST, isAlive: () => true }).acquired).toBe(true);
    expect(acquireRelayLock({ dir, pid: 202, installation_id: INST, isAlive: () => true })).toEqual({ acquired: false, holder: 101 });
    expect(acquireRelayLock({ dir, pid: 202, installation_id: INST, isAlive: () => false }).acquired).toBe(true);
  });
});

describe("connectivity, acknowledgement and worker availability are separate facts", () => {
  it("never reports a stale bridge's last worker state as current", () => {
    const now = Date.parse("2026-09-12T10:00:30.000Z");
    const heartbeat = { seenAt: "2026-09-12T10:00:25.000Z", availability: { state: "ready", executors: [] } };
    expect(bridgeLiveness(heartbeat, now).state).toBe("online");
    expect(workerAvailability(heartbeat, bridgeLiveness(heartbeat, now)).state).toBe("ready");
    const later = now + 60_000;
    expect(bridgeLiveness(heartbeat, later).state).toBe("stale");
    expect(workerAvailability(heartbeat, bridgeLiveness(heartbeat, later)).state).toBe("unknown");
    expect(bridgeLiveness(null, now).state).toBe("never");
  });

  it("classifies the executor catalogue without inventing readiness", () => {
    const executor = (over: Loose = {}) => ({ id: "claude", label: "Claude", permitted: true, qualified: true, available: true, qualification: { refusals: [] }, ...over });
    expect(availabilitySummary({ mode: "v2", catalogue: null }).state).toBe("not-configured");
    expect(availabilitySummary({ mode: "v2", catalogue: { policy: {}, executors: [executor()], refusals: [{ code: "no-worker-runtime-configured" }] } }).state).toBe("not-configured");
    expect(
      availabilitySummary({ mode: "v2", catalogue: { policy: {}, executors: [executor({ qualified: false, qualification: { refusals: [{ code: "runtime-binding-unavailable" }] } })], refusals: [] } }).state,
    ).toBe("unavailable");
    expect(availabilitySummary({ mode: "v2", catalogue: { policy: {}, executors: [executor({ qualified: false })], refusals: [] } }).state).toBe("not-qualified");
    expect(availabilitySummary({ mode: "v2", catalogue: { policy: {}, executors: [executor()], refusals: [] } })).toMatchObject({ state: "ready", dispatchable: true });
    expect(availabilitySummary({ mode: "v1", catalogue: { policy: {}, executors: [executor()], refusals: [] } }).dispatchable).toBe(false);
    expect(availabilitySummary({ mode: "v2", catalogue: null, error: "docker not running" })).toMatchObject({ state: "unavailable", detail: "docker not running" });
  });
});

describe("attention", () => {
  it("keys items by decision or result revision and pushes each once, across restarts", () => {
    const dir = mkdtempSync(join(tmpdir(), "pm-relay-attention-"));
    try {
      const run = (revision: number, extra: Loose = {}) => ({
        summary: { run_id: "r-1", title: "Emit 20", updated_at: "t" },
        detail: { ok: true, run: { lifecycle: "WAITING" }, plans: [{ plan_id: "p-" + revision, revision, status: "proposed" }], questions: [], jobs: [], ownerAction: { kind: "review-plan" }, ...extra },
      });
      expect(attentionItems([run(1)]).map((item) => item.key)).toEqual(["plan:p-1@r1"]);
      const file = join(dir, "attention.json");
      const ledger = createAttentionLedger({ file });
      expect(ledger.isNew()).toBe(true);
      ledger.markSent(attentionItems([run(1)]).map((item) => item.key));
      const restarted = createAttentionLedger({ file });
      expect(restarted.unsent(attentionItems([run(1)]))).toEqual([]);
      expect(restarted.unsent(attentionItems([run(2)])).map((item) => item.key)).toEqual(["plan:p-2@r2"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// The bridge over a Supabase double and the real V2 journey
// ---------------------------------------------------------------------------

type Filter = [string, string, unknown];

function createFakeSupabase({ allowedStatuses }: { allowedStatuses: string[] }) {
  const tables: Record<string, Map<string, Loose>> = { pm_live: new Map(), pm_commands: new Map() };
  const failures: { table: string; op: string; when: (state: Loose) => boolean; times: number }[] = [];

  function from(table: string) {
    const state: Loose = { op: "select", cols: "*", patch: null, rows: null, filters: [] as Filter[], order: null, limit: null, returning: false };
    const matches = (row: Loose) =>
      (state.filters as Filter[]).every(([kind, col, value]) => {
        if (kind === "eq") return row[col] === value;
        if (kind === "in") return (value as unknown[]).includes(row[col]);
        const pattern = new RegExp("^" + String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/%/gu, ".*") + "$", "u");
        return pattern.test(String(row[col]));
      });
    const project = (row: Loose) => {
      if (state.cols === "*") return { ...row };
      const out: Loose = {};
      for (const part of String(state.cols).split(",").map((entry) => entry.trim())) {
        const alias = /^(\w+):payload->>(\w+)$/u.exec(part);
        if (alias) out[alias[1]] = row.payload ? row.payload[alias[2]] ?? null : null;
        else out[part] = row[part];
      }
      return out;
    };
    const run = () => {
      const map = tables[table];
      const failure = failures.find((entry) => entry.table === table && entry.op === state.op && entry.times > 0 && entry.when(state));
      if (failure) {
        failure.times -= 1;
        return { data: null, error: { message: "injected failure", code: "XX000" } };
      }
      if (state.op === "upsert") {
        for (const row of state.rows) map.set(row.id, { ...(map.get(row.id) || {}), ...row });
        return { data: null, error: null };
      }
      if (state.op === "insert") {
        for (const row of state.rows) {
          if (map.has(row.id)) return { data: null, error: { code: "23505", message: "duplicate key" } };
          map.set(row.id, { status: "pending", result: null, error: null, created_at: new Date().toISOString(), ...row });
        }
        return { data: null, error: null };
      }
      const selected = [...map.values()].filter(matches);
      if (state.op === "update") {
        if (table === "pm_commands" && state.patch.status && !allowedStatuses.includes(state.patch.status)) {
          return { data: null, error: { code: "23514", message: "violates check constraint pm_commands_status_check" } };
        }
        for (const row of selected) Object.assign(row, state.patch);
        return { data: state.returning ? selected.map((row) => ({ id: row.id })) : null, error: null };
      }
      if (state.op === "delete") {
        for (const row of selected) map.delete(row.id);
        return { data: null, error: null };
      }
      let out = selected;
      if (state.order) out = [...out].sort((a, b) => String(a[state.order[0]]).localeCompare(String(b[state.order[0]])));
      if (state.limit) out = out.slice(0, state.limit);
      return { data: out.map(project), error: null };
    };
    const api: Loose = {
      select(cols = "*") {
        if (state.op === "select") state.cols = cols;
        else state.returning = true;
        return api;
      },
      upsert(rows: Loose | Loose[]) {
        state.op = "upsert";
        state.rows = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      insert(rows: Loose | Loose[]) {
        state.op = "insert";
        state.rows = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      update(patch: Loose) {
        state.op = "update";
        state.patch = patch;
        return api;
      },
      delete() {
        state.op = "delete";
        return api;
      },
      eq(col: string, value: unknown) {
        state.filters.push(["eq", col, value]);
        return api;
      },
      like(col: string, value: string) {
        state.filters.push(["like", col, value]);
        return api;
      },
      in(col: string, values: unknown[]) {
        state.filters.push(["in", col, values]);
        return api;
      },
      order(col: string) {
        state.order = [col];
        return api;
      },
      limit(n: number) {
        state.limit = n;
        return api;
      },
      then(resolve: (value: unknown) => void, reject: (error: unknown) => void) {
        try {
          resolve(run());
        } catch (error) {
          reject(error);
        }
      },
    };
    return api;
  }

  const channel = { on: () => channel, subscribe: () => channel };
  return { tables, failures, from, channel: () => channel, removeChannel: () => undefined };
}

describe("the bridge relays V2 commands exactly once", () => {
  let ROOT: string;
  let DATA: string;
  let store: ReturnType<typeof openStore>;
  let seq = 0;
  const cmd = () => "cmd-" + ++seq;
  const env = {
    PM_OWNER_USER_ID: OWNER,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value-0000000000",
    CRON_SECRET: "cron-secret-value-0000000000",
  };

  beforeEach(() => {
    seq = 0;
    ROOT = mkdtempSync(join(tmpdir(), "pm-relay-root-"));
    DATA = mkdtempSync(join(tmpdir(), "pm-relay-data-"));
    seedRoot(ROOT);
    writePolicy(ROOT);
    writeFileSync(join(ROOT, ".gitignore"), "/.delivery/\n", "utf8");
    store = openStore({ path: join(ROOT, ".delivery", "v2", "supervisor.sqlite") });
  });
  afterEach(() => {
    try {
      store.close();
    } catch {
      /* closed */
    }
    rmSync(ROOT, { recursive: true, force: true });
    rmSync(DATA, { recursive: true, force: true });
  });

  function bridgeFor({ supabase, journey, pushes = [] as Loose[] }: { supabase: ReturnType<typeof createFakeSupabase>; journey: Loose; pushes?: Loose[] }) {
    const PM_DIR = join(ROOT, PM_REL);
    const deliveryCtx = createDeliveryContext({
      ROOT,
      PM_DIR,
      PM_REL,
      gitStatusPorcelain: () => "",
      gitRevParseHead: () => "fixture-head",
      runValidation: async () => ({ ok: true, results: {} }),
      spawnRunner: () => {},
    });
    const deliveryV2Ctx = {
      root: ROOT,
      allowedOrigins: [],
      journey,
      hasStore: () => true,
      describeExecutors: async () => ({ executors: [{ id: "claude", label: "Claude", permitted: true, qualified: true, available: true }], policy: { policy_revision: 1 }, refusals: [] }),
    };
    const buildData = () => ({ generatedAt: new Date().toISOString(), cancelledLog: "", files: walk(PM_DIR).map((file: Loose) => ({ relPath: file.relPath, raw: file.raw, mtimeMs: file.mtimeMs })) });
    const bridge = createBridge({
      PM_DIR,
      deliveryCtx,
      deliveryV2Ctx,
      buildData,
      env,
      createClientImpl: () => supabase,
      pushImpl: async (push: Loose) => void pushes.push(push),
    }) as Loose;
    bridge.enableDrainForTest();
    return bridge;
  }

  const insertCommand = (supabase: ReturnType<typeof createFakeSupabase>, type: string, body: Loose, installation_id: string, id = randomUUID()) => {
    supabase.tables.pm_commands.set(id, { id, user_id: OWNER, type, payload: { installation_id, body }, status: "pending", result: null, error: null, created_at: new Date().toISOString() });
    return id;
  };

  it("runs a phone approval once through the bridge credential; a replayed row reports its receipt", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    const { run_id, plan } = await plannedRun(journey, cmd());
    const bridge = bridgeFor({ supabase, journey });
    const id = insertCommand(supabase, "v2-decision", { run_id, plan_id: plan.plan_id, plan_revision: plan.revision, contract_revision: 1, decision: "approve", command_id: "ignored" }, bridge.installation_id);

    await bridge.drainOnce();
    await journey.idle();
    const row = supabase.tables.pm_commands.get(id)!;
    expect(receiptState(row).state).toBe("done");
    const decisions = store.listDecisions(run_id).filter((entry: Loose) => entry.kind === "plan-approval");
    expect(decisions).toHaveLength(1);
    expect(decisions[0].actor).toBe("remote:supabase:" + OWNER);
    expect(store.getCommand(id)).not.toBeNull();
    const jobsAfterApproval = store.listJobs(run_id).length;

    // The same row comes back pending: its receipt is re-reported, the approval is not repeated.
    Object.assign(row, { status: "pending", result: null });
    await bridge.drainOnce();
    await journey.idle();
    expect(receiptState(supabase.tables.pm_commands.get(id)!)).toMatchObject({ state: "done", outcome: { recovered: true } });
    expect(store.listDecisions(run_id).filter((entry: Loose) => entry.kind === "plan-approval")).toHaveLength(1);
    expect(store.listJobs(run_id)).toHaveLength(jobsAfterApproval);
  });

  it("prepares from the phone without a job and replays launch and approval exactly once", async () => {
    setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
    const material = { outcome: "The control emits 20", scope: ["src/amount.ts"], steps: ["Change the constant to 20"], acceptance: ["The control emits 20"], invariants: ["Keep configuration unchanged"], exclusions: ["No other controls"], checks: ["amount-check"], risks: [], unknowns: [], dependencies: [], risk: "low", ownerReviewed: true, provenance: "Owner-reviewed fixture" };
    writeFileSync(bookPathIn(ROOT), BOOK.replace("\n## Delivery session log", "\n**Touches:** `src/amount.ts`\n```delivery-plan-v1\n" + JSON.stringify(material) + "\n```\n\n## Delivery session log"));
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    const h = makeHarness(ROOT);
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: h });
    const bridge = bridgeFor({ supabase, journey });
    const launchId = insertCommand(supabase, "v2-deliver", { ...SELECT, executor: "claude", model: "claude-test", effort: "low", workProfile: "focused" }, bridge.installation_id);
    await bridge.drainOnce(); await journey.idle();
    expect(receiptState(supabase.tables.pm_commands.get(launchId)!), JSON.stringify(supabase.tables.pm_commands.get(launchId))).toMatchObject({ state: "done" });
    expect(h.calls).toHaveLength(0);
    const run = store.listRuns()[0];
    expect(store.listJobs(String(run.run_id))).toHaveLength(0);
    Object.assign(supabase.tables.pm_commands.get(launchId)!, { status: "pending", result: null });
    await bridge.drainOnce(); await journey.idle();
    expect(store.listRuns()).toHaveLength(1);
    const plan = journey.detail(String(run.run_id)).plans[0];
    const approveId = insertCommand(supabase, "v2-decision", { run_id: run.run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve" }, bridge.installation_id);
    await bridge.drainOnce(); await journey.idle();
    expect(h.calls).toHaveLength(1);
    Object.assign(supabase.tables.pm_commands.get(approveId)!, { status: "pending", result: null });
    await bridge.drainOnce(); await journey.idle();
    expect(h.calls).toHaveLength(1);
    expect(store.listDecisions(String(run.run_id)).filter((d: Loose) => d.kind === "plan-approval")).toHaveLength(1);
  });

  it("recovers a command whose receipt was lost when the bridge died, without running it again", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    const { run_id, plan } = await plannedRun(journey, cmd());
    const first = bridgeFor({ supabase, journey });
    const id = insertCommand(supabase, "v2-decision", { run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve" }, first.installation_id);
    // The effect happens; the receipt write fails as if the process died right there.
    supabase.failures.push({ table: "pm_commands", op: "update", when: (state) => state.patch.status === "done", times: 1 });
    await first.drainOnce();
    await journey.idle();
    expect(supabase.tables.pm_commands.get(id)!.status).toBe("claimed");
    const jobs = store.listJobs(run_id).length;

    const restarted = bridgeFor({ supabase, journey });
    await restarted.reconcileClaimed();
    await journey.idle();
    expect(receiptState(supabase.tables.pm_commands.get(id)!)).toMatchObject({ state: "done", outcome: { recovered: true } });
    expect(store.listDecisions(run_id).filter((entry: Loose) => entry.kind === "plan-approval")).toHaveLength(1);
    expect(store.listJobs(run_id)).toHaveLength(jobs);
  });

  it("recovers a command that was mid-effect from the supervisor store, and reports unknown when nothing was recorded", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    const { run_id } = await plannedRun(journey, cmd());
    const bridge = bridgeFor({ supabase, journey });
    const journal = createCommandJournal({ dir: join(ROOT, ".delivery", "pm-relay") });

    // Recorded in the store (the journey finished), never effected in the journal.
    const recorded = randomUUID();
    await journey.message({ run_id, body: "keep the old label", command_id: recorded, actor: "remote:supabase:" + OWNER });
    supabase.tables.pm_commands.set(recorded, { id: recorded, user_id: OWNER, type: "v2-message", payload: { installation_id: bridge.installation_id, body: { run_id, body: "keep the old label" } }, status: "claimed", created_at: "1" });
    journal.record(recorded, "claimed", { type: "v2-message" });
    journal.record(recorded, "started", { type: "v2-message" });

    // Started in the journal, nothing in the store: the effect is not established.
    const inFlight = randomUUID();
    supabase.tables.pm_commands.set(inFlight, { id: inFlight, user_id: OWNER, type: "v2-control", payload: { installation_id: bridge.installation_id, body: { run_id, action: "pause" } }, status: "claimed", created_at: "2" });
    journal.record(inFlight, "claimed", { type: "v2-control" });
    journal.record(inFlight, "started", { type: "v2-control" });

    const restarted = bridgeFor({ supabase, journey });
    await restarted.reconcileClaimed();
    expect(receiptState(supabase.tables.pm_commands.get(recorded)!)).toMatchObject({ state: "done", outcome: { recovered: true } });
    expect(store.listMessages(run_id)).toHaveLength(1);
    expect(receiptState(supabase.tables.pm_commands.get(inFlight)!).state).toBe("unknown");
    expect(store.getRun(run_id)!.waiting_reason).not.toBe("paused");
  });

  it("keeps an unknown outcome visible before the owner's migration allows the status", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired"] });
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    await plannedRun(journey, cmd());
    const bridge = bridgeFor({ supabase, journey });
    const journal = createCommandJournal({ dir: join(ROOT, ".delivery", "pm-relay") });
    const id = randomUUID();
    supabase.tables.pm_commands.set(id, { id, user_id: OWNER, type: "pause", payload: { sessionId: "s-1" }, status: "claimed", created_at: "1" });
    journal.record(id, "claimed", { type: "pause" });
    journal.record(id, "started", { type: "pause" });
    await bridge.reconcileClaimed();
    const row = supabase.tables.pm_commands.get(id)!;
    expect(row.status).toBe("claimed");
    expect(receiptState(row).state).toBe("unknown");
  });

  it("leaves another installation's command pending", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    const { run_id } = await plannedRun(journey, cmd());
    const bridge = bridgeFor({ supabase, journey });
    const id = insertCommand(supabase, "v2-control", { run_id, action: "pause" }, "inst-ffffffffffff");
    await bridge.drainOnce();
    expect(supabase.tables.pm_commands.get(id)!.status).toBe("pending");
    expect(store.getRun(run_id)!.waiting_reason).not.toBe("paused");
  });

  it("publishes the corpus, capabilities, runs and heartbeat without any secret value", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    writeFileSync(join(ROOT, PM_REL, "0 - Inbox.md"), "# Inbox\n\n## New\n\n- [ ] pasted " + env.CRON_SECRET + " by mistake\n", "utf8");
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    await plannedRun(journey, cmd());
    const bridge = bridgeFor({ supabase, journey });
    await bridge.publishCorpus();
    await bridge.publishCapabilities();
    await bridge.publishV2();
    await bridge.publishHeartbeat();

    const rows = [...supabase.tables.pm_live.values()];
    const manifest = rows.find((row) => parseRowId(row.id)?.kind === ROW_KINDS.MANIFEST)!;
    expect(manifest.payload.schema).toBe(RELAY_SCHEMA);
    expect(manifest.payload.withheld).toEqual(["0 - Inbox.md"]);
    const docs = new Map(rows.filter((row) => parseRowId(row.id)?.kind === ROW_KINDS.DOC).map((row) => [row.payload.relPath, row.payload]));
    expect(assembleSnapshot(manifest.payload, docs).ok).toBe(true);
    expect(rows.some((row) => parseRowId(row.id)?.kind === ROW_KINDS.V2RUN)).toBe(true);
    // The Phase 5 queue rides the runs row.
    const runsRow = rows.find((row) => parseRowId(row.id)?.kind === ROW_KINDS.V2RUNS)!;
    expect(runsRow.payload.queue).toMatchObject({ writers: { used: 0, max: 2 }, jobs: { max: 3 } });
    const heartbeat = rows.find((row) => parseRowId(row.id)?.kind === ROW_KINDS.HEARTBEAT)!;
    expect(heartbeat.payload.availability).toMatchObject({ state: "ready" });
    expect(heartbeat.payload.drain.enabled).toBe(true);
    const everything = JSON.stringify(rows);
    for (const value of [env.CRON_SECRET, env.NEXT_SUPABASE_SERVICE_ROLE_KEY]) expect(everything).not.toContain(value);
  });

  it("pushes a waiting plan once per revision, and not again after a restart", async () => {
    const supabase = createFakeSupabase({ allowedStatuses: ["pending", "claimed", "done", "failed", "expired", "unknown"] });
    const journey = journeyFor({ root: ROOT, data: DATA, store, harness: makeHarness(ROOT) });
    mkdirSync(join(ROOT, ".delivery", "pm-relay"), { recursive: true });
    const pushes: Loose[] = [];
    const bridge = bridgeFor({ supabase, journey, pushes });
    await bridge.publishV2(); // seeds the ledger with nothing
    const { run_id, plan } = await plannedRun(journey, cmd());
    await bridge.publishV2();
    await bridge.publishV2();
    expect(pushes.map((push) => push.tag)).toEqual(["pm-plan:" + plan.plan_id + "@r1"]);
    expect(pushes[0].url).toBe("/pm/live#/delivery/run/" + run_id);

    const restarted = bridgeFor({ supabase, journey, pushes });
    await restarted.publishV2();
    expect(pushes).toHaveLength(1);

    await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "revise", feedback: "name the file", command_id: cmd(), actor: "owner" });
    await journey.idle();
    await restarted.publishV2();
    expect(pushes.map((push) => push.tag)).toEqual(["pm-plan:" + plan.plan_id + "@r1", "pm-plan:" + journey.detail(run_id).plans[1].plan_id + "@r2"]);
  });
});
