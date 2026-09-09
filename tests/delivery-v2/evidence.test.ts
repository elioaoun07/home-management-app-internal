// PM Delivery V2 — S1.3 fixtures: trusted import and protected checking.
//
// F-EVIDENCE from "PM Delivery — Evidence & Autonomy.md" §9, and the four things
// §4 says the candidate must not be able to do: mint a trusted receipt, redefine
// check selection, silently weaken its oracle, or publish.
//
// Real files throughout. The candidate is imported into an immutable generation
// on disk and then mutated behind the checker's back, because "the writer kept
// editing during the check" is a race, and a race asserted against a mock is a
// race asserted against nothing.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContractError, makeCheckpoint, makeCriterion } from "../../scripts/delivery-v2/contracts.mjs";
import { evaluateCriterion, summarizeCriteria } from "../../scripts/delivery-v2/criteria.mjs";
import {
  CHECKER_ID,
  CHECK_REFUSALS,
  assertRestrictedEnvironment,
  attributeSuppliedLog,
  detectOracleDrift,
  filePresenceObservation,
  importTrustedCandidate,
  malformedReviewObservation,
  parseTestCounts,
  pinCheckPlan,
  restrictedEnv,
  runCheck,
  verifyReceipt,
} from "../../scripts/delivery-v2/checks.mjs";

let ROOT: string;
let WRITER: string;
let GENERATIONS: string;

const FRESHNESS = ["candidate", "test-config", "fixture", "toolchain"];

const AC_SUITE = makeCriterion({
  criterion_id: "AC-suite",
  proposition: "the expense-form unit suite passes on the candidate",
  scope: { candidate: "frozen generation", suite: "tests/expense" },
  observer: { kind: "command", expected: { spec_id: "unit" } },
  oracle_ref: "repository test suite",
  freshness_inputs: FRESHNESS,
  required_for: "candidate",
  forbidden_substitutes: ["source_match", "screenshot"],
});

const AC_REVIEW = makeCriterion({
  criterion_id: "AC-review",
  proposition: "an independent reviewer confirms the money math",
  scope: { candidate: "frozen generation" },
  observer: { kind: "attributed", expected: { spec_id: "review" } },
  oracle_ref: "money-rules skill",
  freshness_inputs: ["candidate"],
  required_for: "candidate",
});

function writerTree(files: Record<string, string>) {
  rmSync(WRITER, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(WRITER, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
  return WRITER;
}

function planFor(criteria = [AC_SUITE], checkerInputs: { path: string; sha256: string }[] = []) {
  return pinCheckPlan({
    criteria,
    specs: {
      unit: { spec_id: "unit", kind: "command", argv: ["node", "--version"], cwd: "." },
      review: { spec_id: "review", kind: "command", argv: ["node", "--version"], cwd: "." },
    },
    checkerInputs,
    toolchain: { node: "v22.20.0" },
  });
}

/** A scripted process runner. Nothing is spawned; the receipt is what is under test. */
const scripted = (result: Record<string, unknown>) => () => ({ stdout: "", stderr: "", signal: null, ...result });

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-evidence-"));
  WRITER = join(ROOT, "writer");
  GENERATIONS = join(ROOT, "generations");
  mkdirSync(WRITER, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* leftover temp dir */
  }
});

describe("trusted import — the checker does not validate a tree the writer can edit", () => {
  it("copies into an immutable generation and derives identity from the copied bytes", () => {
    writerTree({ "src/amount.ts": "export const QUICK = 20;\n" });
    const imported = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    expect(imported.candidate.root).toContain("C1");
    expect(imported.candidate.manifest.map((entry) => entry.path)).toEqual(["src/amount.ts"]);

    // The writer keeps going. The frozen generation does not move.
    writeFileSync(join(WRITER, "src", "amount.ts"), "export const QUICK = 999;\n", "utf8");
    const reimported = importTrustedCandidate({
      sourceRoot: WRITER,
      generationsRoot: GENERATIONS,
      generation: "C2",
    });
    expect(reimported.candidate.candidate_id).not.toBe(imported.candidate.candidate_id);
    // C1 is still what it was: its evidence keeps referring to something real.
    expect(imported.candidate.manifest[0].sha256).not.toBe(reimported.candidate.manifest[0].sha256);
  });

  it("leaves .git, secrets and links out of the imported generation", () => {
    writerTree({
      "src/amount.ts": "export const QUICK = 20;\n",
      ".git/config": "[remote]\n",
      ".env": "SECRET=1\n",
    });
    const imported = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    expect(imported.candidate.manifest.map((entry) => entry.path)).toEqual(["src/amount.ts"]);
    expect(imported.importRefusals.map((entry) => entry.path)).toEqual(expect.arrayContaining([".env", ".git"]));
  });

  it("ignores whatever the worker claimed about its own output", () => {
    writerTree({ "src/amount.ts": "export const QUICK = 20;\n" });
    const imported = importTrustedCandidate({
      sourceRoot: WRITER,
      generationsRoot: GENERATIONS,
      workerClaims: { candidate_id: "cand-trustme", sha256: "deadbeef", summary: "all good" },
    });
    expect(imported.candidate.candidate_id).not.toBe("cand-trustme");
    expect(imported.candidate.workerClaims.summary).toBe("all good");
  });
});

describe("F-EVIDENCE — the candidate cannot redefine check selection", () => {
  it("refuses a criterion the pinned plan does not name", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor([AC_SUITE]);
    const smuggled = makeCriterion({
      criterion_id: "AC-i-invented-this",
      proposition: "trust me",
      scope: {},
      observer: { kind: "command", expected: {} },
      oracle_ref: "the candidate",
      freshness_inputs: ["candidate"],
    });
    expect(() => runCheck({ plan, candidate, criterion: smuggled, execute: scripted({ exitCode: 0 }) })).toThrow(
      new RegExp(CHECK_REFUSALS.NOT_IN_PLAN, "u"),
    );
  });

  it("refuses a criterion whose revision has moved past the pinned plan", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor([AC_SUITE]);
    const revised = makeCriterion({ ...AC_SUITE, revision: 2 });
    expect(() => runCheck({ plan, candidate, criterion: revised, execute: scripted({ exitCode: 0 }) })).toThrow(
      new RegExp(CHECK_REFUSALS.NOT_IN_PLAN, "u"),
    );
  });

  it("refuses at pin time a criterion naming an observer spec the plan does not hold", () => {
    const orphan = makeCriterion({
      criterion_id: "AC-orphan",
      proposition: "x",
      scope: {},
      observer: { kind: "command", expected: { spec_id: "not-pinned" } },
      oracle_ref: "o",
      freshness_inputs: ["candidate"],
    });
    expect(() => pinCheckPlan({ criteria: [orphan], specs: {}, checkerInputs: [] })).toThrow(
      /names an observer spec the plan does not pin/u,
    );
  });
});

describe("F-EVIDENCE — the candidate cannot silently weaken its oracle", () => {
  it("detects a checker input the candidate rewrote", () => {
    writerTree({ "src/amount.ts": "1\n", "tests/amount.test.ts": "expect(1).toBe(1);\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    // Pinned from the base: the test as it was BEFORE the candidate existed.
    const plan = planFor([AC_SUITE], [{ path: "tests/amount.test.ts", sha256: "sha256:the-original" }]);
    const drift = detectOracleDrift({ plan, candidate });
    expect(drift.clean).toBe(false);
    expect(drift.requiresIndependentScrutiny).toBe(true);
    expect(drift.drifted[0]).toMatchObject({ path: "tests/amount.test.ts", kind: "changed" });
  });

  it("detects a checker input the candidate deleted", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor([AC_SUITE], [{ path: "tests/amount.test.ts", sha256: "sha256:the-original" }]);
    expect(detectOracleDrift({ plan, candidate }).drifted[0]).toMatchObject({ kind: "removed" });
  });

  it("refuses to run a check that depends on a drifted input", () => {
    writerTree({ "src/amount.ts": "1\n", "tests/amount.test.ts": "expect(true).toBe(true);\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor([AC_SUITE], [{ path: "tests/amount.test.ts", sha256: "sha256:the-original" }]);
    const outcome = runCheck({
      plan,
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, selected: 5, executed: 5 }),
      dependsOnInputs: ["tests/amount.test.ts"],
    });
    expect(outcome.refused).toBe(CHECK_REFUSALS.ORACLE_DRIFT);
    expect(outcome.receipt).toBeNull();
  });

  it("still runs a check that does not depend on the drifted input, and records the drift", () => {
    writerTree({ "src/amount.ts": "1\n", "tests/other.test.ts": "x\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor([AC_SUITE], [{ path: "tests/other.test.ts", sha256: "sha256:the-original" }]);
    const outcome = runCheck({
      plan,
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, selected: 5, executed: 5 }),
      dependsOnInputs: [],
    });
    expect(outcome.refused).toBeNull();
    // Not silently dropped: the drift travels with the receipt for scrutiny.
    expect(outcome.drift!.requiresIndependentScrutiny).toBe(true);
  });
});

describe("F-EVIDENCE — the candidate cannot mint a trusted receipt", () => {
  it("accepts only receipts the checker produced for this exact plan", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor();
    const outcome = runCheck({
      plan,
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, selected: 12, executed: 12 }),
    });
    expect(verifyReceipt(outcome.receipt, plan).trusted).toBe(true);

    // A convincing forgery, with the right shape and the right producer string.
    const forged = { ...outcome.receipt, produced_by: CHECKER_ID, plan_digest: "sha256:whatever-i-like" };
    expect(verifyReceipt(forged, plan)).toMatchObject({ trusted: false, reason: CHECK_REFUSALS.PLAN_MISMATCH });

    const notEvenTrying = { ...outcome.receipt, produced_by: "native-engineer" };
    expect(verifyReceipt(notEvenTrying, plan)).toMatchObject({
      trusted: false,
      reason: CHECK_REFUSALS.UNTRUSTED_RECEIPT,
    });
  });

  it("keeps a writer-supplied log as an attributed input, not as a check", () => {
    const supplied = attributeSuppliedLog({ path: "logs/tests.txt", contents: "Tests 190 passed (190)\n" });
    expect(supplied.attribution).toBe("native-engineer");
    // The weakest kind, so a behavioural criterion rejects it outright.
    expect(supplied.kind).toBe("source_match");
    const evidence = evaluateCriterion(AC_SUITE, supplied, { currentInputs: {} });
    expect(evidence.state).toBe("missing");
    expect(evidence.reason).toBe("forbidden-substitute");
  });
});

describe("F-EVIDENCE — the named ways of proving nothing", () => {
  it("does not satisfy a behavioural criterion with zero selected tests", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor();
    const outcome = runCheck({
      plan,
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, selected: 0, executed: 0 }),
    });
    const evidence = evaluateCriterion(AC_SUITE, outcome.observation, {
      candidate_ref: candidate.candidate_id,
      currentInputs: outcome.observation!.inputs,
    });
    expect(evidence.state).toBe("missing");
    expect(evidence.reason).toBe("zero-executed");
  });

  it("reads a runner that reports no test files as zero selected", () => {
    expect(parseTestCounts("No test files found, exiting with code 0")).toEqual({
      selected: 0,
      executed: 0,
      skipped: 0,
      failed: 0,
    });
    expect(parseTestCounts("Tests  190 passed (190)")).toMatchObject({ selected: 190, executed: 190 });
    // Unreadable output yields nulls, which criteria.mjs turns into inconclusive.
    expect(parseTestCounts("something else entirely")).toMatchObject({ selected: null, executed: null });
  });

  it("does not satisfy a criterion with an arbitrary proof file's existence", () => {
    writerTree({ "src/amount.ts": "1\n", "docs/proof.md": "I did the work.\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const presence = filePresenceObservation({ path: "docs/proof.md", root: candidate.root });
    expect(presence.detail.matched).toBe(true);
    const evidence = evaluateCriterion(AC_SUITE, presence, { currentInputs: {} });
    expect(evidence.state).toBe("missing");
    expect(presence.detail.note).toBe(CHECK_REFUSALS.FILE_PRESENCE);
  });

  it("leaves a malformed required review inconclusive, never failed and never passed", () => {
    const review = malformedReviewObservation({ reviewer: "fresh-challenger", raw: "{ verdict: yes" });
    const evidence = evaluateCriterion(AC_REVIEW, review, { currentInputs: {} });
    expect(evidence.state).toBe("inconclusive");
    expect(evidence.reason).toBe("malformed-observation");
    // Inconclusive is an obligation, not a verdict: nothing was disproven.
    const summary = summarizeCriteria([AC_REVIEW], [evidence]);
    expect(summary.candidate.satisfied).toBe(false);
  });

  it("stales a receipt once the candidate has moved", () => {
    writerTree({ "src/amount.ts": "export const QUICK = 20;\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const plan = planFor();
    const outcome = runCheck({
      plan,
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, selected: 12, executed: 12 }),
    });
    const fresh = evaluateCriterion(AC_SUITE, outcome.observation, {
      currentInputs: outcome.observation!.inputs,
    });
    expect(fresh.state).toBe("satisfied");

    // A repair produces C2. C1's evidence does not certify it.
    writeFileSync(join(WRITER, "src", "amount.ts"), "export const QUICK = 21;\n", "utf8");
    const second = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS, generation: "C2" });
    const stale = evaluateCriterion(AC_SUITE, outcome.observation, {
      currentInputs: { ...outcome.observation!.inputs, candidate: second.candidate.candidate_id },
    });
    expect(stale.state).toBe("stale");
    expect(stale.reason).toBe("stale-input");
  });

  it("refuses to check a generation that changed underneath it", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    // Someone edits the frozen generation directly — the case the copy exists to
    // make detectable rather than impossible.
    writeFileSync(join(candidate.root, "src", "amount.ts"), "2\n", "utf8");
    const outcome = runCheck({ plan: planFor(), candidate, criterion: AC_SUITE, execute: scripted({ exitCode: 0 }) });
    expect(outcome.refused).toBe(CHECK_REFUSALS.CANDIDATE_MUTATED);
    expect(outcome.receipt).toBeNull();
  });

  it("records a spawn that never produced a process as interrupted, not as a failure", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    const outcome = runCheck({
      plan: planFor(),
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: null, spawnError: "ENOENT" }),
    });
    const evidence = evaluateCriterion(AC_SUITE, outcome.observation, {
      currentInputs: outcome.observation!.inputs,
    });
    expect(evidence.state).toBe("inconclusive");
    expect(evidence.reason).toBe("interrupted-observation");
  });
});

describe("F-PUBLISH — the check environment cannot publish", () => {
  it("refuses to run with publication credentials in the environment", () => {
    expect(() => assertRestrictedEnvironment({ SUPABASE_SERVICE_ROLE_KEY: "sk-live" })).toThrow(
      new RegExp(CHECK_REFUSALS.PUBLICATION_CREDENTIALS, "u"),
    );
    expect(() => assertRestrictedEnvironment({ CRON_SECRET: "x" })).toThrow(ContractError);
    expect(() => assertRestrictedEnvironment({ PATH: "/usr/bin" })).not.toThrow();
  });

  it("builds the check environment from an allowlist, not a denylist", () => {
    const env = restrictedEnv({
      PATH: "/usr/bin",
      SUPABASE_SERVICE_ROLE_KEY: "sk-live",
      SOME_FUTURE_SECRET: "oops",
    });
    expect(env.PATH).toBe("/usr/bin");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    // The point of an allowlist: a variable nobody thought of is still excluded.
    expect(env.SOME_FUTURE_SECRET).toBeUndefined();
  });

  it("refuses a check whose environment carries credentials, before running anything", () => {
    writerTree({ "src/amount.ts": "1\n" });
    const { candidate } = importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS });
    let ran = false;
    expect(() =>
      runCheck({
        plan: planFor(),
        candidate,
        criterion: AC_SUITE,
        env: { PATH: "/usr/bin", GITHUB_TOKEN: "ghp_x" },
        execute: () => {
          ran = true;
          return { exitCode: 0, stdout: "", stderr: "", signal: null };
        },
      }),
    ).toThrow(new RegExp(CHECK_REFUSALS.PUBLICATION_CREDENTIALS, "u"));
    expect(ran).toBe(false);
  });
});

describe("the minimal canonical Checkpoint", () => {
  it("binds identity, inputs, decisions and the next action", () => {
    const checkpoint = makeCheckpoint({
      run_id: "r-1",
      contract_revision: 1,
      created_at: "2026-09-07T12:00:00.000Z",
      source_manifest_ref: "sha256:manifest",
      candidate_ref: "cand-1",
      decision_refs: ["dec-0001"],
      findings: [
        {
          statement: "the quick-amount row emits the label, not the parsed value",
          source_refs: ["src/features/amount.ts#L14"],
          reconsider_when: "the row is refactored to emit numbers",
        },
      ],
      remaining: [{ ref: "AC-amount", next_action: "run the mounted interaction check", resolver: "protected checker" }],
      native_record_refs: ["thread:thr_native"],
      next_action: "re-run the failing interaction check on C2",
    });
    expect(checkpoint.checkpoint_id).toMatch(/^ckpt-/u);
    expect(checkpoint.findings[0].source_refs).toEqual(["src/features/amount.ts#L14"]);
    expect(Object.keys(checkpoint).sort()).toEqual([
      "candidate_ref",
      "checkpoint_id",
      "contract_revision",
      "created_at",
      "decision_refs",
      "findings",
      "native_record_refs",
      "next_action",
      "remaining",
      "run_id",
      "source_manifest_ref",
    ]);
  });

  it("refuses a finding with no provenance", () => {
    expect(() =>
      makeCheckpoint({
        run_id: "r-1",
        contract_revision: 1,
        created_at: "t",
        source_manifest_ref: "sha256:m",
        findings: [{ statement: "the bug is in the reducer", source_refs: [] }],
        next_action: "look at the reducer",
      }),
    ).toThrow(/a finding with no source reference is a claim/u);
  });

  it("refuses a decision reconstructed from prose", () => {
    expect(() =>
      makeCheckpoint({
        run_id: "r-1",
        contract_revision: 1,
        created_at: "t",
        source_manifest_ref: "sha256:m",
        decision_refs: ["the owner said it was fine to skip the migration"],
        next_action: "continue",
      }),
    ).toThrow(/not prose/u);
  });

  it("is deterministic, so an unchanged checkpoint is the same checkpoint", () => {
    const build = () =>
      makeCheckpoint({
        run_id: "r-1",
        contract_revision: 1,
        created_at: "2026-09-07T12:00:00.000Z",
        source_manifest_ref: "sha256:m",
        next_action: "continue",
      });
    expect(build().checkpoint_id).toBe(build().checkpoint_id);
  });
});
