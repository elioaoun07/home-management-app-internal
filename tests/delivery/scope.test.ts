// DLV-7 unit tests: the scope contract's pure half — size classification from
// measured counts, the SPEC-gate mismatch verdict, decomposition normalization,
// and the post-PLAN scope lock's path matching.
import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  buildScopeLock,
  buildScopeVerdict,
  classifyScopeSize,
  normalizeDecomposition,
  normalizeScopeEstimate,
  normalizeSizeClass,
  pathsOutsideScope,
} from "../../scripts/delivery/scope.mjs";

describe("normalizeSizeClass", () => {
  it("accepts the checklist grammar's own letters, case- and space-insensitively", () => {
    expect(normalizeSizeClass("S")).toBe("S");
    expect(normalizeSizeClass(" m ")).toBe("M");
    expect(normalizeSizeClass("l")).toBe("L");
  });

  it("returns null rather than guessing for anything else", () => {
    // An item with no effort recorded has no contract to violate — inventing
    // one would manufacture mismatches out of missing data.
    expect(normalizeSizeClass(null)).toBeNull();
    expect(normalizeSizeClass("XL")).toBeNull();
    expect(normalizeSizeClass(3)).toBeNull();
  });
});

describe("classifyScopeSize", () => {
  it("classifies BUD-14's real shape (1 file, 1 occurrence, 1 module) as S", () => {
    expect(classifyScopeSize({ files: 1, occurrences: 1, modules: 1 })).toBe("S");
  });

  it("classifies BUD-11's measured shape (25 files, 72 occurrences) as L", () => {
    expect(classifyScopeSize({ files: 25, occurrences: 72, modules: 4 })).toBe("L");
  });

  it("uses the worst axis, not an average", () => {
    // 1 file but 40 distinct sites in it is not a small change.
    expect(classifyScopeSize({ files: 1, occurrences: 40, modules: 1 })).toBe("L");
    expect(classifyScopeSize({ files: 1, occurrences: 20, modules: 1 })).toBe("M");
  });

  it("treats an omitted axis as non-disqualifying, not as zero", () => {
    expect(classifyScopeSize({ files: 1 })).toBe("S");
    expect(classifyScopeSize({ occurrences: 60 })).toBe("L");
  });

  it("returns null when nothing at all was measured", () => {
    expect(classifyScopeSize(null)).toBeNull();
    expect(classifyScopeSize({})).toBeNull();
    expect(classifyScopeSize({ note: "big" })).toBeNull();
  });

  it("honours owner-set thresholds over the defaults", () => {
    const strict = { S: { files: 1, occurrences: 1, modules: 1 }, M: { files: 2, occurrences: 2, modules: 1 } };
    expect(classifyScopeSize({ files: 2, occurrences: 2, modules: 1 }, strict)).toBe("M");
    expect(classifyScopeSize({ files: 2, occurrences: 2, modules: 1 }, DEFAULT_THRESHOLDS)).toBe("S");
  });
});

describe("normalizeScopeEstimate", () => {
  it("floors real numbers and keeps a note", () => {
    expect(normalizeScopeEstimate({ files: 2.9, occurrences: 3, modules: 1, note: " grep hits " })).toEqual({
      files: 2, occurrences: 3, modules: 1, note: "grep hits",
    });
  });

  it("rejects a non-numeric axis outright instead of coercing it to zero", () => {
    // `files: "lots"` becoming `files: 0` would look measured while being
    // meaningless — worse than reporting nothing.
    expect(normalizeScopeEstimate({ files: "lots" })).toBeNull();
    expect(normalizeScopeEstimate({ files: -1 })).toBeNull();
    expect(normalizeScopeEstimate({ files: Number.NaN })).toBeNull();
  });

  it("returns null for shapes that carry no axis at all", () => {
    expect(normalizeScopeEstimate(null)).toBeNull();
    expect(normalizeScopeEstimate([])).toBeNull();
    expect(normalizeScopeEstimate({ note: "nothing measured" })).toBeNull();
  });
});

describe("buildScopeVerdict", () => {
  it("flags the BUD-11 shape: an S item measuring L", () => {
    const verdict = buildScopeVerdict({
      estimate: { files: 25, occurrences: 72, modules: 4 },
      itemEffort: "S",
      lane: "FAST",
    });
    expect(verdict.mismatch).toBe(true);
    expect(verdict.direction).toBe("over");
    expect(verdict.sizeClass).toBe("L");
    expect(verdict.itemSizeClass).toBe("S");
    expect(verdict.reason).toContain("25 file(s)");
    expect(verdict.reason).toContain("FAST");
  });

  it("does not flag a matching scope", () => {
    const verdict = buildScopeVerdict({ estimate: { files: 1, occurrences: 1, modules: 1 }, itemEffort: "S" });
    expect(verdict.mismatch).toBe(false);
    expect(verdict.direction).toBe("match");
  });

  it("never flags a measured scope SMALLER than declared", () => {
    // An L item that turns out to be S is a pleasant surprise. Treating it as a
    // violation would train the owner to wave the gate through.
    const verdict = buildScopeVerdict({ estimate: { files: 1, occurrences: 1, modules: 1 }, itemEffort: "L" });
    expect(verdict.mismatch).toBe(false);
    expect(verdict.direction).toBe("under");
  });

  it("reports 'unknown' — never a mismatch — when either side is missing", () => {
    expect(buildScopeVerdict({ estimate: null, itemEffort: "S" })).toMatchObject({ mismatch: false, direction: "unknown" });
    expect(buildScopeVerdict({ estimate: { files: 30 }, itemEffort: null })).toMatchObject({ mismatch: false, direction: "unknown" });
  });
});

describe("normalizeDecomposition", () => {
  const slice = (title: string) => ({ title, rationale: "because", acceptanceCriteriaIds: ["AC1"] });

  it("accepts 2-4 well-formed slices", () => {
    const out = normalizeDecomposition([slice("one"), slice("two")]);
    expect(out).toHaveLength(2);
    expect(out?.[0]).toEqual({ title: "one", rationale: "because", acceptanceCriteriaIds: ["AC1"] });
  });

  it("rejects the whole proposal rather than repairing part of it", () => {
    // A half-parsed decomposition presented as an owner choice is worse than
    // none, because the owner cannot see what was silently dropped.
    expect(normalizeDecomposition([slice("only one")])).toBeNull();
    expect(normalizeDecomposition([slice("a"), slice("b"), slice("c"), slice("d"), slice("e")])).toBeNull();
    expect(normalizeDecomposition([slice("a"), { title: "  " }])).toBeNull();
    expect(normalizeDecomposition([slice("a"), null])).toBeNull();
    expect(normalizeDecomposition("nope")).toBeNull();
  });

  it("defaults a missing acceptanceCriteriaIds to an empty list", () => {
    const out = normalizeDecomposition([{ title: "a" }, { title: "b" }]);
    expect(out?.[0].acceptanceCriteriaIds).toEqual([]);
    expect(out?.[0].rationale).toBeNull();
  });
});

describe("buildScopeLock / pathsOutsideScope", () => {
  const plan = {
    steps: [
      { id: "STEP-1", paths: ["src/lib/money.ts", "src/features/budget/"] },
      { id: "STEP-2", paths: ["src/app/api/**"] },
    ],
  };
  const spec = { acceptanceCriteria: [{ id: "AC1", text: "x" }, { id: "AC2", text: "y" }] };

  it("freezes the union of every step's declared paths plus the AC ids", () => {
    const lock = buildScopeLock({ plan, spec });
    expect(lock.paths.sort()).toEqual(["src/app/api/**", "src/features/budget/", "src/lib/money.ts"]);
    expect(lock.acceptanceCriteriaIds).toEqual(["AC1", "AC2"]);
    expect(lock.stepIds).toEqual(["STEP-1", "STEP-2"]);
  });

  it("accepts literal files, directory prefixes and globs", () => {
    const lock = buildScopeLock({ plan, spec });
    expect(pathsOutsideScope(["src/lib/money.ts"], lock)).toEqual([]);
    expect(pathsOutsideScope(["src/features/budget/hooks/useX.ts"], lock)).toEqual([]);
    expect(pathsOutsideScope(["src/app/api/accounts/route.ts"], lock)).toEqual([]);
  });

  it("reports files the approved plan never declared", () => {
    const lock = buildScopeLock({ plan, spec });
    expect(pathsOutsideScope(["src/lib/money.ts", "src/components/Widget.tsx"], lock)).toEqual([
      "src/components/Widget.tsx",
    ]);
  });

  it("normalizes Windows separators on both sides", () => {
    const lock = buildScopeLock({ plan: { steps: [{ id: "S", paths: ["src\\lib\\money.ts"] }] }, spec });
    expect(pathsOutsideScope(["src\\lib\\money.ts"], lock)).toEqual([]);
  });

  it("never reports anything when the plan declared no paths at all", () => {
    // Inventing a boundary from an empty list would block every plan whose
    // steps happened not to name files.
    expect(pathsOutsideScope(["anything.ts"], buildScopeLock({ plan: { steps: [] }, spec }))).toEqual([]);
    expect(pathsOutsideScope(["anything.ts"], null)).toEqual([]);
  });
});
