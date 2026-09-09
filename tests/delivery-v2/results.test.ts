// PM Delivery V2 — S1.3 fixtures: the Result and its two predicates.
//
// F-RESULT and F-PUBLISH from "PM Delivery — Evidence & Autonomy.md" §9, plus the
// completion predicate in §6. Nearly every assertion here is that something is
// NOT complete, because the failure this module exists to prevent is a green
// result over work that is not done.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContractError, authorizeContract, makeCriterion } from "../../scripts/delivery-v2/contracts.mjs";
import { evaluateCriterion, summarizeCriteria, waiveCriterion } from "../../scripts/delivery-v2/criteria.mjs";
import { checkPublicationScope, freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import { importTrustedCandidate, pinCheckPlan, runCheck } from "../../scripts/delivery-v2/checks.mjs";
import {
  OBLIGATION_KINDS,
  appendResultVersion,
  buildResult,
  postCheckRepairPolicy,
  recordDisposition,
  withProjectionStatus,
} from "../../scripts/delivery-v2/results.mjs";

let ROOT: string;
let WRITER: string;
let GENERATIONS: string;

const FRESHNESS = ["candidate", "test-config", "fixture", "toolchain"];

const AC_SUITE = makeCriterion({
  criterion_id: "AC-suite",
  proposition: "the expense-form unit suite passes on the candidate",
  scope: { candidate: "frozen generation" },
  observer: { kind: "command", expected: { spec_id: "unit" } },
  oracle_ref: "repository test suite",
  freshness_inputs: FRESHNESS,
  required_for: "candidate",
});

const AC_DEPLOYED = makeCriterion({
  criterion_id: "AC-deployed",
  proposition: "the deployed build shows the changed control",
  scope: { environment: "production" },
  observer: { kind: "attributed", expected: {} },
  oracle_ref: "selected item revision",
  freshness_inputs: ["candidate"],
  required_for: "disposition",
});

function contractFor(requestedDisposition: string, criteria = [AC_SUITE]) {
  return authorizeContract({
    work_id: "w-1",
    source_fingerprint: "sha256:src1",
    outcome: "change the quick-amount control from 25 to 20",
    scratchScope: { root: "scratch" },
    publicationScope: { allowedPaths: ["src/amount.ts"] },
    criteria_refs: criteria.map((criterion) => ({ criterion_id: criterion.criterion_id, revision: criterion.revision })),
    requestedDisposition,
  });
}

function writerTree(files: Record<string, string>) {
  rmSync(WRITER, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(WRITER, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
}

function planFor(criteria = [AC_SUITE]) {
  return pinCheckPlan({
    criteria,
    specs: { unit: { spec_id: "unit", kind: "command", argv: ["node", "--version"], cwd: "." } },
    checkerInputs: [],
    toolchain: { node: "v22.20.0" },
  });
}

/** Freeze a candidate and run its unit check, returning everything the Result needs. */
function verifiedCandidate(execResult: Record<string, unknown> = { exitCode: 0, selected: 12, executed: 12 }) {
  writerTree({ "src/amount.ts": "export const QUICK = 20;\n" });
  const { candidate } = importTrustedCandidate({
    sourceRoot: WRITER,
    generationsRoot: GENERATIONS,
    base_manifest: [{ path: "src/amount.ts", sha256: "sha256:base", size: 1 }],
  });
  const outcome = runCheck({
    plan: planFor(),
    candidate,
    criterion: AC_SUITE,
    execute: () => ({ stdout: "", stderr: "", signal: null, ...execResult }),
  });
  const evidence = evaluateCriterion(AC_SUITE, outcome.observation, {
    candidate_ref: candidate.candidate_id,
    currentInputs: outcome.observation!.inputs,
  });
  return { candidate, outcome, evidence };
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-results-"));
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

describe("candidateVerified", () => {
  it("is true only when the required candidate criteria are satisfied by fresh evidence", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      disposition_receipt_refs: ["disp-1"],
      closed_outcome: "verified_candidate",
    });
    expect(result.candidateVerified).toBe(true);
    expect(result.workComplete).toBe(true);
    expect(result.remaining_obligations).toEqual([]);
  });

  it("is false with no candidate at all", () => {
    const { evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate: null,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
    });
    expect(result.candidateVerified).toBe(false);
  });

  it("is false over an empty criterion set rather than vacuously true", () => {
    const { candidate } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate", []),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([], []),
    });
    // "Every required criterion is satisfied" is trivially true of no criteria.
    // A contract that checks nothing has not verified anything.
    expect(result.candidateVerified).toBe(false);
  });

  it("is false when a criterion has no evidence at all", () => {
    const { candidate } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], []),
    });
    expect(result.candidateVerified).toBe(false);
    expect(result.remaining_obligations[0]).toMatchObject({
      kind: OBLIGATION_KINDS.CRITERION,
      detail: { criterion_id: "AC-suite", state: "missing" },
    });
  });

  it("is false when the only evidence is a waiver", () => {
    const { candidate } = verifiedCandidate();
    const waived = waiveCriterion(AC_SUITE, {
      owner_decision_ref: "dec-1",
      limitation: "no test environment for this control yet",
    });
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [waived]),
    });
    // A waiver remains a limitation. It never becomes a pass.
    expect(result.candidateVerified).toBe(false);
    expect(result.criterion_states[0].state).toBe("waived");
  });

  it("is false when the candidate went stale", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      candidateFresh: false,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
    });
    expect(result.candidateVerified).toBe(false);
    expect(result.next_safe_action).toMatch(/re-freeze the candidate/u);
  });

  it("is false when the candidate touched a file outside publicationScope", () => {
    writerTree({ "src/amount.ts": "export const QUICK = 20;\n", "src/surplus.ts": "export const X = 1;\n" });
    const { candidate } = importTrustedCandidate({
      sourceRoot: WRITER,
      generationsRoot: GENERATIONS,
      base_manifest: [{ path: "src/amount.ts", sha256: "sha256:base", size: 1 }],
    });
    const outcome = runCheck({
      plan: planFor(),
      candidate,
      criterion: AC_SUITE,
      execute: () => ({ stdout: "", stderr: "", signal: null, exitCode: 0, selected: 12, executed: 12 }),
    });
    const evidence = evaluateCriterion(AC_SUITE, outcome.observation, {
      currentInputs: outcome.observation!.inputs,
    });
    const scope = checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] });
    expect(scope.outside).toEqual(["src/surplus.ts"]);

    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: scope,
    });
    expect(result.candidateVerified).toBe(false);
    expect(result.remaining_obligations.some((entry) => entry.kind === OBLIGATION_KINDS.SCOPE)).toBe(true);
  });

  it("is false when a referenced artifact is missing", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      missingArtifacts: ["a-transcript"],
    });
    expect(result.candidateVerified).toBe(false);
    expect(result.next_safe_action).toMatch(/restore or re-produce the missing artifact a-transcript/u);
  });

  it("is false when an integrity or authority violation is unresolved", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      authorityViolations: ["the candidate modified the acceptance policy"],
    });
    expect(result.candidateVerified).toBe(false);
    expect(result.next_safe_action).toMatch(/integrity\/authority violation/u);
  });

  it("stays true while cost reconciliation is still outstanding, but the work does not complete", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      resourceSummary: {
        basis: "provider counters",
        settled: 0,
        reserved: 0,
        unknown: [{ job_id: "j-1", reason: "no amount in usd" }],
        enforcementProfile: "token-counters-only",
      },
    });
    // §6: "A candidate can be technically verified while native cost
    // reconciliation remains outstanding; that accounting stays visible and
    // reserved. It cannot be treated as free allowance."
    expect(result.candidateVerified).toBe(true);
    expect(result.workComplete).toBe(false);
    expect(result.resource_summary!.unknown).toHaveLength(1);
  });
});

describe("F-RESULT — build:null cannot resurrect completed work", () => {
  it("does not satisfy a criterion from a check that never executed", () => {
    const { candidate } = verifiedCandidate();
    const outcome = runCheck({
      plan: planFor(),
      candidate,
      criterion: AC_SUITE,
      // The V1 shape: a rung that reports success having run nothing.
      execute: () => ({ stdout: "", stderr: "", signal: null, exitCode: 0, selected: 0, executed: 0 }),
    });
    const evidence = evaluateCriterion(AC_SUITE, outcome.observation, {
      currentInputs: outcome.observation!.inputs,
    });
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
    });
    expect(evidence.state).toBe("missing");
    expect(result.candidateVerified).toBe(false);
    expect(result.workComplete).toBe(false);
  });

  it("does not let an empty re-evaluation revive an earlier completion", () => {
    const { candidate, evidence } = verifiedCandidate();
    const contract = contractFor("verified_candidate");
    const complete = buildResult({
      contract,
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      closed_outcome: "verified_candidate",
    });
    expect(complete.workComplete).toBe(true);

    // A later run whose checks selected nothing. It must not inherit the earlier
    // completion just because a result for this work was once green.
    const revived = buildResult({
      contract,
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], []),
      observedDisposition: "verified_candidate",
      result_version: 2,
      supersedes: complete.result_id,
    });
    expect(revived.workComplete).toBe(false);
    expect(revived.candidateVerified).toBe(false);
  });
});

describe("F-PUBLISH — a verified candidate is not a deployment", () => {
  it("leaves a requested deployment outstanding on a fully verified candidate", () => {
    const { candidate, evidence } = verifiedCandidate();
    const contract = contractFor("verified_deployment", [AC_SUITE, AC_DEPLOYED]);
    const result = buildResult({
      contract,
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE, AC_DEPLOYED], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      closed_outcome: "verified_candidate",
    });
    expect(result.candidateVerified).toBe(true);
    expect(result.workComplete).toBe(false);
    expect(result.requestedDisposition).toBe("verified_deployment");
    expect(result.observedDisposition).toBe("verified_candidate");
    expect(result.remaining_obligations.some((entry) => entry.kind === OBLIGATION_KINDS.DISPOSITION)).toBe(true);
    expect(result.next_safe_action).toMatch(/verified_deployment remains outstanding/u);
  });

  it("refuses to record a disposition from a click", () => {
    expect(() =>
      recordDisposition({
        disposition: "verified_deployment",
        observer: "",
        scenario: "opened the expense form",
        build_ref: "build-123",
        observed_at: "2026-09-07T12:00:00.000Z",
      }),
    ).toThrow(/needs observer/u);
    expect(() =>
      recordDisposition({
        disposition: "verified_deployment",
        observer: "owner",
        scenario: "opened the expense form and tapped 20",
        build_ref: "",
        observed_at: "2026-09-07T12:00:00.000Z",
      }),
    ).toThrow(/needs build_ref/u);
  });

  it("appends a later disposition as a new version without rewriting the engineering", () => {
    const { candidate, evidence } = verifiedCandidate();
    const contract = contractFor("verified_deployment", [AC_SUITE, AC_DEPLOYED]);
    const deployedEvidence = evaluateCriterion(
      AC_DEPLOYED,
      {
        kind: "attributed",
        outcome: "observed",
        inputs: { candidate: candidate.candidate_id },
        attribution: "owner on iPhone 15, build 2026.09.07-1",
        raw_refs: [],
        detail: {},
      },
      { currentInputs: { candidate: candidate.candidate_id } },
    );

    const first = buildResult({
      contract,
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE, AC_DEPLOYED], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      closed_outcome: "verified_candidate",
    });
    expect(first.workComplete).toBe(false);

    const receipt = recordDisposition({
      disposition: "verified_deployment",
      observer: "owner",
      scenario: "opened the expense form on the deployed build and tapped 20",
      build_ref: "build-2026.09.07-1",
      observed_at: "2026-09-08T09:00:00.000Z",
    });
    const second = appendResultVersion(
      buildResult({
        contract,
        run_id: "r-1",
        candidate,
        criteriaSummary: summarizeCriteria([AC_SUITE, AC_DEPLOYED], [evidence, deployedEvidence]),
        publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
        observedDisposition: "verified_candidate",
        closed_outcome: "verified_candidate",
      }),
      { observedDisposition: "verified_deployment", disposition_receipt_refs: [receipt.receipt_id] },
    );

    expect(second.result_version).toBe(2);
    expect(second.supersedes).toMatch(/@1$/u);
    expect(second.observedDisposition).toBe("verified_deployment");
    expect(second.workComplete).toBe(true);
    // Engineering history untouched: same candidate, same closed outcome.
    expect(second.candidate_ref).toBe(first.candidate_ref);
    expect(second.closed_outcome).toBe(first.closed_outcome);
  });

  it("refuses an appended disposition with no attributed receipt", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_deployment", [AC_SUITE, AC_DEPLOYED]),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE, AC_DEPLOYED], [evidence]),
    });
    expect(() =>
      appendResultVersion(result, { observedDisposition: "verified_deployment", disposition_receipt_refs: [] }),
    ).toThrow(/a click is not proof/u);
  });

  it("refuses to un-observe an established disposition", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_deployment", [AC_SUITE, AC_DEPLOYED]),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE, AC_DEPLOYED], [evidence]),
      observedDisposition: "applied_change",
    });
    expect(() =>
      appendResultVersion(result, { observedDisposition: "none", disposition_receipt_refs: ["d-1"] }),
    ).toThrow(/cannot un-observe/u);
  });
});

describe("F-RESULT — a failed projection does not erase verified engineering", () => {
  it("changes only projection_status", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      closed_outcome: "verified_candidate",
    });
    const failed = withProjectionStatus(result, { status: "failed", reason: "PM writeback rejected" });
    expect(failed.projection_status).toBe("failed");
    expect(failed.candidateVerified).toBe(true);
    expect(failed.workComplete).toBe(true);
    expect(failed.candidate_ref).toBe(result.candidate_ref);
  });
});

describe("F-RESULT — malformed engineer prose changes nothing", () => {
  it("does not invalidate otherwise sufficient trusted evidence", () => {
    const { candidate, evidence } = verifiedCandidate();
    const contract = contractFor("verified_candidate");
    const withProse = buildResult({
      contract,
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      closed_outcome: "verified_candidate",
      engineerProse: '{"summary": "I did the thi',
    });
    const withoutProse = buildResult({
      contract,
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      closed_outcome: "verified_candidate",
      engineerProse: null,
    });
    expect(withProse.workComplete).toBe(true);
    expect(withProse.candidateVerified).toBe(true);
    // The prose is retained and is not part of what the Result is.
    expect(withProse.engineer_prose).toBe('{"summary": "I did the thi');
    expect(withProse.body_digest).toBe(withoutProse.body_digest);
  });
});

describe("F-RESULT — an unknown job blocks completion", () => {
  it("keeps an unreconciled dispatch visible and outstanding", () => {
    const { candidate, evidence } = verifiedCandidate();
    const result = buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
      publicationScopeCheck: checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] }),
      observedDisposition: "verified_candidate",
      unknownJobs: [{ job_id: "j-2", reason: "launch acknowledgement lost; reservation held" }],
    });
    expect(result.candidateVerified).toBe(true);
    expect(result.workComplete).toBe(false);
    expect(result.unknown_jobs_or_effects[0].job_id).toBe("j-2");
    expect(result.next_safe_action).toMatch(/reconcile the outstanding job/u);
  });
});

describe("the one post-check repair the FAST policy allows", () => {
  function resultWith(state: "failed" | "missing") {
    const { candidate, evidence } = verifiedCandidate(
      state === "failed" ? { exitCode: 1, selected: 12, executed: 12 } : { exitCode: 0, selected: 0, executed: 0 },
    );
    expect(evidence.state).toBe(state);
    return buildResult({
      contract: contractFor("verified_candidate"),
      run_id: "r-1",
      candidate,
      criteriaSummary: summarizeCriteria([AC_SUITE], [evidence]),
    });
  }

  const permitted = { permitted: true, refusals: [] };

  it("permits exactly one repair after a check actually failed", () => {
    const result = resultWith("failed");
    const first = postCheckRepairPolicy({ result, repairsDispatched: 0, grantVerdict: permitted });
    expect(first.permitted).toBe(true);
    expect(first.failedCriteria).toEqual(["AC-suite"]);

    const second = postCheckRepairPolicy({ result, repairsDispatched: 1, grantVerdict: permitted });
    expect(second.permitted).toBe(false);
    expect(second.refusals[0].code).toBe("repair-budget-spent");
  });

  it("refuses a repair when nothing failed — a missing check is an obligation, not a defect", () => {
    const result = resultWith("missing");
    const policy = postCheckRepairPolicy({ result, grantVerdict: permitted });
    expect(policy.permitted).toBe(false);
    expect(policy.refusals[0].code).toBe("no-failed-check");
  });

  it("refuses a repair the current Grant does not permit", () => {
    const result = resultWith("failed");
    const policy = postCheckRepairPolicy({
      result,
      grantVerdict: { permitted: false, refusals: [{ code: "allowance-exhausted", detail: "no headroom" }] },
    });
    expect(policy.permitted).toBe(false);
    expect(JSON.stringify(policy.refusals)).toMatch(/allowance-exhausted/u);
  });

  it("counts supervisor dispatches, not the native job's own test/fix loop", () => {
    const result = resultWith("failed");
    expect(postCheckRepairPolicy({ result, grantVerdict: permitted }).note).toMatch(/inside its bound/u);
  });
});

describe("the Result refuses to be built from nothing", () => {
  it("requires the contract, the run and a criteria summary", () => {
    const contract = contractFor("verified_candidate");
    expect(() => buildResult({ contract, run_id: "", criteriaSummary: summarizeCriteria([], []) })).toThrow(
      ContractError,
    );
    // @ts-expect-error deliberately omitting the summary
    expect(() => buildResult({ contract, run_id: "r-1" })).toThrow(/silence is not a pass/u);
  });

  it("derives a stable identity for the same work, contract and run", () => {
    const contract = contractFor("verified_candidate");
    writerTree({ "src/amount.ts": "export const QUICK = 20;\n" });
    const candidate = freezeCandidate({ root: WRITER });
    const build = () =>
      buildResult({ contract, run_id: "r-1", candidate, criteriaSummary: summarizeCriteria([], []) });
    expect(build().result_id).toBe(build().result_id);
  });
});
