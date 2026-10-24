// Owner-authorized support jobs and the three-way usage report (sign-off plan,
// Phase 1). R44's 25 local Codex dispatches ran outside every allowance with no
// recorded model, turns or cache. Here: zero automatic support jobs, one job per
// authorization, normalized usage, unknown stays unknown, and Delivery / Support /
// Chat overhead are reported separately. Offline; no provider is involved.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeDeliveryV2, setDispatchMode } from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import {
  accountingReport,
  admitSupportJob,
  authorizeSupport,
  closeSupport,
  recordChatOverhead,
  settleSupportJob,
  supportFor,
} from "../../scripts/delivery-v2/support-ledger.mjs";
import { acceptStewardRequest, updateStewardRequest } from "../../scripts/delivery-v2/steward-requests.mjs";
import { renderAccounting } from "../../scripts/delivery-v2/steward-tools.mjs";
import type { Loose } from "./fixtures/v2-harness";

const AT = "2026-10-24T12:00:00.000Z";
let root: string;
let store: ReturnType<typeof openStore>;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "era-support-"));
  store = openStore({ path: join(root, ".delivery", "v2", "supervisor.sqlite"), now: () => AT });
});
afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

const authorization = (overrides: Loose = {}) => ({
  command_id: randomUUID(),
  subject: { run_id: "r-1" },
  purpose: "repair the checker environment after a setup failure",
  scope: ["scripts/delivery-v2/worker-boundary.mjs"],
  executor: "codex",
  model_tier: "CODEX_LOW",
  effort: "low",
  allowance_tokens: 100_000,
  ...overrides,
});
const authorized = (overrides: Loose = {}) => {
  const input = authorization(overrides);
  const outcome = authorizeSupport(store, input, "owner", AT) as Loose;
  expect(outcome.ok).toBe(true);
  return input;
};
const reading = (input: number, output: number, cachedInput = 0, turn = 0) => ({ turn, usage: { input, cachedInput, output, reasoningOutput: 0 } });

function seedRun(run_id: string, readings: Loose[], { cost = null as number | null, unknownJob = false } = {}) {
  store.insertRun({ run_id, work_id: "w-1", contract_id: "c-1", contract_revision: 1 });
  const job_id = "j-" + run_id;
  store.insertJob({
    job_id, dispatch_key: job_id, run_id, purpose: "implementation", backend_id: "codex-exec-sdk", contract_id: "c-1", contract_revision: 1,
    grant_id: "g-1", grant_revision: 1, reservation: { unit: "tokens", amount: 600000, basis: "fixture" }, request: {},
  });
  readings.forEach((entry, index) => store.recordUsageReading(job_id, { reading_key: "k" + index, unit: "tokens", ...entry, costUsd: cost, observed_at: AT }));
  if (!unknownJob) store.updateJob(job_id, { status: "finished", outcome: "succeeded", reservation_open: false });
  return job_id;
}

describe("authorization", () => {
  it("records scope, model tier, effort and an allowance, once per command id", () => {
    const input = authorization();
    const first = authorizeSupport(store, input, "owner", AT) as Loose;
    expect(first).toMatchObject({ ok: true, repeated: false, authorization: { state: "authorized", max_jobs: 1, allowance: { unit: "tokens", amount: 100_000 }, model_tier: "CODEX_LOW", effort: "low" } });
    expect((authorizeSupport(store, input, "owner", AT) as Loose).repeated).toBe(true);
    expect((authorizeSupport(store, { ...input, allowance_tokens: 999 }, "owner", AT) as Loose).refusals[0].code).toBe("support-command-conflict");
    expect((authorizeSupport(store, input, "someone-else", AT) as Loose).refusals[0].code).toBe("support-command-conflict");
    expect(supportFor(store, { run_id: "r-1" })).toHaveLength(1);
  });

  it.each([
    ["no link to a run or request", { subject: {} }],
    ["no scope", { scope: [] }],
    ["an unknown executor", { executor: "gemini" }],
    ["no model tier", { model_tier: "" }],
    ["a zero allowance", { allowance_tokens: 0 }],
    ["more than three jobs", { max_jobs: 4 }],
  ])("refuses %s", (_label, overrides) => {
    expect((authorizeSupport(store, authorization(overrides), "owner", AT) as Loose).refusals[0].code).toBe("support-request-invalid");
  });
});

describe("there are no automatic support jobs", () => {
  it("admits nothing without a prior owner authorization", () => {
    expect(admitSupportJob(store, { authorization_id: "never-authorized", job_id: "j-x" }, AT)).toMatchObject({ ok: false, refusals: [{ code: "support-not-authorized" }] });
  });

  it("admits one job per authorization and refuses a second without a new owner decision", () => {
    const { command_id } = authorized();
    expect(admitSupportJob(store, { authorization_id: command_id, job_id: "j-1" }, AT)).toMatchObject({ ok: true });
    expect((admitSupportJob(store, { authorization_id: command_id, job_id: "j-1" }, AT) as Loose).repeated).toBe(true);

    settleSupportJob(store, { authorization_id: command_id, job_id: "j-1", usage: { semantics: "per-turn", readings: [reading(1000, 200)] }, stop_reason: "completed" }, AT);
    const second = admitSupportJob(store, { authorization_id: command_id, job_id: "j-2" }, AT) as Loose;
    expect(second.ok).toBe(false);
    expect(second.refusals.map((entry: Loose) => entry.code)).toEqual(["support-job-limit-reached"]);
  });

  it("blocks a further job while an earlier one has unknown usage, and says both reasons", () => {
    const { command_id } = authorized({ max_jobs: 2 });
    admitSupportJob(store, { authorization_id: command_id, job_id: "j-1" }, AT);
    const stillRunning = admitSupportJob(store, { authorization_id: command_id, job_id: "j-2" }, AT) as Loose;
    expect(stillRunning.refusals.map((entry: Loose) => entry.code)).toContain("support-usage-unknown");

    // The job ended and reported nothing: unknown, not free.
    settleSupportJob(store, { authorization_id: command_id, job_id: "j-1", usage: null, stop_reason: "error" }, AT);
    const afterSilence = admitSupportJob(store, { authorization_id: command_id, job_id: "j-2" }, AT) as Loose;
    expect(afterSilence.refusals.map((entry: Loose) => entry.code)).toEqual(["support-usage-unknown"]);
  });

  it("stops admitting once the allowance is spent, and when the owner closes it", () => {
    const { command_id } = authorized({ max_jobs: 3, allowance_tokens: 1_000 });
    admitSupportJob(store, { authorization_id: command_id, job_id: "j-1" }, AT);
    settleSupportJob(store, { authorization_id: command_id, job_id: "j-1", usage: { semantics: "per-turn", readings: [reading(900, 300)] }, stop_reason: "completed" }, AT);
    expect((admitSupportJob(store, { authorization_id: command_id, job_id: "j-2" }, AT) as Loose).refusals.map((entry: Loose) => entry.code)).toContain("support-allowance-exhausted");

    const other = authorized({ max_jobs: 3 });
    expect(closeSupport(store, { authorization_id: other.command_id }, AT)).toMatchObject({ ok: true });
    expect((admitSupportJob(store, { authorization_id: other.command_id, job_id: "j-3" }, AT) as Loose).refusals[0].code).toBe("support-authorization-closed");
  });
});

describe("what a job reports", () => {
  const dispatched = (overrides: Loose = {}) => {
    const input = authorized(overrides);
    admitSupportJob(store, { authorization_id: input.command_id, job_id: "j-1" }, AT);
    return input.command_id;
  };
  const jobOf = (id: string) => (supportFor(store, { run_id: "r-1" }).find((entry: Loose) => entry.authorization_id === id) as Loose).jobs[0];

  it("keeps cached input inside input and differences a cumulative counter, instead of summing restatements", () => {
    const id = dispatched();
    // Codex restates the whole thread each turn: raw 1000/800 then 2500/2000.
    settleSupportJob(
      store,
      {
        authorization_id: id, job_id: "j-1", thread_id: "th-1", turn_ids: ["t1", "t2"],
        usage: { semantics: "thread-cumulative", readings: [reading(1000, 100, 800, 0), reading(2500, 300, 2000, 1)] },
        observed: { model: "gpt-6-luna", effort: "low" }, stop_reason: "completed", cost: null,
      },
      AT,
    );
    const job = jobOf(id);
    expect(job.state).toBe("settled");
    expect(job.usage.tokens).toMatchObject({ input: 2500, cachedInput: 2000, output: 300, total: 2800 });
    expect(job.usage.complete).toBe(true);
    expect(job.thread_id).toBe("th-1");
    expect(job.turn_ids).toEqual(["t1", "t2"]);
    expect(job.effort_match).toBe(true);
    expect(job).not.toHaveProperty("settings_match");
  });

  it("calls a cumulative counter with a missing baseline unknown rather than inventing a number", () => {
    const id = dispatched();
    settleSupportJob(store, { authorization_id: id, job_id: "j-1", usage: { semantics: "thread-cumulative", baselineRequired: true, readings: [reading(5000, 400)] }, stop_reason: "completed" }, AT);
    expect(jobOf(id).state).toBe("unknown");
    expect(jobOf(id).usage.complete).toBe(false);
    expect((admitSupportJob(store, { authorization_id: id, job_id: "j-2" }, AT) as Loose).ok).toBe(false);
  });

  it("treats a missing cost as unknown, never zero, and flags settings the provider contradicted", () => {
    const id = dispatched();
    settleSupportJob(store, { authorization_id: id, job_id: "j-1", usage: { semantics: "per-turn", readings: [reading(100, 10)] }, observed: { model: "gpt-6-terra", effort: "high" }, stop_reason: "completed" }, AT);
    expect(jobOf(id).cost).toEqual({ usd: null, provenance: "unknown" });
    expect(jobOf(id).effort_match).toBe(false);
    const report = accountingReport(store, { run_id: "r-1" }, AT);
    expect(report.support.costUsd).toBeNull();
    expect(report.support.costComplete).toBe(false);
  });

  it("settles idempotently and refuses a conflicting second settlement", () => {
    const id = dispatched();
    const settlement = { authorization_id: id, job_id: "j-1", usage: { semantics: "per-turn", readings: [reading(100, 10)] }, stop_reason: "completed" };
    expect((settleSupportJob(store, settlement, AT) as Loose).repeated).toBe(false);
    expect((settleSupportJob(store, settlement, AT) as Loose).repeated).toBe(true);
    expect((settleSupportJob(store, { ...settlement, usage: { semantics: "per-turn", readings: [reading(999, 10)] } }, AT) as Loose).refusals[0].code).toBe("support-settlement-conflict");
    expect((settleSupportJob(store, { ...settlement, job_id: "j-nope" }, AT) as Loose).refusals[0].code).toBe("support-job-unknown");
  });

  it.each([
    {}, { input: 10 }, { output: 2 }, { input: null, output: 2 },
  ])("keeps absent counters unknown instead of settling zero: %j", (usage) => {
    const id = dispatched();
    expect(settleSupportJob(store, { authorization_id: id, job_id: "j-1", usage: { semantics: "per-turn", readings: [{ usage }] } }, AT)).toMatchObject({ ok: false });
    expect(jobOf(id).state).toBe("dispatched");
    expect(accountingReport(store, { run_id: "r-1" }, AT).support.coverage).toEqual({ known: 0, total: 1 });
    expect((admitSupportJob(store, { authorization_id: id, job_id: "j-2" }, AT) as Loose).refusals.map((entry: Loose) => entry.code)).toContain("support-usage-unknown");
  });

  it("does not treat an empty resumed baseline as measured zero", () => {
    const id = dispatched();
    expect(settleSupportJob(store, { authorization_id: id, job_id: "j-1", usage: { semantics: "thread-cumulative", baseline: {}, baselineRequired: true, readings: [reading(10, 2)] } }, AT)).toMatchObject({ ok: false });
    expect(jobOf(id).state).toBe("dispatched");
  });

  it("reports effort matching without claiming a model match", () => {
    const id = dispatched();
    settleSupportJob(store, { authorization_id: id, job_id: "j-1", usage: { semantics: "per-turn", readings: [reading(10, 2)] }, observed: { model: "unexpected-model", effort: "low" } }, AT);
    const report = accountingReport(store, { run_id: "r-1" }, AT);
    expect(report.support.authorizations[0].jobs[0]).toMatchObject({ effort_match: true, observed: { model: "unexpected-model" } });
    expect(report.support.authorizations[0].jobs[0]).not.toHaveProperty("settings_match");
  });
});

describe("Delivery / Support / Chat overhead, kept apart", () => {
  it("keeps partial cost and estimates explicitly identified", () => {
    for (const cost of [null, { usd: 0.4, provenance: "estimate" }]) {
      const { command_id } = authorized();
      admitSupportJob(store, { authorization_id: command_id, job_id: "j-s" }, AT);
      settleSupportJob(store, { authorization_id: command_id, job_id: "j-s", usage: { semantics: "per-turn", readings: [reading(10, 2)] }, cost }, AT);
    }
    const report = accountingReport(store, { run_id: "r-1" }, AT);
    expect(report.support).toMatchObject({ costUsd: 0.4, costComplete: false, costBasis: "estimate", coverage: { known: 2, total: 2 } });
    expect(renderAccounting(report)).toContain("cost $0.4000 known; remainder unknown (estimate)");
  });
  it("reports each with its own coverage and never as one total", () => {
    seedRun("r-1", [{ input: 40_000, cachedInput: 30_000, output: 2_000 }], { cost: null });
    const { command_id } = authorized();
    admitSupportJob(store, { authorization_id: command_id, job_id: "j-s" }, AT);
    settleSupportJob(store, { authorization_id: command_id, job_id: "j-s", usage: { semantics: "per-turn", readings: [reading(5_000, 500, 1_000)] }, stop_reason: "completed", cost: { usd: 0.42, provenance: "provider-reported" } }, AT);

    const report = accountingReport(store, { run_id: "r-1" }, AT);
    expect(report.delivery.tokens).toMatchObject({ input: 40_000, cachedInput: 30_000, output: 2_000, total: 42_000 });
    expect(report.delivery.costUsd).toBeNull(); // subscription runs report no amount: unknown, not $0
    expect(report.support.tokens).toMatchObject({ input: 5_000, output: 500, total: 5_500 });
    expect(report.support.costUsd).toBe(0.42);
    expect(report.support.costComplete).toBe(true);
    expect(report.chat).toMatchObject({ status: "not-measured", tokens: null, costUsd: null });
    expect(report.coverage).toMatchObject({ delivery: { known: 1, total: 1 }, support: { known: 1, total: 1 }, chat: "not-measured", complete: true });
    expect(report).not.toHaveProperty("total");
    expect(report.support.authorizations[0].jobs[0].requested).toMatchObject({ executor: "codex", model_tier: "CODEX_LOW", effort: "low" });
  });

  it("shows unknown Delivery and Support usage as uncovered", () => {
    seedRun("r-1", [], { unknownJob: true });
    store.updateJob("j-r-1", { status: "unknown", reservation_open: true });
    store.db.prepare("UPDATE jobs SET dispatch_started_at = ? WHERE job_id = ?").run(AT, "j-r-1");
    const { command_id } = authorized();
    admitSupportJob(store, { authorization_id: command_id, job_id: "j-s" }, AT);

    const report = accountingReport(store, { run_id: "r-1" }, AT);
    expect(report.delivery.coverage).toEqual({ known: 0, total: 1 });
    expect(report.support.coverage).toEqual({ known: 0, total: 1 });
    expect(report.support.unknown[0].reason).toMatch(/no outcome recorded/u);
    expect(report.coverage.complete).toBe(false);
  });

  it("finds support linked through the request that created the run, and counts owner-entered chat only as entered", () => {
    const request = { initiatedBy: "era-steward", command_id: randomUUID(), file: "Budget/4 - Checklist.md", expectId: "BUD-14" };
    acceptStewardRequest(store, request, "era-steward", AT);
    seedRun("r-9", []);
    updateStewardRequest(store, request.command_id, "run-created", AT, { ok: true, run_id: "r-9" });
    authorized({ subject: { request_id: request.command_id } });
    expect(accountingReport(store, { run_id: "r-9" }, AT).support.authorizations).toHaveLength(1);

    expect((recordChatOverhead(store, { command_id: randomUUID(), subject: { request_id: request.command_id }, tokens: 12_000, usd: null, note: "owner read the chat meter" }, "owner", AT) as Loose).ok).toBe(true);
    const report = accountingReport(store, { run_id: "r-9" }, AT);
    expect(report.chat).toMatchObject({ status: "owner-entered", tokens: 12_000, costUsd: null });
  });
});

describe("the support routes belong to the owner", () => {
  const headersFor = (kind: "browser" | "steward") => {
    const paired = pairSession({ root, code: issuePairingCode({ root }).code, kind });
    const cookie = SESSION_COOKIE + "=" + paired.token;
    return { origin: "http://127.0.0.1:4317", cookie, [CSRF_HEADER]: String(sessionView({ root, headers: { cookie } }).csrf) };
  };
  const ctx = () => ({ root, store, allowedOrigins: ["http://127.0.0.1:4317"], now: () => AT });
  const post = (headers: Loose, body: Loose) => routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/support", headers, body }, ctx());

  beforeEach(() => setDispatchMode({ root, mode: "v2", actor: "owner" }));

  it("lets the owner authorize, admit and settle; refuses the Steward credential every time", async () => {
    const command_id = randomUUID();
    const owner = headersFor("browser");
    const steward = headersFor("steward");
    const body = { action: "authorize", ...authorization({ command_id }) };
    expect((await post(steward, body))?.status).toBe(403);
    expect((await post(owner, body))?.status).toBe(200);
    expect((await post(steward, { action: "admit", authorization_id: command_id, job_id: "j-1" }))?.status).toBe(403);
    expect((await post(owner, { action: "admit", authorization_id: command_id, job_id: "j-1" }))?.status).toBe(200);
    expect((await post(owner, { action: "admit", authorization_id: command_id, job_id: "j-2" }))?.status).toBe(409);
    const settled = await post(owner, { action: "settle", authorization_id: command_id, job_id: "j-1", usage: { semantics: "per-turn", readings: [{ turn: 0, usage: { input: 10, output: 2 } }] }, stop_reason: "completed" });
    expect(settled?.json.authorization.jobs[0].state).toBe("settled");
    expect((await post(owner, { action: "authorize", command_id: "not-a-uuid" }))?.status).toBe(400);
  });

  it("serves the report to both credentials as a read", async () => {
    for (const kind of ["browser", "steward"] as const) {
      const response = await routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/accounting", headers: headersFor(kind), query: new URLSearchParams({ run: "r-none" }) }, ctx());
      expect(response?.status).toBe(200);
      expect(response?.json.report.chat.status).toBe("not-measured");
    }
    const missing = await routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/accounting", headers: headersFor("browser"), query: new URLSearchParams() }, ctx());
    expect(missing?.status).toBe(400);
  });
});
