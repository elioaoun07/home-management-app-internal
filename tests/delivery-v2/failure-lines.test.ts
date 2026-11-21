import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import { decisiveLines } from "../../scripts/delivery-v2/failure-lines.mjs";

describe("DLV-160 decisive failure lines", () => {
  it("keeps the retained run's ten failures and both totals within twelve lines", () => {
    const fixture = readFileSync(new URL("./fixtures/local-run-7-error.txt", import.meta.url), "utf8");
    const plain = stripVTControlCharacters(fixture);
    const expected = plain.split(/\r?\n/u).filter(line => /^\s*(?:FAIL\s|(?:Test Files|Tests)\s)/u.test(line));
    const result = decisiveLines(fixture);
    expect(result.split("\n")).toEqual(expected);
    expect(result.split("\n").filter(line => /^\s*FAIL\s/u.test(line))).toHaveLength(10);
    expect(result.split("\n")).toHaveLength(12);
    expect(result).not.toContain("\u001b");
  });

  it("adds each selected failure's first following error while preserving source order", () => {
    expect(decisiveLines([
      "noise", " FAIL first.test.ts > first case", "stack noise", "AssertionError: first cause",
      "Error: not the first reason", " FAIL second.test.ts > second case", "Error: second cause",
      "Test Files 2 failed (2)", "Tests 2 failed (2)", "tail noise",
    ].join("\n"))).toBe([
      " FAIL first.test.ts > first case", "AssertionError: first cause",
      " FAIL second.test.ts > second case", "Error: second cause",
      "Test Files 2 failed (2)", "Tests 2 failed (2)",
    ].join("\n"));
  });

  it("does not associate an error beyond a totals line with the preceding failure", () => {
    expect(decisiveLines(" FAIL first.test.ts\nTest Files 1 failed\nTests 1 failed\nError: teardown noise"))
      .toBe(" FAIL first.test.ts\nTest Files 1 failed\nTests 1 failed");
  });

  it("extracts TypeScript diagnostics and Git fatal lines, stripping ANSI and OSC", () => {
    expect(decisiveLines([
      "Running TypeScript check...", "\u001b[31msrc/a.ts(4,2): error TS2322: mismatch\u001b[0m",
      "src/b.ts(1,1): error TS2304: missing", "\u001b]8;;https://example.invalid\u0007fatal: missing object\u001b]8;;\u0007",
      "ELIFECYCLE Command failed",
    ].join("\n"))).toBe("src/a.ts(4,2): error TS2322: mismatch\nsrc/b.ts(1,1): error TS2304: missing\nfatal: missing object");
  });

  it("keeps ESLint file headers with their error locations and omits warnings", () => {
    expect(decisiveLines([
      "C:\\repo\\first.ts", "  1:2  warning  existing warning", "  2:3  error  first error rule",
      "  4:5  error  second error rule", "", "src/second.tsx", "  6:7  error  third error rule",
      "", "3 problems",
    ].join("\n"))).toBe([
      "C:\\repo\\first.ts", "  2:3  error  first error rule", "  4:5  error  second error rule",
      "src/second.tsx", "  6:7  error  third error rule",
    ].join("\n"));
  });

  it("retains a location error without inventing a missing filename", () => {
    expect(decisiveLines("Running ESLint...\n  2:3  error  first error rule")).toBe("  2:3  error  first error rule");
  });

  it("does not split a new ESLint filename and error when only one slot remains", () => {
    const diagnostics = Array.from({ length: 11 }, (_, i) => `src/a.ts(${i + 1},1): error TS2322: mismatch`);
    expect(decisiveLines([...diagnostics, "src/b.ts", "  2:3  error  lint rule"].join("\n")))
      .toBe(diagnostics.join("\n"));
  });

  it("preserves both totals when more than ten failure headings compete for space", () => {
    const failures = Array.from({ length: 15 }, (_, i) => ` FAIL case-${i}.test.ts`);
    const totals = ["Test Files 15 failed", "Tests 15 failed"];
    expect(decisiveLines([...failures, ...totals].join("\n"))).toBe([...failures.slice(0, 10), ...totals].join("\n"));
  });

  it("falls back to the final twelve nonempty lines", () => {
    const lines = Array.from({ length: 15 }, (_, i) => `line ${i}`);
    expect(decisiveLines(lines.join("\n\n") + "\n  \n")).toBe(lines.slice(-12).join("\n"));
  });

  it("returns no detail for empty input", () => {
    expect(decisiveLines("")).toBe("");
    expect(decisiveLines(" \n\t\n")).toBe("");
  });
});
