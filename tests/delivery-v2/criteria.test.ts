// PM Delivery V2 — S0.2 fixtures: the proof contract.
//
// Invariants V2-I06/V2-I07 and the F-EVIDENCE family. Each block below is one of
// the four ways V1 could call something proven that was not (Diagnosis D04/D05),
// written from the refusal side: the interesting assertion is always that a state
// is NOT "satisfied".
//
// Two of the four are observed by actually executing a synthetic control rather
// than by handing the evaluator a literal, because "the observation was produced
// by running the thing" is the property under test.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { verifyInstantEdit } from "../../scripts/delivery/instant.mjs";
import {
  ContractError,
  dispositionObligations,
  authorizeContract,
  fingerprint,
  makeCriterion,
} from "../../scripts/delivery-v2/contracts.mjs";
import {
  commandObservation,
  diffObservation,
  evaluateCriterion,
  evaluateExactChange,
  interactionObservation,
  makeObservation,
  sourceMatchObservation,
  summarizeCriteria,
  waiveCriterion,
} from "../../scripts/delivery-v2/criteria.mjs";
import * as correctControl from "./fixtures/fast-control/quick-amount.mjs";
import * as mismatchControl from "./fixtures/fast-control/quick-amount-mismatch.mjs";

const INPUTS = {
  candidate: "sha256:c1",
  "test-config": "sha256:t1",
  fixture: "sha256:f1",
  toolchain: "sha256:node-24",
};
const FRESHNESS = ["candidate", "test-config", "fixture", "toolchain"];

/** The Evidence & Autonomy §2 illustrative criterion, as a record. */
const AC_AMOUNT = makeCriterion({
  criterion_id: "AC-amount",
  proposition: "the mobile quick-amount control displays and selects 20",
  scope: { candidate: "local", surface: "mobile expense form" },
  observer: { kind: "interaction", expected: { displayed: "20", selected: "20" } },
  oracle_ref: "selected item revision",
  freshness_inputs: FRESHNESS,
  required_for: "candidate",
  forbidden_substitutes: ["source_match", "screenshot"],
});

/** Same proposition, but with no forbidden list — eligibility alone must still refuse. */
const AC_AMOUNT_NO_LIST = makeCriterion({
  criterion_id: "AC-amount-nolist",
  proposition: "the mobile quick-amount control displays and selects 20",
  scope: { candidate: "local", surface: "mobile expense form" },
  observer: { kind: "interaction", expected: { displayed: "20", selected: "20" } },
  oracle_ref: "selected item revision",
  freshness_inputs: FRESHNESS,
});

const AC_SUITE = makeCriterion({
  criterion_id: "AC-suite",
  proposition: "the expense-form unit suite passes on the candidate",
  scope: { candidate: "local", suite: "tests/expense" },
  observer: { kind: "command", expected: {} },
  oracle_ref: "repository test suite",
  freshness_inputs: ["candidate", "test-config"],
});

/** Observe the control the only way that establishes behaviour: by using it. */
function observeControl(control: { labels(): string[]; select(index: number): string }, index: number) {
  return interactionObservation({
    procedure: "render the quick-amount row, activate index " + index + ", read the emitted value",
    observed: { displayed: control.labels()[index], selected: control.select(index) },
    inputs: INPUTS,
    raw_refs: ["fixtures/fast-control"],
  });
}

describe("F-EVIDENCE — a control that displays 20 but emits 25 fails the behavioural criterion", () => {
  it("passes on the correct candidate", () => {
    const record = evaluateCriterion(AC_AMOUNT, observeControl(correctControl, 2), { currentInputs: INPUTS });
    expect(record.state).toBe("satisfied");
    expect(record.observer).toBe("interaction");
  });

  it("fails on the half-done candidate, naming the value that diverged", () => {
    const record = evaluateCriterion(AC_AMOUNT, observeControl(mismatchControl, 2), { currentInputs: INPUTS });
    expect(record.state).toBe("failed");
    expect(record.reason).toBe("value-mismatch");
    expect(record.detail).toContain("selected: expected 20, observed 25");
    // The display half is genuinely correct — that is what makes this the
    // interesting failure rather than an obviously broken candidate.
    expect(String(record.detail)).not.toContain("displayed:");
  });

  it("an observation that does not report a required value is inconclusive, not a pass", () => {
    const partial = interactionObservation({
      procedure: "read the label only",
      observed: { displayed: "20" },
      inputs: INPUTS,
    });
    const record = evaluateCriterion(AC_AMOUNT, partial, { currentInputs: INPUTS });
    expect(record.state).toBe("inconclusive");
    expect(record.reason).toBe("malformed-observation");
  });
});

describe("F-EVIDENCE — a source-only observation cannot satisfy a behaviour criterion", () => {
  const mismatchSource = readFileSync(
    fileURLToPath(new URL("./fixtures/fast-control/quick-amount-mismatch.mjs", import.meta.url)),
    "utf8",
  );

  it("the string really is there — which is precisely why it proves nothing", () => {
    expect(mismatchSource).toContain('"20"');
  });

  it("is refused by name when the contract listed it as a forbidden substitute", () => {
    const observation = sourceMatchObservation({
      path: "tests/delivery-v2/fixtures/fast-control/quick-amount-mismatch.mjs",
      matched: mismatchSource.includes('"20"'),
      needle: '"20"',
      inputs: INPUTS,
    });
    const record = evaluateCriterion(AC_AMOUNT, observation, { currentInputs: INPUTS });
    expect(record.state).toBe("missing");
    expect(record.reason).toBe("forbidden-substitute");
  });

  it("is refused on eligibility alone even when no forbidden list was written", () => {
    const observation = sourceMatchObservation({
      path: "tests/delivery-v2/fixtures/fast-control/quick-amount-mismatch.mjs",
      matched: true,
      inputs: INPUTS,
    });
    const record = evaluateCriterion(AC_AMOUNT_NO_LIST, observation, { currentInputs: INPUTS });
    expect(record.state).toBe("missing");
    expect(record.reason).toBe("ineligible-observer");
  });

  it("a screenshot of the row is refused the same way", () => {
    const shot = makeObservation({
      kind: "screenshot",
      inputs: INPUTS,
      attribution: "checker",
      detail: { viewport: "390x844", theme: "blue" },
    });
    expect(evaluateCriterion(AC_AMOUNT, shot, { currentInputs: INPUTS }).state).toBe("missing");
  });
});

describe("F-EVIDENCE — missing behavioural execution stays missing", () => {
  it("exit zero over zero selected tests is missing, not satisfied and not failed", () => {
    const observation = commandObservation({
      argv: ["vitest", "run", "tests/expense/no-such-file.test.ts"],
      exitCode: 0,
      selected: 0,
      executed: 0,
      inputs: { candidate: "sha256:c1", "test-config": "sha256:t1" },
    });
    const record = evaluateCriterion(AC_SUITE, observation, {});
    expect(record.state).toBe("missing");
    expect(record.reason).toBe("zero-executed");
    expect(record.state).not.toBe("satisfied");
  });

  it("a run that cannot report its own counts is inconclusive", () => {
    const observation = commandObservation({
      argv: ["vitest", "run"],
      exitCode: 0,
      inputs: { candidate: "sha256:c1", "test-config": "sha256:t1" },
    });
    expect(evaluateCriterion(AC_SUITE, observation, {}).state).toBe("inconclusive");
  });

  it("an interrupted check is inconclusive and preserves its receipt", () => {
    const observation = makeObservation({
      kind: "command",
      outcome: "interrupted",
      inputs: { candidate: "sha256:c1", "test-config": "sha256:t1" },
      raw_refs: ["artifacts/checks/partial.log"],
      detail: { argv: ["vitest", "run"], exitCode: null, selected: 12, executed: 4 },
    });
    const record = evaluateCriterion(AC_SUITE, observation, {});
    expect(record.state).toBe("inconclusive");
    expect(record.reason).toBe("interrupted-observation");
    expect(record.raw_refs).toEqual(["artifacts/checks/partial.log"]);
  });

  it("a real run that executed assertions and exited non-zero is failed, not missing", () => {
    const observation = commandObservation({
      argv: ["vitest", "run", "tests/expense"],
      exitCode: 1,
      selected: 12,
      executed: 12,
      inputs: { candidate: "sha256:c1", "test-config": "sha256:t1" },
    });
    const record = evaluateCriterion(AC_SUITE, observation, {});
    expect(record.state).toBe("failed");
    expect(record.reason).toBe("nonzero-exit");
  });

  it("no observation at all is missing, never absent", () => {
    const record = evaluateCriterion(AC_SUITE, null, {});
    expect(record.state).toBe("missing");
    expect(record.reason).toBe("no-observation");
  });

  it("evidence taken under changed inputs is stale, not carried forward", () => {
    const observation = commandObservation({
      argv: ["vitest", "run", "tests/expense"],
      exitCode: 0,
      selected: 12,
      executed: 12,
      inputs: { candidate: "sha256:c1", "test-config": "sha256:t1" },
    });
    const record = evaluateCriterion(AC_SUITE, observation, {
      currentInputs: { candidate: "sha256:c2", "test-config": "sha256:t1" },
    });
    expect(record.state).toBe("stale");
    expect(record.reason).toBe("stale-input");
    expect(record.detail).toContain("candidate");
  });

  it("a receipt that does not identify its own freshness inputs is inconclusive", () => {
    const observation = commandObservation({
      argv: ["vitest", "run"],
      exitCode: 0,
      selected: 3,
      executed: 3,
      inputs: { candidate: "sha256:c1" },
    });
    expect(evaluateCriterion(AC_SUITE, observation, {}).state).toBe("inconclusive");
  });
});

describe("F-EVIDENCE — an unrelated surplus edit fails an exact-change criterion", () => {
  const TARGET = "src/components/expense/MobileExpenseForm.tsx";
  const OTHER = "src/components/ui/button.tsx";
  const BEFORE = 'const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];';
  const AFTER = 'const QUICK_AMOUNTS = ["5", "10", "20", "50", "100"];';
  const DECLARED = [{ path: TARGET, before: BEFORE, after: AFTER }];
  const ALLOWED = ["src/components/expense/"];

  // Shaped the way git actually emits a multi-file diff: the `diff --git` line is
  // what closes the previous hunk, and without it the next file's `---`/`+++`
  // header is read as content (the DLV-81 rule in parseUnifiedDiff).
  const diffFor = (path: string, removed: string[], added: string[]) =>
    [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      "@@ -1,4 +1,4 @@",
      ...removed.map((l) => `-${l}`),
      ...added.map((l) => `+${l}`),
    ].join("\n");

  const CLEAN = diffFor(TARGET, [`  ${BEFORE}`], [`  ${AFTER}`]);
  const SURPLUS = diffFor(
    TARGET,
    [`  ${BEFORE}`, "  const SHOW_QUICK_AMOUNTS = false;"],
    [`  ${AFTER}`, "  const SHOW_QUICK_AMOUNTS = true;"],
  );

  it("accepts the declared change on its own", () => {
    expect(evaluateExactChange({ diffText: CLEAN, declaredChanges: DECLARED, allowedPaths: ALLOWED }).ok).toBe(true);
  });

  it("rejects the same change plus an unrelated boolean flip in the same file", () => {
    const verdict = evaluateExactChange({ diffText: SURPLUS, declaredChanges: DECLARED, allowedPaths: ALLOWED });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.map((f: { code: string }) => f.code)).toContain("surplus-change");
    expect(verdict.failures.map((f: { detail: string }) => f.detail).join(" ")).toContain("SHOW_QUICK_AMOUNTS = true;");
  });

  it("counterexample: V1's INSTANT verifier passes that same diff (Diagnosis D04)", () => {
    // Same file, under the line ceiling, before removed and after added — every
    // assertion V1 makes holds, and the surplus edit ships unreviewed. This is
    // the semantics S0.2 was told not to carry forward.
    const v1 = verifyInstantEdit({
      declaredEdit: { path: TARGET, before: BEFORE, after: AFTER },
      changedFiles: [TARGET],
      diffText: SURPLUS,
      maxDiffLines: 20,
      fixLoop: 0,
    });
    expect(v1.ok).toBe(true);
  });

  it("rejects a change that strays outside the contract's publication scope", () => {
    const strayed = CLEAN + "\n" + diffFor(OTHER, ["  const x = 1;"], ["  const x = 2;"]);
    const verdict = evaluateExactChange({ diffText: strayed, declaredChanges: DECLARED, allowedPaths: ALLOWED });
    const codes = verdict.failures.map((f: { code: string }) => f.code);
    expect(verdict.ok).toBe(false);
    expect(codes).toContain("undeclared-file");
    expect(codes).toContain("scope-violation");
  });

  it("rejects a diff that is missing the declared change", () => {
    const wrong = diffFor(TARGET, ["  const x = 1;"], ["  const x = 2;"]);
    const verdict = evaluateExactChange({ diffText: wrong, declaredChanges: DECLARED, allowedPaths: ALLOWED });
    expect(verdict.failures.map((f: { code: string }) => f.code)).toContain("declared-change-missing");
  });

  it("rejects an empty diff rather than treating no change as no violation", () => {
    const verdict = evaluateExactChange({ diffText: "", declaredChanges: DECLARED });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures[0].code).toBe("no-changes");
  });

  it("drives the same verdict through the criterion, using the contract's allowed paths", () => {
    const criterion = makeCriterion({
      criterion_id: "AC-exact",
      proposition: "the candidate contains the approved edit and nothing else",
      scope: { candidate: "frozen generation" },
      observer: { kind: "diff", expected: { declaredChanges: DECLARED } },
      oracle_ref: "approved plan revision 1",
      freshness_inputs: ["candidate"],
      forbidden_substitutes: ["source_match"],
    });
    const contract = authorizeContract({
      work_id: "w-test",
      source_fingerprint: fingerprint("R-1"),
      outcome: "replace 25 with 20",
      scratchScope: { root: "<scratch>" },
      publicationScope: { allowedPaths: ALLOWED },
      requestedDisposition: "verified_candidate",
    });
    const context = {
      currentInputs: { candidate: "sha256:c1" },
      allowedPaths: [...contract.publicationScope.allowedPaths],
    };

    expect(
      evaluateCriterion(criterion, diffObservation({ diffText: CLEAN, inputs: { candidate: "sha256:c1" } }), context)
        .state,
    ).toBe("satisfied");

    const failed = evaluateCriterion(
      criterion,
      diffObservation({ diffText: SURPLUS, inputs: { candidate: "sha256:c1" } }),
      context,
    );
    expect(failed.state).toBe("failed");
    expect(failed.reason).toBe("surplus-change");
  });
});

describe("waivers and roll-up", () => {
  it("a waiver requires an owner decision and never becomes satisfied", () => {
    expect(() => waiveCriterion(AC_AMOUNT, { owner_decision_ref: "", limitation: "no device" })).toThrow(ContractError);
    const waived = waiveCriterion(AC_AMOUNT, {
      owner_decision_ref: "d-owner-0012",
      limitation: "no physical device available this week",
    });
    expect(waived.state).toBe("waived");
    expect(waived.state).not.toBe("satisfied");
  });

  it("a criterion with no record rolls up as missing, and blocks the disposition", () => {
    const contract = authorizeContract({
      work_id: "w-test",
      source_fingerprint: fingerprint("R-1"),
      outcome: "replace 25 with 20",
      scratchScope: { root: "<scratch>" },
      publicationScope: { allowedPaths: ["src/"] },
      requestedDisposition: "verified_candidate",
    });
    const criteria = [AC_AMOUNT, AC_SUITE];
    const evidence = [evaluateCriterion(AC_AMOUNT, observeControl(correctControl, 2), { currentInputs: INPUTS })];
    const summary = summarizeCriteria(criteria, evidence);

    expect(summary.states).toHaveLength(2);
    expect(summary.candidate.satisfied).toBe(false);
    expect(summary.candidate.outstanding.map((entry: { criterion_id: string }) => entry.criterion_id)).toEqual([
      "AC-suite",
    ]);
    expect(
      dispositionObligations(contract, {
        observedDisposition: "verified_candidate",
        criterionStates: summary.states,
      }).satisfied,
    ).toBe(true); // both criteria are required_for "candidate", so none gate the disposition
  });

  it("evidence for a superseded criterion revision cannot certify the current one", () => {
    const v2 = makeCriterion({ ...AC_SUITE, revision: 2 });
    const oldEvidence = evaluateCriterion(
      AC_SUITE,
      commandObservation({
        argv: ["vitest", "run"],
        exitCode: 0,
        selected: 3,
        executed: 3,
        inputs: { candidate: "sha256:c1", "test-config": "sha256:t1" },
      }),
      {},
    );
    expect(oldEvidence.state).toBe("satisfied");
    const summary = summarizeCriteria([v2], [oldEvidence]);
    expect(summary.states[0].state).toBe("missing");
  });
});
