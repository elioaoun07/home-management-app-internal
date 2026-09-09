// scripts/delivery-v2/results.mjs
// PM Delivery V2 — S1.3: one Result, and two honest predicates.
//
// The schema is "PM Delivery — Evidence & Autonomy.md" §6, field for field. The
// two predicates it defines are the reason this module exists:
//
//   candidateVerified — every required candidate criterion satisfied by eligible
//                       FRESH evidence, valid artifact identity and publication
//                       scope, and no unresolved authority or integrity violation.
//
//   workComplete      — that, plus every requested-disposition criterion
//                       satisfied, plus an observed disposition that actually
//                       establishes the requested destination, plus no unresolved
//                       consequential job, effect or resource obligation.
//
// The gap between them is the whole point
// ---------------------------------------
// A run can close with a verified candidate while the item is still "Awaiting
// release". `verified_candidate !== verified_deployment` is not an oversight to
// be smoothed over by a ladder comparison; it is the difference between "the code
// is right" and "the thing the owner asked for exists". So there is no ordering
// between dispositions here: observed must *equal* requested, and a candidate
// that is verified against a contract requesting deployment produces
// `candidateVerified: true, workComplete: false` with the deployment named as an
// outstanding obligation.
//
// Three things this module refuses to do
// --------------------------------------
//   - treat a waiver as a pass. `waived` is its own state and never satisfies.
//   - treat an absent observation as a pass. A criterion with no evidence, or
//     with evidence for another revision, is `missing`.
//   - let a later observation rewrite closed engineering. `appendResultVersion`
//     adds a version and can only *add* an established disposition; it cannot
//     change the closed outcome, the candidate, or a criterion's state.

import { ContractError, contentId, deepFreeze, dispositionObligations } from "./contracts.mjs";

/** Why work is not complete. Callers surface these; fixtures match on them. */
export const OBLIGATION_KINDS = Object.freeze({
  CRITERION: "criterion",
  DISPOSITION: "disposition",
  ARTIFACT: "missing-artifact",
  UNKNOWN_JOB: "unknown-job-or-effect",
  RESOURCE: "unresolved-resource",
  INTEGRITY: "integrity-violation",
  AUTHORITY: "authority-violation",
  SCOPE: "publication-scope",
  STALE_CANDIDATE: "stale-candidate",
});

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Build one Result.
 *
 * Everything is an input; nothing is inferred from a model's summary. Evidence
 * §6: "Raw observations and authoritative records, not the availability of a
 * model-written summary, determine the Result." `engineerProse` is accepted and
 * ignored for every predicate — it exists in the signature so that a caller with
 * a malformed one has somewhere to put it, and so a fixture can prove that
 * putting it there changes nothing.
 *
 * @param {{contract:import("./contracts.mjs").Contract, run_id:string,
 *   candidate?:(import("./candidate.mjs").Candidate|null),
 *   candidateFresh?:boolean,
 *   criteriaSummary:{states:{criterion_id:string, required_for:string, state:string, reason:(string|null), evidence_id:(string|null)}[],
 *     candidate:{satisfied:boolean, outstanding:object[]}, disposition:{satisfied:boolean, outstanding:object[]}},
 *   evidence_refs?:string[], job_receipt_refs?:string[],
 *   unknownJobs?:{job_id:string, reason:string}[],
 *   resourceSummary?:object, publicationScopeCheck?:({ok:boolean, outside:readonly string[]}|null),
 *   missingArtifacts?:string[], integrityViolations?:string[], authorityViolations?:string[],
 *   observedDisposition?:string, disposition_receipt_refs?:string[],
 *   owner_decision_refs?:string[], checkpoint_ref?:(string|null),
 *   closed_outcome?:(string|null), projection_status?:string,
 *   engineerProse?:(string|null), result_version?:number, supersedes?:(string|null)}} input
 */
export function buildResult({
  contract,
  run_id,
  candidate = null,
  candidateFresh = true,
  criteriaSummary,
  evidence_refs = [],
  job_receipt_refs = [],
  unknownJobs = [],
  resourceSummary = null,
  publicationScopeCheck = null,
  missingArtifacts = [],
  integrityViolations = [],
  authorityViolations = [],
  observedDisposition = "none",
  disposition_receipt_refs = [],
  owner_decision_refs = [],
  checkpoint_ref = null,
  closed_outcome = null,
  projection_status = "pending",
  engineerProse = null,
  result_version = 1,
  supersedes = null,
}) {
  if (!contract || !contract.contract_id) throw new ContractError("buildResult requires the contract");
  if (!isNonEmptyString(run_id)) throw new ContractError("buildResult requires the run_id");
  if (!criteriaSummary || !Array.isArray(criteriaSummary.states)) {
    throw new ContractError("buildResult requires a criteria summary; silence is not a pass");
  }

  /** @type {{kind:string, detail:unknown}[]} */
  const obligations = [];
  const add = (kind, detail) => obligations.push({ kind, detail });

  for (const entry of criteriaSummary.candidate.outstanding) {
    add(OBLIGATION_KINDS.CRITERION, { criterion_id: entry.criterion_id, state: entry.state, required_for: "candidate" });
  }
  for (const entry of criteriaSummary.disposition.outstanding) {
    add(OBLIGATION_KINDS.DISPOSITION, {
      criterion_id: entry.criterion_id,
      state: entry.state,
      required_for: "disposition",
    });
  }
  for (const path of missingArtifacts) add(OBLIGATION_KINDS.ARTIFACT, path);
  for (const violation of integrityViolations) add(OBLIGATION_KINDS.INTEGRITY, violation);
  for (const violation of authorityViolations) add(OBLIGATION_KINDS.AUTHORITY, violation);
  for (const job of unknownJobs) add(OBLIGATION_KINDS.UNKNOWN_JOB, job);
  if (publicationScopeCheck && !publicationScopeCheck.ok) {
    add(OBLIGATION_KINDS.SCOPE, [...publicationScopeCheck.outside]);
  }
  if (candidate && !candidateFresh) {
    add(OBLIGATION_KINDS.STALE_CANDIDATE, candidate.candidate_id);
  }
  if (resourceSummary && Array.isArray(resourceSummary.unknown) && resourceSummary.unknown.length) {
    add(OBLIGATION_KINDS.RESOURCE, [...resourceSummary.unknown]);
  }

  const disposition = dispositionObligations(contract, {
    observedDisposition,
    criterionStates: criteriaSummary.states,
  });
  if (!disposition.satisfied) {
    for (const entry of disposition.outstanding) {
      if (entry.kind === "disposition") add(OBLIGATION_KINDS.DISPOSITION, entry);
    }
  }

  // --- candidateVerified -------------------------------------------------
  //
  // Requires a candidate to exist at all. A run with no frozen candidate has
  // nothing to have verified, and the honest answer is false rather than
  // vacuously true over an empty criterion set.
  const candidateBlockers = obligations.filter((entry) =>
    [
      OBLIGATION_KINDS.ARTIFACT,
      OBLIGATION_KINDS.INTEGRITY,
      OBLIGATION_KINDS.AUTHORITY,
      OBLIGATION_KINDS.SCOPE,
      OBLIGATION_KINDS.STALE_CANDIDATE,
    ].includes(entry.kind),
  );
  const hasRequiredCandidateCriteria = criteriaSummary.states.some(
    (entry) => entry.required_for === "candidate" || entry.required_for === "both",
  );
  // `outstanding.length === 0` rather than `satisfied`, and the difference is not
  // cosmetic. summarizeCriteria reports `satisfied: false` for an *empty* set of
  // relevant criteria, which is the right answer to "did the checks pass" and the
  // wrong answer to "is anything blocking". Here the question is the second one,
  // and the emptiness case is handled explicitly by hasRequiredCandidateCriteria
  // just below — a contract that checks nothing has not verified anything.
  const candidateVerified = Boolean(
    candidate &&
      hasRequiredCandidateCriteria &&
      criteriaSummary.candidate.outstanding.length === 0 &&
      candidateBlockers.length === 0,
  );

  // --- workComplete ------------------------------------------------------
  //
  // Note what is NOT here: any comparison that would let a "higher" observed
  // disposition stand in for the requested one, and any allowance for a waiver.
  const consequentialOutstanding = obligations.filter((entry) => entry.kind !== OBLIGATION_KINDS.RESOURCE);
  const resourceOutstanding = obligations.filter((entry) => entry.kind === OBLIGATION_KINDS.RESOURCE);
  // Same reading as above: nothing outstanding, not "at least one passed". A
  // contract whose requested disposition needs no separate criterion — a
  // `verified_candidate` request, typically — is completed by the disposition
  // being observed, and must not be held open by an empty partition.
  const workComplete = Boolean(
    candidateVerified &&
      criteriaSummary.disposition.outstanding.length === 0 &&
      observedDisposition === contract.requestedDisposition &&
      consequentialOutstanding.length === 0 &&
      resourceOutstanding.length === 0,
  );

  const body = {
    work_id: contract.work_id,
    contract_id: contract.contract_id,
    contract_revision: contract.revision,
    run_id,
    candidate_ref: candidate ? candidate.candidate_id : null,
    criterion_states: criteriaSummary.states,
    requestedDisposition: contract.requestedDisposition,
    observedDisposition,
    remaining_obligations: obligations,
    result_version,
  };

  return deepFreeze({
    result_id: contentId("res", { v: 1, work_id: contract.work_id, contract_id: contract.contract_id, run_id }),
    result_version,
    supersedes,
    schema: "delivery-v2/result@1",

    work_id: contract.work_id,
    contract_id: contract.contract_id,
    contract_revision: contract.revision,
    run_id,

    candidate_ref: candidate ? candidate.candidate_id : null,
    closed_outcome,
    job_receipt_refs: Object.freeze([...job_receipt_refs]),

    criterion_states: Object.freeze(criteriaSummary.states.map((entry) => Object.freeze({ ...entry }))),
    evidence_refs: Object.freeze([...evidence_refs]),

    requestedDisposition: contract.requestedDisposition,
    observedDisposition,
    disposition_receipt_refs: Object.freeze([...disposition_receipt_refs]),

    remaining_obligations: Object.freeze(obligations.map((entry) => Object.freeze(entry))),
    unknown_jobs_or_effects: Object.freeze(unknownJobs.map((entry) => Object.freeze({ ...entry }))),

    resource_summary: resourceSummary
      ? {
          basis: resourceSummary.basis ?? null,
          settled: resourceSummary.settled ?? null,
          reserved: resourceSummary.reserved ?? null,
          unknown: Object.freeze([...(resourceSummary.unknown || [])]),
          enforcement_profile: resourceSummary.enforcementProfile ?? "unqualified",
        }
      : null,

    owner_decision_refs: Object.freeze([...owner_decision_refs]),
    checkpoint_ref,
    next_safe_action: nextSafeAction({ candidateVerified, workComplete, obligations, contract, observedDisposition }),

    candidateVerified,
    workComplete,
    projection_status,

    // Retained, never read by a predicate. A malformed one changes nothing.
    engineer_prose: engineerProse,
    body_digest: contentId("rb", body),
  });
}

/**
 * The single most useful next step, derived from the obligations rather than
 * narrated.
 *
 * Ordered by what blocks what: an integrity or authority problem outranks a
 * missing check, which outranks a disposition nobody can perform yet.
 */
function nextSafeAction({ candidateVerified, workComplete, obligations, contract, observedDisposition }) {
  if (workComplete) return "nothing outstanding; record the result";
  const byKind = (kind) => obligations.find((entry) => entry.kind === kind);

  const integrity = byKind(OBLIGATION_KINDS.INTEGRITY) || byKind(OBLIGATION_KINDS.AUTHORITY);
  if (integrity) return "resolve the integrity/authority violation before any further dispatch: " + JSON.stringify(integrity.detail);
  const stale = byKind(OBLIGATION_KINDS.STALE_CANDIDATE);
  if (stale) return "re-freeze the candidate and re-run the affected checks; the current proof is stale";
  const artifact = byKind(OBLIGATION_KINDS.ARTIFACT);
  if (artifact) return "restore or re-produce the missing artifact " + String(artifact.detail);
  const scope = byKind(OBLIGATION_KINDS.SCOPE);
  if (scope) return "the candidate changes files outside publicationScope: " + JSON.stringify(scope.detail);
  const unknown = byKind(OBLIGATION_KINDS.UNKNOWN_JOB);
  if (unknown) return "reconcile the outstanding job before anything else: " + JSON.stringify(unknown.detail);
  const criterion = byKind(OBLIGATION_KINDS.CRITERION);
  if (criterion) return "obtain eligible evidence for " + JSON.stringify(criterion.detail);
  if (candidateVerified && observedDisposition !== contract.requestedDisposition) {
    return "the candidate is verified; " + contract.requestedDisposition + " remains outstanding and is an owner-controlled step";
  }
  const resource = byKind(OBLIGATION_KINDS.RESOURCE);
  if (resource) return "reconcile the outstanding resource accounting: " + JSON.stringify(resource.detail);
  return "review the outstanding obligations";
}

/**
 * Append a later observed disposition as a new Result version.
 *
 * Evidence §6: "Later observed disposition appends a Result version without
 * rerunning or rewriting the closed engineering history." So this copies the
 * engineering facts forward untouched and only moves the disposition — and it
 * refuses to move it to something *weaker*, because a Result version that
 * un-observes a deployment is not an append, it is a rewrite.
 *
 * The recomputation of `workComplete` is deliberate: adding the missing
 * disposition is exactly the event that can complete the work, and it is the only
 * thing this function is allowed to change.
 *
 * @param {ReturnType<typeof buildResult>} result
 * @param {{observedDisposition:string, disposition_receipt_refs?:string[],
 *   owner_decision_refs?:string[], projection_status?:string}} observation
 */
export function appendResultVersion(result, observation) {
  if (!isNonEmptyString(observation.observedDisposition)) {
    throw new ContractError("appendResultVersion requires the newly observed disposition");
  }
  if (result.observedDisposition !== "none" && observation.observedDisposition !== result.observedDisposition) {
    if (observation.observedDisposition === "none") {
      throw new ContractError("a result version cannot un-observe an established disposition");
    }
  }
  if (!Array.isArray(observation.disposition_receipt_refs) || observation.disposition_receipt_refs.length === 0) {
    throw new ContractError(
      "an observed disposition needs at least one attributed receipt; a click is not proof of a deployed scenario",
    );
  }

  const remaining = result.remaining_obligations.filter(
    (entry) => !(entry.kind === OBLIGATION_KINDS.DISPOSITION && entry.detail && entry.detail.kind === "disposition"),
  );
  const stillOutstanding =
    observation.observedDisposition === result.requestedDisposition
      ? remaining
      : [
          ...remaining,
          {
            kind: OBLIGATION_KINDS.DISPOSITION,
            detail: { kind: "disposition", requested: result.requestedDisposition, observed: observation.observedDisposition },
          },
        ];

  const consequential = stillOutstanding.filter((entry) => entry.kind !== OBLIGATION_KINDS.RESOURCE);
  const resource = stillOutstanding.filter((entry) => entry.kind === OBLIGATION_KINDS.RESOURCE);

  return deepFreeze({
    ...result,
    result_version: result.result_version + 1,
    supersedes: result.result_id + "@" + result.result_version,
    observedDisposition: observation.observedDisposition,
    disposition_receipt_refs: Object.freeze([...observation.disposition_receipt_refs]),
    owner_decision_refs: Object.freeze([
      ...result.owner_decision_refs,
      ...(observation.owner_decision_refs || []),
    ]),
    remaining_obligations: Object.freeze(stillOutstanding.map((entry) => Object.freeze(entry))),
    projection_status: observation.projection_status || result.projection_status,
    workComplete: Boolean(
      result.candidateVerified &&
        observation.observedDisposition === result.requestedDisposition &&
        consequential.length === 0 &&
        resource.length === 0,
    ),
    next_safe_action:
      observation.observedDisposition === result.requestedDisposition
        ? "nothing outstanding; record the result"
        : result.requestedDisposition + " remains outstanding",
  });
}

/**
 * Record an attributed owner observation of a disposition.
 *
 * §6: "`RecordDisposition` may record an attributed owner observation, but cannot
 * promote a generic click into proof of a deployed scenario." So this refuses
 * without a named observer, a named scenario and an identified build — the three
 * things that distinguish "I deployed it" from "the deploy button was pressed".
 *
 * @param {{disposition:string, observer:string, scenario:string, build_ref:string,
 *   observed_at:string, notes?:(string|null)}} input
 */
export function recordDisposition({ disposition, observer, scenario, build_ref, observed_at, notes = null }) {
  for (const [field, value] of Object.entries({ disposition, observer, scenario, build_ref, observed_at })) {
    if (!isNonEmptyString(value)) {
      throw new ContractError(
        "recordDisposition needs " + field + "; an unattributed or unidentified observation is not a disposition receipt",
      );
    }
  }
  const body = { v: 1, disposition, observer, scenario, build_ref, observed_at };
  return deepFreeze({ receipt_id: contentId("disp", body), ...body, notes });
}

/**
 * May the supervisor dispatch the one post-check repair the initial FAST policy
 * allows?
 *
 * Evidence & Autonomy §7: "The initial FAST preset permits one supervisor-
 * initiated repair after protected checks fail, if the Grant and remaining
 * resource allowance permit it. This counts outer repair dispatches, not native
 * internal test/fix iterations."
 *
 * Three conditions, and all three are refusals rather than defaults:
 *
 *   - a check must actually have *failed*. A `missing` or `inconclusive`
 *     criterion is an evidence gap, and dispatching a repair at a writer who has
 *     not been shown a failure is how a repair budget gets spent on a check that
 *     never ran.
 *   - the budget must be unspent. One means one.
 *   - the current Grant and allowance must permit it, evaluated now. This
 *     function does not evaluate them; it requires the caller's verdict, so the
 *     check cannot be satisfied by an authority snapshot taken before the job.
 *
 * @param {{result:ReturnType<typeof buildResult>, repairsDispatched?:number,
 *   limit?:number, grantVerdict:{permitted:boolean, refusals?:readonly object[]}}} input
 */
export function postCheckRepairPolicy({ result, repairsDispatched = 0, limit = 1, grantVerdict }) {
  const refusals = [];
  const failed = result.criterion_states.filter((entry) => entry.state === "failed");
  if (failed.length === 0) {
    refusals.push({
      code: "no-failed-check",
      detail: "a repair answers a demonstrated failure; missing or inconclusive evidence is an obligation, not a defect",
    });
  }
  if (repairsDispatched >= limit) {
    refusals.push({ code: "repair-budget-spent", detail: repairsDispatched + " of " + limit + " already dispatched" });
  }
  if (!grantVerdict || !grantVerdict.permitted) {
    refusals.push({ code: "grant-refused", detail: (grantVerdict && grantVerdict.refusals) || "no grant verdict supplied" });
  }
  return deepFreeze({
    permitted: refusals.length === 0,
    refusals: Object.freeze(refusals),
    failedCriteria: Object.freeze(failed.map((entry) => entry.criterion_id)),
    note: "counts supervisor-dispatched repairs only; the native job's own test/fix loop is inside its bound",
  });
}

/**
 * Report a projection failure without letting it touch the engineering facts.
 *
 * §6: "A failed PM writeback affects `projection_status`; it does not erase
 * verified engineering."
 *
 * @param {ReturnType<typeof buildResult>} result
 * @param {{status:string, reason?:(string|null)}} projection
 */
export function withProjectionStatus(result, projection) {
  return deepFreeze({
    ...result,
    projection_status: projection.status,
    projection_reason: projection.reason ?? null,
    // Unchanged, explicitly. Named here so the invariant has a call site.
    candidateVerified: result.candidateVerified,
    workComplete: result.workComplete,
  });
}
