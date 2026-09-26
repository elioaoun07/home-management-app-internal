// Command Center Phase 3 — one selected item from plan to a truthful Result.
//
// The journey is driven through the REAL Claude and Codex adapters with scripted
// SDK modules injected at their existing `importSdk` seam, a fake worker runtime
// that honours read-only access, and synthetic PM documents. Nothing here reaches
// a provider, a container or production. What it proves is the supervisor's side
// of the contract for both executors: explicit choice, read-only investigation,
// revision-bound plans and answers, native continuity, last-moment refusals,
// protected checks, reconciliation without relaunch, stop until observed, and a
// PM writeback that retries alone.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createJourney } from "../../scripts/delivery-v2/journey.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { policyTemplate } from "../../scripts/delivery-v2/policy.mjs";
import { provisionScratch } from "../../scripts/delivery-v2/scratch.mjs";
import { importTrustedCandidate } from "../../scripts/delivery-v2/checks.mjs";
import { deriveNativeSessionId } from "../../scripts/delivery-v2/adapters/claude.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const PM_REL = join("ERA Notes", "10 - Project Management");
const ROW = "- [ ] **BUD-14** quick-amount control emits 20 _(friction - S)_";
const OTHER_ROW = "- [ ] **BUD-15** keep the second amount at 50 _(annoyance - S)_";
const CHECKLIST = ["# Budget — Checklist", "", "## Now", "", ROW, OTHER_ROW, ""].join("\n");
const BOOK = [
  "# Budget — Master Book",
  "",
  "## Acceptance Criteria Index",
  "",
  "### BUD-14",
  "",
  "- **Acceptance:** the control emits 20.",
  "",
  "### BUD-15",
  "",
  "- **Acceptance:** the second amount stays 50.",
  "",
  "## Delivery session log",
  "",
  "*(Delivery runner appends dated progress bullets here automatically.)*",
  "",
].join("\n");
const SELECT_14 = { file: "Budget/4 - Checklist.md", cbidx: 0, expectLine: ROW, expectId: "BUD-14" };
const SELECT_15 = { file: "Budget/4 - Checklist.md", cbidx: 1, expectLine: OTHER_ROW, expectId: "BUD-15" };
const SETTINGS = {
  claude: { executor: "claude", model: "claude-test", effort: "low" },
  codex: { executor: "codex", model: "codex-test", effort: "low" },
} as const;
const BACKEND = { claude: "claude-agent-sdk", codex: "codex-exec-sdk" } as const;
type Executor = keyof typeof BACKEND;

let ROOT: string;
let GENERATIONS: string;
let store: ReturnType<typeof openStore>;
let commandSeq = 0;
const cmd = () => "cmd-" + ++commandSeq;

const checklistPath = () => join(ROOT, PM_REL, "Budget", "4 - Checklist.md");
const bookPath = () => join(ROOT, PM_REL, "Budget", "Budget — Master Book.md");

function writePolicy(overrides: Loose = {}) {
  const base = policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose;
  const policy = {
    ...base,
    executors: {
      ...base.executors,
      permitted: ["claude", "codex"],
      catalog: {
        revision: 1,
        models: {
          claude: [{ id: "claude-test", efforts: ["low", "high"], observedAs: ["claude-test-2026"] }],
          codex: [{ id: "codex-test" }],
        },
        profiles: {},
      },
    },
    scratchScope: { kind: "snapshot", include: ["src/amount.ts", "tests/amount.check.mjs"] },
    publicationScope: { allowedPaths: ["src/amount.ts"], changeConstraints: {} },
    criteria: [
      {
        criterion_id: "amount-check",
        proposition: "the control emits 20",
        scope: { path: "src/amount.ts" },
        observer: { kind: "command", expected: { spec_id: "amount" } },
        oracle_ref: "tests/amount.check.mjs",
        freshness_inputs: ["candidate"],
        required_for: "candidate",
      },
    ],
    checks: { specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"] } }, inputs: ["tests/amount.check.mjs"] },
    ...overrides,
  };
  writeFileSync(join(ROOT, ".delivery", "v2", "execution-policy.json"), JSON.stringify(policy), "utf8");
  return policy;
}

interface Script {
  questions?: { text: string; blocking: boolean }[];
  investigationWrites?: boolean;
  buildContent?: string;
  repairContent?: string;
  askDuringBuild?: boolean;
  effectiveModel?: string | null;
  costUsd?: number | null;
  hang?: boolean;
  dieAfterStart?: boolean;
}

/** Scripted executors, a worker runtime that honours read-only access, and a checker. */
function makeHarness() {
  const h = {
    script: {} as Script,
    calls: [] as Loose[],
    workspaces: new Map<string, string>(),
    stopObservable: true,
    gate: null as Promise<void> | null,
    zeroTests: false,
    retained: new Map<string, Loose[]>(),
    denied: [] as string[],
    checks: [] as string[],
    runtime: {} as Loose,
  };

  const writeIn = (dir: string, access: string, path: string, content: string) => {
    if (access !== "write") {
      h.denied.push(path);
      return;
    }
    writeFileSync(join(dir, path), content, "utf8");
  };

  const reply = (prompt: string, dir: string, access: string) => {
    const script = h.script;
    if (prompt.startsWith("Investigate") || prompt.startsWith("Continue this work from a handoff")) {
      if (script.investigationWrites) writeIn(dir, access, "src/amount.ts", "export const amount = 99;\n");
      const answered = /Owner answers:/u.test(prompt);
      const plan = {
        outcome: "emit 20",
        scope: ["src/amount.ts"],
        steps: /Requested change:/u.test(prompt) ? ["change the constant", "add the requested note"] : ["change the constant"],
        risks: [],
        unknowns: [],
        checks: ["node tests/amount.check.mjs"],
        questions: !answered && script.questions ? script.questions : [],
      };
      return "Plan:\n```json\n" + JSON.stringify(plan) + "\n```";
    }
    if (prompt.startsWith("Implement")) {
      if (script.askDuringBuild && !/Owner answers:/u.test(prompt)) return '```json\n{"questions":[{"text":"Which file holds it?","blocking":true}]}\n```';
      writeIn(dir, access, "src/amount.ts", script.buildContent ?? "export const amount = 20;\n");
      return "done";
    }
    if (prompt.startsWith("The owner reviewed the checked candidate")) {
      writeIn(dir, access, "src/amount.ts", script.repairContent ?? "export const amount = 20;\n");
      return "revised";
    }
    if (prompt.startsWith("Protected checks failed")) {
      writeIn(dir, access, "src/amount.ts", script.repairContent ?? "export const amount = 20;\n");
      return "repaired";
    }
    return "unrecognised";
  };

  const waitForAbort = async (signal: AbortSignal | undefined) => {
    await new Promise<void>((resolve) => {
      if (!signal || signal.aborted) return resolve();
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    // The stream ends a moment after the environment is removed.
    await new Promise((resolve) => setTimeout(resolve, 25));
  };

  const claudeSdk = (job: Loose, dir: string) => ({
    query: ({ prompt, options }: { prompt: string; options: Loose }) =>
      (async function* () {
        h.calls.push({ backend: BACKEND.claude, job_id: String(job.job_id), access: String(job.access), kind: options.resume ? "resume" : "start", prompt, options });
        yield { type: "system", subtype: "init", model: h.script.effectiveModel ?? options.model ?? "claude-default", session_id: options.resume || options.sessionId };
        if (options.hooks) await options.hooks.PreToolUse[0].hooks[0]({ tool_name: "Read", effort: { level: options.effort ?? "high" } });
        yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "tool_use", name: "Read" }] } };
        if (h.script.dieAfterStart) throw new Error("worker process died");
        if (h.script.hang) {
          await waitForAbort(options.abortController?.signal);
          return;
        }
        const text = reply(prompt, dir, String(job.access));
        yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text }] } };
        yield {
          type: "result",
          subtype: "success",
          is_error: false,
          result: text,
          total_cost_usd: h.script.costUsd === undefined ? 0.01 : h.script.costUsd,
          usage: { input_tokens: 100, output_tokens: 20 },
          modelUsage: { [String(options.model || "claude-default")]: {} },
        };
      })(),
  });

  const codexSdk = (job: Loose, dir: string) => {
    const thread = (threadOptions: Loose, id: string | null) => ({
      async runStreamed(prompt: string, turnOptions: Loose = {}) {
        h.calls.push({ backend: BACKEND.codex, job_id: String(job.job_id), access: String(job.access), kind: id ? "resume" : "start", prompt, options: threadOptions, threadId: id });
        return {
          events: (async function* () {
            yield { type: "thread.started", thread_id: id || "thr-" + job.job_id };
            yield { type: "item.completed", item: { type: "command_execution", command: "cat src/amount.ts" } };
            if (h.script.dieAfterStart) throw new Error("worker process died");
            if (h.script.hang) {
              await waitForAbort(turnOptions.signal);
              return;
            }
            const text = reply(prompt, dir, String(job.access));
            yield { type: "item.completed", item: { type: "agent_message", text } };
            yield { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 5 } };
          })(),
        };
      },
    });
    return {
      Codex: class {
        startThread(threadOptions: Loose) {
          return thread(threadOptions, null);
        }
        resumeThread(id: string, threadOptions: Loose) {
          return thread(threadOptions, id);
        }
      },
    };
  };

  const replay = (backend: string, records: Loose[]) =>
    backend === BACKEND.claude
      ? {
          query: () =>
            (async function* () {
              for (const record of records) yield record;
            })(),
        }
      : {
          Codex: class {
            startThread() {
              return { runStreamed: async () => ({ events: (async function* () { for (const record of records) yield record; })() }) };
            }
            resumeThread() {
              return this.startThread();
            }
          },
        };

  h.runtime = {
    kind: "fake-worker",
    boundary: { image: "fake-worker", digest: "sha256:fake-boundary" },
    workspaceFor: ({ access }: Loose) => ({ root: "/work", backing: "fake-volume", access }),
    binding: async (backend_id: string) => ({ backend_id, sdk_version: "fixture", boundary_digest: "sha256:fake", battery_digest: "sha256:battery" }),
    provision: async ({ run_id, job, include }: Loose) => {
      if (h.gate) await h.gate;
      let base_manifest = null;
      if (!h.workspaces.has(run_id)) {
        const dir = mkdtempSync(join(tmpdir(), "era-v2-ws-"));
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
    recover: async (job: Loose) => {
      const records = h.retained.get(String(job.job_id));
      return records ? { running: false, importSdk: async () => replay(String(job.backend_id), records), source: "retained fixture log" } : null;
    },
    exportCandidate: async ({ run_id, job_id, generation, generationsRoot, base_manifest }: Loose) =>
      importTrustedCandidate({ sourceRoot: h.workspaces.get(run_id)!, generationsRoot, generation, job_id, base_manifest }).candidate,
    checkExecutor:
      ({ candidate }: Loose) =>
      () => {
        h.checks.push(String(candidate.generation));
        if (h.zeroTests) return { exitCode: 0, stdout: "No test files found", stderr: "", spawnError: null };
        const content = readFileSync(join(candidate.root, "src", "amount.ts"), "utf8");
        return content.includes("= 20;")
          ? { exitCode: 0, stdout: "Tests  1 passed (1)", stderr: "", spawnError: null }
          : { exitCode: 1, stdout: "Tests  1 failed | 0 passed (1)", stderr: "", spawnError: null };
      },
  };
  return h;
}

/** A synthetic admitted profile: the journey is under test here, not containment. */
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
    resources: { strictBound: false, strictBoundRefusalReason: "fixture" },
  },
});

function journeyWith(h: ReturnType<typeof makeHarness>, overrides: Loose = {}) {
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

async function deliverPlan(journey: Loose, executor: Executor, selection: Loose = SELECT_14) {
  const outcome = (await journey.deliver({ ...selection, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;
  expect(outcome.ok).toBe(true);
  await journey.idle();
  return outcome;
}

const detailOf = (journey: Loose, run_id: string) => journey.detail(run_id) as Loose;
const latestPlanOf = (journey: Loose, run_id: string) => {
  const plans = detailOf(journey, run_id).plans;
  return plans[plans.length - 1];
};

beforeEach(() => {
  commandSeq = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-journey-"));
  GENERATIONS = mkdtempSync(join(tmpdir(), "era-v2-generations-"));
  mkdirSync(join(ROOT, PM_REL, "Budget"), { recursive: true });
  mkdirSync(join(ROOT, "src"), { recursive: true });
  mkdirSync(join(ROOT, "tests"), { recursive: true });
  mkdirSync(join(ROOT, ".delivery", "v2"), { recursive: true });
  writeFileSync(checklistPath(), CHECKLIST, "utf8");
  writeFileSync(bookPath(), BOOK, "utf8");
  writeFileSync(join(ROOT, "src", "amount.ts"), "export const amount = 25;\n", "utf8");
  writeFileSync(join(ROOT, "tests", "amount.check.mjs"), "// synthetic check\n", "utf8");
  writePolicy();
  store = openStore({ path: join(ROOT, ".delivery", "v2", "supervisor.sqlite") });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(GENERATIONS, { recursive: true, force: true });
});

describe.each(["claude", "codex"] as const)("one dependable journey on %s", (executor) => {
  it("runs plan → approval → implementation → protected check → verified Result", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, executor);
    const run_id = String(delivered.run_id);

    // Read-only investigation, with the run's own settings forwarded.
    const investigation = h.calls[0];
    expect(investigation.backend).toBe(BACKEND[executor]);
    expect(investigation.access).toBe("read-only");
    if (executor === "claude") {
      expect(investigation.options.model).toBe("claude-test");
      expect(investigation.options.effort).toBe("low");
      expect(investigation.options.tools).toEqual(["Read", "Grep", "Glob"]);
    } else {
      expect(investigation.options.model).toBe("codex-test");
      expect(investigation.options.modelReasoningEffort).toBe("low");
      expect(investigation.options.sandboxMode).toBe("read-only");
    }
    let view = detailOf(journey, run_id);
    expect(view.run.waiting_reason).toBe("plan-review");
    expect(view.ownerAction.label).toBe("Review plan");
    expect(view.plans).toHaveLength(1);
    expect(view.plans[0].body.steps).toEqual([{ title: "change the constant" }]);
    expect(view.plans[0]).toMatchObject({ contract_revision: 1, raw_text: expect.stringContaining('"outcome":"emit 20"') });
    expect(view.plans[0].digest).toMatch(/^sha256:/u);
    expect(view.stage.stages[view.stage.current]).toBe("Plan");
    const effective = view.jobs[0].effective;
    if (executor === "claude") {
      expect(effective.verification.model.state).toBe("matched");
      expect(effective.verification.effort.state).toBe("matched");
    } else {
      // Codex 0.144.1 events carry neither: unreported is its own state, not a match.
      expect(effective.verification.model.state).toBe("unreported");
      expect(effective.verification.effort.state).toBe("unreported");
    }

    const decided = (await journey.decide({ run_id, plan_id: view.plans[0].plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(decided.ok).toBe(true);
    await journey.idle();

    // The implementation continues the investigation's native session.
    const implementation = h.calls[1];
    expect(implementation.access).toBe("write");
    expect(implementation.kind).toBe("resume");
    const firstJob = store.listJobs(run_id)[0];
    if (executor === "claude") expect(implementation.options.resume).toBe(deriveNativeSessionId(String(firstJob.job_id)));
    else expect(implementation.threadId).toBe("thr-" + firstJob.job_id);

    view = detailOf(journey, run_id);
    expect(view.run.lifecycle).toBe("CLOSED");
    expect(view.run.closed_outcome).toBe("verified_candidate");
    expect(view.candidate.changed).toEqual([{ path: "src/amount.ts", kind: "update", review: {
      state: "available", beforeHash: expect.stringMatching(/^sha256:/u), afterHash: expect.stringMatching(/^sha256:/u),
      diff: "--- a/src/amount.ts\n+++ b/src/amount.ts\n@@ -1,1 +1,1 @@\n-export const amount = 25;\n+export const amount = 20;",
    } }]);
    expect(view.candidates).toEqual([expect.objectContaining({ generation: "C1", changed: [{ path: "src/amount.ts", kind: "update" }] })]);
    // DLV-120: the checker's own output is retained and read back from the
    // artifact store, not hashed away. `outcome` says which shape this was.
    expect(view.evidence).toEqual([
      expect.objectContaining({
        criterion_id: "amount-check",
        criterion_revision: 1,
        state: "satisfied",
        runner: "delivery-v2/protected-checker",
        outcome: "passed",
        output: expect.stringContaining("Tests  1 passed (1)"),
      }),
    ]);
    expect(view.result.candidateVerified).toBe(true);
    expect(view.result.observedDisposition).toBe("verified_candidate");
    expect(view.result.projection_status).toBe("current");
    expect(view.ownerAction.label).toBe("Apply");
    expect(view.applications).toEqual([]);
    expect(h.calls.every((call) => call.backend === BACKEND[executor])).toBe(true);

    // The writeback is a session-log line; the checkbox is not ticked.
    expect(readFileSync(bookPath(), "utf8")).toMatch(new RegExp("\\*\\*BUD-14\\*\\* V2 run `" + run_id + "` · candidate verified; not applied"));
    expect(readFileSync(checklistPath(), "utf8")).toContain(ROW);
    // The host checkout was never written by the worker.
    expect(readFileSync(join(ROOT, "src", "amount.ts"), "utf8")).toBe("export const amount = 25;\n");
  });

  it("denies a write attempted during investigation", async () => {
    const h = makeHarness();
    h.script.investigationWrites = true;
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, executor);
    expect(h.denied).toEqual(["src/amount.ts"]);
    expect(readFileSync(join(h.workspaces.get(String(delivered.run_id))!, "src", "amount.ts"), "utf8")).toBe("export const amount = 25;\n");
    expect(detailOf(journey, String(delivered.run_id)).run.waiting_reason).toBe("plan-review");
  });

  it("reconciles a crash after dispatch from retained output, without relaunching", async () => {
    const h = makeHarness();
    h.script.dieAfterStart = true;
    const first = journeyWith(h);
    const delivered = await deliverPlan(first, executor);
    const run_id = String(delivered.run_id);
    const job = store.listJobs(run_id)[0];
    expect(job.status).toBe("unknown");
    expect(job.dispatch_started_at).not.toBeNull();
    expect(detailOf(first, run_id).ownerAction.label).toBe("Reconcile");

    // The worker had in fact finished; its output was retained.
    const plan = '```json\n{"outcome":"emit 20","steps":["change the constant"]}\n```';
    h.retained.set(
      String(job.job_id),
      executor === "claude"
        ? [
            { type: "system", subtype: "init", model: "claude-test", session_id: job.native_ref },
            { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text: plan }] } },
            { type: "result", subtype: "success", is_error: false, result: plan, total_cost_usd: 0.02, usage: { input_tokens: 10 } },
          ]
        : [
            { type: "thread.started", thread_id: job.native_ref },
            { type: "item.completed", item: { type: "agent_message", text: plan } },
            { type: "turn.completed", usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0 } },
          ],
    );
    h.script.dieAfterStart = false;

    // A new supervisor process over the same store.
    store.close();
    store = openStore({ path: join(ROOT, ".delivery", "v2", "supervisor.sqlite") });
    const restarted = journeyWith(h);
    await restarted.reconcile();
    await restarted.idle();

    expect(h.calls).toHaveLength(1);
    expect(store.listJobs(run_id)).toHaveLength(1);
    expect(store.getJob(String(job.job_id))!.status).toBe("finished");
    const view = detailOf(restarted, run_id);
    expect(view.plans).toHaveLength(1);
    expect(view.run.waiting_reason).toBe("plan-review");
  });

  it("keeps a cancel stop-requested until the environment observes it", async () => {
    const h = makeHarness();
    h.script.hang = true;
    h.stopObservable = false;
    const journey = journeyWith(h);
    const delivered = (await journey.deliver({ ...SELECT_14, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;
    const run_id = String(delivered.run_id);
    for (let tries = 0; tries < 200 && store.listJobs(run_id)[0]?.status !== "active"; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const stopped = (await journey.control({ run_id, action: "stop", command_id: cmd(), actor: "owner" })) as Loose;
    expect(stopped.stops[0].display).toBe("Stop requested");
    await journey.idle();

    let view = detailOf(journey, run_id);
    expect(view.run.lifecycle).toBe("WAITING");
    expect(view.run.waiting_reason).toBe("stop-requested");
    expect(view.jobs[0].stop).toBe("Stop requested");
    expect(view.stage.branch).toBe("stop-requested");

    h.stopObservable = true;
    await journey.control({ run_id, action: "stop", command_id: cmd(), actor: "owner" });
    await journey.idle();
    view = detailOf(journey, run_id);
    expect(view.jobs[0].stop).toBe("Stopped");
    expect(view.run.closed_outcome).toBe("cancelled");
    expect(view.result.candidateVerified).toBe(false);
  });
});

describe("plans, questions and answers bind their revision", () => {
  it("refuses approval while a blocking question is open and answers only for the asking revision", async () => {
    const h = makeHarness();
    h.script.questions = [{ text: "Keep the old amount visible?", blocking: true }];
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    let view = detailOf(journey, run_id);
    expect(view.run.waiting_reason).toBe("question");
    expect(view.ownerAction.label).toBe("Answer");

    const blocked = (await journey.decide({ run_id, plan_id: view.plans[0].plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(blocked.refusals[0].code).toBe("blocking-question-open");

    const question = view.questions[0];
    const wrong = (await journey.answer({ run_id, question_id: question.question_id, plan_revision: 2, answer: "no", command_id: cmd(), actor: "owner" })) as Loose;
    expect(wrong.refusals[0].code).toBe("question-superseded");

    const answerCommand = cmd();
    const answered = (await journey.answer({ run_id, question_id: question.question_id, plan_revision: 1, answer: "no", command_id: answerCommand, actor: "owner" })) as Loose;
    expect(answered.ok).toBe(true);
    await journey.idle();
    // The same answer sent again is the same command: no second investigation.
    const again = (await journey.answer({ run_id, question_id: question.question_id, plan_revision: 1, answer: "no", command_id: answerCommand, actor: "owner" })) as Loose;
    expect(again.duplicate).toBe(true);
    await journey.idle();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1].prompt).toMatch(/Owner answers:[\s\S]*Keep the old amount visible\? → no/u);

    view = detailOf(journey, run_id);
    expect(view.plans.map((plan: Loose) => plan.status)).toEqual(["superseded", "proposed"]);

    // A second answer to the superseded question is refused, not applied.
    const late = (await journey.answer({ run_id, question_id: question.question_id, plan_revision: 1, answer: "yes", command_id: cmd(), actor: "owner" })) as Loose;
    expect(late.ok).toBe(false);
  });

  it("invalidates an older plan when a revision is requested", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "codex");
    const run_id = String(delivered.run_id);
    const first = latestPlanOf(journey, run_id);
    const revised = (await journey.decide({ run_id, plan_id: first.plan_id, plan_revision: 1, decision: "revise", feedback: "add the requested note", command_id: cmd(), actor: "owner" })) as Loose;
    expect(revised.ok).toBe(true);
    await journey.idle();
    expect(h.calls[1].access).toBe("read-only");
    expect(h.calls[1].prompt).toMatch(/Requested change: add the requested note/u);

    const stale = (await journey.decide({ run_id, plan_id: first.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(stale.refusals[0].code).toBe("plan-revision-superseded");
    const second = latestPlanOf(journey, run_id);
    expect(second.revision).toBe(2);
    expect(second.body.steps.map((step: Loose) => step.title)).toContain("add the requested note");
  });

  it("stops on a blocking build question and continues under the same approval", async () => {
    const h = makeHarness();
    h.script.askDuringBuild = true;
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    let view = detailOf(journey, run_id);
    expect(view.run.waiting_reason).toBe("question");
    const question = view.questions.find((entry: Loose) => entry.stage === "build");
    await journey.answer({ run_id, question_id: question.question_id, plan_revision: question.plan_revision, answer: "src/amount.ts", command_id: cmd(), actor: "owner" });
    await journey.idle();
    view = detailOf(journey, run_id);
    expect(h.calls[2].access).toBe("write");
    expect(view.run.closed_outcome).toBe("verified_candidate");
  });

  it("gives a message a receipt that moves only when a job carries it", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    const queued = (await journey.message({ run_id, body: "keep the label short", command_id: cmd(), actor: "owner" })) as Loose;
    expect(queued.receipt).toBe("Queued");
    const gate = { release: () => undefined as void };
    h.gate = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    expect(detailOf(journey, run_id).messages[0].receipt).toBe("Awaiting next turn");
    h.gate = null;
    gate.release();
    await journey.idle();
    expect(detailOf(journey, run_id).messages[0].receipt).toBe("Delivered");
    expect(h.calls[1].prompt).toMatch(/keep the label short/u);
  });

  it("answers a repeated approval from its receipt without a second implementation", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "codex");
    const run_id = String(delivered.run_id);
    const plan = latestPlanOf(journey, run_id);
    const approve = cmd();
    await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: approve, actor: "owner" });
    const repeated = (await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: approve, actor: "owner" })) as Loose;
    expect(repeated.duplicate).toBe(true);
    const fresh = (await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(fresh.refusals[0].code).toBe("plan-already-decided");
    await journey.idle();
    expect(store.listJobs(run_id).filter((job: Loose) => job.access === "write")).toHaveLength(1);
  });
});

describe("source, grant and policy changes refuse stale continuation", () => {
  async function planned(h: ReturnType<typeof makeHarness>) {
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    return { journey, run_id, plan: latestPlanOf(journey, run_id) };
  }

  it("refuses implementation when the selected row changed after planning", async () => {
    const h = makeHarness();
    const { journey, run_id, plan } = await planned(h);
    writeFileSync(checklistPath(), CHECKLIST.replace("emits 20", "emits 25"), "utf8");
    const decided = (await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(decided.continuation.ok).toBe(false);
    expect(JSON.stringify(decided.continuation.refusals)).toMatch(/source-stale/u);
    await journey.idle();
    expect(h.calls.filter((call) => call.access === "write")).toHaveLength(0);
    expect(detailOf(journey, run_id).run.waiting_reason).toBe("continuation-refused");
  });

  it("refuses at the moment of dispatch when acceptance changes after admission", async () => {
    const h = makeHarness();
    const { journey, run_id, plan } = await planned(h);
    const gate = { release: () => undefined as void };
    h.gate = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    const decided = (await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(decided.continuation.ok).toBe(true);
    writeFileSync(bookPath(), BOOK.replace("the control emits 20.", "the control emits 20 and announces it."), "utf8");
    h.gate = null;
    gate.release();
    await journey.idle();
    const job = store.getJob(decided.continuation.job_id)!;
    expect(job.status).toBe("finished");
    expect(job.outcome).toBe("cancelled");
    expect(job.dispatch_started_at).toBeNull();
    expect(job.reservation_open).toBe(0);
    expect(String(job.reason)).toMatch(/stale-selected-source/u);
    expect(h.calls.filter((call) => call.access === "write")).toHaveLength(0);
  });

  it("refuses at dispatch when the policy revision moved", async () => {
    const h = makeHarness();
    const { journey, run_id, plan } = await planned(h);
    const gate = { release: () => undefined as void };
    h.gate = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    const decided = (await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    writePolicy({ policy_revision: 2 });
    h.gate = null;
    gate.release();
    await journey.idle();
    expect(String(store.getJob(decided.continuation.job_id)!.reason)).toMatch(/policy-revision-moved/u);
  });

  it("closes a stopped run and refuses every later command under its revoked grant", async () => {
    const h = makeHarness();
    const { journey, run_id, plan } = await planned(h);
    const stopped = (await journey.control({ run_id, action: "stop", command_id: cmd(), actor: "owner" })) as Loose;
    expect(stopped.closed).toBe(true);
    const decided = (await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" })) as Loose;
    expect(decided.refusals[0].code).toBe("run-closed");
    expect(detailOf(journey, run_id).run.closed_outcome).toBe("cancelled");
  });
});

describe("checks decide the Result, never the executor", () => {
  it("spends exactly one repair on a failed check and verifies the repaired generation", async () => {
    const h = makeHarness();
    h.script.buildContent = "export const amount = 21;\n";
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "codex");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(h.checks).toEqual(["C1", "C2"]);
    const view = detailOf(journey, run_id);
    expect(store.listJobs(run_id).map((job: Loose) => job.purpose)).toEqual(["investigate", "resume", "repair"]);
    expect(view.result.result_version).toBe(2);
    expect(view.run.closed_outcome).toBe("verified_candidate");
  });

  it("closes as failed when the repair also fails, without a second repair", async () => {
    const h = makeHarness();
    h.script.buildContent = "export const amount = 21;\n";
    h.script.repairContent = "export const amount = 22;\n";
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    const view = detailOf(journey, run_id);
    expect(store.listJobs(run_id).filter((job: Loose) => job.purpose === "repair")).toHaveLength(1);
    expect(view.run.closed_outcome).toBe("failed");
    expect(view.result.candidateVerified).toBe(false);
    expect(view.result.workComplete).toBe(false);
    expect(view.result.remaining_obligations.map((entry: Loose) => entry.kind)).toContain("criterion");
  });

  it("treats a zero-test check as not tested: no pass, no repair", async () => {
    const h = makeHarness();
    h.zeroTests = true;
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    let view = detailOf(journey, run_id);
    expect(view.evidence[0]).toMatchObject({ state: "missing", reason: "zero-executed", label: "Not tested" });
    expect(view.result.candidateVerified).toBe(false);
    expect(view.run.waiting_reason).toBe("checks-inconclusive");
    expect(store.listJobs(run_id).some((job: Loose) => job.purpose === "repair")).toBe(false);

    h.zeroTests = false;
    await journey.control({ run_id, action: "recheck", command_id: cmd(), actor: "owner" });
    view = detailOf(journey, run_id);
    expect(view.result.candidateVerified).toBe(true);
    expect(view.run.closed_outcome).toBe("verified_candidate");
  });

  it("retries only the PM writeback after it fails", async () => {
    const h = makeHarness();
    let failures = 1;
    const journey = journeyWith(h, {
      writeProjection: (input: Loose) => {
        if (failures-- > 0) throw new Error("Master Book locked");
        return { written: true, path: input.root };
      },
    });
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    let view = detailOf(journey, run_id);
    expect(view.result.projection_status).toBe("failed");
    expect(view.result.candidateVerified).toBe(true);
    expect(view.ownerAction.label).toBe("Retry writeback");
    const calls = h.calls.length;
    const retried = (await journey.control({ run_id, action: "retry-projection", command_id: cmd(), actor: "owner" })) as Loose;
    expect(retried.projection_status).toBe("current");
    view = detailOf(journey, run_id);
    expect(h.calls).toHaveLength(calls);
    expect(store.listResults(run_id)).toHaveLength(1);
    expect(h.checks).toEqual(["C1"]);
  });
});

describe("resources keep unknown usage unknown", () => {
  it("never reads an executor with no monetary reading as free", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "codex");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    let view = detailOf(journey, run_id);
    expect(view.resources.settled).toBe(0);
    expect(view.resources.unknown.length).toBeGreaterThan(0);
    expect(view.resources.provenance.providerReportedUsd).toBeNull();
    expect(view.resources.provenance.measuredTokens.input).toBeGreaterThan(0);
    expect(view.result.candidateVerified).toBe(true);
    expect(view.result.workComplete).toBe(false);
    expect(view.result.remaining_obligations.map((entry: Loose) => entry.kind)).toContain("unresolved-resource");

    const acknowledged = (await journey.control({ run_id, action: "acknowledge-usage", command_id: cmd(), actor: "owner" })) as Loose;
    expect(acknowledged.released.length).toBeGreaterThan(0);
    view = detailOf(journey, run_id);
    expect(view.resources.openReservations).toBe(0);
    expect(view.resources.unknown.length).toBeGreaterThan(0);
  });

  it("refuses to start under a finite allowance with no numeric reservation", async () => {
    writePolicy({ resources: { unit: "usd", allowance: 5, strict: false, perJobReservation: { amount: null, basis: "unknown" } } });
    const journey = journeyWith(makeHarness());
    const outcome = (await journey.deliver({ ...SELECT_14, ...SETTINGS.claude, command_id: cmd(), actor: "owner" })) as Loose;
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome.refusals)).toMatch(/unknown-next-reservation-under-allowance/u);
  });
});

describe("the executor is chosen per run and never substituted", () => {
  it("refuses a missing executor, an unsupported effort and an unlisted model before writing anything", async () => {
    const journey = journeyWith(makeHarness());
    const none = (await journey.deliver({ ...SELECT_14, command_id: cmd(), actor: "owner" })) as Loose;
    expect(none.refusals[0].code).toBe("no-executor-selected");
    const codexMax = (await journey.deliver({ ...SELECT_14, executor: "codex", effort: "max", command_id: cmd(), actor: "owner" })) as Loose;
    expect(JSON.stringify(codexMax.refusals)).toMatch(/unsupported-effort/u);
    const claudeMinimal = (await journey.deliver({ ...SELECT_14, executor: "claude", effort: "minimal", command_id: cmd(), actor: "owner" })) as Loose;
    expect(JSON.stringify(claudeMinimal.refusals)).toMatch(/unsupported-effort/u);
    const unlisted = (await journey.deliver({ ...SELECT_14, executor: "claude", model: "not-listed", command_id: cmd(), actor: "owner" })) as Loose;
    expect(JSON.stringify(unlisted.refusals)).toMatch(/model-not-in-catalog/u);
    expect(store.listRuns()).toEqual([]);
  });

  it("runs two items on two executors side by side without crossing them", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const claudeRun = await deliverPlan(journey, "claude", SELECT_14);
    const codexRun = await deliverPlan(journey, "codex", SELECT_15);
    const byRun = (run_id: string) => h.calls.filter((call) => store.getJob(call.job_id)!.run_id === run_id).map((call) => call.backend);
    expect(byRun(String(claudeRun.run_id))).toEqual([BACKEND.claude]);
    expect(byRun(String(codexRun.run_id))).toEqual([BACKEND.codex]);
    const list = journey.list() as Loose[];
    expect(list.map((entry) => entry.executor).sort()).toEqual(["claude", "codex"]);
  });

  it("refuses a second run for an item that already has one, and answers a repeated deliver from its receipt", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const command_id = cmd();
    const first = (await journey.deliver({ ...SELECT_14, ...SETTINGS.claude, command_id, actor: "owner" })) as Loose;
    const repeated = (await journey.deliver({ ...SELECT_14, ...SETTINGS.claude, command_id, actor: "owner" })) as Loose;
    expect(repeated.duplicate).toBe(true);
    expect(repeated.job_id).toBe(first.job_id);
    const another = (await journey.deliver({ ...SELECT_14, ...SETTINGS.codex, command_id: cmd(), actor: "owner" })) as Loose;
    expect(another.refusals[0].code).toBe("work-already-has-active-run");
    await journey.idle();
    expect(h.calls).toHaveLength(1);
  });

  it("holds a mismatched effective model and hands off explicitly to the other executor", async () => {
    const h = makeHarness();
    h.script.effectiveModel = "a-different-model";
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    let view = detailOf(journey, run_id);
    expect(view.run.waiting_reason).toBe("settings-mismatch");
    expect(view.ownerAction.label).toBe("Settings mismatch");
    expect(view.plans).toHaveLength(0);
    expect(view.jobs[0].effective.verification.model).toMatchObject({ state: "mismatched", requested: "claude-test", effective: "a-different-model" });

    const handed = (await journey.control({ run_id, action: "handoff", executor: "codex", model: "codex-test", effort: "low", command_id: cmd(), actor: "owner" })) as Loose;
    expect(handed.ok).toBe(true);
    await journey.idle();
    view = detailOf(journey, run_id);
    expect(h.calls[h.calls.length - 1].backend).toBe(BACKEND.codex);
    expect(h.calls[h.calls.length - 1].kind).toBe("start");
    expect(view.settings.executor).toBe("codex");
    expect(view.settings.history[0].backend_id).toBe(BACKEND.claude);
    expect(view.plans).toHaveLength(1);
  });

  it("reaches the qualification gate with the real profile description and admits nothing", async () => {
    const journey = createJourney({ root: ROOT, pmRel: PM_REL, store: () => store, runtime: makeHarness().runtime, generationsRoot: GENERATIONS }) as unknown as Loose;
    const outcome = (await journey.deliver({ ...SELECT_14, ...SETTINGS.claude, command_id: cmd(), actor: "owner" })) as Loose;
    expect(outcome.ok).toBe(false);
    expect(outcome.refusals[0].code).toBe("profile-not-admitted");
    expect(store.listRuns()).toEqual([]);
  });
});

describe("pause and resume", () => {
  it("pauses an active investigation until stopped, then resumes the same native session", async () => {
    const h = makeHarness();
    h.script.hang = true;
    const journey = journeyWith(h);
    const delivered = (await journey.deliver({ ...SELECT_14, ...SETTINGS.claude, command_id: cmd(), actor: "owner" })) as Loose;
    const run_id = String(delivered.run_id);
    for (let tries = 0; tries < 200 && store.listJobs(run_id)[0]?.status !== "active"; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const paused = (await journey.control({ run_id, action: "pause", command_id: cmd(), actor: "owner" })) as Loose;
    expect(paused.stops[0].display).toBe("Stop requested");
    await journey.idle();
    let view = detailOf(journey, run_id);
    expect(view.jobs[0].stop).toBe("Stopped");
    expect(view.run.waiting_reason).toBe("paused");
    expect(view.ownerAction.label).toBe("Resume");

    h.script.hang = false;
    const resumed = (await journey.control({ run_id, action: "resume", command_id: cmd(), actor: "owner" })) as Loose;
    expect(resumed.ok).toBe(true);
    await journey.idle();
    view = detailOf(journey, run_id);
    expect(h.calls[1].kind).toBe("resume");
    expect(h.calls[1].access).toBe("read-only");
    expect(view.plans).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DLV-108 — recovery after a job has finished.
//
// `dispatch_started_at` closes the window before the provider call. This suite
// covers the window *after* the outcome is known: settlement is committed and
// the usage is banked, but the artifacts the outcome owes — plan, candidate,
// evidence, result, writeback — are written outside that transaction. A job in
// that window is terminal, so the outstanding scan cannot see it, and before
// schema 8 nothing else could either.
//
// Each test drops the process at one boundary, reopens the store in a new
// supervisor, and reconciles TWICE. They assert the same four properties,
// because they are what "recovered" has to mean here:
//
//   exactly-once completion  one plan / one candidate / one result, at result
//                            version 1 — never a second transition for facts
//                            already recorded
//   no redispatch            `h.calls` does not grow; no adapter is entered
//   no doubled usage         the run's banked token and cost totals are the
//                            same numbers after recovery as before it
//   recoverable artifacts    the candidate bytes, evidence and PM writeback the
//                            crash interrupted all exist afterwards
//
// The second reconcile is not decoration: it is the difference between "the
// recovery worked" and "the recovery is idempotent", and an unattended restart
// loop needs the second one.
// ---------------------------------------------------------------------------

/** A store that loses the process immediately before one chosen write. */
function crashingStore(real: Loose, fire: (method: string, args: Loose[]) => boolean): Loose {
  let fired = false;
  return new Proxy(real, {
    get(target: Loose, prop: string | symbol) {
      const value = target[prop as string];
      if (typeof value !== "function") return value;
      return (...args: Loose[]) => {
        if (!fired && fire(String(prop), args)) {
          fired = true;
          // Everything committed before this point survives; this call and
          // everything after it does not. That is the crash.
          throw new Error("process lost before " + String(prop));
        }
        return value.apply(target, args);
      };
    },
  }) as Loose;
}

/** What the run has actually banked, across every job. */
function spendOf(run_id: string) {
  const readings = store.listJobs(run_id).flatMap((job: Loose) => store.listUsageReadings(String(job.job_id)) as Loose[]);
  return {
    rows: readings.length,
    input: readings.reduce((total: number, row: Loose) => total + Number(row.input || 0), 0),
    output: readings.reduce((total: number, row: Loose) => total + Number(row.output || 0), 0),
    costUsd: readings.reduce((total: number, row: Loose) => total + Number(row.cost_usd || 0), 0),
  };
}

const storePath = () => join(ROOT, ".delivery", "v2", "supervisor.sqlite");
const SQLITE_MODULE: string = "node:sqlite";

/** A fresh supervisor process over the same on-disk store. */
function restart(h: ReturnType<typeof makeHarness>) {
  store.close();
  store = openStore({ path: storePath() });
  return journeyWith(h);
}

describe.each(["claude", "codex"] as const)("DLV-108 terminal-job recovery on %s", (executor) => {
  it("recovers an investigation lost between settlement and its plan", async () => {
    const h = makeHarness();
    // The environment cleanup that runs between the outcome and the follow-on.
    h.runtime.release = async () => {
      throw new Error("process lost during cleanup");
    };
    const journey = journeyWith(h);
    const delivered = (await journey.deliver({ ...SELECT_14, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;
    const run_id = String(delivered.run_id);
    await journey.idle();

    // The interrupted shape: terminal and paid for, with nothing to show for it.
    const job = store.listJobs(run_id)[0];
    expect(job.status).toBe("finished");
    expect(job.settled_at).not.toBeNull();
    expect(job.after_state).toBeNull();
    expect(store.listPlans(run_id)).toHaveLength(0);
    const banked = spendOf(run_id);
    expect(banked.rows).toBeGreaterThan(0);
    // Invisible to the scan that exists for the other side of the dispatch.
    expect(store.listOutstandingJobs()).toEqual([]);
    expect(store.listSettledUnprocessedJobs().map((row: Loose) => String(row.job_id))).toEqual([String(job.job_id)]);

    h.runtime.release = async () => undefined;
    const restarted = restart(h);
    expect(detailOf(restarted, run_id).ownerAction.label).toBe("Reconcile");

    const first = (await restarted.reconcile()) as Loose;
    await restarted.idle();
    expect(first.settled).toEqual([{ job_id: String(job.job_id), run_id, after_state: "done" }]);

    let view = detailOf(restarted, run_id);
    expect(view.plans).toHaveLength(1);
    expect(view.plans[0].body.steps).toEqual([{ title: "change the constant" }]);
    expect(view.run.waiting_reason).toBe("plan-review");
    expect(view.ownerAction.label).toBe("Review plan");
    expect(h.calls).toHaveLength(1);
    expect(spendOf(run_id)).toEqual(banked);
    const recovered = view.plans[0].plan_id;

    // Twice. Nothing is proposed again, nothing is charged again.
    const second = (await restarted.reconcile()) as Loose;
    await restarted.idle();
    expect(second.settled).toEqual([]);
    view = detailOf(restarted, run_id);
    expect(view.plans).toHaveLength(1);
    expect(view.plans[0].plan_id).toBe(recovered);
    expect(store.listJobs(run_id)).toHaveLength(1);
    expect(h.calls).toHaveLength(1);
    expect(spendOf(run_id)).toEqual(banked);
    expect(store.getJob(String(job.job_id))!.after_state).toBe("done");
  });

  it("does not propose a second plan when only the run's position was lost", async () => {
    const h = makeHarness();
    // The plan's own transaction commits; the run never reaches review.
    const crashed = crashingStore(store, (method, args) => method === "updateRun" && String((args[1] as Loose)?.waiting_reason) === "plan-review");
    const journey = journeyWith(h, { store: () => crashed });
    const delivered = (await journey.deliver({ ...SELECT_14, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;
    const run_id = String(delivered.run_id);
    await journey.idle();

    expect(store.listPlans(run_id)).toHaveLength(1);
    expect(store.getRun(run_id)!.waiting_reason).not.toBe("plan-review");
    expect(store.listJobs(run_id)[0].after_state).toBeNull();
    const banked = spendOf(run_id);

    const restarted = restart(h);
    for (const pass of [1, 2]) {
      await restarted.reconcile();
      await restarted.idle();
      const view = detailOf(restarted, run_id);
      expect(view.plans, "pass " + pass).toHaveLength(1);
      expect(view.plans[0].revision).toBe(1);
      expect(view.run.waiting_reason).toBe("plan-review");
      expect(h.calls).toHaveLength(1);
      expect(spendOf(run_id)).toEqual(banked);
    }

    // And the recovered plan is a real one: it can still be approved and built on.
    const view = detailOf(restarted, run_id);
    await restarted.decide({ run_id, plan_id: view.plans[0].plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await restarted.idle();
    expect(detailOf(restarted, run_id).run.closed_outcome).toBe("verified_candidate");
  });

  it("recovers an implementation lost between settlement and its candidate", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, executor);
    const run_id = String(delivered.run_id);
    const plan = latestPlanOf(journey, run_id);

    // Cleanup fails only on the implementation job, after its outcome is banked.
    h.runtime.release = async () => {
      throw new Error("process lost during cleanup");
    };
    await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();

    const build = store.listJobs(run_id).find((row: Loose) => row.access === "write")!;
    expect(build.status).toBe("finished");
    expect(build.settled_at).not.toBeNull();
    expect(build.after_state).toBeNull();
    expect(store.listCandidates(run_id)).toHaveLength(0);
    expect(store.listResults(run_id)).toHaveLength(0);
    const banked = spendOf(run_id);
    const calls = h.calls.length;

    h.runtime.release = async () => undefined;
    const restarted = restart(h);
    await restarted.reconcile();
    await restarted.idle();

    let view = detailOf(restarted, run_id);
    expect(view.candidates).toHaveLength(1);
    expect(view.candidate.changed).toEqual([{ path: "src/amount.ts", kind: "update", review: expect.objectContaining({ state: "available" }) }]);
    expect(view.evidence).toEqual([expect.objectContaining({ criterion_id: "amount-check", state: "satisfied" })]);
    expect(view.result.result_version).toBe(1);
    expect(view.run.closed_outcome).toBe("verified_candidate");
    expect(view.ownerAction.label).toBe("Apply");
    // The writeback the crash swallowed is written now, from the recovered result.
    expect(readFileSync(bookPath(), "utf8")).toMatch(new RegExp("\\*\\*BUD-14\\*\\* V2 run `" + run_id + "`"));
    expect(h.calls).toHaveLength(calls);
    expect(spendOf(run_id)).toEqual(banked);

    await restarted.reconcile();
    await restarted.idle();
    view = detailOf(restarted, run_id);
    expect(store.listCandidates(run_id)).toHaveLength(1);
    expect(store.listResults(run_id)).toHaveLength(1);
    expect(view.result.result_version).toBe(1);
    expect(store.listJobs(run_id)).toHaveLength(2);
    expect(h.calls).toHaveLength(calls);
    expect(spendOf(run_id)).toEqual(banked);
  });

  it("checks a frozen candidate rather than re-running the work that produced it", async () => {
    const h = makeHarness();
    // The candidate is frozen and hashed; the result never lands.
    const crashed = crashingStore(store, (method) => method === "putResult");
    const journey = journeyWith(h, { store: () => crashed });
    const delivered = await deliverPlan(journey, executor);
    const run_id = String(delivered.run_id);
    const plan = latestPlanOf(journey, run_id);
    await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();

    expect(store.listCandidates(run_id)).toHaveLength(1);
    expect(store.listResults(run_id)).toHaveLength(0);
    const frozen = store.listCandidates(run_id)[0];
    expect(store.listJobs(run_id).find((row: Loose) => row.access === "write")!.after_state).toBeNull();
    const banked = spendOf(run_id);
    const calls = h.calls.length;
    const checksBefore = h.checks.length;

    const restarted = restart(h);
    await restarted.reconcile();
    await restarted.idle();

    let view = detailOf(restarted, run_id);
    // The same bytes: recovery checked the candidate, it did not rebuild it.
    expect(store.listCandidates(run_id)).toHaveLength(1);
    expect(store.listCandidates(run_id)[0].candidate_id).toBe(frozen.candidate_id);
    expect(view.result.result_version).toBe(1);
    expect(view.result.candidateVerified).toBe(true);
    expect(view.run.closed_outcome).toBe("verified_candidate");
    // The local checker ran; no adapter did.
    expect(h.checks.length).toBeGreaterThan(checksBefore);
    expect(h.calls).toHaveLength(calls);
    expect(spendOf(run_id)).toEqual(banked);
    const evidenceAfter = store.listEvidence(run_id).length;
    expect(evidenceAfter).toBeGreaterThan(0);

    const checksAfter = h.checks.length;
    await restarted.reconcile();
    await restarted.idle();
    view = detailOf(restarted, run_id);
    expect(store.listResults(run_id)).toHaveLength(1);
    expect(view.result.result_version).toBe(1);
    // A result that already names this candidate is the completion: the second
    // pass re-checks nothing and re-writes nothing.
    expect(h.checks).toHaveLength(checksAfter);
    expect(store.listEvidence(run_id)).toHaveLength(evidenceAfter);
    expect(h.calls).toHaveLength(calls);
    expect(spendOf(run_id)).toEqual(banked);
  });

  it("keeps the retained container output until the recovered outcome is durable", async () => {
    const h = makeHarness();
    // The job dies mid-stream, so it settles as `unknown` and must be recovered
    // from the container log — the material `release` destroys.
    h.script.dieAfterStart = true;
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, executor);
    const run_id = String(delivered.run_id);
    const job = store.listJobs(run_id)[0];
    expect(job.status).toBe("unknown");

    const plan = '```json\n{"outcome":"emit 20","steps":["change the constant"]}\n```';
    h.retained.set(
      String(job.job_id),
      executor === "claude"
        ? [
            { type: "system", subtype: "init", model: "claude-test", session_id: job.native_ref },
            { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text: plan }] } },
            { type: "result", subtype: "success", is_error: false, result: plan, total_cost_usd: 0.02, usage: { input_tokens: 10 } },
          ]
        : [
            { type: "thread.started", thread_id: job.native_ref },
            { type: "item.completed", item: { type: "agent_message", text: plan } },
            { type: "turn.completed", usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0 } },
          ],
    );
    h.script.dieAfterStart = false;

    // Every release, with the job's status at the moment the container went.
    const releases: Loose[] = [];
    h.runtime.release = async (released: Loose) => {
      releases.push({ job_id: String(released.job_id), statusAtRelease: String(store.getJob(String(released.job_id))!.status) });
    };

    const restarted = restart(h);
    await restarted.reconcile();
    await restarted.idle();

    // The container is dropped only after the store has accepted the outcome, so
    // a write that failed would still have the log to replay from.
    expect(releases).toContainEqual({ job_id: String(job.job_id), statusAtRelease: "finished" });
    expect(releases.every((entry: Loose) => entry.statusAtRelease !== "unknown")).toBe(true);
    expect(detailOf(restarted, run_id).plans).toHaveLength(1);
    expect(h.calls).toHaveLength(1);
  });

  it("does not mint a second result when only the closing transition was lost", async () => {
    const h = makeHarness();
    // The result is recorded; the run is never closed against it.
    const crashed = crashingStore(store, (method, args) => method === "updateRun" && String((args[1] as Loose)?.lifecycle) === "CLOSED");
    const journey = journeyWith(h, { store: () => crashed });
    const delivered = await deliverPlan(journey, executor);
    const run_id = String(delivered.run_id);
    const plan = latestPlanOf(journey, run_id);
    await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();

    expect(store.listResults(run_id)).toHaveLength(1);
    expect(store.getRun(run_id)!.lifecycle).not.toBe("CLOSED");
    expect(store.getRun(run_id)!.result_ref).toBeNull();
    const banked = spendOf(run_id);
    const calls = h.calls.length;

    const restarted = restart(h);
    for (const pass of [1, 2]) {
      await restarted.reconcile();
      await restarted.idle();
      const view = detailOf(restarted, run_id);
      expect(store.listResults(run_id), "pass " + pass).toHaveLength(1);
      expect(view.result.result_version).toBe(1);
      expect(view.run.lifecycle).toBe("CLOSED");
      expect(view.run.closed_outcome).toBe("verified_candidate");
      expect(view.result.projection_status).toBe("current");
      expect(store.listCandidates(run_id)).toHaveLength(1);
      expect(h.calls).toHaveLength(calls);
      expect(spendOf(run_id)).toEqual(banked);
    }
    expect(readFileSync(bookPath(), "utf8")).toMatch(new RegExp("\\*\\*BUD-14\\*\\* V2 run `" + run_id + "`"));
  });

  it("holds a settled job's follow-on while the owner has paused the run, and never loses it", async () => {
    const h = makeHarness();
    h.script.hang = true;
    const journey = journeyWith(h);
    const delivered = (await journey.deliver({ ...SELECT_14, ...SETTINGS[executor], command_id: cmd(), actor: "owner" })) as Loose;
    const run_id = String(delivered.run_id);
    for (let tries = 0; tries < 200 && store.listJobs(run_id)[0]?.status !== "active"; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await journey.control({ run_id, action: "pause", command_id: cmd(), actor: "owner" });
    await journey.idle();

    // Settled by the observed stop, under a position that declines the follow-on.
    const job = store.listJobs(run_id)[0];
    expect(job.status).toBe("finished");
    expect(job.settled_at).not.toBeNull();
    expect(store.getRun(run_id)!.waiting_reason).toBe("paused");

    const restarted = restart(h);
    await restarted.reconcile();
    await restarted.idle();
    // Deferred, not done: the work is owed, the run is simply not taking it now.
    expect(store.getJob(String(job.job_id))!.after_state).toBe("deferred");
    expect(store.listSettledUnprocessedJobs()).toEqual([]);
    expect(detailOf(restarted, run_id).run.waiting_reason).toBe("paused");
    expect(detailOf(restarted, run_id).ownerAction.label).toBe("Resume");
    expect(h.calls).toHaveLength(1);

    // Leaving that position releases the hold without leaving a phantom obligation.
    h.script.hang = false;
    await restarted.control({ run_id, action: "resume", command_id: cmd(), actor: "owner" });
    await restarted.idle();
    const view = detailOf(restarted, run_id);
    expect(view.plans).toHaveLength(1);
    expect(view.ownerAction.label).toBe("Review plan");
    expect(store.listSettledUnprocessedJobs()).toEqual([]);
  });
});

describe("DLV-108 settlement marker", () => {
  it("never re-drives a job that settled before the marker existed", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    const plan = latestPlanOf(journey, run_id);
    await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(detailOf(journey, run_id).run.closed_outcome).toBe("verified_candidate");

    // Rewrite the rows as schema 7 wrote them: finished, with no settlement
    // marker and no after-state. Their post-processing completed under the old
    // code, so the scan must ignore them — re-driving a closed run would mint a
    // second result for facts that are already recorded.
    store.close();
    // The store's own binding, reached without a static specifier: @types/node 20
    // has no `node:sqlite` declarations and the runtime is Node 22.
    const { DatabaseSync } = (await import(SQLITE_MODULE)) as Loose;
    const raw = new DatabaseSync(storePath());
    raw.exec("UPDATE jobs SET settled_at = NULL, after_state = NULL");
    raw.close();
    store = openStore({ path: storePath() });
    expect(store.listSettledUnprocessedJobs()).toEqual([]);

    const restarted = journeyWith(h);
    await restarted.reconcile();
    await restarted.idle();
    expect(store.listResults(run_id)).toHaveLength(1);
    expect(detailOf(restarted, run_id).result.result_version).toBe(1);
    expect(detailOf(restarted, run_id).run.closed_outcome).toBe("verified_candidate");
  });
});

describe("owner-authorized revision of a checked candidate (DLV-113)", () => {
  async function inconclusive(h: ReturnType<typeof makeHarness>) {
    h.zeroTests = true;
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    await journey.decide({ run_id, plan_id: latestPlanOf(journey, run_id).plan_id, plan_revision: 1, decision: "approve", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(detailOf(journey, run_id).run.waiting_reason).toBe("checks-inconclusive");
    return { journey, run_id };
  }

  it("refuses without explicit authorization or findings, and dispatches nothing", async () => {
    const h = makeHarness();
    const { journey, run_id } = await inconclusive(h);
    const jobs = store.listJobs(run_id).length;
    const bare = (await journey.control({ run_id, action: "revise", findings: "fix it", command_id: cmd(), actor: "owner" })) as Loose;
    expect(bare.refusals[0].code).toBe("revision-not-authorized");
    const empty = (await journey.control({ run_id, action: "revise", findings: "  ", authorize_revision: true, command_id: cmd(), actor: "owner" })) as Loose;
    expect(empty.refusals[0].code).toBe("revision-findings-required");
    await journey.message({ run_id, body: "please fix", command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(store.listJobs(run_id)).toHaveLength(jobs);
    expect(store.listCandidates(run_id)).toHaveLength(1);
  });

  it("keeps C1 and its result, binds findings to them, and produces C2", async () => {
    const h = makeHarness();
    const { journey, run_id } = await inconclusive(h);
    const c1 = store.listCandidates(run_id)[0] as Loose;
    const before = store.listResults(run_id).length;
    h.zeroTests = false;
    const command_id = cmd();
    const revised = (await journey.control({ run_id, action: "revise", findings: "amount must be 20", authorize_revision: true, command_id, actor: "owner" })) as Loose;
    expect(revised.ok).toBe(true);
    await journey.idle();
    const candidates = store.listCandidates(run_id) as Loose[];
    expect(candidates.map((row) => row.generation)).toEqual(["C1", "C2"]);
    expect(candidates[0].candidate_id).toBe(c1.candidate_id);
    expect(store.listResults(run_id).length).toBeGreaterThan(before);
    expect(store.listJobs(run_id).map((job: Loose) => job.purpose)).toEqual(["investigate", "resume", "resume"]);
    const decision = (store.listDecisions(run_id) as Loose[]).find((entry) => entry.kind === "revision-authorized");
    expect(decision).toBeTruthy();
    const seen = typeof decision!.evidence_seen === "string" ? JSON.parse(decision!.evidence_seen) : decision!.evidence_seen;
    expect(seen).toMatchObject({ candidate_id: c1.candidate_id, generation: "C1", findings: "amount must be 20" });
    expect(h.calls.some((call) => /Owner findings/u.test(String(call.prompt)) && /amount must be 20/u.test(String(call.prompt)))).toBe(true);
    expect(detailOf(journey, run_id).run.closed_outcome).toBe("verified_candidate");
  });

  it("does not launch twice on a replayed command", async () => {
    const h = makeHarness();
    const { journey, run_id } = await inconclusive(h);
    h.zeroTests = false;
    const command_id = cmd();
    const body = { run_id, action: "revise", findings: "amount must be 20", authorize_revision: true, command_id, actor: "owner" };
    await journey.control(body);
    await journey.idle();
    await journey.control(body);
    await journey.idle();
    expect(store.listJobs(run_id).filter((job: Loose) => String(job.settings_json).includes('"revision":true'))).toHaveLength(1);
  });

  it("does not repair automatically when the revision fails", async () => {
    const h = makeHarness();
    const { journey, run_id } = await inconclusive(h);
    h.zeroTests = false;
    h.script.repairContent = "export const amount = 22;\n";
    await journey.control({ run_id, action: "revise", findings: "amount must be 20", authorize_revision: true, command_id: cmd(), actor: "owner" });
    await journey.idle();
    const purposes = store.listJobs(run_id).map((job: Loose) => job.purpose);
    expect(purposes).toEqual(["investigate", "resume", "resume"]);
    expect(purposes).not.toContain("repair");
    expect(store.listCandidates(run_id)).toHaveLength(2);
  });

  it("refuses a run that is not awaiting revision", async () => {
    const h = makeHarness();
    const journey = journeyWith(h);
    const delivered = await deliverPlan(journey, "claude");
    const run_id = String(delivered.run_id);
    const refused = (await journey.control({ run_id, action: "revise", findings: "x", authorize_revision: true, command_id: cmd(), actor: "owner" })) as Loose;
    expect(refused.refusals[0].code).toBe("run-not-awaiting-revision");
  });
});
