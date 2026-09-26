// PM Delivery V2 — the required verification, end to end.
//
// Two things run r-83dddb67fea9 could not do, proved here against the real
// journey with a scripted type checker: refuse to call a candidate verified when
// the typecheck failed, and refuse Apply when the typecheck is missing, failed
// or stale. Nothing reaches a provider, a container or a compiler.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { TYPECHECK_CRITERION_ID } from "../../scripts/delivery-v2/typecheck.mjs";
import { SELECT, journeyFor, makeHarness, seedRoot, verifiedRun, writePolicy, type Loose } from "./fixtures/v2-harness";

let ROOT: string;
let DATA: string;
let store: ReturnType<typeof openStore>;
let seq = 0;
const cmd = () => "cmd-" + ++seq;

/** The policy's required typecheck. argv is never executed: the runner is scripted. */
const withTypecheck = (enforcement = "required") => ({
  checks: {
    specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"] } },
    inputs: ["tests/amount.check.mjs"],
    requiredVerifications: { typecheck: { enabled: true, argv: ["tsc", "--noEmit"], enforcement, include: ["src", "tsconfig.json"] } },
  },
});

/**
 * A scripted tsc. Each verification runs the baseline first and the candidate
 * second, so odd calls are baselines and even calls are candidates — which also
 * keeps a repair attempt's second verification honest instead of letting the
 * first run's diagnostics become the next run's baseline.
 */
const scriptedTypecheck = (candidateStdout: string, baselineStdout = "") => {
  let call = 0;
  return () => {
    call += 1;
    const stdout = call % 2 === 1 ? baselineStdout : candidateStdout;
    return { exitCode: stdout ? 2 : 0, stdout, stderr: "", spawnError: null, signal: null };
  };
};

/** Plan, approve, build, check — without asserting how it ended. */
async function checkedRun(journey: Loose) {
  const delivered = await journey.deliver({ ...SELECT, executor: "claude", model: "claude-test", effort: "low", command_id: cmd(), actor: "owner" });
  expect(delivered.ok).toBe(true);
  await journey.idle();
  const run_id = String(delivered.run_id);
  const plan = journey.detail(run_id).plans[0];
  const decided = await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve", command_id: cmd(), actor: "owner" });
  expect(decided.ok).toBe(true);
  await journey.idle();
  return { run_id, view: journey.detail(run_id) as Loose };
}

const typecheckState = (view: Loose) =>
  ((view.result && view.result.criterion_states) || []).find((entry: Loose) => entry.criterion_id === TYPECHECK_CRITERION_ID) || null;

beforeEach(() => {
  seq = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-verify-root-"));
  DATA = mkdtempSync(join(tmpdir(), "era-v2-verify-data-"));
  seedRoot(ROOT);
  // The checker's own configuration comes from the checkout, never the
  // candidate; without one the environment probe is right to refuse to grade.
  writeFileSync(join(ROOT, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["src/**/*.ts"] }), "utf8");
  store = openStore({ path: join(ROOT, ".delivery", "v2", "supervisor.sqlite") });
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

const journeyWith = (h: Loose, overrides: Loose = {}) => journeyFor({ root: ROOT, data: DATA, store, harness: h, overrides });

describe("the required typecheck is part of being verified", () => {
  it("passes a run whose candidate introduces no diagnostic, and records the verdict", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck("") });
    const { run_id, view } = await verifiedRun(journey, cmd);
    expect(view.ownerAction).toEqual({ kind: "apply", label: "Apply" });
    const states = journey.detail(run_id).result.criterion_states as Loose[];
    expect(states.find((entry) => entry.criterion_id === TYPECHECK_CRITERION_ID)).toMatchObject({ state: "satisfied", required_for: "candidate" });
  });

  it("refuses to verify a candidate whose typecheck found a new diagnostic", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    // The defect shape from the investigated run: declared checks pass, the
    // compiler does not, and the run must not be called verified.
    const journey = journeyWith(h, {
      typecheckExecutor: scriptedTypecheck("src/amount.ts(3,9): error TS2339: Property 'from' does not exist on type '() => Client'."),
    });
    const { view } = await checkedRun(journey);
    expect(typecheckState(view)?.state).toBe("failed");
    expect(view.result.candidateVerified).toBe(false);
    expect(view.run.closed_outcome).not.toBe("verified_candidate");
  });

  it("keeps a pre-existing diagnostic out of the candidate's account", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    const shared = "src/config.ts(1,1): error TS2345: pre-existing in the checkout";
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck(shared, shared) });
    const { run_id } = await verifiedRun(journey, cmd);
    const states = journey.detail(run_id).result.criterion_states as Loose[];
    expect(states.find((entry) => entry.criterion_id === TYPECHECK_CRITERION_ID)?.state).toBe("satisfied");
  });

  it("stays inconclusive — not a pass — when the checking environment is incomplete", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    const broken = "src/amount.ts(1,1): error TS2307: Cannot find module 'next' or its corresponding type declarations.";
    // Identical both sides: baseline subtraction alone would call this a pass.
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck(broken, broken) });
    const { view } = await checkedRun(journey);
    expect(typecheckState(view)?.state).toBe("inconclusive");
    expect(view.result.candidateVerified).toBe(false);
  });

  it("records the verdict but blocks nothing when the policy says advisory", async () => {
    writePolicy(ROOT, withTypecheck("advisory"));
    const h = makeHarness(ROOT);
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck("src/amount.ts(3,9): error TS2339: nope") });
    const { run_id } = await verifiedRun(journey, cmd);
    const states = journey.detail(run_id).result.criterion_states as Loose[];
    expect(states.find((entry) => entry.criterion_id === TYPECHECK_CRITERION_ID)).toMatchObject({ state: "failed", required_for: "informational" });
  });

  it("retains a readable diagnostic artifact outside the model's context", async () => {
    writePolicy(ROOT, withTypecheck("advisory"));
    const h = makeHarness(ROOT);
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck("src/amount.ts(3,9): error TS2339: Property 'from' does not exist"), artifactsRoot: join(DATA, "artifacts") });
    const { run_id } = await verifiedRun(journey, cmd);
    const evidence = store
      .listEvidence(run_id)
      .map((row: Loose) => JSON.parse(String(row.record_json)))
      .find((record: Loose) => record && record.criterion_id === TYPECHECK_CRITERION_ID);
    expect(evidence.artifact).toBeTruthy();
    const stored = JSON.parse(readFileSync(String(evidence.artifact), "utf8"));
    expect(stored.diagnostics[0].message).toMatch(/does not exist/u);
  });
});

describe("Apply refuses an unverified candidate", () => {
  it("refuses when the result predates the required verification", async () => {
    // Verified WITHOUT the typecheck configured…
    writePolicy(ROOT);
    const h = makeHarness(ROOT);
    const journey = journeyWith(h);
    const { run_id, candidate_id, result_ref } = await verifiedRun(journey, cmd);

    // …then the owner turns the requirement on. The old result proves nothing
    // about typechecking, and Apply must say so rather than pass.
    writePolicy(ROOT, withTypecheck());
    const gated = journeyWith(h, { typecheckExecutor: scriptedTypecheck("") });
    const refused = await gated.apply({ run_id, action: "apply", candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(refused.ok).toBe(false);
    expect(refused.refusals[0].code).toBe("required-verification-missing-failed-or-stale");
    expect(refused.refusals[0].detail).toMatch(/never been typechecked/u);
  });

  it("applies when the verification is present, satisfied and bound to this candidate", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck("") });
    const { run_id, candidate_id, result_ref } = await verifiedRun(journey, cmd);
    const applied = await journey.apply({ run_id, action: "apply", candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(applied.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DLV-133 — which environment the journey actually asks for, and what it says
// ---------------------------------------------------------------------------

describe("the journey prefers the protected checker and records which one ran", () => {
  /** A runtime offering an isolated checker whose compiler is scripted. */
  const withChecker = (h: Loose, candidateStdout: string) => {
    const calls: Loose[] = [];
    let call = 0;
    h.runtime.typecheckExecutor = ({ include }: Loose) => ({
      ok: true,
      program: { volume: "era-v2-program-fixture", fingerprint: "sha256:fixture", files: include.length },
      producer: {
        producer: "protected-checker",
        isolated: true,
        detail: "fixture checker",
        program: { volume: "era-v2-program-fixture", fingerprint: "sha256:fixture", files: include.length, root: "/program", config: "tsconfig.json" },
        dependencies: { volume: "era-v2-deps-fixture", typescript: "5.9.2", node: process.version },
        image: "sha256:fixture",
      },
      execute: (input: Loose) => {
        calls.push(input);
        call += 1;
        const stdout = call % 2 === 1 ? "" : candidateStdout;
        return { exitCode: stdout ? 2 : 0, stdout, stderr: "", spawnError: null, signal: null };
      },
    });
    return calls;
  };

  it("uses the checker when the runtime offers one, and the verdict says so", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    const calls = withChecker(h, "");
    // No typecheckExecutor override: the container is preferred only when the
    // host executor was not injected.
    const journey = journeyWith(h);
    const { run_id } = await verifiedRun(journey, cmd);
    expect(calls.map((entry) => entry.phase)).toEqual(["baseline", "candidate"]);
    const evidence = (journey.detail(run_id).evidence as Loose[]).find((entry) => entry.criterion_id === TYPECHECK_CRITERION_ID);
    expect(evidence!.environment).toMatchObject({ producer: "protected-checker", isolated: true });
    const events = journey.detail(run_id).events as Loose[];
    expect(events.some((entry) => entry.kind === "typecheck.checker-ready")).toBe(true);
    expect(events.find((entry) => entry.kind === "typecheck.satisfied")!.data).toMatchObject({ producer: "protected-checker", isolated: true });
  });

  it("falls back to the labelled host path and records why the checker was unavailable", async () => {
    writePolicy(ROOT, withTypecheck());
    const h = makeHarness(ROOT);
    h.runtime.typecheckExecutor = () => ({ ok: false, reason: "the checker dependency volume era-deps does not resolve typescript" });
    const journey = journeyWith(h, { typecheckExecutor: scriptedTypecheck("") });
    const { run_id } = await verifiedRun(journey, cmd);
    const evidence = (journey.detail(run_id).evidence as Loose[]).find((entry) => entry.criterion_id === TYPECHECK_CRITERION_ID);
    expect(evidence!.environment).toMatchObject({ producer: "host-checkout", isolated: false });
    const unavailable = (journey.detail(run_id).events as Loose[]).find((entry) => entry.kind === "typecheck.checker-unavailable");
    expect(unavailable!.data.reason).toMatch(/does not resolve typescript/u);
  });

  it("refuses to verify at all when the policy requires isolation and the checker is unavailable", async () => {
    const required = withTypecheck();
    writePolicy(ROOT, {
      checks: {
        ...required.checks,
        requiredVerifications: { typecheck: { ...required.checks.requiredVerifications.typecheck, isolation: "checker" } },
      },
    });
    const h = makeHarness(ROOT);
    h.runtime.typecheckExecutor = () => ({ ok: false, reason: "no compiler in the dependency volume" });
    const journey = journeyWith(h);
    const { view } = await checkedRun(journey);
    const state = typecheckState(view);
    expect(state).toMatchObject({ state: "inconclusive", reason: "typecheck-did-not-run-in-the-protected-checker" });
    // Inconclusive is not a pass: the candidate is not verified and Apply has
    // nothing to act on.
    expect(view.result.candidateVerified).toBe(false);
  });
});
