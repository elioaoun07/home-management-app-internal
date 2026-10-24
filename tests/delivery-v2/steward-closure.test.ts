// ERA Steward sign-off: the one offline closure suite (plan Phase 3).
//
// Real Start route + real journey + the Steward's typed tools + the support
// ledger + the mandatory candidate-test gate, driven by fake provider events. It
// proves four things and nothing else; it starts no provider, Docker or checker:
//
//   1. success, repeated status reads, a lost Start reply and a reconnect keep one
//      request/run identity and cause zero supervision-model calls;
//   2. a stale connection, a duplicate and an unexpected failure cause no new
//      Start, no repair and no hidden fallback;
//   3. a generic agent/shell request is denied; an explicitly authorized support
//      job is linked and counted; unknown usage stays visible and blocks more;
//   4. a failing mandatory candidate test blocks verification and Apply; passing
//      evidence is bound to the exact candidate; owner approval gates stay intact.
//
// What it cannot prove — the external Steward tool configuration, a physical phone
// — is on the sign-off list in docs/Delivery-UAT.md, not here.
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeDeliveryV2, setDispatchMode } from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { policyTemplate } from "../../scripts/delivery-v2/policy.mjs";
import { createStewardClient } from "../../scripts/delivery-v2/steward-tools.mjs";
import { handleMcpMessage } from "../../scripts/delivery-v2/steward-mcp.mjs";
import { CANDIDATE_TESTS_CRITERION_ID } from "../../scripts/delivery-v2/candidate-tests.mjs";
import { CHECKLIST, journeyFor, makeHarness, seedRoot, writePolicy, type Loose } from "./fixtures/v2-harness";

const ORIGIN = "http://127.0.0.1:4317";
const TEST_FILE = "tests/amount.unit.test.ts";
const VITEST = ["node", "/node_modules/vitest/vitest.mjs", "run"];
const PASS = { exitCode: 0, stdout: "Test Files  1 passed (1)\n      Tests  3 passed (3)", stderr: "", spawnError: null };
const FAIL = { exitCode: 1, stdout: "Test Files  1 failed (1)\n      Tests  2 failed | 1 passed (3)", stderr: "", spawnError: null };

let ROOT: string;
let DATA: string;
let store: ReturnType<typeof openStore>;
let AT: string;
let networkDown: boolean;
let postsToDeliver: number;
let lostReply: number;

/** Everything one scenario needs, built over fresh state. */
function world({ vitest = (_argv: string[]): Loose => PASS } = {}) {
  writePolicy(ROOT, {
    publicationScope: { allowedPaths: ["src", "tests"], changeConstraints: {} },
    scratchScope: { kind: "snapshot", include: ["src/amount.ts", "src/config.ts", "src/old.ts", "tests/amount.check.mjs", "vitest.config.ts"] },
    checks: {
      specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"] } },
      inputs: ["tests/amount.check.mjs"],
      requiredVerifications: { candidateTests: { enabled: true, argv: VITEST, include: ["tests/**/*.test.ts"] } },
    },
    // Focused delivery's shape: no automatic repair. Any extra provider call below is a finding.
    execution: { ...(policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose).execution, repairDispatchLimit: 0 },
  });
  const h = makeHarness(ROOT, (dir) => {
    writeFileSync(join(dir, "src", "amount.ts"), "export const amount = 20;\n", "utf8");
    mkdirSync(join(dir, "tests"), { recursive: true });
    writeFileSync(join(dir, TEST_FILE), "// authored by the candidate\n", "utf8");
  });
  const vitestCalls: Loose[] = [];
  const inherited = h.runtime.checkExecutor;
  h.runtime.checkExecutor = (input: Loose) => {
    const oracle = inherited(input);
    return async (call: Loose) => {
      if (call.argv[1] === "tests/amount.check.mjs") return oracle(call);
      vitestCalls.push({ argv: [...call.argv], candidate_id: String(input.candidate.candidate_id), generation: String(input.candidate.generation) });
      return vitest(call.argv);
    };
  };
  const journey = journeyFor({ root: ROOT, data: DATA, store, harness: h });
  const ctx = { root: ROOT, store, journey, allowedOrigins: [ORIGIN], now: () => AT };

  const fetchImpl = (async (url: string, init: Loose = {}) => {
    const target = new URL(url);
    const isStart = init.method === "POST" && target.pathname === "/api/delivery/v2/deliver";
    if (networkDown) throw new TypeError("network down");
    if (isStart) postsToDeliver += 1;
    const lower: Record<string, string> = {};
    for (const [key, value] of Object.entries(init.headers || {})) lower[key.toLowerCase()] = String(value);
    let routed: Loose;
    if (target.pathname === "/api/data") routed = { status: 200, json: { files: [{ relPath: "Budget/4 - Checklist.md", raw: CHECKLIST }] } };
    else routed = (await routeDeliveryV2({ method: init.method || "GET", path: target.pathname, query: target.searchParams, body: init.body ? JSON.parse(init.body) : {}, headers: lower }, ctx))!;
    if (isStart && lostReply > 0) {
      lostReply -= 1;
      throw new TypeError("reply lost");
    }
    return new Response(JSON.stringify(routed.json), { status: routed.status, headers: { "Content-Type": "application/json", ...(routed.headers || {}) } });
  }) as unknown as typeof fetch;

  const steward = createStewardClient({ root: ROOT, baseUrl: ORIGIN, fetchImpl, now: () => AT, sleep: async () => undefined });
  const owner = () => {
    const paired = pairSession({ root: ROOT, code: issuePairingCode({ root: ROOT }).code });
    const cookie = SESSION_COOKIE + "=" + paired.token;
    return { origin: ORIGIN, cookie, [CSRF_HEADER]: String(sessionView({ root: ROOT, headers: { cookie } }).csrf) };
  };
  const ownerHeaders = owner();
  const stewardHeaders = () => {
    const paired = pairSession({ root: ROOT, code: issuePairingCode({ root: ROOT }).code, kind: "steward" });
    const cookie = SESSION_COOKIE + "=" + paired.token;
    return { origin: ORIGIN, cookie, [CSRF_HEADER]: String(sessionView({ root: ROOT, headers: { cookie } }).csrf) };
  };
  const route = (method: string, path: string, body: Loose = {}, headers: Loose = ownerHeaders, query = new URLSearchParams()) =>
    routeDeliveryV2({ method, path, body, headers, query }, ctx) as Promise<Loose>;
  const approve = async (run_id: string) => {
    const plan = journey.detail(run_id).plans[0];
    const decided = await route("POST", "/api/delivery/v2/decision", { run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve", command_id: randomUUID() });
    expect(decided.status).toBe(200);
    await journey.idle();
    return journey.detail(run_id) as Loose;
  };
  return { h, journey, ctx, steward, route, approve, ownerHeaders, stewardHeaders, vitestCalls, fetchImpl };
}

const jobsOf = () => store.listAllJobs() as Loose[];

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-closure-root-"));
  DATA = mkdtempSync(join(tmpdir(), "era-closure-data-"));
  AT = "2026-10-24T15:00:00.000Z";
  networkDown = false;
  postsToDeliver = 0;
  lostReply = 0;
  seedRoot(ROOT);
  writeFileSync(join(ROOT, "vitest.config.ts"), "export default {};\n", "utf8");
  store = openStore({ path: join(ROOT, ".delivery", "v2", "supervisor.sqlite"), now: () => AT });
  setDispatchMode({ root: ROOT, mode: "v2", actor: "owner" });
});
afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(DATA, { recursive: true, force: true });
});

const pairSteward = async (w: ReturnType<typeof world>) => {
  const outcome = await w.steward.pair(issuePairingCode({ root: ROOT }).code);
  expect(outcome.ok).toBe(true);
};

describe("1 — one identity, zero supervision-model calls", () => {
  it("survives a lost Start reply, repeated reads and a reconnect with one request and one run", async () => {
    const w = world();
    await pairSteward(w);

    lostReply = 1; // the server accepts the Start; the Steward never hears back
    const first = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    expect(first).toMatchObject({ ok: false, status: "uncertain" });
    const recovered = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    expect(recovered).toMatchObject({ ok: true, status: "started", request_id: first.request_id });
    await w.journey.idle();

    const run_id = String(recovered.run_id);
    const providerCallsAfterStart = w.h.calls.length;
    const jobsAfterStart = jobsOf().length;
    for (let i = 0; i < 3; i += 1) {
      expect((await w.steward.readRequest({ request_id: first.request_id })).run_id).toBe(run_id);
      expect((await w.steward.readRun({ run_id })).ok).toBe(true);
    }
    const waited = await w.steward.waitForChanges({ run_id, timeout_seconds: 1 });
    expect(waited.ok).toBe(true);
    // A new tool process (reconnect) finds the same intent and the same run.
    const reconnected = createStewardClient({ root: ROOT, baseUrl: ORIGIN, fetchImpl: w.fetchImpl, now: () => AT });
    expect(await reconnected.startDelivery({ id: "BUD-14", executor: "claude" })).toMatchObject({ status: "started", run_id, request_id: first.request_id });

    expect(postsToDeliver).toBe(1);
    expect(store.listRuns()).toHaveLength(1);
    expect(store.listReceiptsByKind("steward-initiation")).toHaveLength(1);
    // Only the planning job ever called a model; supervision added none.
    expect(w.h.calls).toHaveLength(providerCallsAfterStart);
    expect(jobsOf()).toHaveLength(jobsAfterStart);
    expect(w.h.calls.map((call) => call.access)).toEqual(["read-only"]);
  });

  it("runs the whole delivery to a verified candidate with the owner approving and the Steward only reading", async () => {
    const w = world();
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const run_id = String(started.run_id);

    const view = await w.approve(run_id);
    expect(view.run.closed_outcome).toBe("verified_candidate");
    const read = await w.steward.readRun({ run_id });
    expect(read.message).toContain("CLOSED/verified_candidate");
    expect(read.message).toContain("candidate verified");
    expect(read.message).toContain(CANDIDATE_TESTS_CRITERION_ID + ":satisfied");
    // Two delivery jobs (plan, implementation); nothing else called a model.
    expect(w.h.calls.map((call) => call.access)).toEqual(["read-only", "write"]);
    expect(read.accounting.delivery.jobs).toBe(2);
    expect(read.accounting.delivery.tokens.total).toBe(24);
    expect(read.accounting.support.coverage.total).toBe(0);
    expect(read.accounting.chat.status).toBe("not-measured");
  });
});

describe("2 — no new Start, repair or fallback on staleness, duplicates or failure", () => {
  it("keeps the last confirmed state through a dropped connection and never starts again", async () => {
    const w = world();
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const known = await w.steward.readRun({ run_id: String(started.run_id) });

    networkDown = true;
    AT = "2026-10-24T15:45:00.000Z";
    const stale = await w.steward.readRun({ run_id: String(started.run_id) });
    const again = await w.steward.startDelivery({ id: "BUD-14", executor: "claude" });
    networkDown = false;

    expect(stale).toMatchObject({ ok: true, stale: true, last_confirmed_at: "2026-10-24T15:00:00.000Z" });
    expect(stale.message).toContain(String(known.message));
    expect(again.status).toBe("uncertain"); // could not confirm; did not guess
    expect(postsToDeliver).toBe(1);
    expect(store.listRuns()).toHaveLength(1);
    expect(w.h.calls).toHaveLength(1);
  });

  it("answers a duplicate or a second request for the same item with the original, and runs nothing", async () => {
    const w = world();
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const stored = JSON.parse(String(store.getReceipt("steward:" + started.request_id)!.observed_json));
    expect(stored.run_id).toBe(started.run_id);

    // The exact payload the tool persisted, resent as a network retry would send it.
    const intent = JSON.parse(readFileSync(join(ROOT, ".delivery", "v2", "steward", "intents", "deliver-bud-14.json"), "utf8"));
    const rawStart = (command_id: string) => w.route("POST", "/api/delivery/v2/deliver", { ...intent.payload, command_id }, w.stewardHeaders());
    const duplicate = await rawStart(started.request_id);
    expect(duplicate.json.run_id).toBe(started.run_id);
    const another = await rawStart(randomUUID());
    expect(another.json).toMatchObject({ error: "steward-request-conflict", command_id: started.request_id });
    await w.journey.idle();

    expect(store.listRuns()).toHaveLength(1);
    expect(jobsOf()).toHaveLength(1);
    expect(w.h.calls).toHaveLength(1);
  });

  it("stops at the first unexpected failure: no repair, no retry, no model fallback", async () => {
    const w = world({ vitest: () => { throw new Error("checker container vanished"); } });
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const view = await w.approve(String(started.run_id));

    expect(view.result.candidateVerified).toBe(false);
    expect(view.run.closed_outcome).not.toBe("verified_candidate");
    const states = view.result.criterion_states as Loose[];
    expect(states.find((entry) => entry.criterion_id === CANDIDATE_TESTS_CRITERION_ID)?.state).toBe("inconclusive");
    // Plan + implementation only. A repair or a second model would be a third call.
    expect(w.h.calls.map((call) => call.access)).toEqual(["read-only", "write"]);
    expect(w.vitestCalls).toHaveLength(1);
    const read = await w.steward.readRun({ run_id: String(started.run_id) });
    expect(read.message).toContain("candidate not verified");
    expect(w.h.calls).toHaveLength(2);
    expect(postsToDeliver).toBe(1);
  });
});

describe("3 — no generic delegation; support is owner-authorized, linked and counted", () => {
  const rpc = (w: ReturnType<typeof world>, name: string, args: Loose = {}) =>
    handleMcpMessage(w.steward, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } as Loose);

  it("refuses a generic agent or shell request at the tool and at the server", async () => {
    const w = world();
    await pairSteward(w);
    for (const [name, code] of [["codex", "generic-delegation-refused"], ["claude", "generic-delegation-refused"], ["bash", "shell-execution-refused"], ["apply", "owner-action-refused"]]) {
      const reply = (await rpc(w, name, { prompt: "run git status" }))!.result as Loose;
      expect(reply.isError).toBe(true);
      expect(reply.content[0].text).toContain(code);
    }
    // Server side, with the Steward's own credential: the support and control routes are closed.
    const stewardHeaders = w.stewardHeaders();
    for (const path of ["/api/delivery/v2/support", "/api/delivery/v2/control", "/api/delivery/v2/apply", "/api/delivery/v2/decision"]) {
      expect((await w.route("POST", path, { action: "authorize" }, stewardHeaders)).status).toBe(403);
    }
    expect(w.h.calls).toHaveLength(0);
    expect(jobsOf()).toHaveLength(0);
  });

  it("links an authorized support job to the delivery, counts it apart, and shows unknown usage", async () => {
    const w = world();
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const run_id = String(started.run_id);
    const deliveryBefore = (await w.steward.readRun({ run_id })).accounting.delivery;

    // Nothing is admitted until the owner decides.
    expect((await w.route("POST", "/api/delivery/v2/support", { action: "admit", authorization_id: "x", job_id: "j-s1" })).status).toBe(409);

    const authorization_id = randomUUID();
    const authorized = await w.route("POST", "/api/delivery/v2/support", {
      action: "authorize", command_id: authorization_id, subject: { request_id: started.request_id },
      purpose: "repair the checker environment", scope: ["scripts/delivery-v2/worker-boundary.mjs"], executor: "codex", model_tier: "CODEX_LOW", effort: "low", allowance_tokens: 50_000,
    });
    expect(authorized.status).toBe(200);
    expect((await w.route("POST", "/api/delivery/v2/support", { action: "admit", authorization_id, job_id: "j-s1" })).status).toBe(200);
    // While that job's usage is unknown the owner sees it as uncovered, and another job is refused.
    let report = (await w.steward.readRun({ run_id })).accounting;
    expect(report.support.coverage).toEqual({ known: 0, total: 1 });
    expect(report.support.unknown[0].reason).toMatch(/no outcome recorded/u);
    expect((await w.route("POST", "/api/delivery/v2/support", { action: "admit", authorization_id, job_id: "j-s2" })).json.refusals.map((r: Loose) => r.code)).toEqual(expect.arrayContaining(["support-usage-unknown", "support-job-limit-reached"]));

    await w.route("POST", "/api/delivery/v2/support", {
      action: "settle", authorization_id, job_id: "j-s1", thread_id: "th-9", turn_ids: ["t1"], observed: { model: "gpt-6-luna", effort: "low" },
      usage: { semantics: "thread-cumulative", readings: [{ turn: 0, usage: { input: 8_000, cachedInput: 6_000, output: 700 } }] }, stop_reason: "completed",
    });
    report = (await w.steward.readRun({ run_id })).accounting;
    expect(report.support.tokens).toMatchObject({ input: 8_000, cachedInput: 6_000, output: 700, total: 8_700 });
    expect(report.support.costUsd).toBeNull();
    expect(report.support.authorizations[0].jobs[0]).toMatchObject({ thread_id: "th-9", observed: { model: "gpt-6-luna" }, effort_match: true });
    // Delivery's own figures did not move, and the second job is still refused.
    expect(report.delivery.tokens).toEqual(deliveryBefore.tokens);
    expect((await w.route("POST", "/api/delivery/v2/support", { action: "admit", authorization_id, job_id: "j-s2" })).status).toBe(409);
    expect(jobsOf()).toHaveLength(1); // the ledger records support; it never creates a delivery job
  });
});

describe("4 — candidate tests gate verification and Apply; approvals stay with the owner", () => {
  it("does not verify a candidate whose mandatory test fails, and refuses to Apply it", async () => {
    const w = world({ vitest: () => FAIL });
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const run_id = String(started.run_id);
    const view = await w.approve(run_id);

    expect(view.result.candidateVerified).toBe(false);
    expect(view.run.closed_outcome).not.toBe("verified_candidate");
    const refused = await w.route("POST", "/api/delivery/v2/apply", { run_id, action: "apply", candidate_id: String(view.candidate.candidate_id), result_ref: view.result.result_id + "@" + view.result.result_version, command_id: randomUUID() });
    expect(refused.status).toBe(409);
    expect(refused.json.refusals[0].code).toBe("no-verified-candidate-to-apply");
    expect(view.applications ?? []).toHaveLength(0);
  });

  it("binds passing evidence to the exact candidate, and only the owner can Apply it", async () => {
    const w = world();
    await pairSteward(w);
    const started = await w.steward.startDelivery({ id: "BUD-14", executor: "claude", model: "claude-test", effort: "low" });
    await w.journey.idle();
    const run_id = String(started.run_id);
    const view = await w.approve(run_id);
    const candidate_id = String(view.candidate.candidate_id);
    const result_ref = view.result.result_id + "@" + view.result.result_version;
    expect(view.run.closed_outcome).toBe("verified_candidate");

    const stored = ((store as Loose).listEvidence(run_id, candidate_id) as Loose[])
      .map((row) => JSON.parse(String(row.record_json)))
      .find((record) => record.criterion_id === CANDIDATE_TESTS_CRITERION_ID);
    expect(stored.verification).toMatchObject({ state: "satisfied", candidate_id, files: [{ path: TEST_FILE }] });
    expect(stored.verification.definition_digest).toMatch(/^sha256:/u);
    expect(w.vitestCalls[0]).toMatchObject({ candidate_id, argv: [...VITEST, TEST_FILE] });

    // The Steward credential cannot approve or Apply, whatever it sends.
    const stewardHeaders = w.stewardHeaders();
    const blocked = await w.route("POST", "/api/delivery/v2/apply", { run_id, action: "apply", candidate_id, result_ref, command_id: randomUUID() }, stewardHeaders);
    expect(blocked.status).toBe(403);
    expect(store.listApplications(run_id)).toHaveLength(0);

    const applied = await w.route("POST", "/api/delivery/v2/apply", { run_id, action: "apply", candidate_id, result_ref, command_id: randomUUID() });
    expect(applied.status).toBe(200);
    // Applied only after the same tests ran again on the integrated tree.
    expect(w.vitestCalls).toHaveLength(2);
    expect(w.vitestCalls[1].generation).not.toBe(w.vitestCalls[0].generation);
    expect((store.listApplications(run_id) as Loose[]).at(-1)!.state).toBe("applied");
  });
});
