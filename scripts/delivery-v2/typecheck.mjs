// scripts/delivery-v2/typecheck.mjs
// PM Delivery V2 — the deterministic type check that runs outside the model.
//
// Why this exists
// ---------------
// Run r-83dddb67fea9 closed as `verified_candidate` carrying
// `supabaseAdmin.from(...)` where `supabaseAdmin().from(...)` is required — a
// TS2339 that throws at runtime *after* the split fields have been written. The
// worker did try `npm run typecheck`; `tsc` was not installed in its container,
// so the attempt failed for environmental reasons and nothing else in the
// pipeline could catch it (Investigation §5.4, F8).
//
// Two lessons are built into this file, and both are refusals rather than
// features:
//
//   1. **An incomplete checking environment is inconclusive, never a pass.** A
//      tsc that cannot resolve `next` will report hundreds of TS2307s in the
//      baseline as well as the candidate, and subtracting one from the other
//      yields a clean "no new errors" that means nothing. `environmentVerdict`
//      looks for that shape explicitly and refuses to grade the run.
//   2. **The candidate must not be able to configure its own checker.** The
//      program is assembled from the *host* tsconfig and the host's installed
//      typescript; a candidate that touches tsconfig, package.json or
//      node_modules makes the check inconclusive instead of being allowed to
//      weaken it.
//
// What it does not do: run tsc itself (the caller injects an executor, so
// fixtures need no compiler), decide acceptance (criteria.mjs does that), or
// feed anything back to the model. Diagnostics are retained as a bounded,
// sanitized artifact beside the evidence — hashes alone would leave the owner
// with "something failed" and nothing to act on.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ContractError, contentId, deepFreeze, normalizePath } from "./contracts.mjs";
import { candidateChangedPaths } from "./candidate.mjs";

/** The criterion id this verification reports under. Required for candidate. */
export const TYPECHECK_CRITERION_ID = "delivery-typecheck";

/** How a typecheck ended. `inconclusive` is a first-class outcome here. */
export const TYPECHECK_STATE = Object.freeze({
  SATISFIED: "satisfied",
  FAILED: "failed",
  INCONCLUSIVE: "inconclusive",
});

/** Why a typecheck could not grade the candidate. */
export const TYPECHECK_REFUSALS = Object.freeze({
  ENVIRONMENT: "typecheck-environment-incomplete",
  CANDIDATE_CONFIGURES_CHECKER: "candidate-changes-the-checker-configuration",
  NO_RUNNER: "no-typecheck-runner-available",
  UNREADABLE: "typecheck-output-could-not-be-parsed",
  STAGING: "typecheck-program-could-not-be-staged",
});

/**
 * Files whose change would let the candidate decide how it is checked.
 *
 * `tsconfig` picks the compiler options and can load a plugin; `package.json`
 * picks the typescript version and the script; anything under `node_modules` is
 * the compiler itself. A candidate touching one of these is not refused — the
 * check simply cannot claim to be independent of it, so it reports inconclusive
 * and says which file.
 */
export const CHECKER_CONFIGURATION_PATHS = Object.freeze([/^tsconfig.*\.json$/u, /^package\.json$/u, /^package-lock\.json$|^pnpm-lock\.yaml$/u, /^node_modules\//u]);

/**
 * Diagnostic codes that describe a broken *environment* rather than broken code.
 *
 * Their presence in the BASELINE is the signal: a baseline that cannot find its
 * modules or its config is not a baseline, it is a misconfigured compiler, and
 * the difference between two such runs is meaningless.
 */
export const ENVIRONMENT_DIAGNOSTIC_CODES = Object.freeze([
  "TS2307", // Cannot find module 'x' or its corresponding type declarations
  "TS2688", // Cannot find type definition file for 'x'
  "TS5012", // Cannot read file
  "TS5083", // Cannot read file 'tsconfig.json'
  "TS6053", // File 'x' not found
  "TS6059", // File is not under 'rootDir'
  "TS18003", // No inputs were found in config file
]);

/** Hard ceiling on what is retained, so a broken run cannot fill the disk. */
export const ARTIFACT_LIMITS = Object.freeze({ diagnostics: 200, messageChars: 400, outputChars: 20_000 });

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const DIAGNOSTIC = /^(?:(?<file>[^(\n]+?)\((?<line>\d+),(?<column>\d+)\):\s*)?error (?<code>TS\d+):\s*(?<message>.*)$/u;

/**
 * Read tsc's human-readable output into structured diagnostics.
 *
 * `--pretty false` is what the caller must pass; this parser deliberately also
 * strips ANSI, because a coloured run that silently parsed to zero diagnostics
 * would look exactly like a clean one.
 */
export function parseTypescriptDiagnostics(output) {
  const text = String(output || "").replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");
  const diagnostics = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const match = DIAGNOSTIC.exec(rawLine.trim());
    if (!match || !match.groups) continue;
    diagnostics.push({
      file: match.groups.file ? normalizePath(match.groups.file) : null,
      line: match.groups.line ? Number(match.groups.line) : null,
      column: match.groups.column ? Number(match.groups.column) : null,
      code: match.groups.code,
      message: match.groups.message.trim(),
    });
  }
  return diagnostics;
}

/**
 * The identity used to match a candidate diagnostic against a baseline one.
 *
 * Line and column are deliberately excluded: an edit above a pre-existing error
 * shifts it, and treating the shifted copy as "new" would fail every candidate
 * that touches a file with an existing diagnostic.
 */
export function diagnosticKey(diagnostic) {
  return [diagnostic.file || "<program>", diagnostic.code, diagnostic.message].join("|");
}

/**
 * Split candidate diagnostics into new, pre-existing and resolved.
 *
 * Multiplicity is preserved: two copies of one message in the candidate against
 * one in the baseline leaves one new. A candidate cannot hide a defect behind an
 * identical pre-existing one.
 *
 * @param {{baseline?:Diagnostic[], candidate?:Diagnostic[]}} input
 */
export function classifyDiagnostics({ baseline = [], candidate = [] }) {
  const remaining = new Map();
  for (const entry of baseline) remaining.set(diagnosticKey(entry), (remaining.get(diagnosticKey(entry)) || 0) + 1);

  const introduced = [];
  const preExisting = [];
  for (const entry of candidate) {
    const key = diagnosticKey(entry);
    const left = remaining.get(key) || 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      preExisting.push(entry);
    } else {
      introduced.push(entry);
    }
  }
  const resolved = [];
  for (const [key, count] of remaining) for (let index = 0; index < count; index += 1) resolved.push(key);

  return deepFreeze({
    introduced: Object.freeze(introduced),
    preExisting: Object.freeze(preExisting),
    resolved: Object.freeze(resolved),
  });
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Can this checker's verdict be believed at all?
 *
 * Answering "yes" requires positive evidence, not the absence of a crash:
 * the compiler ran and produced readable output, the program had a config and
 * inputs, and the baseline is free of environment-shaped diagnostics.
 *
 * @param {{baseline:{exitCode:(number|null), stdout?:string, stderr?:string, spawnError?:(string|null)},
 *   diagnostics:Diagnostic[], configPath:(string|null), candidateTouchesConfig?:string[]}} input
 */
export function environmentVerdict({ baseline, diagnostics, configPath, candidateTouchesConfig = [] }) {
  const reasons = [];
  if (!baseline || baseline.spawnError) reasons.push("the type checker did not start: " + String((baseline && baseline.spawnError) || "no result"));
  if (!isNonEmptyString(configPath)) reasons.push("no tsconfig was available to the checker");
  if (candidateTouchesConfig.length) {
    reasons.push("the candidate changes the checker's own configuration (" + candidateTouchesConfig.join(", ") + "), so this check is not independent of it");
  }

  const combined = String((baseline && baseline.stdout) || "") + "\n" + String((baseline && baseline.stderr) || "");
  const environmentDiagnostics = diagnostics.filter((entry) => ENVIRONMENT_DIAGNOSTIC_CODES.includes(entry.code));
  if (environmentDiagnostics.length) {
    const codes = [...new Set(environmentDiagnostics.map((entry) => entry.code))].sort();
    reasons.push(
      "the baseline program itself reports " +
        environmentDiagnostics.length +
        " environment diagnostic(s) (" +
        codes.join(", ") +
        "); a program that cannot resolve its own inputs cannot grade a candidate, and subtracting these away would manufacture a pass",
    );
  }
  // A non-zero exit with nothing parseable is a compiler that failed to run, not
  // a candidate that failed to compile.
  if (baseline && baseline.exitCode !== 0 && !diagnostics.length) {
    reasons.push("the baseline run exited " + String(baseline.exitCode) + " without emitting a readable diagnostic: " + clip(combined, 200));
  }

  return deepFreeze({ complete: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/** Which of the candidate's changed paths would configure the checker. */
export function checkerConfigurationChanges(candidate) {
  const changed = candidateChangedPaths(candidate).map((change) => normalizePath(change.path));
  return changed.filter((path) => CHECKER_CONFIGURATION_PATHS.some((pattern) => pattern.test(path)));
}

// ---------------------------------------------------------------------------
// The program under test
// ---------------------------------------------------------------------------

/**
 * What the checker compiles: the host checkout, with the candidate's bytes
 * standing in for the files it changes.
 *
 * The checkout is the integration target, so this answers the question that
 * matters before Apply - "would this compile where it is actually going" -
 * rather than "does the 29-file snapshot compile", which it cannot, since a
 * curated snapshot is not a program.
 *
 * Nothing is copied and nothing is written. An earlier version staged a copy of
 * the source tree per check; on this machine that copy alone ran for over twelve
 * minutes of pure I/O on ~2,100 files. `typecheck-runner.mjs` overlays the
 * candidate inside a TypeScript CompilerHost instead, so the checkout is read
 * and never touched - the same rule Apply operates under.
 *
 * @param {{candidate:Record<string, any>}} input
 */
export function candidateOverlay({ candidate }) {
  const changes = candidateChangedPaths(candidate);
  return {
    changed: changes.filter((change) => change.kind !== "delete").map((change) => normalizePath(change.path)).sort(),
    deleted: changes.filter((change) => change.kind === "delete").map((change) => normalizePath(change.path)).sort(),
  };
}

/**
 * The default executor: one `typecheck-runner.mjs` process per phase.
 *
 * Injected everywhere, so a fixture scripts two outputs and needs no compiler.
 * The real one exists so a verdict rests on a process that actually ran.
 *
 * @param {{argv:string[], cwd:string, env?:object, phase:string, hostRoot:string,
 *   candidateRoot?:(string|null), changed?:string[], deleted?:string[], timeoutMs?:number}} input
 */
export function spawnTypecheck({ argv, cwd, env = {}, phase, hostRoot, candidateRoot = null, changed = [], deleted = [], timeoutMs = 900_000 }) {
  const args = [...argv.slice(1), "--root", hostRoot];
  if (phase === "candidate" && candidateRoot) {
    args.push("--candidate", candidateRoot);
    if (changed.length) args.push("--changed", changed.join(","));
    if (deleted.length) args.push("--deleted", deleted.join(","));
  }
  const result = spawnSync(argv[0], args, { cwd, env, encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return {
    exitCode: result.status,
    signal: result.signal ?? null,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    spawnError: result.error ? String(result.error.code || result.error.message) : null,
  };
}

// ---------------------------------------------------------------------------
// The verification
// ---------------------------------------------------------------------------

/**
 * Run the baseline and candidate type checks and grade the difference.
 *
 * The caller supplies `execute({argv, cwd, env, phase, hostRoot, candidateRoot,
 * changed, deleted})` returning `{exitCode, stdout, stderr, spawnError}` — the
 * same result shape `checks.mjs` uses, so a fixture scripts two outputs and no
 * compiler is needed to test the logic.
 *
 * Order matters: the baseline compiles the checkout untouched, then the same
 * program compiles again with the candidate's bytes overlaid. Two runs over one
 * checkout, differing only by the candidate — and if the first is not a sound
 * baseline, the second is never graded.
 *
 * @param {{hostRoot:string, candidate:Record<string, any>, argv:string[],
 *   execute?:Function, env?:object, now?:Function}} input
 */
export function runTypecheckVerification({
  hostRoot,
  candidate,
  argv,
  execute = spawnTypecheck,
  env = {},
  now = () => new Date().toISOString(),
}) {
  if (typeof execute !== "function") {
    return verdict({ state: TYPECHECK_STATE.INCONCLUSIVE, reason: TYPECHECK_REFUSALS.NO_RUNNER, detail: "no executor was provided", now });
  }
  if (!isNonEmptyString(hostRoot)) throw new ContractError("runTypecheckVerification: a host root is required");

  const configChanges = checkerConfigurationChanges(candidate);
  const overlay = candidateOverlay({ candidate });
  const run = (phase) =>
    execute({
      argv: [...argv],
      cwd: hostRoot,
      env,
      phase,
      hostRoot,
      candidateRoot: candidate ? candidate.root : null,
      changed: overlay.changed,
      deleted: overlay.deleted,
    });

  const started_at = now();
  const baselineRun = run("baseline");
  const baselineDiagnostics = parseTypescriptDiagnostics(String(baselineRun.stdout || "") + "\n" + String(baselineRun.stderr || ""));
  const environment = environmentVerdict({
    baseline: baselineRun,
    diagnostics: baselineDiagnostics,
    configPath: existsSync(join(hostRoot, "tsconfig.json")) ? "tsconfig.json" : null,
    candidateTouchesConfig: configChanges,
  });

  if (!environment.complete) {
    return verdict({
      state: TYPECHECK_STATE.INCONCLUSIVE,
      reason: configChanges.length ? TYPECHECK_REFUSALS.CANDIDATE_CONFIGURES_CHECKER : TYPECHECK_REFUSALS.ENVIRONMENT,
      detail: environment.reasons.join("; "),
      now,
      started_at,
      candidate,
      environment,
      baselineDiagnostics,
      overlay,
    });
  }

  const candidateRun = run("candidate");
  if (candidateRun.spawnError) {
    return verdict({
      state: TYPECHECK_STATE.INCONCLUSIVE,
      reason: TYPECHECK_REFUSALS.NO_RUNNER,
      detail: String(candidateRun.spawnError),
      now,
      started_at,
      candidate,
      environment,
      baselineDiagnostics,
      overlay,
    });
  }
  const candidateDiagnostics = parseTypescriptDiagnostics(String(candidateRun.stdout || "") + "\n" + String(candidateRun.stderr || ""));
  if (candidateRun.exitCode !== 0 && !candidateDiagnostics.length) {
    return verdict({
      state: TYPECHECK_STATE.INCONCLUSIVE,
      reason: TYPECHECK_REFUSALS.UNREADABLE,
      detail: "exit " + String(candidateRun.exitCode) + " with no readable diagnostic: " + clip(String(candidateRun.stderr || candidateRun.stdout || ""), 200),
      now,
      started_at,
      candidate,
      environment,
      baselineDiagnostics,
      overlay,
    });
  }

  const split = classifyDiagnostics({ baseline: baselineDiagnostics, candidate: candidateDiagnostics });
  // A new environment diagnostic in the candidate run is still an environment
  // failure, not a candidate defect: five changed files cannot break module
  // resolution for a whole program.
  const newEnvironment = split.introduced.filter((entry) => ENVIRONMENT_DIAGNOSTIC_CODES.includes(entry.code));
  if (newEnvironment.length && newEnvironment.length === split.introduced.length) {
    return verdict({
      state: TYPECHECK_STATE.INCONCLUSIVE,
      reason: TYPECHECK_REFUSALS.ENVIRONMENT,
      detail: "only environment diagnostics changed (" + [...new Set(newEnvironment.map((entry) => entry.code))].join(", ") + ")",
      now,
      started_at,
      candidate,
      environment,
      baselineDiagnostics,
      candidateDiagnostics,
      split,
      overlay,
    });
  }

  return verdict({
    state: split.introduced.length ? TYPECHECK_STATE.FAILED : TYPECHECK_STATE.SATISFIED,
    reason: null,
    detail: split.introduced.length ? split.introduced.length + " new diagnostic(s) introduced by the candidate" : null,
    now,
    started_at,
    candidate,
    environment,
    baselineDiagnostics,
    candidateDiagnostics,
    split,
    overlay,
    exitCode: candidateRun.exitCode,
  });
}

function verdict({
  state,
  reason,
  detail,
  now,
  started_at = null,
  candidate = null,
  environment = null,
  baselineDiagnostics = [],
  candidateDiagnostics = [],
  split = null,
  overlay = null,
  exitCode = null,
}) {
  const body = {
    criterion_id: TYPECHECK_CRITERION_ID,
    state,
    reason,
    detail,
    candidate_id: candidate ? String(candidate.candidate_id) : null,
    // The exact inputs this verdict is about. A later candidate, or the same
    // candidate over a moved integration target, does not inherit it.
    checked_inputs: candidate
      ? {
          candidate_id: String(candidate.candidate_id),
          changed: Object.freeze(
            overlay
              ? [...overlay.changed, ...overlay.deleted].map(String).sort()
              : candidateChangedPaths(candidate).map((entry) => String(entry.path)).sort(),
          ),
        }
      : null,
    environment: environment || { complete: false, reasons: ["the environment was never probed"] },
    counts: {
      baseline: baselineDiagnostics.length,
      candidate: candidateDiagnostics.length,
      introduced: split ? split.introduced.length : null,
      preExisting: split ? split.preExisting.length : null,
      resolved: split ? split.resolved.length : null,
    },
    diagnostics: Object.freeze((split ? split.introduced : []).slice(0, ARTIFACT_LIMITS.diagnostics).map(sanitize)),
    truncated: split ? Math.max(0, split.introduced.length - ARTIFACT_LIMITS.diagnostics) : 0,
    exitCode,
    started_at,
    finished_at: now(),
  };
  return deepFreeze({ ...body, verification_id: contentId("tc", body) });
}

/**
 * One diagnostic, bounded and free of anything but code shape.
 *
 * Paths are kept relative and messages clipped; no environment values, no
 * absolute paths, no file contents.
 */
function sanitize(diagnostic) {
  return {
    file: diagnostic.file,
    line: diagnostic.line,
    column: diagnostic.column,
    code: diagnostic.code,
    message: clip(diagnostic.message, ARTIFACT_LIMITS.messageChars),
  };
}

const clip = (text, max) => {
  const value = String(text || "").trim();
  return value.length > max ? value.slice(0, max) + "…" : value;
};

/**
 * Write the retained artifact for one verification.
 *
 * Bounded and sanitized, and deliberately a *file*, not a hash: the owner has to
 * be able to read what failed without re-running anything, and without the model
 * seeing it.
 */
export function writeTypecheckArtifact({ dir, verification }) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, String(verification.verification_id) + ".json");
  writeFileSync(path, JSON.stringify(verification, null, 2), "utf8");
  return path;
}

/**
 * Is a stored verdict still about this candidate and this integration target?
 *
 * Both halves matter. The candidate id covers the writer's bytes; the target
 * fingerprint covers the checkout those bytes will land in, which another Apply
 * or a CLI edit can move underneath a verdict that was true an hour ago.
 */
/** @param {{verification:(Record<string, any>|null), candidate_id:string, changed?:(string[]|null)}} input */
export function verificationIsFresh({ verification, candidate_id, changed = null }) {
  if (!verification || verification.criterion_id !== TYPECHECK_CRITERION_ID) return { fresh: false, reason: "no typecheck verification is recorded" };
  if (String(verification.candidate_id || "") !== String(candidate_id)) {
    return { fresh: false, reason: "the recorded typecheck is for candidate " + String(verification.candidate_id) };
  }
  if (changed) {
    const recorded = (verification.checked_inputs && verification.checked_inputs.changed) || [];
    const wanted = [...changed].map(String).sort();
    if (recorded.length !== wanted.length || recorded.some((path, index) => path !== wanted[index])) {
      return { fresh: false, reason: "the recorded typecheck covered a different set of changed files" };
    }
  }
  return { fresh: true, reason: null };
}
