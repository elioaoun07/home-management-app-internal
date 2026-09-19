// Command Center Phase 3 — exclusive dispatch claims, last-moment checks and
// resources that refuse instead of reading unknown as zero (DLV-97, V2-I04/I05).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizeContract, authorizeGrant } from "../../scripts/delivery-v2/contracts.mjs";
import { bindAdapterResult, makeExecutionRef } from "../../scripts/delivery-v2/adapters/adapter.mjs";
import { STORE_SCHEMA_VERSION, openStore } from "../../scripts/delivery-v2/store.mjs";
import {
  ADMISSION_REFUSALS,
  DISPATCH_REFUSALS,
  RESOURCE_REFUSALS,
  admitJob,
  dispatchJob,
  releaseStaleClaims,
  requestStop,
  resourceSummary,
} from "../../scripts/delivery-v2/jobs.mjs";

const CONTRACT = authorizeContract({
  work_id: "w-1",
  source_fingerprint: "sha256:src",
  outcome: "emit 20",
  scratchScope: { include: [] },
  publicationScope: { allowedPaths: ["src/amount.ts"] },
  requestedDisposition: "verified_candidate",
});

const grant = (resource_policy: Record<string, unknown> = { unit: "usd", allowance: null }) =>
  authorizeGrant({
    contract_id: CONTRACT.contract_id,
    contract_revision: CONTRACT.revision,
    permitted_effects: ["native_dispatch"],
    permitted_executors: ["p-1"],
    resource_policy: resource_policy as { unit: string; allowance?: number | null; strict?: boolean },
  });

let ROOT: string;
let store: ReturnType<typeof openStore>;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-claims-"));
  store = openStore({ path: join(ROOT, "supervisor.sqlite") });
  store.insertRun({ run_id: "r-1", work_id: "w-1", contract_id: CONTRACT.contract_id, contract_revision: 1, lifecycle: "ACTIVE" });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  rmSync(ROOT, { recursive: true, force: true });
});

function admit(overrides: Record<string, unknown> = {}) {
  return admitJob({
    store,
    run_id: "r-1",
    contract: CONTRACT,
    grant: grant(),
    profileAdmission: { admitted: true, refusals: [], profile_id: "p-1" },
    backend_id: "fake",
    reservation: { unit: "usd", amount: null, basis: "unknown until observed" },
    instruction: "do it",
    workspace: { root: "/work" },
    command: { command_id: "cmd-" + Math.random().toString(16).slice(2), actor: "owner" },
    ...overrides,
  } as Parameters<typeof admitJob>[0]);
}

function slowAdapter(calls: string[], { throwBeforeMarker = false, delayBeforeMarker = 0 } = {}) {
  const run = async (request: { executionRef: ReturnType<typeof makeExecutionRef> }, options: { onDispatchStart?: (arg: { at: string }) => void } = {}) => {
    calls.push("start");
    if (throwBeforeMarker) throw new Error("unreachable before dispatch");
    // Provisioning, SDK loading: time between taking the claim and the marker,
    // which is exactly where an idempotent marker alone lets a second caller in.
    if (delayBeforeMarker) await new Promise((resolve) => setTimeout(resolve, delayBeforeMarker));
    options.onDispatchStart?.({ at: new Date().toISOString() });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return bindAdapterResult({
      operation: "start",
      executionRef: makeExecutionRef({ ...request.executionRef, native_ref: "n-1" }),
      status: "finished",
      dispatchAttempted: true,
      observations: { usageReadings: [], nativeOutcome: "succeeded" },
    });
  };
  return {
    backend_id: "fake",
    start: run,
    resume: (_prior: unknown, request: { executionRef: ReturnType<typeof makeExecutionRef> }, options = {}) => run(request, options),
    stop: async (ref: ReturnType<typeof makeExecutionRef>) =>
      bindAdapterResult({ operation: "stop", executionRef: ref, status: "unknown", observations: { requested: true, providerConfirmed: false } }),
  };
}

describe("an exclusive claim precedes every provider call", () => {
  it("lets exactly one of two concurrent dispatches reach the provider", async () => {
    const admitted = admit();
    const calls: string[] = [];
    const adapter = slowAdapter(calls, { delayBeforeMarker: 15 });
    const job_id = admitted.job!.job_id;
    const [a, b] = await Promise.all([
      dispatchJob({ store, adapter, job_id, request: admitted.request, claimant: "journey:a" }),
      dispatchJob({ store, adapter, job_id, request: admitted.request, claimant: "journey:b" }),
    ]);
    expect([a.dispatched, b.dispatched].filter(Boolean)).toHaveLength(1);
    const refused = a.dispatched ? b : a;
    expect(refused.refusals![0].code).toBe(DISPATCH_REFUSALS.CLAIM_HELD);
    expect(calls).toEqual(["start"]);
  });

  it("refuses a second dispatch of the same job from the same process", async () => {
    const admitted = admit();
    const calls: string[] = [];
    const adapter = slowAdapter(calls, { delayBeforeMarker: 15 });
    const job_id = admitted.job!.job_id;
    const [a, b] = await Promise.all([
      dispatchJob({ store, adapter, job_id, request: admitted.request, claimant: "journey:same" }),
      dispatchJob({ store, adapter, job_id, request: admitted.request, claimant: "journey:same" }),
    ]);
    expect([a.dispatched, b.dispatched].filter(Boolean)).toHaveLength(1);
    expect(calls).toEqual(["start"]);
  });

  it("returns a claim that never reached its marker, so the same intent can be sent later", async () => {
    const admitted = admit();
    const job_id = admitted.job!.job_id;
    await expect(dispatchJob({ store, adapter: slowAdapter([], { throwBeforeMarker: true }), job_id, request: admitted.request })).rejects.toThrow();
    expect(store.getJob(job_id)!.dispatch_claim).toBeNull();
    const retry = await dispatchJob({ store, adapter: slowAdapter([]), job_id, request: admitted.request });
    expect(retry.dispatched).toBe(true);
  });

  it("releases a stopped supervisor's claim only when no marker was committed", () => {
    const unsent = admit().job!.job_id;
    const sent = admit().job!.job_id;
    store.claimDispatch(unsent, "journey:dead");
    store.claimDispatch(sent, "journey:dead");
    store.markDispatchStarted(sent, new Date().toISOString());
    const released = releaseStaleClaims({ store, claimant: "journey:alive" });
    expect(released).toEqual([unsent]);
    expect(store.getJob(unsent)!.dispatch_claim).toBeNull();
    expect(store.getJob(sent)!.dispatch_claim).toBe("journey:dead");
  });
});

describe("checks at the last moment", () => {
  it("refuses at dispatch time, sends nothing and releases the reservation", async () => {
    const admitted = admit();
    const calls: string[] = [];
    const outcome = await dispatchJob({
      store,
      adapter: slowAdapter(calls),
      job_id: admitted.job!.job_id,
      request: admitted.request,
      preDispatch: async () => ({ ok: false, refusals: [{ code: "stale-selected-source", detail: "changed: source" }] }),
    });
    expect(outcome.dispatched).toBe(false);
    expect(calls).toEqual([]);
    const job = store.getJob(admitted.job!.job_id)!;
    expect(job.status).toBe("finished");
    expect(job.outcome).toBe("cancelled");
    expect(job.reservation_open).toBe(0);
    expect(job.dispatch_started_at).toBeNull();
    expect(String(job.reason)).toMatch(/stale-selected-source/u);
  });

  it("records the checks a dispatch was sent under", async () => {
    const admitted = admit();
    await dispatchJob({
      store,
      adapter: slowAdapter([]),
      job_id: admitted.job!.job_id,
      request: admitted.request,
      claimant: "journey:x",
      preDispatch: async () => ({ ok: true, refusals: [], intent: { source_fingerprint: "sha256:src", grant_revision: 0 } }),
    });
    const intent = JSON.parse(String(store.getJob(admitted.job!.job_id)!.intent_json));
    expect(intent).toMatchObject({ source_fingerprint: "sha256:src", grant_revision: 0, claimant: "journey:x", checked: true });
  });
});

describe("unknown resources never become zero", () => {
  it("refuses a null next reservation under a finite allowance", () => {
    const outcome = admit({ grant: grant({ unit: "usd", allowance: 5 }) });
    expect(outcome.admitted).toBe(false);
    const resources = outcome.refusals.find((entry: { code: string }) => entry.code === ADMISSION_REFUSALS.RESOURCES) as { detail: { code: string }[] };
    expect(resources.detail.map((entry) => entry.code)).toContain(RESOURCE_REFUSALS.UNKNOWN_NEXT);
  });

  it("refuses a reservation in a different unit from its grant", () => {
    const outcome = admit({ grant: grant({ unit: "tokens", allowance: null }) });
    expect(JSON.stringify(outcome.refusals)).toMatch(RESOURCE_REFUSALS.UNIT_MISMATCH);
  });

  it("refuses an open reservation with no amount when the next job is priced", () => {
    const first = admit();
    expect(first.admitted).toBe(true);
    const second = admit({ grant: grant({ unit: "usd", allowance: 5 }), reservation: { unit: "usd", amount: 1, basis: "estimate" } });
    expect(JSON.stringify(second.refusals)).toMatch(RESOURCE_REFUSALS.UNKNOWN_OPEN);
  });

  it("settles token-denominated usage from measured counters", () => {
    const admitted = admit({ grant: grant({ unit: "tokens", allowance: null }), reservation: { unit: "tokens", amount: 1000, basis: "estimate" } });
    store.recordUsageReading(admitted.job!.job_id, { reading_key: "turn:0", unit: "tokens", input: 100, cachedInput: 10, output: 20, reasoningOutput: 5, costUsd: null });
    const summary = resourceSummary(store, { run_id: "r-1", unit: "tokens" });
    expect(summary.settled).toBe(120);
    expect(summary.provenance.measuredTokens).toMatchObject({ input: 100, cachedInput: 10, output: 20, reasoningOutput: 5, total: 120 });
    expect(summary.reserved).toBe(1000);
    expect(summary.unknown).toEqual([]);
    expect(summary.provenance.providerReportedUsd).toBeNull();
  });

  it("keeps a job unknown when one turn was priced and another was not", () => {
    const admitted = admit();
    const job_id = admitted.job!.job_id;
    store.recordUsageReading(job_id, { reading_key: "turn:0", unit: "usd", input: 1, costUsd: 0.01 });
    store.recordUsageReading(job_id, { reading_key: "turn:1", unit: "usd", input: 1, costUsd: null });
    const summary = resourceSummary(store, { run_id: "r-1", unit: "usd" });
    expect(summary.settled).toBeCloseTo(0.01);
    expect(summary.unknown.map((entry: { job_id: string }) => entry.job_id)).toContain(job_id);
    expect(summary.provenance.providerReportedUsd).toBeCloseTo(0.01);
  });
});

describe("a stop is requested until it is observed", () => {
  it("shows Stop requested, then Stopped once the environment confirms", async () => {
    const admitted = admit();
    const job_id = admitted.job!.job_id;
    store.markDispatchStarted(job_id, new Date().toISOString());
    const adapter = slowAdapter([]);
    const first = await requestStop({ store, adapter, job_id, observeStop: async () => ({ stopObserved: false }) });
    expect(first.display).toBe("Stop requested");
    expect(store.getJob(job_id)!.status).toBe("unknown");
    expect(store.getJob(job_id)!.stop_observed_at).toBeNull();
    const second = await requestStop({ store, adapter, job_id, observeStop: async () => ({ stopObserved: true }) });
    expect(second.display).toBe("Stopped");
    const job = store.getJob(job_id)!;
    expect(job.status).toBe("finished");
    expect(job.outcome).toBe("cancelled");
    // Usage nobody read stays reserved.
    expect(job.reservation_open).toBe(1);
  });
});

describe("store migration", () => {
  it("opens a schema-2 store in place and keeps its rows", () => {
    // The same binding the store uses, reached through its handle.
    const Database = store.db.constructor as new (path: string) => { exec: (sql: string) => void; close: () => void };
    store.close();
    const path = join(ROOT, "old.sqlite");
    const db = new Database(path);
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO meta VALUES ('schema_version', '2');
      CREATE TABLE runs (run_id TEXT PRIMARY KEY, work_id TEXT NOT NULL, contract_id TEXT NOT NULL, contract_revision INTEGER NOT NULL,
        grant_id TEXT, grant_revision INTEGER, lifecycle TEXT NOT NULL, closed_outcome TEXT, result_ref TEXT, waiting_reason TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO runs VALUES ('r-old', 'w', 'c', 1, NULL, NULL, 'ACTIVE', NULL, NULL, NULL, 't', 't');
      CREATE TABLE jobs (job_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, purpose TEXT NOT NULL, backend_id TEXT NOT NULL,
        dispatch_key TEXT NOT NULL UNIQUE CHECK (dispatch_key = job_id), native_ref TEXT, status TEXT NOT NULL, outcome TEXT,
        contract_id TEXT NOT NULL, contract_revision INTEGER NOT NULL, grant_id TEXT NOT NULL, grant_revision INTEGER NOT NULL,
        profile_id TEXT, reservation_unit TEXT NOT NULL, reservation_amount REAL, reservation_basis TEXT NOT NULL,
        reservation_open INTEGER NOT NULL DEFAULT 1, dispatch_started_at TEXT, request_json TEXT NOT NULL, observations_json TEXT,
        reason TEXT, publication_revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO jobs (job_id, run_id, purpose, backend_id, dispatch_key, status, contract_id, contract_revision, grant_id, grant_revision,
        reservation_unit, reservation_basis, request_json, created_at, updated_at)
        VALUES ('j-old', 'r-old', 'start', 'codex-exec-sdk', 'j-old', 'unknown', 'c', 1, 'g', 0, 'usd', 'b', '{}', 't', 't');
    `);
    db.close();
    store = openStore({ path });
    expect(store.getRun("r-old")!.lifecycle).toBe("ACTIVE");
    const job = store.getJob("j-old")!;
    expect(job.status).toBe("unknown");
    expect(job.access).toBe("write");
    expect(job.dispatch_claim).toBeNull();
    expect(String(store.db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()!.value)).toBe(String(STORE_SCHEMA_VERSION));
    expect(store.listPlans("r-old")).toEqual([]);
  });
});
