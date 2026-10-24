// scripts/delivery-v2/candidate-tests.mjs
// Mandatory candidate tests: the tests a candidate adds or changes (or its approved
// plan names) must run against the frozen candidate, in the protected checker,
// before it can be called verified or applied.
//
// Why this exists
// ---------------
// R44's candidate passed its protected oracle (36/36) and its typecheck, and was
// called "verified". Its own authored test file had never been executed: the five
// cases timed out the first time anyone ran them, after Apply. The oracle and the
// typecheck answer "does the rule work" and "does it compile"; neither answers
// "do the tests this candidate ships pass". This module is that third question.
//
// What it does not do
// -------------------
// It does not replace the protected oracle or the typecheck, and it never lets the
// candidate choose the command: `argv` is pinned by policy, the only thing the
// candidate contributes is the list of test paths, and each path must be a plain
// repo-relative path matching a policy pattern. The checker's own configuration
// (`checks.inputs`) is compared against the base; a candidate that rewrote it
// cannot grade itself. A test that is missing, skipped, failing, unreadable or
// that never ran is not a pass.
//
// Pure: no fs, no clock, no processes. journey.mjs supplies the executor.

import { canonicalJson, contentId, deepFreeze, fingerprint } from "./contracts.mjs";
import { candidateChangedPaths } from "./candidate.mjs";

export const CANDIDATE_TESTS_CRITERION_ID = "delivery-candidate-tests";

export const CANDIDATE_TESTS_STATE = Object.freeze({
  SATISFIED: "satisfied",
  FAILED: "failed",
  INCONCLUSIVE: "inconclusive",
});

export const CANDIDATE_TESTS_REASONS = Object.freeze({
  NONE_SELECTED: "no-candidate-tests",
  MISSING: "candidate-tests-missing",
  UNSAFE_PATH: "candidate-test-path-unsafe",
  FAILED: "candidate-tests-failed",
  SKIPPED: "candidate-tests-skipped",
  NO_RUN: "candidate-tests-did-not-run",
  UNREADABLE: "candidate-tests-output-unreadable",
  RUNNER: "candidate-tests-runner-error",
  OVER_SELECTED: "candidate-tests-selected-extra-files",
  CHECKER_INPUT: "checker-input-changed-in-candidate",
  NO_CHECKER: "candidate-tests-no-protected-checker",
});

/** Which paths count as tests when the policy names no patterns. */
export const DEFAULT_TEST_PATTERNS = Object.freeze([
  "tests/**/*.test.ts",
  "tests/**/*.test.tsx",
  "tests/**/*.test.mjs",
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
]);

const SAFE_PATH = /^[A-Za-z0-9_@+][A-Za-z0-9_.@+/-]*$/u;

/** `**` crosses directories, `*` does not. Anchored; no other metacharacters. */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      out += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (ch === "*") out += "[^/]*";
    else out += ch.replace(/[.+^${}()|[\]\\?]/gu, "\\$&");
  }
  return new RegExp("^" + out + "$", "u");
}

export const isTestPath = (path, patterns = DEFAULT_TEST_PATTERNS) => patterns.some((glob) => globToRegExp(glob).test(path));

/**
 * The mandatory set: test files the candidate added or changed, plus test files its
 * approved plan names. Bytes come from `candidate` (the tree that will be run);
 * what counts as changed comes from `scopeCandidate` (the writer's own diff), so an
 * integrated snapshot runs the same set against the integrated bytes.
 *
 * @param {{candidate:object, scopeCandidate?:object, planScope?:string[], patterns?:readonly string[]}} input
 */
export function selectCandidateTests({ candidate, scopeCandidate = candidate, planScope = [], patterns = DEFAULT_TEST_PATTERNS }) {
  const present = new Map(candidate.manifest.map((entry) => [entry.path, entry.sha256]));
  const wanted = new Map();
  for (const change of candidateChangedPaths(scopeCandidate)) {
    if (change.kind !== "delete" && isTestPath(change.path, patterns)) wanted.set(change.path, "changed");
  }
  for (const path of planScope) {
    const clean = String(path).replace(/^\.\//u, "");
    if (isTestPath(clean, patterns) && !wanted.has(clean)) wanted.set(clean, "planned");
  }
  const files = [];
  const missing = [];
  const unsafe = [];
  for (const [path, source] of [...wanted.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!SAFE_PATH.test(path) || path.split("/").some((part) => part === ".." || part === ".")) unsafe.push(path);
    else if (!present.has(path)) missing.push(path);
    else files.push({ path, sha256: present.get(path), source });
  }
  return deepFreeze({ files, missing, unsafe });
}

/**
 * The identity of the check itself. Evidence is valid only for the same pinned
 * command, patterns, checker inputs and test bytes; any difference means "run it
 * again", not "close enough".
 */
export function candidateTestsDefinition({ configured, selection, checkerInputs = [], image = null }) {
  const body = {
    v: 1,
    argv: [...configured.argv],
    include: [...configured.include],
    files: selection.files.map((file) => ({ path: file.path, sha256: file.sha256 })),
    missing: [...selection.missing],
    checkerInputs: [...checkerInputs].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    image,
  };
  return { definition_digest: fingerprint(canonicalJson(body)), argv: body.argv, files: body.files };
}

const strip = (text) => String(text || "").replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");

function summaryLine(text, label) {
  const line = text.match(new RegExp("^\\s*" + label + "\\s+(.+)$", "mu"));
  if (!line) return null;
  const total = line[1].match(/\((\d+)\)\s*$/u);
  const read = (word) => Number(line[1].match(new RegExp("(\\d+)\\s+" + word + "\\b", "u"))?.[1] || 0);
  return {
    total: total ? Number(total[1]) : null,
    passed: read("passed"),
    failed: read("failed"),
    skipped: read("skipped") + read("todo"),
  };
}

/** Vitest's own summary: file and test counts, or null when it printed neither. */
export function parseVitestSummary(output) {
  const text = strip(output);
  const files = summaryLine(text, "Test Files");
  const tests = summaryLine(text, "Tests");
  return files || tests ? { files, tests } : null;
}

/**
 * Turn one checker execution into a verdict.
 *
 * Strict by construction: a pass needs exit 0, a readable summary, exactly the
 * mandatory files collected (no more, no fewer), every test executed, none
 * skipped, none failing.
 *
 * @param {{selection:ReturnType<typeof selectCandidateTests>, raw:(Record<string, any>|null)}} input
 * @returns {{state:string, reason:(string|null), detail:string, counts:object}}
 */
export function gradeCandidateTests({ selection, raw }) {
  const result = (state, reason, detail, counts = {}) => ({ state, reason, detail, counts });
  if (selection.unsafe.length) {
    return result(CANDIDATE_TESTS_STATE.INCONCLUSIVE, CANDIDATE_TESTS_REASONS.UNSAFE_PATH, "test path refused: " + selection.unsafe.join(", "));
  }
  if (selection.missing.length) {
    return result(CANDIDATE_TESTS_STATE.FAILED, CANDIDATE_TESTS_REASONS.MISSING, "planned test files are not in the candidate: " + selection.missing.join(", "));
  }
  if (!selection.files.length) {
    return result(CANDIDATE_TESTS_STATE.SATISFIED, CANDIDATE_TESTS_REASONS.NONE_SELECTED, "the candidate adds, changes and plans no test files");
  }
  if (!raw || raw.spawnError || raw.exitCode === null || raw.exitCode === undefined) {
    return result(CANDIDATE_TESTS_STATE.INCONCLUSIVE, CANDIDATE_TESTS_REASONS.RUNNER, "the checker produced no result" + (raw && raw.spawnError ? " (" + String(raw.spawnError) + ")" : ""));
  }
  const summary = parseVitestSummary(String(raw.stdout || "") + "\n" + String(raw.stderr || ""));
  const counts = { files: summary?.files || null, tests: summary?.tests || null };
  if (!summary || !summary.tests || !summary.files) {
    return raw.exitCode === 0
      ? result(CANDIDATE_TESTS_STATE.INCONCLUSIVE, CANDIDATE_TESTS_REASONS.UNREADABLE, "exit 0 but no test summary was printed", counts)
      : result(CANDIDATE_TESTS_STATE.FAILED, CANDIDATE_TESTS_REASONS.FAILED, "the runner exited " + raw.exitCode + " before reporting tests", counts);
  }
  const tests = summary.tests;
  const files = summary.files;
  if (tests.failed > 0 || (files && files.failed > 0) || raw.exitCode !== 0) {
    return result(CANDIDATE_TESTS_STATE.FAILED, CANDIDATE_TESTS_REASONS.FAILED, tests.failed + " test(s) failed; exit " + raw.exitCode, counts);
  }
  if (tests.skipped > 0 || (files && files.skipped > 0)) {
    return result(CANDIDATE_TESTS_STATE.FAILED, CANDIDATE_TESTS_REASONS.SKIPPED, (tests.skipped || files.skipped) + " mandatory test(s) skipped", counts);
  }
  if (!tests.total || tests.passed !== tests.total) {
    return result(CANDIDATE_TESTS_STATE.INCONCLUSIVE, CANDIDATE_TESTS_REASONS.NO_RUN, "not every selected test executed", counts);
  }
  if (!files.total || files.total !== selection.files.length || files.passed !== files.total) {
    return result(
      CANDIDATE_TESTS_STATE.INCONCLUSIVE,
      files.total > selection.files.length ? CANDIDATE_TESTS_REASONS.OVER_SELECTED : CANDIDATE_TESTS_REASONS.NO_RUN,
      "the runner collected " + files.total + " file(s) for " + selection.files.length + " mandatory",
      counts,
    );
  }
  return result(CANDIDATE_TESTS_STATE.SATISFIED, null, tests.passed + " test(s) in " + selection.files.length + " file(s) passed", counts);
}

/**
 * The verification record stored as evidence. Shaped like the typecheck's so the
 * existing review surface (state, reason, environment, retained output) shows it.
 */
export function buildCandidateTestsVerification({ candidate, definition, selection, grade, producer, output = null, exitCode = null, started_at = null, finished_at = null }) {
  const body = {
    criterion_id: CANDIDATE_TESTS_CRITERION_ID,
    state: grade.state,
    reason: grade.reason,
    detail: grade.detail,
    candidate_id: String(candidate.candidate_id),
    definition_digest: definition.definition_digest,
    argv: definition.argv,
    files: selection.files,
    missing: selection.missing,
    counts: grade.counts,
    environment: producer,
    output,
    exitCode,
    started_at,
    finished_at,
  };
  return deepFreeze({ ...body, verification_id: contentId("ct", body) });
}

/**
 * Is a stored verdict still about this candidate under today's pinned definition?
 * `current` is the definition recomputed from the live policy and candidate.
 */
export function candidateTestsAreFresh({ verification, candidate_id, current }) {
  if (!verification || verification.criterion_id !== CANDIDATE_TESTS_CRITERION_ID) return { fresh: false, reason: "no candidate-test verification is recorded" };
  if (String(verification.candidate_id) !== String(candidate_id)) return { fresh: false, reason: "the recorded candidate tests are for candidate " + String(verification.candidate_id) };
  if (verification.definition_digest !== current.definition_digest) return { fresh: false, reason: "the candidate tests were run under a different command, checker input or test set" };
  return { fresh: true, reason: null };
}
