// scripts/delivery-v2/baseline.mjs
// PM Delivery V2 — S0.2: the record an ordinary-native baseline (and later a
// pilot sample) is written into.
//
// "PM Delivery — Execution Portfolio.md" §1 requires every sample to record owner
// setup, explanation, decisions, recovery, review, application and release effort
// as well as outcome, latency, cost basis and limitations — and states the rule
// this module is built around: **unobserved owner minutes remain unknown**.
//
// So the shape here is adversarial towards its own summary. An unmeasured field
// is null and stays null; totalOwnerMinutes returns the unknown field names
// alongside the sum rather than treating a missing measurement as zero; and a
// record cannot move to "observed" without a named observer and an explicit
// decision about every field that was not measured. A baseline that flatters the
// supervisor by silently zeroing the owner's minutes is worse than no baseline,
// because the S2 comparison is the only thing that decides whether any of this is
// worth keeping.
//
// This module builds and validates the record. It does not run anything, and
// nothing in it can mark a baseline observed on its own behalf.

import {
  ContractError,
  CLOSED_OUTCOMES,
  OBSERVED_DISPOSITIONS,
  contentId,
  deepFreeze,
  makeResourceBasis,
} from "./contracts.mjs";

/** Local runtime storage root named by Architecture §4. Gitignored; never committed. */
export const BASELINE_ARTIFACT_DIR = ".delivery/v2/artifacts/baselines";

/** @param {string} repoRoot @param {string} baselineId */
export function baselineArtifactPath(repoRoot, baselineId) {
  return String(repoRoot).replace(/\\/gu, "/").replace(/\/$/u, "") + "/" + BASELINE_ARTIFACT_DIR + "/" + baselineId + ".json";
}

/** Every owner-effort bucket a sample must account for, measured or explicitly not. */
export const OWNER_EFFORT_FIELDS = Object.freeze([
  "setup",
  "explanation",
  "decisions",
  "monitoring",
  "recovery",
  "review",
  "application",
  "release",
  "maintenance",
]);

/** How the sample was produced. One executor, two comparable workflows. */
export const BASELINE_METHODS = Object.freeze(["ordinary-native", "delivery-v2"]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

function normalizeEffort(input) {
  const effort = {};
  for (const field of OWNER_EFFORT_FIELDS) {
    const value = input ? input[field] : null;
    if (value == null) {
      effort[field] = null; // unknown, and it stays unknown
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ContractError("ownerEffortMinutes." + field + " must be a non-negative number or null");
    }
    effort[field] = value;
  }
  return effort;
}

/**
 * @typedef {object} BaselineRecord
 * @property {string} baseline_id
 * @property {string} schema
 * @property {string} method
 * @property {string} status "planned" until an attributed observer records it
 * @property {string} work_id
 * @property {string} contract_id
 * @property {number} contract_revision
 * @property {string} requestedDisposition
 * @property {string} observedDisposition
 * @property {(string|null)} closed_outcome
 * @property {Record<string, (number|null)>} ownerEffortMinutes
 * @property {readonly string[]} unknownEffortFields
 * @property {import("./contracts.mjs").ResourceBasis} resourceBasis
 * @property {(number|null)} elapsedMs
 * @property {readonly object[]} criterionStates
 * @property {readonly string[]} limitations
 * @property {readonly string[]} obligations
 * @property {(string|null)} observed_by
 * @property {(string|null)} observed_at
 * @property {readonly string[]} raw_refs
 */

/**
 * Create the record for a sample that has not happened yet.
 *
 * Deliberately constructible before any work is done: the check plan, requested
 * disposition and resource basis are agreed up front (Portfolio S0.2), and the
 * measurements arrive later through recordBaselineObservation. A "planned" record
 * asserts nothing about a run.
 *
 * @param {{baseline_id?:string, method?:string, work_id:string, contract_id:string,
 *   contract_revision:number, requestedDisposition:string,
 *   resourceBasis?:(import("./contracts.mjs").ResourceBasis|null), limitations?:string[],
 *   obligations?:string[]}} input
 * @returns {BaselineRecord}
 */
export function planBaselineRecord({
  baseline_id,
  method = "ordinary-native",
  work_id,
  contract_id,
  contract_revision,
  requestedDisposition,
  resourceBasis,
  limitations = [],
  obligations = [],
}) {
  if (!BASELINE_METHODS.includes(method)) {
    throw new ContractError("baseline.method must be one of " + BASELINE_METHODS.join("|"));
  }
  if (!isNonEmptyString(work_id) || !isNonEmptyString(contract_id)) {
    throw new ContractError("a baseline record must name its work_id and contract_id");
  }
  const basis =
    resourceBasis ||
    makeResourceBasis({
      unknown: ["everything: no run has been performed"],
      strictBoundRefusalReason: "no executor is qualified; no whole-job bound exists to promise",
    });
  const id =
    baseline_id ||
    contentId("b", { v: 1, method, work_id, contract_id, contract_revision, requestedDisposition });
  return deepFreeze({
    baseline_id: id,
    schema: "delivery-v2/baseline@1",
    method,
    status: "planned",
    work_id,
    contract_id,
    contract_revision,
    requestedDisposition,
    observedDisposition: "none",
    closed_outcome: null,
    ownerEffortMinutes: normalizeEffort(null),
    unknownEffortFields: Object.freeze([...OWNER_EFFORT_FIELDS]),
    resourceBasis: basis,
    elapsedMs: null,
    criterionStates: Object.freeze([]),
    limitations: Object.freeze([...limitations]),
    obligations: Object.freeze([...obligations]),
    observed_by: null,
    observed_at: null,
    raw_refs: Object.freeze([]),
  });
}

/**
 * Attach the measurements of a run that actually happened.
 *
 * Refuses without an attributed observer and a timestamp, because an
 * unattributed baseline is exactly the "invented from prior smoke sessions"
 * failure Portfolio S0.2 forbids. Fields left null are reported in
 * unknownEffortFields; that is a legitimate, honest outcome and is not the same
 * as zero.
 *
 * @param {BaselineRecord} record
 * @param {{observed_by:string, observed_at:string, ownerEffortMinutes?:Record<string, (number|null)>,
 *   closed_outcome?:(string|null), observedDisposition?:string, elapsedMs?:(number|null),
 *   resourceBasis?:(import("./contracts.mjs").ResourceBasis|null), criterionStates?:object[], limitations?:string[],
 *   obligations?:string[], raw_refs?:string[]}} observation
 * @returns {BaselineRecord}
 */
export function recordBaselineObservation(record, observation) {
  if (!isNonEmptyString(observation.observed_by)) {
    throw new ContractError("a baseline observation must name who observed it");
  }
  if (!isNonEmptyString(observation.observed_at)) {
    throw new ContractError("a baseline observation must carry when it was observed");
  }
  const closed = observation.closed_outcome ?? null;
  if (closed !== null && !CLOSED_OUTCOMES.includes(closed)) {
    throw new ContractError("baseline.closed_outcome must be one of " + CLOSED_OUTCOMES.join("|"));
  }
  const disposition = observation.observedDisposition ?? "none";
  if (!OBSERVED_DISPOSITIONS.includes(disposition)) {
    throw new ContractError("baseline.observedDisposition must be one of " + OBSERVED_DISPOSITIONS.join("|"));
  }
  const effort = normalizeEffort(observation.ownerEffortMinutes || null);
  const unknown = OWNER_EFFORT_FIELDS.filter((field) => effort[field] == null);

  return deepFreeze({
    ...record,
    status: "observed",
    observedDisposition: disposition,
    closed_outcome: closed,
    ownerEffortMinutes: effort,
    unknownEffortFields: Object.freeze(unknown),
    resourceBasis: observation.resourceBasis || record.resourceBasis,
    elapsedMs: observation.elapsedMs ?? null,
    criterionStates: Object.freeze([...(observation.criterionStates || [])]),
    limitations: Object.freeze([...(observation.limitations || record.limitations)]),
    obligations: Object.freeze([...(observation.obligations || record.obligations)]),
    observed_by: observation.observed_by,
    observed_at: observation.observed_at,
    raw_refs: Object.freeze([...(observation.raw_refs || [])]),
  });
}

/**
 * Sum what was measured and say plainly what was not.
 *
 * There is no variant of this function that returns a bare number. The caller is
 * forced to carry the unknowns into whatever comparison it makes, which is the
 * whole point: "Unobserved owner minutes remain unknown."
 *
 * @param {BaselineRecord} record
 */
export function totalOwnerMinutes(record) {
  const known = OWNER_EFFORT_FIELDS.filter((field) => record.ownerEffortMinutes[field] != null);
  const unknown = OWNER_EFFORT_FIELDS.filter((field) => record.ownerEffortMinutes[field] == null);
  return deepFreeze({
    measuredMinutes: known.reduce((sum, field) => sum + Number(record.ownerEffortMinutes[field]), 0),
    measuredFields: Object.freeze(known),
    unknownFields: Object.freeze(unknown),
    complete: unknown.length === 0,
  });
}

/**
 * Is this pair of samples comparable at all?
 *
 * Portfolio §1: "The comparison is against the same required outcome and
 * evidence." Two samples of different contract revisions or different requested
 * dispositions are not a comparison, and a sample that has not been observed is
 * not a sample. Returns the blocking reasons rather than a verdict, so an
 * incomparable pair cannot be quietly reported as a saving.
 *
 * @param {BaselineRecord} native
 * @param {BaselineRecord} supervised
 */
export function comparabilityReport(native, supervised) {
  const blockers = [];
  if (native.status !== "observed" || supervised.status !== "observed") {
    blockers.push("a sample that has not been observed cannot enter the comparison");
  }
  if (native.work_id !== supervised.work_id) blockers.push("different work items");
  if (native.contract_id !== supervised.contract_id) blockers.push("different contract revisions");
  if (native.requestedDisposition !== supervised.requestedDisposition) {
    blockers.push("different requested dispositions");
  }
  if (native.observedDisposition !== supervised.observedDisposition) {
    blockers.push(
      "different observed dispositions (" +
        native.observedDisposition +
        " vs " +
        supervised.observedDisposition +
        "): a patch is not comparable with a deployment",
    );
  }
  const nativeTotal = totalOwnerMinutes(native);
  const supervisedTotal = totalOwnerMinutes(supervised);
  if (!nativeTotal.complete || !supervisedTotal.complete) {
    blockers.push("unmeasured owner effort: " + [...nativeTotal.unknownFields, ...supervisedTotal.unknownFields].join(", "));
  }
  return deepFreeze({
    comparable: blockers.length === 0,
    blockers,
    native: nativeTotal,
    supervised: supervisedTotal,
  });
}
