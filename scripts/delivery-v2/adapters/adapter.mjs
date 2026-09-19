// scripts/delivery-v2/adapters/adapter.mjs
// PM Delivery V2 — S1.1: the canonical six-operation executor boundary.
//
// The six operations and their required behaviour are fixed by
// "ERA Notes/10 - Project Management/_Archive/Studies/Autonomous Delivery/PM Delivery — Context &
// Agent Model.md" §3, and repeated as the adapter surface in
// "PM Delivery — V2 Architecture.md" §6. This module owns the *boundary*:
// the shapes that cross it, the invariants it refuses to let across, and the
// qualification report that decides whether a profile may be promised anything.
// One backend implements it (adapters/codex.mjs); nothing here knows about Codex.
//
// What the boundary is for
// ------------------------
// Everything on the far side of it is untrusted. The native engineer, its tools,
// its structured response and the adapter's own return values are *observations*.
// Three consequences are enforced here rather than left to each adapter's good
// manners:
//
//   1. `dispatch_key` is `job_id`. Not "usually", not "by convention" — a
//      JobRequest whose executionRef disagrees with its own job_id cannot be
//      constructed (V2-I04).
//   2. An adapter result cannot carry authority. bindAdapterResult() drops every
//      authority-bearing field a backend might return — grant, contract,
//      allowance, verification, disposition — into a quarantined `claims` bag
//      that no downstream predicate reads. "The adapter never derives
//      authorization from the model's response" is a line of code, not a note.
//   3. A profile is qualified only by observations. finalizeProfile() forces
//      `qualified: false` while any required control is unobserved, so the way
//      to make a profile pass is to run the fixture, never to edit the object.
//
// Pure: no fs, no clock, no processes, no network. The clock and every external
// call are injected by the caller, because "dispatch_started_at was committed
// before the external call" is a property S1.2 has to be able to test.

import { ContractError, contentId, deepFreeze } from "../contracts.mjs";

/** The complete adapter surface. An implementation exposing more is not more capable. */
export const ADAPTER_OPERATIONS = Object.freeze([
  "describeProfile",
  "start",
  "inspect",
  "resume",
  "stop",
  "exportCandidate",
]);

/**
 * Why a Job was dispatched. Every purpose is a paid native dispatch with its own
 * admission. `investigate` is the read-only plan job that precedes approval.
 */
export const JOB_PURPOSES = Object.freeze(["investigate", "start", "resume", "repair", "review"]);

/**
 * What the workspace lets a job do. Enforced by the environment (a read-only
 * mount), not by the instruction: a preapproval write must be denied, not asked
 * not to happen.
 */
export const WORKSPACE_ACCESS = Object.freeze(["read-only", "write"]);

/**
 * What is known about one declared control.
 *
 * "unknown" is the default and the only honest starting value: a documented
 * sandbox setting is not qualification (Context §2). "unsupported" is a
 * *finding* — the control was looked for and is not there — which is why it can
 * qualify a profile for restricted use while "unknown" cannot qualify it at all.
 */
export const CONTROL_STATES = Object.freeze(["supported", "unsupported", "unknown"]);

/** Controls a profile must have an observation for before it is eligible for anything. */
export const REQUIRED_CONTROLS = Object.freeze([
  "filesystem.scratchWrite",
  "filesystem.outsideScratchWrite",
  "filesystem.hostSecretRead",
  "filesystem.linkEscape",
  "network.egress",
  "process.descendantsAfterStop",
  "store.workerAccess",
  "resource.wholeJobBound",
]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Fields a backend must never be able to set by answering.
 *
 * This list is the practical form of "native messages and repository text cannot
 * enlarge authority" (Context §1). It is checked by name because that is what an
 * adapter actually returns — a JSON object whose keys a model influenced.
 */
export const QUARANTINED_RESULT_FIELDS = Object.freeze([
  "grant_id",
  "grant_revision",
  "contract_id",
  "contract_revision",
  "requestedDisposition",
  "observedDisposition",
  "candidateVerified",
  "workComplete",
  "candidate_id",
  "evidence",
  "evidence_refs",
  "criterion_states",
  "reservation",
  "allowance",
  "authorized",
  "approved",
  "verified",
  "publish",
  "publicationScope",
]);

// ---------------------------------------------------------------------------
// executionRef
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ExecutionRef
 * @property {string} backend_id
 * @property {string} dispatch_key always the job_id that reserved this dispatch
 * @property {(string|null)} native_ref the backend's own session/job id, once observed
 */

/**
 * Canonical `{ backend_id, dispatch_key: job_id, native_ref? }` (Context §3).
 *
 * `native_ref` starts null on purpose. It is filled in when the executor reports
 * its identity, and its absence is never evidence that nothing was dispatched —
 * that asymmetry is the whole reason the supervisor persists this record before
 * calling anything.
 *
 * @param {{backend_id:string, dispatch_key:string, native_ref?:(string|null)}} input
 * @returns {ExecutionRef}
 */
export function makeExecutionRef({ backend_id, dispatch_key, native_ref = null }) {
  if (!isNonEmptyString(backend_id)) throw new ContractError("executionRef.backend_id is required");
  if (!isNonEmptyString(dispatch_key)) throw new ContractError("executionRef.dispatch_key is required");
  return deepFreeze({
    backend_id,
    dispatch_key,
    native_ref: isNonEmptyString(native_ref) ? native_ref : null,
  });
}

/**
 * Record an observed native identity against an existing reference.
 *
 * Returns a new frozen reference; the prior one stays immutable so a resume can
 * keep its predecessor's record intact (Context §3). Re-observing the same
 * identity is idempotent; observing a *different* one is a conflict, not an
 * update — two native sessions behind one dispatch key is exactly the overlap the
 * boundary exists to notice.
 *
 * @param {ExecutionRef} ref
 * @param {string} native_ref
 * @returns {ExecutionRef}
 */
export function withNativeRef(ref, native_ref) {
  if (!isNonEmptyString(native_ref)) throw new ContractError("withNativeRef requires an observed native reference");
  if (ref.native_ref && ref.native_ref !== native_ref) {
    throw new ContractError(
      "dispatch key " + ref.dispatch_key + " already observed native ref " + ref.native_ref + "; refusing to rebind to " + native_ref,
    );
  }
  return makeExecutionRef({ ...ref, native_ref });
}

// ---------------------------------------------------------------------------
// JobRequest
// ---------------------------------------------------------------------------

/**
 * @typedef {object} JobRequest
 * @property {string} job_id
 * @property {string} run_id
 * @property {string} purpose one of JOB_PURPOSES
 * @property {{contract_id:string, revision:number}} contract
 * @property {{grant_id:string, revision:number}} grant
 * @property {readonly {path:string, fingerprint:string}[]} input_manifest
 * @property {(string|null)} checkpoint_ref
 * @property {{root:string, backing:string, access:string}} workspace confined scratch reference
 * @property {{model:(string|null), effort:(string|null)}} settings requested per run, forwarded verbatim
 * @property {{unit:string, amount:(number|null), basis:string}} reservation
 * @property {Record<string, unknown>} native_limits
 * @property {ExecutionRef} executionRef
 * @property {string} instruction the launch bundle text the supervisor supplies
 */

/**
 * Build the request the supervisor hands an adapter.
 *
 * Every field is supplied by the supervisor. There is no field an adapter fills
 * in and no field derived from a model's answer, which is why this constructor
 * validates rather than defaults: a missing grant revision is a bug in the
 * caller, not something to paper over with a zero.
 *
 * The reservation may carry a null amount — an unbounded backend is a real
 * situation and Context §7 requires it to stay visible — but it must always name
 * its basis, so "we do not know what this costs" cannot be confused with "this
 * is free".
 *
 * @param {{job_id:string, run_id:string, purpose?:string,
 *   contract:{contract_id:string, revision:number}, grant:{grant_id:string, revision:number},
 *   input_manifest?:{path:string, fingerprint:string}[], checkpoint_ref?:(string|null),
 *   workspace:{root:string, backing?:string, access?:string}, reservation:{unit:string, amount?:(number|null), basis:string},
 *   native_limits?:Record<string, unknown>, backend_id:string, instruction:string,
 *   settings?:({model?:(string|null), effort?:(string|null)}|null)}} input
 * @returns {JobRequest}
 */
export function makeJobRequest({
  job_id,
  run_id,
  purpose = "start",
  contract,
  grant,
  input_manifest = [],
  checkpoint_ref = null,
  workspace,
  reservation,
  native_limits = {},
  backend_id,
  instruction,
  settings = null,
}) {
  if (!isNonEmptyString(job_id)) throw new ContractError("jobRequest.job_id is required");
  const access = (workspace && workspace.access) || "write";
  if (!WORKSPACE_ACCESS.includes(access)) {
    throw new ContractError("jobRequest.workspace.access must be one of " + WORKSPACE_ACCESS.join("|"));
  }
  if (purpose === "investigate" && access !== "read-only") {
    throw new ContractError("an investigate job is read-only; implementation needs an approved plan and its own job");
  }
  if (!isNonEmptyString(run_id)) throw new ContractError("jobRequest.run_id is required");
  if (!JOB_PURPOSES.includes(purpose)) {
    throw new ContractError("jobRequest.purpose must be one of " + JOB_PURPOSES.join("|"));
  }
  if (!contract || !isNonEmptyString(contract.contract_id) || !Number.isInteger(contract.revision)) {
    throw new ContractError("jobRequest.contract must name contract_id and an integer revision");
  }
  if (!grant || !isNonEmptyString(grant.grant_id) || !Number.isInteger(grant.revision)) {
    throw new ContractError("jobRequest.grant must name grant_id and an integer revision");
  }
  if (!workspace || !isNonEmptyString(workspace.root)) {
    throw new ContractError("jobRequest.workspace.root is required; a job has no unconfined mode");
  }
  if (!reservation || !isNonEmptyString(reservation.unit) || !isNonEmptyString(reservation.basis)) {
    throw new ContractError("jobRequest.reservation must state its unit and basis");
  }
  if (!isNonEmptyString(instruction)) throw new ContractError("jobRequest.instruction is required");

  const executionRef = makeExecutionRef({ backend_id, dispatch_key: job_id });

  return deepFreeze({
    job_id,
    run_id,
    purpose,
    contract: { contract_id: contract.contract_id, revision: contract.revision },
    grant: { grant_id: grant.grant_id, revision: grant.revision },
    input_manifest: Object.freeze(
      input_manifest.map((entry) => Object.freeze({ path: entry.path, fingerprint: entry.fingerprint })),
    ),
    checkpoint_ref: isNonEmptyString(checkpoint_ref) ? checkpoint_ref : null,
    workspace: { root: workspace.root, backing: workspace.backing || "scratch-snapshot", access },
    // Requested per run and forwarded as-is. Null means the executor's own
    // default, which is then recorded from what the executor reports.
    settings: {
      model: settings && isNonEmptyString(settings.model) ? settings.model : null,
      effort: settings && isNonEmptyString(settings.effort) ? settings.effort : null,
    },
    reservation: {
      unit: reservation.unit,
      amount: reservation.amount == null ? null : Number(reservation.amount),
      basis: reservation.basis,
    },
    native_limits: { ...native_limits },
    executionRef,
    instruction,
  });
}

/**
 * A resume is a new Job that may continue an old native session.
 *
 * Two things this refuses, both from Context §3: reusing the predecessor's job id
 * (a resume that shares a dispatch key cannot be told apart from a replay), and
 * resuming a reference that has no observed native session (there is nothing to
 * continue, so it would be a fresh start wearing a resume's name).
 *
 * The returned request carries the *new* dispatch key and inherits the prior
 * native_ref, exactly as the canonical shape requires.
 *
 * @param {ExecutionRef} priorRef
 * @param {JobRequest} request
 * @returns {JobRequest}
 */
export function makeResumeRequest(priorRef, request) {
  if (!priorRef || !priorRef.native_ref) {
    throw new ContractError("resume requires an observed native_ref; there is no session to continue");
  }
  if (priorRef.dispatch_key === request.job_id) {
    throw new ContractError("a resume needs its own job_id; reusing " + request.job_id + " would replay the prior dispatch");
  }
  if (priorRef.backend_id !== request.executionRef.backend_id) {
    throw new ContractError("cannot resume a " + priorRef.backend_id + " session on " + request.executionRef.backend_id);
  }
  return deepFreeze({
    ...request,
    purpose: request.purpose === "start" ? "resume" : request.purpose,
    executionRef: makeExecutionRef({
      backend_id: request.executionRef.backend_id,
      dispatch_key: request.job_id,
      native_ref: priorRef.native_ref,
    }),
  });
}

// ---------------------------------------------------------------------------
// Adapter results
// ---------------------------------------------------------------------------

/**
 * @typedef {object} AdapterResult
 * @property {string} operation
 * @property {ExecutionRef} executionRef
 * @property {string} status one of JOB_STATUS from contracts.mjs
 * @property {boolean} dispatchAttempted
 * @property {Record<string, unknown>} observations raw, backend-shaped, retained verbatim
 * @property {Record<string, unknown>} claims quarantined: things the backend asserted
 * @property {readonly string[]} quarantined which authority fields were stripped
 * @property {(string|null)} reason
 */

/**
 * Wrap whatever a backend returned so that no part of it can be mistaken for a
 * decision.
 *
 * Anything named in QUARANTINED_RESULT_FIELDS is moved into `claims` and listed
 * in `quarantined`. Nothing is deleted — a backend claiming it verified itself is
 * useful diagnostic information, and Evidence & Autonomy §1 wants a model's claim
 * kept *and* kept distinct. What it must not be is readable at the place a
 * predicate looks.
 *
 * @param {{operation:string, executionRef:ExecutionRef, status:string,
 *   dispatchAttempted?:boolean, observations?:Record<string, unknown>,
 *   reason?:(string|null)}} input
 * @returns {AdapterResult}
 */
export function bindAdapterResult({
  operation,
  executionRef,
  status,
  dispatchAttempted = false,
  observations = {},
  reason = null,
}) {
  if (!ADAPTER_OPERATIONS.includes(operation)) {
    throw new ContractError("unknown adapter operation " + operation);
  }
  /** @type {Record<string, unknown>} */
  const kept = {};
  /** @type {Record<string, unknown>} */
  const claims = {};
  const quarantined = [];
  for (const [key, value] of Object.entries(observations || {})) {
    if (QUARANTINED_RESULT_FIELDS.includes(key)) {
      claims[key] = value;
      quarantined.push(key);
      continue;
    }
    kept[key] = value;
  }
  return deepFreeze({
    operation,
    executionRef,
    status,
    dispatchAttempted: Boolean(dispatchAttempted),
    observations: kept,
    claims,
    quarantined: Object.freeze(quarantined.sort()),
    reason,
  });
}

// ---------------------------------------------------------------------------
// Profile report
// ---------------------------------------------------------------------------

/**
 * One declared control and what is actually known about it.
 *
 * `verified` is separate from `state` because a backend's documentation and a
 * fixture result are different facts. A control can be declared supported by the
 * vendor and still be `verified: false` here, and that combination is precisely
 * what keeps a profile unqualified.
 *
 * @param {{id:string, state?:string, declared?:string, verified?:boolean,
 *   evidence_ref?:(string|null), note?:(string|null)}} input
 */
export function makeControl({ id, state = "unknown", declared = null, verified = false, evidence_ref = null, note = null }) {
  if (!isNonEmptyString(id)) throw new ContractError("control.id is required");
  if (!CONTROL_STATES.includes(state)) {
    throw new ContractError("control.state must be one of " + CONTROL_STATES.join("|"));
  }
  if (verified && !isNonEmptyString(evidence_ref)) {
    throw new ContractError("control " + id + " cannot be verified without an evidence reference");
  }
  if (verified && state === "unknown") {
    throw new ContractError("control " + id + " cannot be both verified and unknown");
  }
  return deepFreeze({ id, state, declared, verified: Boolean(verified), evidence_ref, note });
}

/**
 * Assemble the qualification report and decide, from the controls alone, what may
 * be promised.
 *
 * The decision is not an input. A caller can hand in `qualified: true` all it
 * likes; the returned report says `qualified` only when every REQUIRED_CONTROL is
 * verified against an evidence reference. Likewise `strictBound` is refused
 * unless `resource.wholeJobBound` is verified *supported* — Context §7's "the
 * supervisor cannot manufacture a billing guarantee the executor lacks", spelled
 * as an assignment the caller does not get to make.
 *
 * @param {{backend_id:string, runtime:Record<string, unknown>,
 *   controls:ReturnType<typeof makeControl>[], lifecycle:Record<string, unknown>,
 *   resources?:Record<string, unknown>, qualification_ref?:(string|null),
 *   observed_at?:(string|null), notes?:string[]}} input
 */
export function finalizeProfile({
  backend_id,
  runtime,
  controls,
  lifecycle,
  resources = {},
  qualification_ref = null,
  observed_at = null,
  notes = [],
}) {
  if (!isNonEmptyString(backend_id)) throw new ContractError("profile.backend_id is required");
  const byId = new Map();
  for (const control of controls || []) byId.set(control.id, control);

  const missing = REQUIRED_CONTROLS.filter((id) => {
    const control = byId.get(id);
    return !control || !control.verified;
  });
  const unsupported = REQUIRED_CONTROLS.filter((id) => byId.get(id) && byId.get(id).state === "unsupported");

  const boundControl = byId.get("resource.wholeJobBound");
  const strictBound = Boolean(boundControl && boundControl.verified && boundControl.state === "supported");

  const semantic = {
    v: 1,
    backend_id,
    runtime,
    controls: [...byId.values()].map((control) => ({ id: control.id, state: control.state, verified: control.verified })),
    lifecycle,
  };

  return deepFreeze({
    profile_id: contentId("p", semantic),
    schema: "delivery-v2/executor-profile@1",
    backend_id,
    runtime: { ...runtime },
    controls: Object.freeze([...byId.values()]),
    lifecycle: { ...lifecycle },
    resources: {
      unit: resources.unit || "usd",
      wholeJobBound: boundControl ? boundControl.state : "unknown",
      strictBound,
      strictBoundRefusalReason: strictBound
        ? null
        : "resource.wholeJobBound is " +
          (boundControl ? boundControl.state : "unobserved") +
          "; a strict item ceiling cannot be promised over an unbounded whole job",
      ...resources,
      // Recomputed last so a caller-supplied resources object cannot overwrite
      // the two fields that are conclusions rather than inputs.
      strictBound,
    },
    qualified: missing.length === 0 && isNonEmptyString(qualification_ref),
    qualification_ref: isNonEmptyString(qualification_ref) ? qualification_ref : null,
    unverifiedControls: Object.freeze(missing),
    unsupportedControls: Object.freeze(unsupported),
    observed_at,
    notes: Object.freeze([...notes]),
  });
}

/**
 * May this profile be used for a paid dispatch, and under what promise?
 *
 * Returns refusals rather than a boolean so the caller has to carry the reason
 * into whatever it tells the owner. An unqualified profile is not an error — it
 * is the normal state of a backend nobody has run the fixtures against — and the
 * correct response to it is prepared assistance, not a launch.
 *
 * @param {ReturnType<typeof finalizeProfile>} profile
 * @param {{strictBoundRequired?:boolean, requireConfinement?:boolean}} [need]
 */
export function admitProfile(profile, need = {}) {
  const refusals = [];
  if (!profile.qualified) {
    refusals.push({
      code: "profile-unqualified",
      detail: profile.unverifiedControls.length
        ? "unverified controls: " + profile.unverifiedControls.join(", ")
        : "no qualification reference",
    });
  }
  if (need.requireConfinement !== false) {
    for (const id of ["filesystem.outsideScratchWrite", "filesystem.hostSecretRead", "store.workerAccess"]) {
      const control = profile.controls.find((entry) => entry.id === id);
      if (!control || !control.verified || control.state !== "supported") {
        refusals.push({ code: "confinement-unproven", detail: id });
      }
    }
  }
  if (need.strictBoundRequired && !profile.resources.strictBound) {
    refusals.push({ code: "strict-bound-unavailable", detail: profile.resources.strictBoundRefusalReason });
  }
  return deepFreeze({
    admitted: refusals.length === 0,
    refusals: Object.freeze(refusals),
    profile_id: profile.profile_id,
    // Carried so an admission cannot be used to authorize a dispatch to a
    // *different* backend. With more than one executor selectable, "this profile
    // is admitted" and "this profile describes the backend we are about to call"
    // became two separate facts, and admitJob checks the pairing.
    backend_id: profile.backend_id,
  });
}

/**
 * Assert an object really implements the whole boundary.
 *
 * Cheap, and it exists because a partially implemented adapter is the failure
 * that shows up as a `TypeError` three layers into a dispatch, after the
 * reservation has been taken.
 *
 * @param {Record<string, unknown>} adapter
 */
export function assertAdapterShape(adapter) {
  if (!adapter || typeof adapter !== "object") throw new ContractError("adapter must be an object");
  const missing = ADAPTER_OPERATIONS.filter((op) => typeof adapter[op] !== "function");
  if (missing.length) {
    throw new ContractError("adapter is missing required operations: " + missing.join(", "));
  }
  if (!isNonEmptyString(adapter.backend_id)) throw new ContractError("adapter must declare a backend_id");
  return adapter;
}
