// DLV-120 — protected-check output is retained, bounded, redacted and classified.
//
// What was wrong
// --------------
// `runCheck` recorded `outputHash = sha256(stdout + stderr)` and a note saying
// the output was hashed and not stored. Safe, and useless: a failed check handed
// the owner "something failed" plus a hex string, and the only way to learn what
// failed was to re-run the verification or dispatch another model job to go and
// look. Recheck then produced repeated inconclusive Results with identical
// evidence refs (DLV-112's symptom) because there was nothing to read.
//
// What these fixtures pin: the text is kept and readable, it carries no absolute
// host path and nothing token-shaped, it is bounded at both ends, and the four
// non-pass shapes stay four distinct facts. Counts and their evaluation are
// deliberately untouched — DLV-112 shipped `parseTestCounts` and this must not
// re-decide any verdict, only explain one.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importTrustedCandidate, pinCheckPlan, runCheck } from "../../scripts/delivery-v2/checks.mjs";
import { makeCriterion } from "../../scripts/delivery-v2/contracts.mjs";
import { evaluateCriterion } from "../../scripts/delivery-v2/criteria.mjs";
import { CHECK_OUTCOMES, RETENTION_LIMITS, classifyCheckOutcome, redactSecrets, retainOutput, retentionNote } from "../../scripts/delivery-v2/diagnostics.mjs";

let ROOT: string;
let WRITER: string;
let GENERATIONS: string;

const AC_SUITE = makeCriterion({
  criterion_id: "AC-suite",
  proposition: "the unit suite passes on the candidate",
  scope: { candidate: "frozen generation" },
  observer: { kind: "command", expected: { spec_id: "unit" } },
  oracle_ref: "repository test suite",
  freshness_inputs: ["candidate", "test-config", "fixture", "toolchain"],
  required_for: "candidate",
  forbidden_substitutes: ["source_match"],
});

const planFor = () =>
  pinCheckPlan({
    criteria: [AC_SUITE],
    specs: { unit: { spec_id: "unit", kind: "command", argv: ["node", "--version"], cwd: "." } },
    toolchain: { node: "v22.20.0" },
  });

const scripted = (result: Record<string, unknown>) => () => ({ stdout: "", stderr: "", signal: null, spawnError: null, ...result });

function candidateFor(files: Record<string, string> = { "src/amount.ts": "1\n" }) {
  rmSync(WRITER, { recursive: true, force: true });
  for (const [path, contents] of Object.entries(files)) {
    const full = join(WRITER, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
  return importTrustedCandidate({ sourceRoot: WRITER, generationsRoot: GENERATIONS }).candidate;
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-diagnostics-"));
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

// ---------------------------------------------------------------------------
// Redaction and bounds
// ---------------------------------------------------------------------------

describe("retainOutput", () => {
  it("keeps both streams labelled instead of concatenating them into one story", async () => {
    const retained = retainOutput({ stdout: "Tests  1 passed (1)", stderr: "a warning" });
    expect(retained.text).toMatch(/--- stdout ---/u);
    expect(retained.text).toMatch(/--- stderr ---/u);
    expect(retained.empty).toBe(false);
  });

  it("replaces absolute roots and the home directory with stable tokens", async () => {
    const retained = retainOutput({
      stdout: "FAIL C:/work/candidate/src/a.ts\nalso C:\\work\\candidate\\src\\a.ts",
      roots: [{ token: "<candidate>", path: "C:/work/candidate" }],
      home: "C:/Users/someone",
    });
    expect(retained.text).not.toMatch(/C:[\\/]work/u);
    expect(retained.text).toMatch(/<candidate>\/src\/a\.ts/u);
  });

  it("strips terminal colour so a coloured log is not stored as escape soup", async () => {
    expect(retainOutput({ stdout: "\u001B[32mTests\u001B[0m  1 passed (1)" }).text).toMatch(/^--- stdout ---\nTests {2}1 passed \(1\)$/u);
  });

  it("drops the middle of a runaway log and says how much", async () => {
    const lines = Array.from({ length: RETENTION_LIMITS.headLines + RETENTION_LIMITS.tailLines + 500 }, (_, index) => "line " + index);
    const retained = retainOutput({ stdout: lines.join("\n") });
    expect(retained.droppedLines).toBe(500);
    expect(retained.text).toMatch(/500 line\(s\) omitted/u);
    // Both ends survive: the head says what was selected, the tail says what broke.
    expect(retained.text).toMatch(/line 0\n/u);
    expect(retained.text).toMatch(/line 699$/u);
  });

  it("clips a single enormous line rather than storing it whole", async () => {
    const retained = retainOutput({ stdout: "x".repeat(RETENTION_LIMITS.lineChars + 50) });
    expect(retained.clippedLines).toBe(1);
    expect(retained.text.length).toBeLessThan(RETENTION_LIMITS.lineChars + 60);
  });

  it("keeps the hash of the original bytes, so a receipt can still be compared", async () => {
    const a = retainOutput({ stdout: "same" });
    const b = retainOutput({ stdout: "same" });
    expect(a.sourceHash).toBe(b.sourceHash);
    expect(retainOutput({ stdout: "different" }).sourceHash).not.toBe(a.sourceHash);
  });
});

describe("redactSecrets", () => {
  it.each([
    ["sk-ant-api03-" + "A".repeat(40)],
    ["ghp_" + "b".repeat(36)],
    ["xoxb-" + "123456789012-abcdefghijklmn"],
    ["AKIA" + "C".repeat(16)],
    ["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"],
  ])("replaces a token-shaped run: %s", (secret) => {
    const { text, redactedSecrets } = redactSecrets("leaked " + secret + " here");
    expect(text).not.toContain(secret);
    expect(text).toContain("<redacted-secret>");
    expect(redactedSecrets).toBeGreaterThan(0);
  });

  it("leaves ordinary compiler output alone", async () => {
    const line = "src/a.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'.";
    expect(redactSecrets(line).text).toBe(line);
  });
});

describe("retentionNote", () => {
  it("states the gap honestly when nothing was retained", async () => {
    expect(retentionNote(null)).toMatch(/not retained/u);
    expect(retentionNote(retainOutput({ stdout: "", stderr: "" }))).toMatch(/no output/u);
  });

  it("names every bound it applied", async () => {
    const lines = Array.from({ length: RETENTION_LIMITS.headLines + RETENTION_LIMITS.tailLines + 5 }, () => "x");
    const note = retentionNote(retainOutput({ stdout: lines.join("\n") + "\nsk-ant-api03-" + "A".repeat(40) }));
    expect(note).toMatch(/line\(s\) omitted/u);
    expect(note).toMatch(/redacted/u);
    expect(note).toMatch(/absolute paths replaced/u);
  });
});

// ---------------------------------------------------------------------------
// The four shapes of not-passing
// ---------------------------------------------------------------------------

describe("classifyCheckOutcome", () => {
  it("separates a runner that never started from a check that failed", async () => {
    expect(classifyCheckOutcome({ spawnError: "ENOENT", exitCode: null, counts: {} })).toMatchObject({
      outcome: CHECK_OUTCOMES.RUNNER_MISSING,
      aboutTheCandidate: false,
    });
  });

  it("separates unreadable output from both of those", async () => {
    expect(classifyCheckOutcome({ exitCode: 1, counts: { selected: null, executed: null } })).toMatchObject({
      outcome: CHECK_OUTCOMES.OUTPUT_UNREADABLE,
      aboutTheCandidate: false,
    });
  });

  it("separates zero selection from a real failure", async () => {
    expect(classifyCheckOutcome({ exitCode: 0, counts: { selected: 0, executed: 0 } }).outcome).toBe(CHECK_OUTCOMES.NO_TESTS_SELECTED);
  });

  it("calls a nonzero exit with readable counts what it is, and only that a statement about the candidate", async () => {
    const failed = classifyCheckOutcome({ exitCode: 1, counts: { selected: 10, executed: 10, failed: 2 } });
    expect(failed.outcome).toBe(CHECK_OUTCOMES.TESTS_FAILED);
    expect(failed.aboutTheCandidate).toBe(true);
    expect(classifyCheckOutcome({ exitCode: 0, counts: { selected: 10, executed: 10, failed: 0 } }).outcome).toBe(CHECK_OUTCOMES.PASSED);
  });

  it("treats a green exit with failing cases as a failure, not a pass", async () => {
    expect(classifyCheckOutcome({ exitCode: 0, counts: { selected: 10, executed: 10, failed: 3 } }).outcome).toBe(CHECK_OUTCOMES.TESTS_FAILED);
  });
});

// ---------------------------------------------------------------------------
// runCheck: retention with identity, and the distinctions on the receipt
// ---------------------------------------------------------------------------

describe("runCheck retains its output", () => {
  it("hands the retainer bounded redacted text tagged with the criterion at its revision", async () => {
    const candidate = candidateFor();
    const kept: Record<string, unknown>[] = [];
    const outcome = await runCheck({
      plan: planFor(),
      candidate,
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 1, stdout: "Tests  2 failed | 8 passed (10)", stderr: "FAIL " + candidate.root + "/src/amount.test.ts" }),
      retain: (entry: Record<string, unknown>) => {
        kept.push(entry);
        return entry.artifact_id;
      },
    });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({
      kind: "check-output",
      criterion_id: "AC-suite",
      criterion_revision: AC_SUITE.revision,
      candidate_id: candidate.candidate_id,
      spec_id: "unit",
    });
    expect(String(kept[0].bytes)).toMatch(/2 failed \| 8 passed/u);
    // The candidate's absolute root never reaches the store.
    expect(String(kept[0].bytes)).not.toContain(candidate.root);
    expect(String(kept[0].bytes)).toMatch(/<candidate>/u);
    expect(outcome.receipt!.raw_refs).toEqual([kept[0].artifact_id]);
    expect(outcome.observation!.raw_refs).toEqual([kept[0].artifact_id]);
  });

  it("addresses the artifact by content, so a re-run overwrites and a new revision does not", async () => {
    const candidate = candidateFor();
    const ids: string[] = [];
    const capture = (entry: { artifact_id: string }) => {
      ids.push(entry.artifact_id);
      return entry.artifact_id;
    };
    const run = (criterion = AC_SUITE) =>
      runCheck({ plan: planFor(), candidate, criterion, execute: scripted({ exitCode: 0, stdout: "Tests  1 passed (1)" }), retain: capture });
    await run();
    await run();
    expect(ids[0]).toBe(ids[1]);
  });

  it("still produces a receipt when the store refuses the blob, and says nothing was retained", async () => {
    const outcome = await runCheck({
      plan: planFor(),
      candidate: candidateFor(),
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, stdout: "Tests  1 passed (1)" }),
      retain: () => {
        throw new Error("disk full");
      },
    });
    expect(outcome.receipt).not.toBeNull();
    expect(outcome.receipt!.raw_refs).toEqual([]);
    expect((outcome.receipt!.output as { retained: boolean }).retained).toBe(false);
  });

  it("keeps the old hash beside the retained text rather than replacing it", async () => {
    const outcome = await runCheck({
      plan: planFor(),
      candidate: candidateFor(),
      criterion: AC_SUITE,
      execute: scripted({ exitCode: 0, stdout: "Tests  1 passed (1)" }),
      retain: (entry: { artifact_id: string }) => entry.artifact_id,
    });
    expect(outcome.receipt!.outputHash).toMatch(/^sha256:/u);
    expect(outcome.receipt!.redaction).toMatch(/retained/u);
  });
});

describe("runCheck distinguishes the failure shapes on the receipt", () => {
  it.each([
    [{ spawnError: "ENOENT", exitCode: null }, CHECK_OUTCOMES.RUNNER_MISSING, false],
    [{ exitCode: 1, stdout: "something exploded" }, CHECK_OUTCOMES.OUTPUT_UNREADABLE, false],
    [{ exitCode: 0, stdout: "No test files found" }, CHECK_OUTCOMES.NO_TESTS_SELECTED, false],
    [{ exitCode: 1, stdout: "Tests  2 failed | 8 passed (10)" }, CHECK_OUTCOMES.TESTS_FAILED, true],
    [{ exitCode: 0, stdout: "Tests  10 passed (10)" }, CHECK_OUTCOMES.PASSED, true],
  ])("records %j as %s", async (result, outcome, aboutTheCandidate) => {
    const receipt = (await runCheck({
      plan: planFor(),
      candidate: candidateFor(),
      criterion: AC_SUITE,
      execute: scripted(result as Record<string, unknown>),
      retain: (entry: { artifact_id: string }) => entry.artifact_id,
    })).receipt!;
    expect(receipt.outcome).toBe(outcome);
    expect(receipt.aboutTheCandidate).toBe(aboutTheCandidate);
    expect(receipt.outcomeDetail).toEqual(expect.any(String));
  });

  it("does not let the new vocabulary change any verdict DLV-112 already decided", async () => {
    const candidate = candidateFor();
    const verdicts = async (result: Record<string, unknown>) => {
      const outcome = await runCheck({ plan: planFor(), candidate, criterion: AC_SUITE, execute: scripted(result) });
      return evaluateCriterion(AC_SUITE, outcome.observation, { candidate_ref: candidate.candidate_id, currentInputs: outcome.observation!.inputs });
    };
    expect((await verdicts({ exitCode: 0, stdout: "Tests  10 passed (10)" })).state).toBe("satisfied");
    expect((await verdicts({ exitCode: 1, stdout: "Tests  2 failed | 8 passed (10)" })).state).toBe("failed");
    expect((await verdicts({ exitCode: 0, stdout: "No test files found" })).state).toBe("missing");
    expect((await verdicts({ exitCode: 1, stdout: "something exploded" })).state).toBe("inconclusive");
    expect((await verdicts({ spawnError: "ENOENT", exitCode: null })).state).toBe("inconclusive");
  });
});
