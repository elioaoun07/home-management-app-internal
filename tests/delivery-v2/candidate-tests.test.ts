// Mandatory candidate tests (ERA Steward sign-off plan, Phase 2).
//
// R44's candidate was "verified" while its own authored test file had never been
// executed; it failed five cases the first time anyone ran it, after Apply. These
// tests prove the gate closes that: the tests a candidate adds, changes or has its
// plan name run in the protected checker (here scripted), and anything but a clean
// pass blocks Candidate verified and Apply. Nothing reaches a provider or Docker.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { validateExecutionPolicy, policyTemplate } from "../../scripts/delivery-v2/policy.mjs";
import {
  CANDIDATE_TESTS_CRITERION_ID,
  candidateTestsDefinition,
  globToRegExp,
  gradeCandidateTests,
  isTestPath,
  parseVitestSummary,
  selectCandidateTests,
} from "../../scripts/delivery-v2/candidate-tests.mjs";
import { SELECT, journeyFor, makeHarness, seedRoot, writePolicy, type Loose } from "./fixtures/v2-harness";

// ---------------------------------------------------------------------------
// Pure: selection, definition and grading
// ---------------------------------------------------------------------------

const manifest = (paths: Record<string, string>) => Object.entries(paths).map(([path, sha256]) => ({ path, sha256 }));
const candidateOf = (now: Record<string, string>, base: Record<string, string> = {}) =>
  ({ candidate_id: "cand-x", manifest: manifest(now), base_manifest: manifest(base) }) as Loose;
const pass = (tests = 3, files = 1) => ({ exitCode: 0, stdout: `Test Files  ${files} passed (${files})\n      Tests  ${tests} passed (${tests})`, stderr: "", spawnError: null });
const selected = (paths: string[]) =>
  ({ files: paths.map((path) => ({ path, sha256: "sha256:a", source: "changed" })), missing: [], unsafe: [] }) as unknown as Parameters<typeof gradeCandidateTests>[0]["selection"];

describe("which tests are mandatory", () => {
  it("the documented default policy includes source-adjacent tests", () => {
    const policy = structuredClone(policyTemplate({ executor: "claude", authorized_by: "owner" })) as Loose;
    policy.checks.requiredVerifications = { candidateTests: { enabled: true, enforcement: "required", argv: ["node", "/node_modules/vitest/vitest.mjs", "run"] } };
    const validated = validateExecutionPolicy(policy) as Loose;
    expect(validated.ok).toBe(true);
    const selection = selectCandidateTests({ candidate: candidateOf({ "src/features/items/new.test.ts": "sha256:a", "tests/new.test.ts": "sha256:b" }), patterns: validated.policy.checks.requiredVerifications.candidateTests.include });
    expect(selection.files.map((file) => file.path)).toEqual(["src/features/items/new.test.ts", "tests/new.test.ts"]);
    expect(gradeCandidateTests({ selection, raw: null }).state).not.toBe("satisfied");
  });
  it("matches policy globs with ** across directories and * within one", () => {
    expect(isTestPath("tests/pm-ui/raw-fetch-guard.test.ts")).toBe(true);
    expect(isTestPath("src/lib/a.test.ts")).toBe(true);
    expect(isTestPath("src/lib/a.ts")).toBe(false);
    expect(isTestPath("tests/helper.ts")).toBe(false);
    expect(globToRegExp("tests/*.test.ts").test("tests/a/b.test.ts")).toBe(false);
    expect(globToRegExp("tests/**/*.test.ts").test("tests/a/b.test.ts")).toBe(true);
  });

  it("takes added and changed tests, plus tests the plan names, and never a deleted one", () => {
    const base = { "tests/old.test.ts": "sha256:1", "tests/gone.test.ts": "sha256:2", "tests/same.test.ts": "sha256:3", "src/a.ts": "sha256:4" };
    const now = { "tests/old.test.ts": "sha256:1b", "tests/new.test.ts": "sha256:5", "tests/same.test.ts": "sha256:3", "src/a.ts": "sha256:4b" };
    const selection = selectCandidateTests({ candidate: candidateOf(now, base), planScope: ["src/a.ts", "tests/same.test.ts"] });
    expect(selection.files.map((file) => [file.path, file.source])).toEqual([
      ["tests/new.test.ts", "changed"],
      ["tests/old.test.ts", "changed"],
      ["tests/same.test.ts", "planned"],
    ]);
    expect(selection.missing).toEqual([]);
  });

  it("reports a planned test the candidate does not contain as missing", () => {
    const selection = selectCandidateTests({ candidate: candidateOf({ "src/a.ts": "sha256:1" }), planScope: ["tests/promised.test.ts"] });
    expect(selection.missing).toEqual(["tests/promised.test.ts"]);
    expect(gradeCandidateTests({ selection, raw: null })).toMatchObject({ state: "failed", reason: "candidate-tests-missing" });
  });

  it("refuses a path that could reach the command line as anything but a path", () => {
    const hostile = { "tests/a b.test.ts": "sha256:1", "tests/../x.test.ts": "sha256:2", "tests/ok.test.ts": "sha256:3" };
    const selection = selectCandidateTests({ candidate: candidateOf(hostile), patterns: ["tests/**/*.test.ts"] });
    expect(selection.files.map((file) => file.path)).toEqual(["tests/ok.test.ts"]);
    expect([...selection.unsafe].sort()).toEqual(["tests/../x.test.ts", "tests/a b.test.ts"]);
    expect(gradeCandidateTests({ selection, raw: pass() })).toMatchObject({ state: "inconclusive", reason: "candidate-test-path-unsafe" });
  });

  it("binds the definition to the command, the checker inputs and every test byte", () => {
    const configured = { argv: ["node", "vitest.mjs", "run"], include: ["tests/**/*.test.ts"] };
    const one = selected(["tests/a.test.ts"]);
    const digest = (overrides: Loose = {}) =>
      candidateTestsDefinition({ configured: { ...configured, ...overrides.configured }, selection: overrides.selection || one, checkerInputs: overrides.inputs || [] }).definition_digest;
    expect(digest()).toBe(digest());
    expect(digest({ configured: { argv: ["node", "other.mjs", "run"] } })).not.toBe(digest());
    expect(digest({ selection: { ...one, files: [{ path: "tests/a.test.ts", sha256: "sha256:b" }] } })).not.toBe(digest());
    expect(digest({ inputs: [{ path: "vitest.config.ts", sha256: "sha256:c" }] })).not.toBe(digest());
  });
});

describe("what counts as passing", () => {
  it("reads vitest's file and test summaries, with or without colour", () => {
    expect(parseVitestSummary("\u001B[32m Test Files \u001B[39m 2 passed (2)\n Tests  5 passed | 1 skipped (6)")).toEqual({
      files: { total: 2, passed: 2, failed: 0, skipped: 0 },
      tests: { total: 6, passed: 5, failed: 0, skipped: 1 },
    });
    expect(parseVitestSummary("Test Files  1 failed | 1 passed (2)\n Tests  no tests")?.files).toMatchObject({ total: 2, failed: 1 });
    expect(parseVitestSummary("nothing here")).toBeNull();
  });

  it("passes only on exit 0 with every selected file collected, every test executed and none skipped", () => {
    expect(gradeCandidateTests({ selection: selected(["tests/a.test.ts"]), raw: pass(3, 1) })).toMatchObject({ state: "satisfied", reason: null });
  });

  it.each([
    ["a failing test", { exitCode: 1, stdout: "Test Files  1 failed (1)\n Tests  2 failed | 1 passed (3)", stderr: "", spawnError: null }, "failed", "candidate-tests-failed"],
    ["a skipped test", { exitCode: 0, stdout: "Test Files  1 passed (1)\n Tests  2 passed | 1 skipped (3)", stderr: "", spawnError: null }, "failed", "candidate-tests-skipped"],
    ["a timeout", { exitCode: null, stdout: "", stderr: "", spawnError: "ETIMEDOUT" }, "inconclusive", "candidate-tests-runner-error"],
    ["a runner that never started", { exitCode: null, stdout: "", stderr: "", spawnError: "ENOENT" }, "inconclusive", "candidate-tests-runner-error"],
    ["a green exit with no summary", { exitCode: 0, stdout: "ok", stderr: "", spawnError: null }, "inconclusive", "candidate-tests-output-unreadable"],
    ["a test count without a file summary", { exitCode: 0, stdout: "Tests 3 passed (3)", stderr: "", spawnError: null }, "inconclusive", "candidate-tests-output-unreadable"],
    ["a file count without a total", { exitCode: 0, stdout: "Test Files 1 passed\n Tests 3 passed (3)", stderr: "", spawnError: null }, "inconclusive", "candidate-tests-did-not-run"],
    ["a file count without every file passed", { exitCode: 0, stdout: "Test Files (1)\n Tests 3 passed (3)", stderr: "", spawnError: null }, "inconclusive", "candidate-tests-did-not-run"],
    ["a crash before any report", { exitCode: 1, stdout: "SyntaxError", stderr: "", spawnError: null }, "failed", "candidate-tests-failed"],
    ["a collection error", { exitCode: 1, stdout: "Test Files  1 failed (1)\n Tests  no tests", stderr: "", spawnError: null }, "failed", "candidate-tests-failed"],
    ["extra files the filter also matched", pass(4, 2), "inconclusive", "candidate-tests-selected-extra-files"],
    ["a file the runner did not collect", { exitCode: 0, stdout: "Test Files  1 passed (1)\n Tests  3 passed (3)", stderr: "", spawnError: null }, "inconclusive", "candidate-tests-did-not-run"],
  ])("does not pass %s", (_label, raw, state, reason) => {
    const files = reason === "candidate-tests-did-not-run" ? ["tests/a.test.ts", "tests/b.test.ts"] : ["tests/a.test.ts"];
    expect(gradeCandidateTests({ selection: selected(files), raw: raw as Loose })).toMatchObject({ state, reason });
  });

  it("is not applicable — and says so — when there is nothing to run", () => {
    expect(gradeCandidateTests({ selection: selected([]), raw: null })).toMatchObject({ state: "satisfied", reason: "no-candidate-tests" });
  });
});

describe("policy", () => {
  const base = () => structuredClone(policyTemplate({ executor: "claude", authorized_by: "owner" })) as Loose;
  it("pins the command and keeps existing policies' fingerprint unchanged when the check is absent", () => {
    const without = validateExecutionPolicy(base()) as Loose;
    expect(without.ok).toBe(true);
    expect("candidateTests" in without.policy.checks.requiredVerifications).toBe(false);
    const policy = base();
    policy.checks.requiredVerifications.candidateTests = { argv: ["node", "/node_modules/vitest/vitest.mjs", "run"] };
    const parsed = validateExecutionPolicy(policy) as Loose;
    expect(parsed.ok).toBe(true);
    expect(parsed.policy.checks.requiredVerifications.candidateTests).toMatchObject({ enabled: true, enforcement: "required" });
    expect(parsed.policy.checks.requiredVerifications.candidateTests.include.length).toBeGreaterThan(0);
  });

  it.each([
    ["no argv", { argv: [] }],
    ["a non-string argv", { argv: ["node", 5] }],
    ["an absolute pattern", { argv: ["node"], include: ["/etc/*.test.ts"] }],
    ["a parent pattern", { argv: ["node"], include: ["../x/*.test.ts"] }],
    ["an unknown enforcement", { argv: ["node"], enforcement: "maybe" }],
  ])("refuses %s", (_label, entry) => {
    const policy = base();
    policy.checks.requiredVerifications.candidateTests = entry;
    expect((validateExecutionPolicy(policy) as Loose).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The real journey: verify, Apply, and the integrated re-run
// ---------------------------------------------------------------------------

let ROOT: string;
let DATA: string;
let store: ReturnType<typeof openStore>;
let seq = 0;
const cmd = () => "cmd-" + ++seq;
const TEST_FILE = "tests/amount.unit.test.ts";
const VITEST = ["node", "/node_modules/vitest/vitest.mjs", "run"];

const withTests = (extra: Loose = {}) => ({
  publicationScope: { allowedPaths: ["src", "tests"], changeConstraints: {} },
  scratchScope: { kind: "snapshot", include: ["src/amount.ts", "src/config.ts", "src/old.ts", "tests/amount.check.mjs", "vitest.config.ts"] },
  checks: {
    specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"] } },
    inputs: ["tests/amount.check.mjs", ...(extra.inputs || [])],
    requiredVerifications: { candidateTests: { enabled: true, argv: extra.argv || VITEST, include: ["tests/**/*.test.ts"], enforcement: extra.enforcement || "required" } },
  },
});

/** A candidate that fixes the amount and ships a test file. */
const buildWithTest = (extraBuild: (dir: string) => void = () => undefined) => (dir: string) => {
  writeFileSync(join(dir, "src", "amount.ts"), "export const amount = 20;\n", "utf8");
  mkdirSync(join(dir, "tests"), { recursive: true });
  writeFileSync(join(dir, TEST_FILE), "// authored by the candidate\n", "utf8");
  extraBuild(dir);
};

/** Runs the oracle as the harness does, and scripts only the candidate-test command. */
function scriptChecker(h: Loose, vitest: (argv: string[]) => Loose) {
  const vitestCalls: Loose[] = [];
  const inherited = h.runtime.checkExecutor;
  h.runtime.checkExecutor = (input: Loose) => {
    const oracle = inherited(input);
    return async (call: Loose) => {
      if (call.argv[1] === "tests/amount.check.mjs") return oracle(call);
      vitestCalls.push({ argv: [...call.argv], generation: String(input.candidate.generation) });
      return vitest(call.argv);
    };
  };
  return vitestCalls;
}

async function checkedRun(journey: Loose) {
  const delivered = await journey.deliver({ ...SELECT, executor: "claude", model: "claude-test", effort: "low", command_id: cmd(), actor: "owner" });
  expect(delivered.ok).toBe(true);
  await journey.idle();
  const run_id = String(delivered.run_id);
  const plan = journey.detail(run_id).plans[0];
  const decided = await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve", command_id: cmd(), actor: "owner" });
  expect(decided.ok).toBe(true);
  await journey.idle();
  const view = journey.detail(run_id) as Loose;
  return { run_id, view, candidate_id: view.candidate ? String(view.candidate.candidate_id) : "", result_ref: view.result ? view.result.result_id + "@" + view.result.result_version : "" };
}

const testsState = (view: Loose) => ((view.result && view.result.criterion_states) || []).find((entry: Loose) => entry.criterion_id === CANDIDATE_TESTS_CRITERION_ID) || null;

beforeEach(() => {
  seq = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-ctests-root-"));
  DATA = mkdtempSync(join(tmpdir(), "era-v2-ctests-data-"));
  seedRoot(ROOT);
  writeFileSync(join(ROOT, "vitest.config.ts"), "export default {};\n", "utf8");
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

const journeyWith = (h: Loose) => journeyFor({ root: ROOT, data: DATA, store, harness: h });

describe("a candidate's own tests gate Candidate verified", () => {
  it("verifies when the new test file ran in the checker with the pinned command and passed, then re-runs it on the integrated tree before Applied", async () => {
    writePolicy(ROOT, withTests());
    const h = makeHarness(ROOT, buildWithTest());
    const calls = scriptChecker(h, () => pass(3, 1));
    const journey = journeyWith(h);
    const { run_id, view, candidate_id, result_ref } = await checkedRun(journey);

    expect(view.run.closed_outcome).toBe("verified_candidate");
    expect(testsState(view)).toMatchObject({ state: "satisfied", required_for: "candidate" });
    // The command is the policy's; the candidate contributed only its path.
    expect(calls).toHaveLength(1);
    expect(calls[0].argv).toEqual([...VITEST, TEST_FILE]);
    const evidence = (view.evidence as Loose[]).find((entry) => entry.criterion_id === CANDIDATE_TESTS_CRITERION_ID);
    expect(evidence!.environment).toMatchObject({ producer: "protected-checker", isolated: true });

    const applied = await journey.apply({ run_id, action: "apply", candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(applied.ok).toBe(true);
    // Applied only after the integrated tree's own run of the same tests.
    expect(calls).toHaveLength(2);
    expect(calls[1].generation).not.toBe(calls[0].generation);
    expect(journey.detail(run_id).applications.at(-1).state).toBe("applied");
  });

  it.each([
    ["fail", () => ({ exitCode: 1, stdout: "Test Files  1 failed (1)\n Tests  2 failed | 1 passed (3)", stderr: "", spawnError: null }), "failed"],
    ["are skipped", () => ({ exitCode: 0, stdout: "Test Files  1 passed (1)\n Tests  2 passed | 1 skipped (3)", stderr: "", spawnError: null }), "failed"],
    ["time out", () => ({ exitCode: null, stdout: "", stderr: "", spawnError: "ETIMEDOUT" }), "inconclusive"],
    ["print nothing readable", () => ({ exitCode: 0, stdout: "ok", stderr: "", spawnError: null }), "inconclusive"],
  ])("does not verify the candidate when its tests %s, and there is nothing to Apply", async (_label, script, state) => {
    writePolicy(ROOT, withTests());
    const h = makeHarness(ROOT, buildWithTest());
    scriptChecker(h, script as () => Loose);
    const journey = journeyWith(h);
    const { run_id, view } = await checkedRun(journey);
    expect(testsState(view)?.state).toBe(state);
    expect(view.result.candidateVerified).toBe(false);
    expect(view.run.closed_outcome).not.toBe("verified_candidate");
    const refused = await journey.apply({ run_id, action: "apply", candidate_id: String(view.candidate.candidate_id), result_ref: view.result.result_id + "@" + view.result.result_version, command_id: cmd(), actor: "owner" });
    expect(refused.ok).toBe(false);
  });

  it("fails a candidate that omits a test its approved plan names, without running anything", async () => {
    writePolicy(ROOT, withTests());
    const h = makeHarness(ROOT, undefined, ["src/amount.ts", TEST_FILE]);
    const calls = scriptChecker(h, () => pass());
    const { view } = await checkedRun(journeyWith(h));
    expect(testsState(view)).toMatchObject({ state: "failed" });
    expect(String(testsState(view).reason)).toMatch(/candidate-tests-missing/u);
    expect(view.result.candidateVerified).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("is satisfied without running when the candidate adds, changes and plans no test", async () => {
    writePolicy(ROOT, withTests());
    const h = makeHarness(ROOT);
    const calls = scriptChecker(h, () => pass());
    const { view } = await checkedRun(journeyWith(h));
    expect(testsState(view)).toMatchObject({ state: "satisfied", reason: expect.stringMatching(/^no-candidate-tests/u) });
    expect(view.run.closed_outcome).toBe("verified_candidate");
    expect(calls).toHaveLength(0);
  });

  it("will not let a candidate grade itself by rewriting the checker's configuration", async () => {
    writePolicy(ROOT, withTests({ inputs: ["vitest.config.ts"] }));
    const h = makeHarness(ROOT, buildWithTest((dir) => writeFileSync(join(dir, "vitest.config.ts"), "export default { passWithNoTests: true };\n", "utf8")));
    const calls = scriptChecker(h, () => pass());
    const { view } = await checkedRun(journeyWith(h));
    expect(testsState(view)?.state).toBe("inconclusive");
    expect(view.result.candidateVerified).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("records the verdict but blocks nothing under advisory enforcement", async () => {
    writePolicy(ROOT, withTests({ enforcement: "advisory" }));
    const h = makeHarness(ROOT, buildWithTest());
    scriptChecker(h, () => ({ exitCode: 1, stdout: "Test Files  1 failed (1)\n Tests  1 failed (1)", stderr: "", spawnError: null }));
    const { view } = await checkedRun(journeyWith(h));
    expect(testsState(view)).toMatchObject({ state: "failed", required_for: "informational" });
    expect(view.run.closed_outcome).toBe("verified_candidate");
  });
});

describe("Apply refuses candidate tests that are missing or stale", () => {
  it("refuses a result recorded before the policy required candidate tests", async () => {
    writePolicy(ROOT, { publicationScope: { allowedPaths: ["src", "tests"], changeConstraints: {} } });
    const h = makeHarness(ROOT, buildWithTest());
    const first = await checkedRun(journeyWith(h));
    expect(first.view.run.closed_outcome).toBe("verified_candidate");

    writePolicy(ROOT, withTests());
    scriptChecker(h, () => pass());
    const refused = await journeyWith(h).apply({ run_id: first.run_id, action: "apply", candidate_id: first.candidate_id, result_ref: first.result_ref, command_id: cmd(), actor: "owner" });
    expect(refused.ok).toBe(false);
    expect(refused.refusals[0].code).toBe("required-verification-missing-failed-or-stale");
    expect(refused.refusals[0].detail).toMatch(/never been run/u);
  });

  it("refuses when the pinned command changed after the tests were run", async () => {
    writePolicy(ROOT, withTests());
    const h = makeHarness(ROOT, buildWithTest());
    scriptChecker(h, () => pass());
    const first = await checkedRun(journeyWith(h));
    expect(first.view.run.closed_outcome).toBe("verified_candidate");

    writePolicy(ROOT, withTests({ argv: ["node", "/node_modules/vitest/vitest.mjs", "run", "--bail"] }));
    const refused = await journeyWith(h).apply({ run_id: first.run_id, action: "apply", candidate_id: first.candidate_id, result_ref: first.result_ref, command_id: cmd(), actor: "owner" });
    expect(refused.ok).toBe(false);
    expect(refused.refusals[0].detail).toMatch(/different command, checker input or test set/u);
  });
});
