// scripts/delivery-v2/checks.mjs
// PM Delivery V2 — S1.3: trusted import, protected check execution, receipts.
//
// "The checker executes after trusted snapshotting freezes a candidate the writer
//  cannot mutate. It uses an approved observer/configuration outside the writer's
//  authority and a restricted execution environment. A candidate-authored package
//  script cannot become the trusted evaluator simply by emitting a familiar
//  success line."
//   — "PM Delivery — Evidence & Autonomy.md" §4
//
// Four things the candidate must not be able to do, and where each is stopped
// ---------------------------------------------------------------------------
//   mint a trusted receipt      → `verifyReceipt` binds every receipt to the
//                                 pinned plan's digest, which is computed from
//                                 inputs taken *before* the candidate existed.
//                                 A fabricated object has no matching digest.
//   redefine check selection    → the CheckPlan is pinned outside the writer and
//                                 is immutable; `runCheck` refuses a criterion
//                                 that is not in it, and refuses a spec the plan
//                                 did not name.
//   silently weaken its oracle  → the plan fingerprints its checker inputs from
//                                 the base tree. If the candidate changed any of
//                                 them, `detectOracleDrift` reports it and the
//                                 affected evidence is invalidated pending
//                                 independent scrutiny.
//   publish or release output   → nothing here applies anything, and
//                                 `assertRestrictedEnvironment` refuses to run a
//                                 check in an environment carrying publication
//                                 credentials.
//
// The one thing this module deliberately cannot do is decide acceptance. It
// produces observations; criteria.mjs decides what they establish; results.mjs
// decides what that means for the work. Collapsing those three into one function
// is how a checker ends up able to certify itself.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { ContractError, contentId, deepFreeze, normalizePath } from "./contracts.mjs";
import { commandObservation, interactionObservation, makeObservation } from "./criteria.mjs";
import { candidateFreshness, freezeCandidate } from "./candidate.mjs";
import { classifyRelativePath, walkTrusted } from "./scratch.mjs";

/** Who produced a receipt. A receipt claiming any other producer is not trusted. */
export const CHECKER_ID = "delivery-v2/protected-checker";

/** Why a check or receipt was refused. */
export const CHECK_REFUSALS = Object.freeze({
  NOT_IN_PLAN: "criterion-not-in-pinned-plan",
  SPEC_NOT_IN_PLAN: "observer-spec-not-in-pinned-plan",
  ORACLE_DRIFT: "checker-input-changed-in-candidate",
  UNTRUSTED_RECEIPT: "receipt-not-produced-by-the-protected-checker",
  PLAN_MISMATCH: "receipt-bound-to-a-different-plan",
  CANDIDATE_MUTATED: "candidate-changed-during-checking",
  PUBLICATION_CREDENTIALS: "check-environment-carries-publication-credentials",
  FILE_PRESENCE: "file-presence-is-not-an-observation-of-behaviour",
  NO_EXECUTION: "observer-produced-no-execution",
});

/**
 * Environment variable names whose presence means this process could publish.
 *
 * Checked by name because that is what a process actually inherits. The list is
 * this repo's own publication and production surfaces plus the provider
 * credentials a candidate's package script would love to read.
 */
export const PUBLICATION_CREDENTIAL_KEYS = Object.freeze([
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "VERCEL_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "NPM_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
]);

const sha256 = (buffer) => "sha256:" + createHash("sha256").update(buffer).digest("hex");
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

// ---------------------------------------------------------------------------
// Trusted import
// ---------------------------------------------------------------------------

/**
 * Copy the writer's output into an immutable candidate generation and freeze it
 * there.
 *
 * Architecture §8: "At handoff stop/quiesce the writer, copy output through the
 * trusted loader into an immutable candidate generation and verify hashes. Do not
 * validate a tree the engineer can keep changing."
 *
 * The copy is the point. Freezing the writer's own directory would produce a
 * manifest that is true for as long as it takes to compute and no longer, and
 * every check after that would be racing an editor. `generation` is part of the
 * destination path, so C1 and a later C2 exist side by side and C1's evidence
 * keeps referring to something real.
 *
 * The `exportResult` from the adapter contributes *references only*: its material
 * root and whatever the worker claimed. Nothing it says about identity is read —
 * `freezeCandidate` hashes the bytes that arrived.
 *
 * @param {{sourceRoot:string, generationsRoot:string, generation?:string,
 *   kind?:string, job_id?:(string|null), base_manifest?:object[],
 *   environment?:Record<string, string>, workerClaims?:Record<string, unknown>,
 *   frozen_at?:(string|null)}} input
 */
export function importTrustedCandidate({
  sourceRoot,
  generationsRoot,
  generation = "C1",
  kind = "code",
  job_id = null,
  base_manifest = [],
  environment = {},
  workerClaims = {},
  frozen_at = null,
}) {
  if (!isNonEmptyString(sourceRoot) || !isNonEmptyString(generationsRoot)) {
    throw new ContractError("importTrustedCandidate requires a source root and a generations root");
  }
  const destination = join(generationsRoot, generation);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });

  // Walk the writer's tree through the trusted loader first, so links, excluded
  // paths and collisions are refused before anything is copied rather than being
  // copied and then explained.
  const survey = walkTrusted({ root: sourceRoot });
  for (const entry of survey.entries) {
    const classified = classifyRelativePath(entry.path);
    if (!classified.ok) continue;
    cpSync(join(sourceRoot, entry.path), join(destination, entry.path), { recursive: false, force: true, dereference: false });
  }

  const candidate = freezeCandidate({
    root: destination,
    kind,
    generation,
    job_id,
    base_manifest,
    environment,
    workerClaims,
    frozen_at,
  });
  return deepFreeze({ candidate, importRefusals: survey.refusals, source: normalizePath(sourceRoot) });
}

// ---------------------------------------------------------------------------
// The pinned check plan
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ObserverSpec
 * @property {string} spec_id
 * @property {string} kind "command" | "interaction"
 * @property {readonly string[]} argv for a command observer
 * @property {string} cwd
 * @property {(string|null)} procedure for an interaction observer
 * @property {Record<string, unknown>} expected
 */

/**
 * Pin the observers, their configuration and their inputs, outside the writer.
 *
 * `checkerInputs` are fingerprinted from the **base** tree — the state before the
 * candidate existed. That is what makes oracle drift detectable: if the candidate
 * rewrote a test, a config or a lockfile that a check depends on, the pinned
 * fingerprint no longer matches and `detectOracleDrift` says which file.
 *
 * The plan is content-addressed, and its digest is what every receipt is bound
 * to. A candidate cannot produce a receipt that verifies against it, because it
 * would have to know a digest computed over inputs it never saw and cannot
 * change.
 *
 * @param {{criteria:import("./contracts.mjs").Criterion[],
 *   specs:Record<string, {spec_id?:string, kind:string, argv?:string[], cwd?:string,
 *     procedure?:(string|null), expected?:Record<string, unknown>}>,
 *   checkerInputs?:{path:string, sha256:string}[],
 *   toolchain?:Record<string, string>, environmentDescription?:string}} input
 */
export function pinCheckPlan({ criteria, specs, checkerInputs = [], toolchain = {}, environmentDescription = "restricted" }) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new ContractError("a check plan with no criteria observes nothing; name the criteria");
  }
  const bySpec = {};
  for (const [id, spec] of Object.entries(specs || {})) {
    if (!spec || !isNonEmptyString(spec.kind)) throw new ContractError("observer spec " + id + " needs a kind");
    bySpec[id] = deepFreeze({
      spec_id: id,
      kind: spec.kind,
      argv: Object.freeze([...(spec.argv || [])]),
      cwd: spec.cwd || ".",
      procedure: spec.procedure || null,
      expected: { ...(spec.expected || {}) },
    });
  }

  const assignments = {};
  for (const criterion of criteria) {
    const spec_id = criterion.observer.expected && criterion.observer.expected.spec_id;
    if (spec_id && !bySpec[spec_id]) {
      throw new ContractError("criterion " + criterion.criterion_id + " names an observer spec the plan does not pin");
    }
    assignments[criterion.criterion_id] = {
      revision: criterion.revision,
      kind: criterion.observer.kind,
      spec_id: spec_id || null,
    };
  }

  const inputs = [...checkerInputs]
    .map((entry) => ({ path: normalizePath(entry.path), sha256: entry.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const semantic = { v: 1, assignments, specs: bySpec, checkerInputs: inputs, toolchain };
  return deepFreeze({
    plan_id: contentId("plan", semantic),
    plan_digest: sha256(Buffer.from(JSON.stringify(semantic), "utf8")),
    assignments: deepFreeze(assignments),
    specs: deepFreeze(bySpec),
    checkerInputs: Object.freeze(inputs.map((entry) => Object.freeze(entry))),
    toolchain: { ...toolchain },
    environmentDescription,
  });
}

/**
 * Did the candidate change anything the checks depend on?
 *
 * Reported rather than silently tolerated *or* silently fatal. Evidence §4: "New
 * tests remain part of the candidate; independently scrutinize changes that
 * remove assertions, alter test selection, weaken policy or redefine expected
 * behavior." A candidate that legitimately adds a test will trip this, and the
 * right response is a look, not an automatic rejection — so this returns the list
 * and `runCheck` refuses only for the inputs a *particular* check depends on.
 *
 * @param {{plan:ReturnType<typeof pinCheckPlan>, candidate:import("./candidate.mjs").Candidate}} input
 */
export function detectOracleDrift({ plan, candidate }) {
  const byPath = new Map(candidate.manifest.map((entry) => [entry.path, entry.sha256]));
  const drifted = [];
  for (const input of plan.checkerInputs) {
    const observed = byPath.get(input.path);
    if (observed === undefined) {
      drifted.push({ path: input.path, kind: "removed", pinned: input.sha256, observed: null });
    } else if (observed !== input.sha256) {
      drifted.push({ path: input.path, kind: "changed", pinned: input.sha256, observed });
    }
  }
  return deepFreeze({
    clean: drifted.length === 0,
    drifted: Object.freeze(drifted.map((entry) => Object.freeze(entry))),
    requiresIndependentScrutiny: drifted.length > 0,
  });
}

/**
 * Refuse to run a check in an environment that could publish.
 *
 * §4: "Use a clean controlled check environment without publication
 * credentials." A check that runs candidate code with a service-role key in the
 * environment is one `process.env` read away from being an application step.
 *
 * @param {Record<string, string|undefined>} env
 */
export function assertRestrictedEnvironment(env) {
  const present = PUBLICATION_CREDENTIAL_KEYS.filter((key) => isNonEmptyString(env[key]));
  if (present.length) {
    throw new ContractError(CHECK_REFUSALS.PUBLICATION_CREDENTIALS + ": " + present.join(", "));
  }
  return true;
}

/**
 * Build the safe environment a check actually runs in.
 *
 * An allowlist, not a denylist. A denylist over `process.env` protects against
 * the variables somebody remembered; an allowlist protects against the ones they
 * did not.
 */
/**
 * @param {Record<string, (string|undefined)>} [base]
 * @returns {Record<string, string>}
 */
export function restrictedEnv(base = process.env) {
  const allowed = ["PATH", "Path", "SystemRoot", "windir", "TEMP", "TMP", "HOME", "USERPROFILE", "LANG", "NODE_ENV"];
  const env = {};
  for (const key of allowed) if (base[key] != null) env[key] = String(base[key]);
  env.CI = "1";
  return env;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Default executor: an actual process, in the frozen generation, under the
 * restricted environment.
 *
 * Injected everywhere so fixtures can script exit codes and counts without
 * spawning anything; the real one exists so the receipt can carry a genuine argv,
 * cwd and exit status rather than a description of one.
 */
export function spawnExecutor({ argv, cwd, env, timeoutMs = 600_000 }) {
  const [command, ...args] = argv;
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: timeoutMs });
  return {
    exitCode: result.status,
    signal: result.signal ?? null,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    spawnError: result.error ? String(result.error.code || result.error.message) : null,
  };
}

/**
 * Read selected/executed/skipped counts out of a runner's output.
 *
 * Deliberately conservative: when the counts cannot be read, they come back null,
 * and criteria.mjs turns a receipt with null counts into `inconclusive` — not
 * into a pass. Diagnosis D05 is the reason this is not "assume it ran": exit code
 * zero over zero selected tests is the exact shape of a green run that proved
 * nothing.
 */
export function parseTestCounts(output) {
  const text = String(output || "");
  // vitest: "Tests  190 passed (190)" / "Tests  no tests"
  const vitest = text.match(/Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?\s*\((\d+)\)/u);
  if (vitest) {
    const failed = Number(vitest[1] || 0);
    const passed = Number(vitest[2] || 0);
    const skipped = Number(vitest[3] || 0);
    const total = Number(vitest[4] || 0);
    return { selected: total, executed: failed + passed, skipped, failed };
  }
  if (/No test files found|no tests/iu.test(text)) return { selected: 0, executed: 0, skipped: 0, failed: 0 };
  return { selected: null, executed: null, skipped: null, failed: null };
}

/**
 * @typedef {object} CheckReceipt
 * @property {string} receipt_id
 * @property {string} produced_by always CHECKER_ID
 * @property {string} plan_id
 * @property {string} plan_digest binds this receipt to inputs the writer never saw
 * @property {string} candidate_id
 * @property {string} criterion_id
 * @property {number} criterion_revision
 */

/**
 * Run one pinned check against one frozen candidate and produce its receipt.
 *
 * The order of refusals is the argument:
 *
 *   1. the criterion must be in the pinned plan — a candidate cannot add one;
 *   2. the observer spec must be in the pinned plan — it cannot swap the command;
 *   3. the checker inputs this criterion depends on must be unchanged — it cannot
 *      weaken the oracle;
 *   4. the candidate must not have moved since it was frozen — it cannot edit
 *      under the check;
 *   5. only then does anything execute.
 *
 * `freshnessInputs` in the returned observation are the identities the evidence
 * is valid *for*. criteria.mjs compares them against the current ones later, and
 * that comparison is what turns a mutated candidate into `stale` rather than into
 * a pass nobody re-examined.
 *
 * @param {{plan:ReturnType<typeof pinCheckPlan>, candidate:import("./candidate.mjs").Candidate,
 *   criterion:import("./contracts.mjs").Criterion, execute?:Function,
 *   env?:Record<string, (string|undefined)>, now?:Function, interaction?:Function,
 *   dependsOnInputs?:(string[]|null)}} input
 * @returns {{receipt:(CheckReceipt|null), observation:(import("./criteria.mjs").Observation|null),
 *   refused:(string|null), detail:(string|null),
 *   drift?:ReturnType<typeof detectOracleDrift>,
 *   freshness?:ReturnType<import("./candidate.mjs").candidateFreshness>}}
 */
export function runCheck({
  plan,
  candidate,
  criterion,
  execute = spawnExecutor,
  env = restrictedEnv(),
  now = () => new Date().toISOString(),
  interaction = null,
  dependsOnInputs = null,
}) {
  const assignment = plan.assignments[criterion.criterion_id];
  if (!assignment || assignment.revision !== criterion.revision) {
    throw new ContractError(CHECK_REFUSALS.NOT_IN_PLAN + ": " + criterion.criterion_id);
  }
  assertRestrictedEnvironment(env);

  const drift = detectOracleDrift({ plan, candidate });
  const relevant = dependsOnInputs
    ? drift.drifted.filter((entry) => dependsOnInputs.includes(entry.path))
    : drift.drifted;
  if (relevant.length) {
    return deepFreeze({
      receipt: null,
      observation: null,
      refused: CHECK_REFUSALS.ORACLE_DRIFT,
      detail: relevant.map((entry) => entry.kind + " " + entry.path).join(", "),
      drift,
    });
  }

  const freshness = candidateFreshness(candidate);
  if (!freshness.fresh) {
    return deepFreeze({
      receipt: null,
      observation: null,
      refused: CHECK_REFUSALS.CANDIDATE_MUTATED,
      detail: [...freshness.changed, ...freshness.added, ...freshness.removed].join(", "),
      freshness,
    });
  }

  const spec = assignment.spec_id ? plan.specs[assignment.spec_id] : null;
  if (!spec) {
    throw new ContractError(CHECK_REFUSALS.SPEC_NOT_IN_PLAN + ": " + criterion.criterion_id);
  }

  const inputs = {
    candidate: candidate.candidate_id,
    "test-config": plan.plan_digest,
    fixture: plan.plan_digest,
    toolchain: JSON.stringify(plan.toolchain),
    ...candidate.environment,
  };

  const started_at = now();
  let observation;
  let raw;

  if (spec.kind === "interaction") {
    if (typeof interaction !== "function") {
      throw new ContractError("an interaction check needs an interaction runner");
    }
    raw = interaction({ spec, candidate });
    observation = interactionObservation({
      procedure: spec.procedure || spec.spec_id,
      observed: raw.observed || {},
      inputs,
      attribution: CHECKER_ID,
      raw_refs: [],
    });
  } else {
    raw = execute({ argv: [...spec.argv], cwd: candidate.root, env });
    const counts = parseTestCounts(String(raw.stdout || "") + "\n" + String(raw.stderr || ""));
    // A spawn that never produced a process is not a failing check; it is no
    // check at all, and the receipt has to say so.
    if (raw.spawnError) {
      observation = makeObservation({
        kind: "command",
        outcome: "interrupted",
        inputs,
        attribution: CHECKER_ID,
        detail: { argv: [...spec.argv], cwd: candidate.root, exitCode: null, selected: null, executed: null },
      });
    } else {
      observation = commandObservation({
        argv: [...spec.argv],
        cwd: candidate.root,
        exitCode: raw.exitCode,
        selected: raw.selected ?? counts.selected,
        executed: raw.executed ?? counts.executed,
        skipped: raw.skipped ?? counts.skipped,
        inputs,
        attribution: CHECKER_ID,
        raw_refs: [],
      });
    }
  }

  const finished_at = now();
  const outputHash = sha256(Buffer.from(String(raw.stdout || "") + String(raw.stderr || ""), "utf8"));

  const body = {
    plan_id: plan.plan_id,
    plan_digest: plan.plan_digest,
    candidate_id: candidate.candidate_id,
    criterion_id: criterion.criterion_id,
    criterion_revision: criterion.revision,
    spec_id: spec.spec_id,
    argv: spec.kind === "interaction" ? null : [...spec.argv],
    procedure: spec.kind === "interaction" ? spec.procedure : null,
    cwd: candidate.root,
    environmentDescription: plan.environmentDescription,
    started_at,
    finished_at,
    exitCode: raw.exitCode ?? null,
    signal: raw.signal ?? null,
    counts: {
      selected: observation.detail.selected ?? null,
      executed: observation.detail.executed ?? null,
      skipped: observation.detail.skipped ?? null,
    },
    outputHash,
    redaction: "stdout and stderr are hashed, not stored, and no environment values are recorded",
    oracle_ref: criterion.oracle_ref,
    freshnessInputs: inputs,
  };

  return deepFreeze({
    receipt: deepFreeze({ receipt_id: contentId("ev", body), produced_by: CHECKER_ID, ...body }),
    observation,
    refused: null,
    detail: null,
    drift,
  });
}

/**
 * Is this receipt one the protected checker actually produced for this plan?
 *
 * Two conditions, and the second is the one a candidate cannot satisfy: the
 * receipt must be bound to the pinned plan's digest, which is derived from
 * checker inputs fingerprinted before the candidate existed and pinned outside
 * its authority.
 *
 * @param {(Record<string, unknown>|null)} receipt
 * @param {ReturnType<typeof pinCheckPlan>} plan
 */
export function verifyReceipt(receipt, plan) {
  if (!receipt || receipt.produced_by !== CHECKER_ID) {
    return deepFreeze({ trusted: false, reason: CHECK_REFUSALS.UNTRUSTED_RECEIPT });
  }
  if (receipt.plan_digest !== plan.plan_digest || receipt.plan_id !== plan.plan_id) {
    return deepFreeze({ trusted: false, reason: CHECK_REFUSALS.PLAN_MISMATCH });
  }
  return deepFreeze({ trusted: true, reason: null });
}

/**
 * Take a log the writer supplied and keep it as what it is.
 *
 * §4: "The native engineer can suggest checks and supply logs, but supplied logs
 * remain attributed inputs until verified." So this produces an observation whose
 * attribution is the writer and whose kind is `source_match` — the weakest kind,
 * ineligible for any behavioural criterion — rather than a `command` observation
 * that would look identical to one the checker produced.
 *
 * @param {{path:string, contents?:string, writer?:string}} input
 */
export function attributeSuppliedLog({ path, contents = "", writer = "native-engineer" }) {
  return makeObservation({
    kind: "source_match",
    outcome: "observed",
    inputs: {},
    attribution: writer,
    raw_refs: [],
    detail: {
      path: normalizePath(path),
      matched: true,
      needle: "",
      note: "supplied by the writer; an attributed input, not a check receipt",
      contentsHash: sha256(Buffer.from(String(contents), "utf8")),
    },
  });
}

/**
 * A file exists. That is all this says.
 *
 * Exists as a named constructor so the refusal has a call site: V1's acceptance
 * matrix accepted an arbitrary existing path as evidence, and the failure mode
 * was a criterion satisfied by `docs/proof.md` being present. The observation is
 * `source_match`, so any criterion asking for behaviour rejects it as an
 * ineligible observer, and a contract that names it a forbidden substitute
 * rejects it by name.
 *
 * @param {{path:string, root:string}} input
 */
export function filePresenceObservation({ path, root }) {
  let exists = false;
  try {
    readFileSync(join(root, path));
    exists = true;
  } catch {
    exists = false;
  }
  return makeObservation({
    kind: "source_match",
    outcome: "observed",
    inputs: {},
    attribution: CHECKER_ID,
    detail: {
      path: normalizePath(path),
      matched: exists,
      needle: "",
      note: CHECK_REFUSALS.FILE_PRESENCE,
    },
  });
}

/**
 * A required review that came back unusable.
 *
 * `outcome: "malformed"` is what criteria.mjs turns into `inconclusive`. The
 * distinction from a *failed* review matters: a malformed review has not
 * established that the claim is false, so it leaves an obligation rather than a
 * verdict.
 *
 * @param {{reviewer:string, raw?:string}} input
 */
export function malformedReviewObservation({ reviewer, raw = "" }) {
  return makeObservation({
    kind: "attributed",
    outcome: "malformed",
    inputs: {},
    attribution: reviewer,
    detail: { rawHash: sha256(Buffer.from(String(raw), "utf8")) },
  });
}
