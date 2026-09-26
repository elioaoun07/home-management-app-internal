// scripts/delivery-v2/criteria.mjs
// PM Delivery V2 — S0.2: specify the proof.
//
// Turns a Criterion (schema in contracts.mjs) plus one attributed observation
// into an evidence record with one of the six states from
// "PM Delivery — Evidence & Autonomy.md" §5. Implements invariants V2-I06/V2-I07
// and the F-EVIDENCE fixture family.
//
// The rule this module exists to enforce
// --------------------------------------
// "Each criterion is satisfied only by eligible, fresh evidence for its
// proposition; missing, malformed, stale or waived evidence is never a pass."
//
// Concretely, against the four V1 counterexamples in Diagnosis:
//   D04  a declared edit that landed *plus* an unrelated edit is not an exact
//        change — surplus content in the same file fails, not just a surplus file
//   D05  exit code 0 over zero selected tests is "missing", never "satisfied"
//   D05  a malformed verdict is "inconclusive", never a quiet pass
//   D04  a filename or a source string is not behaviour
//
// Eligibility is strict kind equality. There is no subsumption ladder in which a
// "stronger" observation silently satisfies a criterion that asked for another
// kind: the criterion names the observer it needs, and anything else is
// ineligible. forbidden_substitutes then names the specific weaker facts the
// contract anticipated, so the refusal reason is precise rather than generic.
//
// Pure: no fs, no processes, no clock. The caller runs the observer and hands the
// receipt in; this module only decides what the receipt establishes.

import { parseUnifiedDiff } from "../delivery/instant.mjs";
import {
  ContractError,
  EVIDENCE_REASONS,
  EVIDENCE_STATES,
  OBSERVATION_KINDS,
  contentId,
  deepFreeze,
  normalizePath,
  normalizeSourceText,
} from "./contracts.mjs";

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Observation
 * @property {string} kind one of OBSERVATION_KINDS
 * @property {string} outcome "observed" | "interrupted" | "malformed" | "contradicted"
 * @property {Record<string, string>} inputs freshness identities this observation was taken under
 * @property {(string|null)} attribution who or what produced it
 * @property {readonly string[]} raw_refs pointers to raw output/artifacts
 * @property {Record<string, unknown>} detail kind-specific payload
 */

/**
 * @param {{kind:string, outcome?:string, inputs?:Record<string, string>,
 *   attribution?:(string|null), raw_refs?:string[], detail?:Record<string, unknown>}} input
 * @returns {Observation}
 */
export function makeObservation({
  kind,
  outcome = "observed",
  inputs = {},
  attribution = null,
  raw_refs = [],
  detail = {},
}) {
  if (!OBSERVATION_KINDS.includes(kind)) {
    throw new ContractError("observation.kind must be one of " + OBSERVATION_KINDS.join("|"));
  }
  return deepFreeze({
    kind,
    outcome,
    inputs: { ...inputs },
    attribution,
    raw_refs: [...raw_refs],
    detail: { ...detail },
  });
}

/**
 * An actual process execution. selected/executed are required and are the reason
 * a green exit code cannot stand in for behaviour: a run that selected nothing
 * proves nothing, whatever it printed.
 *
 * `failure` (DLV-120) names which shape of non-pass this was — a missing runner,
 * unreadable output, zero selection or genuinely failing tests. It is carried
 * beside the counts rather than replacing them: evaluation still reads only
 * exitCode/selected/executed, so this cannot change a verdict, only explain one.
 *
 * @param {{argv:string[], cwd?:string, exitCode:number, selected?:(number|null),
 *   executed?:(number|null), skipped?:(number|null), inputs?:Record<string, string>,
 *   attribution?:string, raw_refs?:string[], failure?:(string|null),
 *   failureDetail?:(string|null)}} input
 */
export function commandObservation({
  argv,
  cwd = ".",
  exitCode,
  selected = null,
  executed = null,
  skipped = 0,
  inputs = {},
  attribution = "delivery-v2/checker",
  raw_refs = [],
  failure = null,
  failureDetail = null,
}) {
  return makeObservation({
    kind: "command",
    inputs,
    attribution,
    raw_refs,
    detail: { argv: [...argv], cwd, exitCode, selected, executed, skipped, failure, failureDetail },
  });
}

/**
 * A mounted/browser action with the values actually observed — the only kind that
 * can establish that a control both displays and does the requested thing.
 *
 * @param {{procedure:string, observed:Record<string, unknown>,
 *   inputs?:Record<string, string>, attribution?:string, raw_refs?:string[]}} input
 */
export function interactionObservation({
  procedure,
  observed,
  inputs = {},
  attribution = "delivery-v2/checker",
  raw_refs = [],
}) {
  return makeObservation({
    kind: "interaction",
    inputs,
    attribution,
    raw_refs,
    detail: { procedure, observed: { ...observed } },
  });
}

/**
 * @param {{path:string, matched:boolean, needle?:string, inputs?:Record<string, string>,
 *   attribution?:string, raw_refs?:string[]}} input
 */
export function sourceMatchObservation({
  path,
  matched,
  needle = "",
  inputs = {},
  attribution = "delivery-v2/checker",
  raw_refs = [],
}) {
  return makeObservation({
    kind: "source_match",
    inputs,
    attribution,
    raw_refs,
    detail: { path: normalizePath(path), matched: Boolean(matched), needle },
  });
}

/**
 * @param {{diffText:string, inputs?:Record<string, string>, attribution?:string,
 *   raw_refs?:string[]}} input
 */
export function diffObservation({ diffText, inputs = {}, attribution = "delivery-v2/snapshot", raw_refs = [] }) {
  return makeObservation({ kind: "diff", inputs, attribution, raw_refs, detail: { diffText } });
}

// ---------------------------------------------------------------------------
// Exact change / scope
// ---------------------------------------------------------------------------

function multisetSubtract(actual, expected) {
  const counts = new Map();
  for (const line of expected) counts.set(line, (counts.get(line) || 0) + 1);
  const surplus = [];
  for (const line of actual) {
    const left = counts.get(line) || 0;
    if (left > 0) counts.set(line, left - 1);
    else surplus.push(line);
  }
  const missing = [];
  for (const [line, left] of counts) for (let i = 0; i < left; i += 1) missing.push(line);
  return { surplus, missing };
}

/**
 * Blank lines are excluded from both sides.
 *
 * A blank line carries no behaviour and hunk edges produce them, so counting them
 * would make exactness a whitespace argument. This is a named limitation, not an
 * oversight: surplus *content* is what this check exists to catch.
 */
function contentLines(lines) {
  return lines.map(normalizeSourceText).filter((line) => line !== "");
}

function withinAllowedPath(path, allowedPaths) {
  return allowedPaths.some((allowed) => {
    const clean = normalizePath(allowed).replace(/\*+$/u, "");
    return path === clean || (clean.endsWith("/") ? path.startsWith(clean) : path.startsWith(clean));
  });
}

/**
 * Is this diff exactly the authorized change, and nothing else?
 *
 * V1's equivalent (scripts/delivery/instant.mjs, verifyInstantEdit) checks that
 * the declared before/after appear and that no *other file* was touched, then
 * allows anything else up to a line ceiling. Diagnosis D04 is what that permits:
 * an approved 25 -> 20 edit plus an unrelated boolean flip in the same file
 * passes. Here every changed content line must be accounted for by a declared
 * change in both directions, so surplus inside the declared file fails too.
 *
 * @param {{diffText:string, declaredChanges:{path:string, before?:string, after:string}[],
 *   allowedPaths?:string[]}} input
 */
export function evaluateExactChange({ diffText, declaredChanges, allowedPaths = [] }) {
  const failures = [];
  const add = (code, detail) => failures.push({ code, detail });
  if (!Array.isArray(declaredChanges) || declaredChanges.length === 0) {
    throw new ContractError("evaluateExactChange requires at least one declared change");
  }
  const declared = declaredChanges.map((change) => ({
    path: normalizePath(change.path),
    before: String(change.before || ""),
    after: String(change.after || ""),
  }));
  const { added, removed, changedLines, files } = parseUnifiedDiff(diffText);
  const touched = files.map(normalizePath);

  if (changedLines === 0 && touched.length === 0) {
    add(EVIDENCE_REASONS.NO_CHANGES, "the candidate diff is empty");
    return deepFreeze({ ok: false, failures, changedLines, files: touched });
  }

  const declaredPaths = new Set(declared.map((change) => change.path));
  const undeclared = touched.filter((path) => !declaredPaths.has(path));
  if (undeclared.length) add(EVIDENCE_REASONS.UNDECLARED_FILE, undeclared.join(", "));

  if (allowedPaths.length) {
    const outside = touched.filter((path) => !withinAllowedPath(path, allowedPaths));
    if (outside.length) add(EVIDENCE_REASONS.SCOPE_VIOLATION, outside.join(", "));
  }

  const expectedAdded = contentLines(declared.flatMap((change) => change.after.split("\n")));
  const expectedRemoved = contentLines(declared.flatMap((change) => change.before.split("\n")));
  const actualAdded = contentLines(added);
  const actualRemoved = contentLines(removed);

  const addedDelta = multisetSubtract(actualAdded, expectedAdded);
  const removedDelta = multisetSubtract(actualRemoved, expectedRemoved);

  if (addedDelta.surplus.length) {
    add(EVIDENCE_REASONS.SURPLUS_CHANGE, "added lines the approved change did not declare: " + addedDelta.surplus.join(" | "));
  }
  if (removedDelta.surplus.length) {
    add(EVIDENCE_REASONS.SURPLUS_CHANGE, "removed lines the approved change did not declare: " + removedDelta.surplus.join(" | "));
  }
  if (addedDelta.missing.length) {
    add(EVIDENCE_REASONS.DECLARED_CHANGE_MISSING, "declared additions absent from the diff: " + addedDelta.missing.join(" | "));
  }
  if (removedDelta.missing.length) {
    add(EVIDENCE_REASONS.DECLARED_CHANGE_MISSING, "declared removals absent from the diff: " + removedDelta.missing.join(" | "));
  }

  return deepFreeze({ ok: failures.length === 0, failures, changedLines, files: touched });
}

// ---------------------------------------------------------------------------
// Criterion evaluation
// ---------------------------------------------------------------------------

function evidenceRecord(criterion, observation, state, reason, detail, context) {
  if (!EVIDENCE_STATES.includes(state)) throw new ContractError("unknown evidence state " + state);
  const body = {
    criterion_id: criterion.criterion_id,
    criterion_revision: criterion.revision,
    candidate_ref: context.candidate_ref ?? null,
    observer: observation ? observation.kind : null,
    oracle_ref: criterion.oracle_ref,
    inputs: observation ? { ...observation.inputs } : {},
    state,
    reason,
  };
  return deepFreeze({
    evidence_id: contentId("e", body),
    ...body,
    required_for: criterion.required_for,
    attribution: observation ? observation.attribution : null,
    raw_refs: observation ? [...observation.raw_refs] : [],
    detail: detail ?? null,
  });
}

function evaluateCommand(criterion, observation) {
  const { exitCode, selected, executed } = observation.detail;
  if (typeof selected !== "number" || typeof executed !== "number") {
    // A run that cannot say how much it selected or executed is not a weaker
    // pass; it is a receipt that establishes nothing.
    return { state: "inconclusive", reason: EVIDENCE_REASONS.MALFORMED, detail: "receipt omits selected/executed counts" };
  }
  if (selected === 0 || executed === 0) {
    return {
      state: "missing",
      reason: EVIDENCE_REASONS.ZERO_EXECUTED,
      detail: "selected=" + selected + " executed=" + executed + " exit=" + exitCode,
    };
  }
  if (exitCode !== 0) {
    return { state: "failed", reason: EVIDENCE_REASONS.NONZERO_EXIT, detail: "exit=" + exitCode };
  }
  return { state: "satisfied", reason: null, detail: "executed=" + executed };
}

function evaluateInteraction(criterion, observation) {
  const expected = criterion.observer.expected || {};
  const observed = observation.detail.observed || {};
  const keys = Object.keys(expected);
  if (keys.length === 0) {
    throw new ContractError("interaction criterion " + criterion.criterion_id + " declares no expected values");
  }
  const missingKeys = keys.filter((key) => !(key in observed));
  if (missingKeys.length) {
    return {
      state: "inconclusive",
      reason: EVIDENCE_REASONS.MALFORMED,
      detail: "observation did not report: " + missingKeys.join(", "),
    };
  }
  const mismatches = keys
    .filter((key) => String(observed[key]) !== String(expected[key]))
    .map((key) => key + ": expected " + String(expected[key]) + ", observed " + String(observed[key]));
  if (mismatches.length) {
    return { state: "failed", reason: EVIDENCE_REASONS.VALUE_MISMATCH, detail: mismatches.join("; ") };
  }
  return { state: "satisfied", reason: null, detail: observation.detail.procedure || null };
}

function evaluateSourceMatch(criterion, observation) {
  const expected = criterion.observer.expected || {};
  if (expected.path && normalizePath(String(expected.path)) !== observation.detail.path) {
    return {
      state: "failed",
      reason: EVIDENCE_REASONS.VALUE_MISMATCH,
      detail: "observed " + observation.detail.path + ", criterion names " + expected.path,
    };
  }
  return observation.detail.matched
    ? { state: "satisfied", reason: null, detail: observation.detail.path }
    : { state: "failed", reason: EVIDENCE_REASONS.VALUE_MISMATCH, detail: "no match in " + observation.detail.path };
}

function evaluateDiff(criterion, observation, context) {
  const expected = criterion.observer.expected || {};
  const declaredChanges = expected.declaredChanges;
  if (!Array.isArray(declaredChanges) || declaredChanges.length === 0) {
    throw new ContractError("diff criterion " + criterion.criterion_id + " declares no declaredChanges");
  }
  const allowedPaths = context.allowedPaths ?? expected.allowedPaths ?? [];
  const verdict = evaluateExactChange({
    diffText: String(observation.detail.diffText || ""),
    declaredChanges,
    allowedPaths: [...allowedPaths],
  });
  if (verdict.ok) return { state: "satisfied", reason: null, detail: verdict.changedLines + " changed line(s)" };
  return {
    state: "failed",
    reason: verdict.failures[0].code,
    detail: verdict.failures.map((failure) => failure.code + ": " + failure.detail).join(" | "),
  };
}

function evaluateAttributed(criterion, observation) {
  if (!isNonEmptyString(observation.attribution)) {
    return { state: "missing", reason: EVIDENCE_REASONS.UNATTRIBUTED, detail: "no observer named" };
  }
  if (observation.outcome === "contradicted") {
    return { state: "failed", reason: EVIDENCE_REASONS.VALUE_MISMATCH, detail: "observer reported the proposition false" };
  }
  return { state: "satisfied", reason: null, detail: observation.attribution };
}

/**
 * Decide what one observation establishes about one criterion.
 *
 * @param {import("./contracts.mjs").Criterion} criterion
 * @param {(Observation|null)} observation
 * @param {{candidate_ref?:(string|null), currentInputs?:Record<string, string>,
 *   allowedPaths?:string[]}} [context]
 */
export function evaluateCriterion(criterion, observation, context = {}) {
  const currentInputs = context.currentInputs || {};

  if (!observation) {
    return evidenceRecord(criterion, null, "missing", EVIDENCE_REASONS.NO_OBSERVATION, null, context);
  }
  if (criterion.forbidden_substitutes.includes(observation.kind)) {
    // Named in the contract as a weaker fact that cannot carry this claim. Not
    // "failed" — the proposition was not disproven, it was never observed.
    return evidenceRecord(
      criterion,
      observation,
      "missing",
      EVIDENCE_REASONS.FORBIDDEN_SUBSTITUTE,
      observation.kind + " is a declared forbidden substitute for " + criterion.criterion_id,
      context,
    );
  }
  if (observation.kind !== criterion.observer.kind) {
    return evidenceRecord(
      criterion,
      observation,
      "missing",
      EVIDENCE_REASONS.INELIGIBLE_OBSERVER,
      "criterion requires " + criterion.observer.kind + ", observation is " + observation.kind,
      context,
    );
  }
  if (observation.outcome === "interrupted") {
    return evidenceRecord(criterion, observation, "inconclusive", EVIDENCE_REASONS.INTERRUPTED, null, context);
  }
  if (observation.outcome === "malformed") {
    return evidenceRecord(criterion, observation, "inconclusive", EVIDENCE_REASONS.MALFORMED, null, context);
  }

  const undeclared = criterion.freshness_inputs.filter((input) => !(input in observation.inputs));
  if (undeclared.length) {
    return evidenceRecord(
      criterion,
      observation,
      "inconclusive",
      EVIDENCE_REASONS.MALFORMED,
      "receipt does not identify: " + undeclared.join(", "),
      context,
    );
  }
  const drifted = criterion.freshness_inputs.filter(
    (input) => input in currentInputs && currentInputs[input] !== observation.inputs[input],
  );
  if (drifted.length) {
    return evidenceRecord(
      criterion,
      observation,
      "stale",
      EVIDENCE_REASONS.STALE_INPUT,
      "changed since the observation: " + drifted.join(", "),
      context,
    );
  }

  let verdict;
  switch (criterion.observer.kind) {
    case "command":
      verdict = evaluateCommand(criterion, observation);
      break;
    case "interaction":
      verdict = evaluateInteraction(criterion, observation);
      break;
    case "source_match":
      verdict = evaluateSourceMatch(criterion, observation);
      break;
    case "diff":
      verdict = evaluateDiff(criterion, observation, context);
      break;
    default:
      verdict = evaluateAttributed(criterion, observation);
      break;
  }
  return evidenceRecord(criterion, observation, verdict.state, verdict.reason, verdict.detail, context);
}

/**
 * Record an owner's explicit acceptance of a named limitation.
 *
 * "waived" is its own state and never becomes "satisfied": Evidence & Autonomy §1
 * is explicit that a waiver remains a limitation. It requires a decision
 * reference so the acceptance is attributable to a person, not to the run.
 *
 * @param {import("./contracts.mjs").Criterion} criterion
 * @param {{owner_decision_ref:string, limitation:string, candidate_ref?:(string|null)}} input
 */
export function waiveCriterion(criterion, { owner_decision_ref, limitation, candidate_ref = null }) {
  if (!isNonEmptyString(owner_decision_ref)) {
    throw new ContractError("a waiver requires owner_decision_ref; a run cannot waive its own criterion");
  }
  if (!isNonEmptyString(limitation)) throw new ContractError("a waiver must name the limitation being accepted");
  return evidenceRecord(criterion, null, "waived", null, limitation, { candidate_ref, owner_decision_ref });
}

/**
 * Fold evidence records into the per-criterion state list the disposition
 * predicate consumes. A criterion with no record is "missing", never absent:
 * silence is not a pass.
 *
 * @param {import("./contracts.mjs").Criterion[]} criteria
 * @param {{criterion_id:string, criterion_revision:number, state:string, reason:(string|null)}[]} evidence
 */
export function summarizeCriteria(criteria, evidence) {
  const byId = new Map();
  for (const record of evidence) {
    // Evidence for an older criterion revision cannot certify the current one.
    const existing = byId.get(record.criterion_id);
    if (!existing || record.criterion_revision > existing.criterion_revision) byId.set(record.criterion_id, record);
  }
  const states = criteria.map((criterion) => {
    const record = byId.get(criterion.criterion_id);
    const usable = record && record.criterion_revision === criterion.revision;
    return {
      criterion_id: criterion.criterion_id,
      required_for: criterion.required_for,
      state: usable ? record.state : "missing",
      reason: usable ? record.reason : EVIDENCE_REASONS.NO_OBSERVATION,
      evidence_id: usable ? record.evidence_id : null,
    };
  });
  const partition = (predicate) => {
    const relevant = states.filter(predicate);
    return {
      satisfied: relevant.length > 0 && relevant.every((entry) => entry.state === "satisfied"),
      outstanding: relevant.filter((entry) => entry.state !== "satisfied"),
    };
  };
  return deepFreeze({
    states,
    candidate: partition((entry) => entry.required_for === "candidate" || entry.required_for === "both"),
    disposition: partition((entry) => entry.required_for === "disposition" || entry.required_for === "both"),
  });
}
