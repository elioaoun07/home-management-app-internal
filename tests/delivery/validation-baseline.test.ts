import { describe, expect, it } from "vitest";
import { classifyValidationFailure, extractFailingFiles } from "../../scripts/delivery/validation-baseline.mjs";

const TSC_EXCERPT = [
  "> tsc --noEmit -p .",
  "",
  "tests/pm-ui/lint-rules.test.ts(10,33): error TS2353: Object literal may only specify known properties.",
  "tests/pm-ui/lint-rules.test.ts(15,36): error TS2353: Object literal may only specify known properties.",
  " ELIFECYCLE  Command failed with exit code 1.",
].join("\n");

describe("extractFailingFiles", () => {
  it("extracts tsc error file paths, de-duplicated", () => {
    expect(extractFailingFiles(TSC_EXCERPT)).toEqual(["tests/pm-ui/lint-rules.test.ts"]);
  });

  it("extracts vitest FAIL lines", () => {
    const excerpt = " FAIL  src/lib/__tests__/queryConfig.test.ts > some test\n ✗ src/lib/other.test.ts";
    expect(extractFailingFiles(excerpt)).toEqual(["src/lib/__tests__/queryConfig.test.ts", "src/lib/other.test.ts"]);
  });

  it("extracts eslint stylish bare-path-then-rows format", () => {
    const excerpt = ["src/app/page.tsx", "  10:5  error  'x' is defined but never used", "", "1 problem"].join("\n");
    expect(extractFailingFiles(excerpt)).toEqual(["src/app/page.tsx"]);
  });

  it("returns an empty array for unparseable text", () => {
    expect(extractFailingFiles("something went wrong, no file info")).toEqual([]);
    expect(extractFailingFiles("")).toEqual([]);
    expect(extractFailingFiles(undefined as unknown as string)).toEqual([]);
  });
});

describe("classifyValidationFailure (BUD-11 counterfactual)", () => {
  it("treats an unchanged pre-existing typecheck failure as non-attributable when it exactly matches the baseline", () => {
    const validation = { ok: false, results: { typecheck: { ok: false, excerpt: TSC_EXCERPT } } };
    const baseline = { ok: false, results: { typecheck: { ok: false, excerpt: TSC_EXCERPT } } };
    const verdict = classifyValidationFailure(validation, baseline);
    expect(verdict.attributable).toBe(false);
    expect(verdict.preExistingCommands).toEqual(["typecheck"]);
    expect(verdict.attributableCommands).toEqual([]);
  });

  it("treats a failure as attributable when there is no baseline at all", () => {
    const validation = { ok: false, results: { typecheck: { ok: false, excerpt: TSC_EXCERPT } } };
    const verdict = classifyValidationFailure(validation, null);
    expect(verdict.attributable).toBe(true);
    expect(verdict.attributableCommands).toEqual(["typecheck"]);
  });

  it("treats a failure as attributable when the baseline passed that command", () => {
    const validation = { ok: false, results: { typecheck: { ok: false, excerpt: TSC_EXCERPT } } };
    const baseline = { ok: true, results: { typecheck: { ok: true, excerpt: "" } } };
    const verdict = classifyValidationFailure(validation, baseline);
    expect(verdict.attributable).toBe(true);
  });

  it("treats a failure as attributable when a NEW file starts failing beyond the baseline's set", () => {
    const validation = {
      ok: false,
      results: {
        typecheck: {
          ok: false,
          excerpt:
            TSC_EXCERPT + "\nsrc/lib/queryConfig.ts(4,1): error TS1005: ';' expected.",
        },
      },
    };
    const baseline = { ok: false, results: { typecheck: { ok: false, excerpt: TSC_EXCERPT } } };
    const verdict = classifyValidationFailure(validation, baseline);
    expect(verdict.attributable).toBe(true);
    expect(verdict.attributableCommands).toEqual(["typecheck"]);
  });

  it("mixes pre-existing and attributable commands correctly", () => {
    const validation = {
      ok: false,
      results: {
        typecheck: { ok: false, excerpt: TSC_EXCERPT },
        lint: { ok: false, excerpt: "src/app/page.tsx\n  1:1  error  bad thing" },
      },
    };
    const baseline = {
      ok: false,
      results: {
        typecheck: { ok: false, excerpt: TSC_EXCERPT },
        lint: { ok: true, excerpt: "" },
      },
    };
    const verdict = classifyValidationFailure(validation, baseline);
    expect(verdict.attributable).toBe(true);
    expect(verdict.preExistingCommands).toEqual(["typecheck"]);
    expect(verdict.attributableCommands).toEqual(["lint"]);
  });

  it("passing commands are excluded from both lists", () => {
    const validation = {
      ok: false,
      results: { typecheck: { ok: true, excerpt: "" }, lint: { ok: false, excerpt: "src/x.ts(1,1): error TS1" } },
    };
    const verdict = classifyValidationFailure(validation, null);
    expect(verdict.preExistingCommands).toEqual([]);
    expect(verdict.attributableCommands).toEqual(["lint"]);
  });
});
