// DLV-114 / DLV-109 — in-job stopping and visible progress.
//
// Isolated on purpose. Every case here runs against the REAL budget module, the
// REAL Claude and Codex adapters (scripted SDKs injected at their `importSdk`
// seam), a temporary SQLite store and a fake worker runtime. Nothing reaches a
// provider, a container or production, and nothing in this file is evidence that
// a real executor stopped: the remaining obligation is the bounded real stop
// witness for the chosen provider, which only the owner can run (UAT).
//
// What these fixtures do establish:
//   - an unserveable enforcement mode refuses *before* dispatch, and is never
//     silently downgraded to the weaker mode that would have run;
//   - a crossing observed mid-stream aborts the stream, and the turns after it
//     are never emitted;
//   - everything observed before the crossing survives — usage, activity, and
//     the bytes the writer had already produced;
//   - nothing redispatches: no repair, no continuation, and reconciling twice
//     over a reopened store adds no job and no second reading;
//   - observed activity is readable through the run view while the stream is
//     still open, and the final batch does not duplicate it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BUDGET_REFUSALS,
  createBudgetMonitor,
  normalizedReading,
  resolveEnforcement,
} from "../../scripts/delivery-v2/budget.mjs";
import { createJourney } from "../../scripts/delivery-v2/journey.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { policyTemplate, validateExecutionPolicy } from "../../scripts/delivery-v2/policy.mjs";
import { provisionScratch } from "../../scripts/delivery-v2/scratch.mjs";
import { importTrustedCandidate } from "../../scripts/delivery-v2/checks.mjs";
import { describeProfile as describeClaude } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { describeProfile as describeCodex } from "../../scripts/delivery-v2/adapters/codex.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

// ---------------------------------------------------------------------------
// The pure module
// ---------------------------------------------------------------------------

const PER_TURN = { wholeJobBound: "unsupported", strictBound: false, inJobReadings: "per-turn" };
const END_ONLY = { wholeJobBound: "unsupported", strictBound: false, inJobReadings: "end-only" };
const BOUNDED = { wholeJobBound: "supported", strictBound: true, inJobReadings: "per-turn" };

describe("what a limit may promise", () => {
  it("refuses a hard cap over an executor with no proved whole-job bound, and offers no weaker substitute", () => {
    const verdict = resolveEnforcement({ mode: "hard-cap", limit: 200_000, capability: PER_TURN });
    expect(verdict.ok).toBe(false);
    expect(verdict.refusals.map((r: Loose) => r.code)).toContain(BUDGET_REFUSALS.HARD_CAP_UNAVAILABLE);
    // The whole point: no fallback. A refused cap does not become a threshold.
    expect(verdict.mode).toBeNull();
    expect(verdict.limit).toBeNull();
  });

  it("allows a hard cap only when the whole-job bound is both supported and proved", () => {
    expect(resolveEnforcement({ mode: "hard-cap", limit: 100, capability: BOUNDED }).mode).toBe("hard-cap");
    // Supported but unverified is not proved: `strictBound` is the conclusion
    // finalizeProfile computes, and a caller cannot assert past it.
    const halfway = { wholeJobBound: "supported", strictBound: false, inJobReadings: "per-turn" };
    expect(resolveEnforcement({ mode: "hard-cap", limit: 100, capability: halfway }).ok).toBe(false);
  });

  it("refuses a stop threshold over counters that only arrive at the end", () => {
    const verdict = resolveEnforcement({ mode: "threshold", limit: 100, capability: END_ONLY });
    expect(verdict.ok).toBe(false);
    expect(verdict.refusals.map((r: Loose) => r.code)).toEqual([BUDGET_REFUSALS.LIVE_READINGS_UNAVAILABLE]);
    expect(verdict.mode).toBeNull();
    expect(resolveEnforcement({ mode: "threshold", limit: 100, capability: { inJobReadings: "unknown" } }).ok).toBe(false);
  });

  it("refuses a limitless or uncountable limit rather than counting nothing", () => {
    expect(resolveEnforcement({ mode: "threshold", limit: null, capability: PER_TURN }).refusals.map((r: Loose) => r.code)).toContain(
      BUDGET_REFUSALS.NO_LIMIT,
    );
    expect(
      resolveEnforcement({ mode: "threshold", limit: 100, unit: "usd", capability: PER_TURN }).refusals.map((r: Loose) => r.code),
    ).toContain(BUDGET_REFUSALS.UNIT_NOT_COUNTABLE);
    expect(resolveEnforcement({ mode: "sort-of", limit: 100, capability: PER_TURN }).refusals.map((r: Loose) => r.code)).toEqual([
      BUDGET_REFUSALS.UNKNOWN_MODE,
    ]);
  });

  it("admits advisory without any capability, and says it stops nothing", () => {
    const verdict = resolveEnforcement({ mode: "advisory", limit: 200_000, capability: END_ONLY });
    expect(verdict.ok).toBe(true);
    expect(verdict.mode).toBe("advisory");
    expect(verdict.basis).toMatch(/nothing here stops a running job/u);
  });

  it("reports both adapters as per-turn readers with no whole-job bound", () => {
    for (const resources of [describeClaude().resources, describeCodex().resources] as Loose[]) {
      expect(resources.inJobReadings).toBe("per-turn");
      expect(resources.strictBound).toBe(false);
      expect(resolveEnforcement({ mode: "threshold", limit: 10, capability: resources }).ok).toBe(true);
      expect(resolveEnforcement({ mode: "hard-cap", limit: 10, capability: resources }).ok).toBe(false);
    }
  });
});

describe("counting a job against its limit", () => {
  const reading = (turn: number, input: number, output = 0) => ({ key: "turn:" + turn, usage: { input, output } });

  it("counts input plus output only; cached input and reasoning are subsets", () => {
    expect(normalizedReading({ input: 100, output: 20, cachedInput: 90, cacheCreation: 40, reasoningOutput: 5 })).toBe(120);
  });

  it("warns once, stops once, and counts a repeated reading once", () => {
    const monitor = createBudgetMonitor({ mode: "threshold", limit: 1000, warnAtPercent: 80 });
    expect(monitor.observe(reading(0, 400, 100))).toMatchObject({ level: "ok", warn: false, stop: false, used: 500 });
    const warned = monitor.observe(reading(1, 300, 50));
    expect(warned).toMatchObject({ level: "warn", warn: true, stop: false, used: 850 });
    // The same turn again is the same fact, not more spending.
    const again = monitor.observe(reading(1, 300, 50));
    expect(again).toMatchObject({ duplicate: true, used: 850, warn: false, stop: false });
    const crossed = monitor.observe(reading(2, 200, 0));
    expect(crossed).toMatchObject({ level: "exceeded", warn: false, stop: true, used: 1050 });
    // One crossing, one stop request — a late reading never asks for a second.
    expect(monitor.observe(reading(3, 500, 0)).stop).toBe(false);
    const record = monitor.record();
    expect(record).toMatchObject({ stopRequested: true, warned: true, overshoot: 550, readings: 4 });
    expect(record.basis).toMatch(/already spent/u);
  });

  it("measures against the run, not the job: banked usage counts", () => {
    const monitor = createBudgetMonitor({ mode: "threshold", limit: 1000, banked: 900 });
    expect(monitor.observe(reading(0, 100, 50))).toMatchObject({ stop: true, used: 1050, observed: 150 });
  });

  it("treats a decreased counter as a reset, never a refund", () => {
    const monitor = createBudgetMonitor({ mode: "threshold", limit: 1000 });
    monitor.observe(reading(0, 400, 100));
    monitor.observe(reading(0, 10, 0));
    expect(monitor.state().used).toBe(500);
    expect(monitor.record().resets).toHaveLength(1);
  });

  it("never stops under advisory, however far past the limit it counts", () => {
    const monitor = createBudgetMonitor({ mode: "advisory", limit: 100 });
    const verdict = monitor.observe(reading(0, 9000, 1000));
    expect(verdict).toMatchObject({ level: "exceeded", warn: true, stop: false });
    expect(monitor.record()).toMatchObject({ stopRequested: false, overshoot: 9900 });
    expect(monitor.record().basis).toMatch(/stops nothing/u);
  });
});

describe("the policy states its enforcement mode", () => {
  const base = () =>
    ({
      ...(policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose),
      runtime: { kind: "container", image: "x", digest: "sha256:x", network: { mode: "none" } },
    }) as Loose;

  const validateWith = (resources: Loose) =>
    validateExecutionPolicy({ ...base(), resources: { ...base().resources, ...resources } }) as Loose;

  it("defaults to advisory with an 80% warning", () => {
    const template = policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose;
    expect(template.resources.enforcement).toBe("advisory");
    expect(template.resources.warnAtPercent).toBe(80);
  });

  it("refuses an enforcing mode with nothing to cross, and an unknown mode outright", () => {
    const noLimit = validateWith({ unit: "tokens", allowance: null, enforcement: "threshold" });
    expect(noLimit.ok).toBe(false);
    expect(noLimit.refusals.some((r: Loose) => /needs a numeric allowance/u.test(String(r.detail)))).toBe(true);
    const unknown = validateWith({ unit: "tokens", allowance: 10, enforcement: "as-needed" });
    expect(unknown.ok).toBe(false);
    expect(unknown.refusals.some((r: Loose) => /resources.enforcement must be one of/u.test(String(r.detail)))).toBe(true);
  });

  it("refuses a warning level outside 0–100", () => {
    for (const warnAtPercent of [0, -5, 140]) {
      const outcome = validateWith({ unit: "tokens", allowance: 10, warnAtPercent });
      expect(outcome.ok).toBe(false);
      expect(outcome.refusals.some((r: Loose) => /warnAtPercent/u.test(String(r.detail)))).toBe(true);
    }
  });

  it("accepts a threshold over a numeric token allowance", () => {
    const outcome = validateWith({ unit: "tokens", allowance: 200_000, enforcement: "threshold", warnAtPercent: 75 });
    expect(outcome.ok).toBe(true);
    expect(outcome.policy.resources).toMatchObject({ enforcement: "threshold", warnAtPercent: 75 });
  });
});

// ---------------------------------------------------------------------------
// The journey, through both real adapters
// ---------------------------------------------------------------------------

const PM_REL = join("ERA Notes", "10 - Project Management");
const ROW = "- [ ] **BUD-14** quick-amount control emits 20 _(friction - S)_";
const CHECKLIST = ["# Budget — Checklist", "", "## Now", "", ROW, ""].join("\n");
const BOOK = [
  "# Budget — Master Book",
  "",
  "## Acceptance Criteria Index",
  "",
  "### BUD-14",
  "",
  "- **Acceptance:** the control emits 20.",
  "",
  "## Delivery session log",
  "",
].join("\n");
const SELECT = { file: "Budget/4 - Checklist.md", cbidx: 0, expectLine: ROW, expectId: "BUD-14" };
const SETTINGS = {
  claude: { executor: "claude", model: "claude-test", effort: "low" },
  codex: { executor: "codex", model: "codex-test", effort: "low" },
} as const;
const BACKEND = { claude: "claude-agent-sdk", codex: "codex-exec-sdk" } as const;
type Executor = keyof typeof BACKEND;

/** One scripted turn spends this much: 400 in + 100 out = 500 normalized. */
const TURN_INPUT = 400;
const TURN_OUTPUT = 100;
const TURN_COST = TURN_INPUT + TURN_OUTPUT;

let ROOT: string;
let GENERATIONS: string;
let store: ReturnType<typeof openStore>;
let commandSeq = 0;
const cmd = () => "cmd-" + ++commandSeq;

const storePath = () => join(ROOT, ".delivery", "v2", "supervisor.sqlite");

function writePolicy(resources: Loose) {
  const base = policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose;
  writeFileSync(
    join(ROOT, ".delivery", "v2", "execution-policy.json"),
    JSON.stringify({
      ...base,
      executors: {
        ...base.executors,
        permitted: ["claude", "codex"],
        catalog: {
          revision: 1,
          models: { claude: [{ id: "claude-test", efforts: ["low"] }], codex: [{ id: "codex-test" }] },
          profiles: {},
        },
      },
      scratchScope: { kind: "snapshot", include: ["src/amount.ts"] },
      publicationScope: { allowedPaths: ["src/amount.ts"], changeConstraints: {} },
      criteria: [],
      checks: { specs: {}, inputs: [] },
      resources: {
        unit: "tokens",
        perJobReservation: { amount: 100, basis: "admission estimate for this fixture" },
        ...resources,
      },
    }),
    "utf8",
  );
}

/**
 * Executors that emit several priced turns, so a crossing can happen with the
 * stream still open — which is the only shape in which an in-job stop means
 * anything. `emitted` counts the turns the fixture actually produced, so a test
 * can prove the turns after the abort never ran.
 */
function makeHarness() {
  const h = {
    turns: 4,
    emitted: 0,
    gate: null as null | { promise: Promise<void>; open: () => void },
    workspaces: new Map<string, string>(),
    calls: [] as Loose[],
    stopObservable: true,
    runtime: {} as Loose,
  };

  const openGate = () => {
    let open = () => {};
    const promise = new Promise<void>((resolve) => {
      open = () => resolve();
    });
    h.gate = { promise, open };
    return h.gate;
  };

  const plan = JSON.stringify({
    outcome: "emit 20",
    scope: ["src/amount.ts"],
    steps: ["change the constant"],
    risks: [],
    unknowns: [],
    checks: [],
    questions: [],
  });

  const textFor = (prompt: string) => (prompt.startsWith("Investigate") ? "Plan:\n```json\n" + plan + "\n```" : "done");

  const claudeSdk = (job: Loose, dir: string) => ({
    query: ({ prompt, options }: { prompt: string; options: Loose }) =>
      (async function* () {
        h.calls.push({ backend: BACKEND.claude, job_id: String(job.job_id), access: String(job.access), prompt });
        yield { type: "system", subtype: "init", model: "claude-test", session_id: options.resume || options.sessionId };
        const text = textFor(prompt);
        if (String(job.access) === "write") writeFileSync(join(dir, "src/amount.ts"), "export const amount = 20;\n", "utf8");
        yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "tool_use", name: "Read" }] } };
        if (h.gate && String(job.access) === "write") await h.gate.promise;
        yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text }] } };
        const turns = String(job.access) === "write" ? h.turns : 1;
        for (let turn = 0; turn < turns; turn += 1) {
          h.emitted += 1;
          yield {
            type: "result",
            subtype: "success",
            is_error: false,
            result: text,
            era_billing_basis: "included-subscription",
            usage: { input_tokens: TURN_INPUT, output_tokens: TURN_OUTPUT },
            modelUsage: { "claude-test": {} },
          };
        }
      })(),
  });

  const codexSdk = (job: Loose, dir: string) => {
    const thread = (id: string | null) => ({
      async runStreamed(prompt: string) {
        h.calls.push({ backend: BACKEND.codex, job_id: String(job.job_id), access: String(job.access), prompt });
        const text = textFor(prompt);
        return {
          events: (async function* () {
            yield { type: "thread.started", thread_id: id || "thr-" + job.job_id };
            if (String(job.access) === "write") writeFileSync(join(dir, "src/amount.ts"), "export const amount = 20;\n", "utf8");
            yield { type: "item.completed", item: { type: "command_execution", command: "cat src/amount.ts" } };
            if (h.gate && String(job.access) === "write") await h.gate.promise;
            yield { type: "item.completed", item: { type: "agent_message", text } };
            const turns = String(job.access) === "write" ? h.turns : 1;
            for (let turn = 0; turn < turns; turn += 1) {
              h.emitted += 1;
              // Codex counters are cumulative for the thread, so each turn
              // restates the total. Normalization turns that back into a delta.
              yield {
                type: "turn.completed",
                usage: {
                  input_tokens: TURN_INPUT * (turn + 1),
                  cached_input_tokens: 0,
                  output_tokens: TURN_OUTPUT * (turn + 1),
                  reasoning_output_tokens: 0,
                },
              };
            }
          })(),
        };
      },
    });
    return {
      Codex: class {
        startThread() {
          return thread(null);
        }
        resumeThread(id: string) {
          return thread(id);
        }
      },
    };
  };

  h.runtime = {
    kind: "fake-worker",
    boundary: { image: "fake-worker", digest: "sha256:fake-boundary" },
    workspaceFor: ({ access }: Loose) => ({ root: "/work", backing: "fake-volume", access }),
    binding: async (backend_id: string) => ({ backend_id, sdk_version: "fixture", boundary_digest: "sha256:fake", battery_digest: "sha256:battery" }),
    provision: async ({ run_id, job, include }: Loose) => {
      let base_manifest = null;
      if (!h.workspaces.has(run_id)) {
        const dir = mkdtempSync(join(tmpdir(), "era-v2-budget-ws-"));
        base_manifest = provisionScratch({ scratchRoot: dir, hostRoot: ROOT, include }).supplied;
        h.workspaces.set(run_id, dir);
      }
      const dir = h.workspaces.get(run_id)!;
      return {
        workspace: { root: "/work", backing: "fake-volume", access: job.access },
        base_manifest,
        refusals: [],
        importSdk: async () => (job.backend_id === BACKEND.claude ? claudeSdk(job, dir) : codexSdk(job, dir)),
      };
    },
    stop: async () => ({ stopObserved: h.stopObservable, detail: h.stopObservable ? "removed" : "still present" }),
    release: async () => undefined,
    recover: async () => null,
    exportCandidate: async ({ run_id, job_id, generation, generationsRoot, base_manifest }: Loose) =>
      importTrustedCandidate({ sourceRoot: h.workspaces.get(run_id)!, generationsRoot, generation, job_id, base_manifest }).candidate,
    checkExecutor: () => () => ({ exitCode: 0, stdout: "Tests  1 passed (1)", stderr: "", spawnError: null }),
  };
  return Object.assign(h, { openGate });
}

/**
 * A synthetic admitted profile carrying the real adapters' resource findings:
 * per-turn readings, no whole-job bound. Containment is not what this file tests.
 */
const describeAdmitted = async (backend_id: string) => ({
  ok: true,
  refusal: null,
  profile: {
    profile_id: "p-" + backend_id,
    backend_id,
    qualified: true,
    qualification_ref: "qr-fixture",
    unverifiedControls: [],
    controls: ["filesystem.outsideScratchWrite", "filesystem.hostSecretRead", "store.workerAccess"].map((id) => ({ id, verified: true, state: "supported" })),
    resources: {
      strictBound: false,
      strictBoundRefusalReason: "no whole-job bound is proved for this fixture",
      wholeJobBound: "unsupported",
      inJobReadings: "per-turn",
    },
  },
});

function journeyWith(h: Loose, overrides: Loose = {}) {
  return createJourney({
    root: ROOT,
    pmRel: PM_REL,
    store: () => store,
    runtime: h.runtime,
    describe: describeAdmitted,
    generationsRoot: GENERATIONS,
    ...overrides,
  }) as unknown as Loose;
}

async function approvedBuild(journey: Loose, executor: Executor) {
  const delivered = (await journey.deliver({ ...SELECT, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;
  expect(delivered).toMatchObject({ ok: true });
  await journey.idle();
  const run_id = String(delivered.run_id);
  const view = journey.detail(run_id) as Loose;
  expect(view.plans).toHaveLength(1);
  await journey.decide({ run_id, plan_id: view.plans[0].plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
  return run_id;
}

beforeEach(() => {
  commandSeq = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-budget-"));
  GENERATIONS = mkdtempSync(join(tmpdir(), "era-v2-budget-gen-"));
  mkdirSync(join(ROOT, PM_REL, "Budget"), { recursive: true });
  mkdirSync(join(ROOT, "src"), { recursive: true });
  mkdirSync(join(ROOT, ".delivery", "v2"), { recursive: true });
  writeFileSync(join(ROOT, PM_REL, "Budget", "4 - Checklist.md"), CHECKLIST, "utf8");
  writeFileSync(join(ROOT, PM_REL, "Budget", "Budget — Master Book.md"), BOOK, "utf8");
  writeFileSync(join(ROOT, "src", "amount.ts"), "export const amount = 25;\n", "utf8");
  // One investigation turn (500) then an implementation that crosses on its
  // second turn: 500 banked + 500 + 500 = 1500 against 1200.
  writePolicy({ allowance: 1200, enforcement: "threshold", warnAtPercent: 80 });
  store = openStore({ path: storePath() });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* a test closed it */
  }
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(GENERATIONS, { recursive: true, force: true });
});

describe.each(["claude", "codex"] as const)("an in-job crossing on %s", (executor) => {
  it("stops the open stream, keeps what it had, and never dispatches again", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const run_id = await approvedBuild(journey, executor);
    await journey.idle();

    // The implementation stopped at the crossing with the stream still open: the
    // turns after it were never produced. Claude's counters are per-turn, so two
    // build turns reach 1500; Codex's restate the whole thread, so its first
    // build turn restates the investigation's 500 and it takes three. Either way
    // the run stops at the same observed total and the scripted turn 4 never ran.
    expect(h.emitted).toBe(executor === "claude" ? 1 + 2 : 1 + 3);
    expect(h.emitted).toBeLessThan(1 + h.turns);

    const jobs = store.listJobs(run_id);
    expect(jobs).toHaveLength(2);
    expect(jobs.filter((job: Loose) => job.purpose === "repair")).toHaveLength(0);
    const build = jobs[1] as Loose;
    expect(build.stop_requested_at).not.toBeNull();
    expect(build.stop_observed_at).not.toBeNull();
    expect(build.publication_revoked).toBe(1);
    expect(build.outcome).toBe("cancelled");
    // Nothing was read that was not spent: the reservation stays open.
    expect(build.reservation_open).toBe(1);

    const budget = JSON.parse(String(build.budget_json));
    expect(budget).toMatchObject({
      mode: "threshold",
      limit: 1200,
      banked: TURN_COST,
      used: TURN_COST * 3,
      stopRequested: true,
      warned: true,
      // The turn that crossed had already been paid for. Reported, never netted off.
      overshoot: TURN_COST * 3 - 1200,
    });

    const view = journey.detail(run_id) as Loose;
    expect(view.run.lifecycle).toBe("WAITING");
    expect(view.run.waiting_reason).toBe("budget-exhausted");
    expect(view.ownerAction).toEqual({ kind: "budget", label: "Limit reached" });
    expect(view.resources.enforcement).toBe("threshold");
    expect(view.resources.settled).toBe(TURN_COST * 3);
    // Every observed turn is banked; the stop does not erase what it cost.
    expect(store.listUsageReadings(String(build.job_id))).toHaveLength(executor === "claude" ? 2 : 3);

    const kinds = view.events.map((entry: Loose) => entry.kind);
    expect(kinds).toContain("budget.warn");
    expect(kinds).toContain("budget.stop");

    // The partial bytes survive as a candidate, with no checks and no result:
    // partial work is evidence, not something that can be accepted.
    expect(view.candidates).toHaveLength(1);
    expect(view.candidates[0].changed).toEqual([{ path: "src/amount.ts", kind: "update" }]);
    expect(view.result).toBeNull();
    expect(view.evidence).toEqual([]);
  });

  it("adds nothing when a restarted supervisor reconciles the stopped run twice", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const run_id = await approvedBuild(journey, executor);
    await journey.idle();
    const before = {
      jobs: store.listJobs(run_id).length,
      readings: store.listJobs(run_id).map((job: Loose) => store.listUsageReadings(String(job.job_id)).length),
      candidates: store.listCandidates(run_id).length,
      calls: h.calls.length,
      emitted: h.emitted,
    };

    store.close();
    store = openStore({ path: storePath() });
    const restarted = journeyWith(h);
    await restarted.reconcile();
    await restarted.idle();
    await restarted.reconcile();
    await restarted.idle();

    expect(store.listJobs(run_id)).toHaveLength(before.jobs);
    expect(store.listJobs(run_id).map((job: Loose) => store.listUsageReadings(String(job.job_id)).length)).toEqual(before.readings);
    expect(store.listCandidates(run_id)).toHaveLength(before.candidates);
    // No provider was contacted and no turn was produced by either pass.
    expect(h.calls).toHaveLength(before.calls);
    expect(h.emitted).toBe(before.emitted);
    expect((restarted.detail(run_id) as Loose).run.waiting_reason).toBe("budget-exhausted");
  });

  it("shows observed activity while the stream is still open, and does not double it when it ends", async () => {
    const h = makeHarness();
    const gate = h.openGate();
    const journey = journeyWith(h);
    const run_id = await approvedBuild(journey, executor);

    // The implementation is held open mid-stream, after its first observed event.
    let mid = journey.detail(run_id) as Loose;
    for (let tries = 0; tries < 400 && !mid.jobs.some((job: Loose) => job.status === "active"); tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      mid = journey.detail(run_id) as Loose;
    }
    const build = mid.jobs.find((job: Loose) => job.access === "write");
    expect(build.status).toBe("active");
    for (let tries = 0; tries < 400 && !(journey.detail(run_id) as Loose).activity.some((entry: Loose) => entry.job_id === build.job_id); tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const live = (journey.detail(run_id) as Loose).activity.filter((entry: Loose) => entry.job_id === build.job_id);
    // DLV-109: the event is readable through the ordinary run view while the job
    // is still running — the failure this fixes was an empty panel until the end.
    expect(live.length).toBeGreaterThan(0);

    gate.open();
    await journey.idle();

    // The adapter also returns its whole buffer with the result. Under the
    // dispatch's own ordinals that is the same rows, not a second copy.
    const after = (journey.detail(run_id) as Loose).activity.filter((entry: Loose) => entry.job_id === build.job_id);
    const keys = after.map((entry: Loose) => entry.kind + "|" + entry.summary + "|" + entry.at);
    expect(new Set(keys).size).toBe(keys.length);
    expect(after.length).toBeGreaterThanOrEqual(live.length);
  });

  it("refuses a hard cap before dispatch instead of running under a weaker promise", async () => {
    writePolicy({ allowance: 1200, enforcement: "hard-cap" });
    const h = makeHarness();
    const journey = journeyWith(h);
    const outcome = (await journey.deliver({ ...SELECT, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;

    expect(outcome.ok).toBe(false);
    expect(outcome.refusals[0].detail.some((entry: Loose) => entry.code === "strict-bound-unavailable")).toBe(true);
    // Nothing ran and nothing was recorded: a refused cap is not a quiet threshold.
    expect(h.calls).toHaveLength(0);
    expect(store.listRuns()).toHaveLength(0);
  });

  it("counts and warns under advisory without interrupting the job", async () => {
    writePolicy({ allowance: 1200, enforcement: "advisory" });
    const h = makeHarness();
    const journey = journeyWith(h);
    const run_id = await approvedBuild(journey, executor);
    await journey.idle();

    // Every scripted turn ran: advisory promises a count, not a stop.
    expect(h.emitted).toBe(1 + h.turns);
    const build = store.listJobs(run_id)[1] as Loose;
    expect(build.stop_requested_at).toBeNull();
    const budget = JSON.parse(String(build.budget_json));
    expect(budget).toMatchObject({ mode: "advisory", stopRequested: false, warned: true });
    expect(budget.basis).toMatch(/stops nothing/u);
    expect((journey.detail(run_id) as Loose).events.map((entry: Loose) => entry.kind)).not.toContain("budget.stop");
  });
});
