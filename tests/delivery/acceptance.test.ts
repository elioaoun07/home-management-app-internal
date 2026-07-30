// DLV-10 unit tests: the AC coverage matrix's pure half — evidence resolution
// and the claim-reconciliation rule ("the agent may claim, the runner confirms").
import { describe, expect, it } from "vitest";

import {
  initAcceptance,
  isAcceptanceComplete,
  reconcileAcceptance,
  renderAcceptanceMd,
  resolveEvidence,
  summarizeAcceptance,
  unsatisfiedAcceptance,
  waiveAcceptance,
} from "../../scripts/delivery/acceptance.mjs";

const ACS = [
  { id: "AC1", text: "allocation splits sum exactly" },
  { id: "AC2", text: "negative balances round half-even" },
];

describe("initAcceptance", () => {
  it("starts every criterion unmet with no evidence", () => {
    const matrix = initAcceptance(ACS);
    expect(matrix).toHaveLength(2);
    expect(matrix[0]).toMatchObject({ id: "AC1", status: "unmet", evidence: null, updatedBy: null });
  });

  it("drops malformed rows instead of creating id-less criteria", () => {
    expect(initAcceptance([{ text: "no id" }, null, { id: "AC1", text: "ok" }])).toHaveLength(1);
  });
});

describe("resolveEvidence", () => {
  const facts = {
    changedFiles: ["src/lib/money.ts"],
    fileExists: (p: string) => p === "docs/proof.md",
    passingRungs: ["typecheck", "test"],
  };

  it("accepts a validation rung that actually passed", () => {
    expect(resolveEvidence("test", facts)).toEqual({ ok: true, kind: "validation" });
    expect(resolveEvidence("tests", facts)).toEqual({ ok: true, kind: "validation" });
  });

  it("refuses a rung that did not run or did not pass", () => {
    // "the tests prove it" is evidence exactly when the runner watched the
    // tests pass, and worth nothing when it did not.
    expect(resolveEvidence("lint", facts).ok).toBe(false);
    expect(resolveEvidence("test", { ...facts, passingRungs: [] }).ok).toBe(false);
  });

  it("accepts a file this session actually changed", () => {
    expect(resolveEvidence("src/lib/money.ts", facts)).toEqual({ ok: true, kind: "diff" });
    expect(resolveEvidence("src/lib/money.ts:42", facts)).toEqual({ ok: true, kind: "diff" });
    expect(resolveEvidence("src\\lib\\money.ts", facts)).toEqual({ ok: true, kind: "diff" });
  });

  it("accepts an existing file, and refuses one that does not exist", () => {
    expect(resolveEvidence("docs/proof.md", facts)).toEqual({ ok: true, kind: "file" });
    expect(resolveEvidence("docs/imaginary.md", facts).ok).toBe(false);
  });

  it("refuses prose and empties", () => {
    expect(resolveEvidence("I checked it manually", facts).ok).toBe(false);
    expect(resolveEvidence("", facts).ok).toBe(false);
    expect(resolveEvidence(undefined as unknown as string, facts).ok).toBe(false);
  });
});

describe("reconcileAcceptance", () => {
  const facts = { changedFiles: ["src/lib/money.ts"], passingRungs: ["test"], validationPassed: true, turnId: "0007" };

  it("confirms a met claim backed by resolvable evidence", () => {
    const { matrix, downgraded } = reconcileAcceptance(
      initAcceptance(ACS),
      [{ id: "AC1", status: "met", evidence: "src/lib/money.ts" }],
      facts,
    );
    expect(matrix[0]).toMatchObject({ status: "met", evidenceKind: "diff", updatedBy: "0007" });
    expect(downgraded).toEqual([]);
  });

  it("demotes an unevidenced met claim to unmet and says why", () => {
    const { matrix, downgraded } = reconcileAcceptance(initAcceptance(ACS), [{ id: "AC1", status: "met" }], facts);
    expect(matrix[0].status).toBe("unmet");
    expect(downgraded[0]).toMatchObject({ id: "AC1", claimed: "met", actual: "unmet" });
    expect(downgraded[0].reason).toMatch(/no evidence/);
  });

  it("demotes a met claim whose evidence does not resolve", () => {
    const { matrix, downgraded } = reconcileAcceptance(
      initAcceptance(ACS),
      [{ id: "AC1", status: "met", evidence: "src/never/touched.ts" }],
      facts,
    );
    expect(matrix[0].status).toBe("unmet");
    expect(downgraded[0].reason).toMatch(/did not resolve/);
  });

  it("records a met claim made while validation is failing as FAILED — the BUD-11 lie", () => {
    // "✅ COMPLETED" in the build log over a red typecheck is not merely
    // unproven, it is contradicted, and the matrix says so.
    const { matrix, downgraded } = reconcileAcceptance(
      initAcceptance(ACS),
      [{ id: "AC1", status: "met", evidence: "src/lib/money.ts" }],
      { ...facts, validationPassed: false },
    );
    expect(matrix[0].status).toBe("failed");
    expect(downgraded[0]).toMatchObject({ actual: "failed", reason: "validation did not pass" });
  });

  it("never lets an agent waive its own criterion", () => {
    const { matrix } = reconcileAcceptance(initAcceptance(ACS), [{ id: "AC1", status: "waived" }], facts);
    expect(matrix[0].status).toBe("unmet");
  });

  it("leaves criteria the claims said nothing about untouched", () => {
    const { matrix } = reconcileAcceptance(
      initAcceptance(ACS),
      [{ id: "AC1", status: "met", evidence: "test" }],
      facts,
    );
    expect(matrix[1]).toMatchObject({ id: "AC2", status: "unmet", updatedBy: null });
  });

  it("re-running with the existing rows as claims reverts a met AC when validation goes red", () => {
    // This is exactly what handleValidating does on every pass.
    const first = reconcileAcceptance(initAcceptance(ACS), [{ id: "AC1", status: "met", evidence: "test" }], facts).matrix;
    expect(first[0].status).toBe("met");
    const second = reconcileAcceptance(
      first,
      first.map((r) => ({ id: r.id, status: r.status, evidence: r.evidence })),
      { ...facts, validationPassed: false },
    ).matrix;
    expect(second[0].status).toBe("failed");
  });
});

describe("waivers and completeness", () => {
  it("waives only the named unsatisfied criteria, and records the owner", () => {
    const matrix = waiveAcceptance(initAcceptance(ACS), ["AC2"], { note: "waive: out of scope for this slice" });
    expect(matrix[0].status).toBe("unmet");
    expect(matrix[1]).toMatchObject({ status: "waived", updatedBy: "owner" });
  });

  it("waives everything unsatisfied when no ids are given", () => {
    expect(waiveAcceptance(initAcceptance(ACS)).every((r) => r.status === "waived")).toBe(true);
  });

  it("never downgrades an already-met criterion into a waiver", () => {
    const met = reconcileAcceptance(initAcceptance(ACS), [{ id: "AC1", status: "met", evidence: "test" }], {
      passingRungs: ["test"], validationPassed: true,
    }).matrix;
    expect(waiveAcceptance(met)[0].status).toBe("met");
  });

  it("treats an empty matrix as complete rather than as a blocker", () => {
    // A spec that declared no ACs has nothing to prove; inventing a blocker
    // there would strand the session.
    expect(isAcceptanceComplete([])).toBe(true);
    expect(unsatisfiedAcceptance([])).toEqual([]);
  });

  it("summarizes by status", () => {
    const matrix = waiveAcceptance(initAcceptance(ACS), ["AC2"]);
    expect(summarizeAcceptance(matrix)).toEqual({ total: 2, met: 0, waived: 1, unmet: 1, failed: 0 });
  });
});

describe("renderAcceptanceMd", () => {
  it("labels a failed criterion so it cannot read as a pass", () => {
    const matrix = reconcileAcceptance(initAcceptance(ACS), [{ id: "AC1", status: "met", evidence: "x" }], {
      validationPassed: false,
    }).matrix;
    const md = renderAcceptanceMd(matrix);
    expect(md).toContain("| AC1 | FAILED |");
    expect(md).toContain("| AC2 | UNMET |");
    expect(md).toContain("0 met · 0 waived · 1 unmet · 1 failed (of 2)");
  });

  it("says so plainly when the spec declared no criteria", () => {
    expect(renderAcceptanceMd([])).toContain("declared no acceptance criteria");
  });
});
