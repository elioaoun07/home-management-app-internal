// scripts/delivery-v2/contracts.mjs
// PM Delivery V2 — the single authoritative schema module.
//
// Slice S0.1/S0.2 of "ERA Notes/10 - Project Management/Autonomous Delivery/
// PM Delivery — Execution Portfolio.md". The canonical record names, enums and
// lifecycle semantics come from "PM Delivery — V2 Architecture.md" §4/§5, and the
// criterion/evidence contract from "PM Delivery — Evidence & Autonomy.md" §2/§5.
// Nothing here invents a second vocabulary: if a value is not in those two
// documents it is not an enum here.
//
// Why one module: Architecture §1 requires new authoritative schemas to live in
// one place and be reused at entry/projection boundaries. V1's failure mode (D11)
// was several files each holding a slightly different opinion about the same
// fact. work-ref.mjs, criteria.mjs and baseline.mjs all construct their records
// through this file and never redeclare a shape.
//
// Pure and side-effect free: no fs, no clock, no randomness. Every identifier is
// derived from content, so re-reading identical source yields identical records
// (Portfolio S0.1 "Done": deterministic selection/contract output).

import { createHash } from "node:crypto";

export class ContractError extends Error {}

// ---------------------------------------------------------------------------
// Canonical enums (Architecture §5)
// ---------------------------------------------------------------------------

/** What the owner asked to exist at the end. Never rewritten to fit capability. */
export const REQUESTED_DISPOSITIONS = Object.freeze([
  "research",
  "verified_candidate",
  "applied_change",
  "verified_deployment",
]);

/** What has actually been established. "none" until something is observed. */
export const OBSERVED_DISPOSITIONS = Object.freeze(["none", ...REQUESTED_DISPOSITIONS]);

export const RUN_LIFECYCLE = Object.freeze(["DRAFT", "ACTIVE", "WAITING", "CLOSED"]);
export const CLOSED_OUTCOMES = Object.freeze(["verified_candidate", "useful_partial", "failed", "cancelled"]);
export const JOB_STATUS = Object.freeze(["reserved", "active", "paused", "finished", "unknown"]);
export const JOB_OUTCOMES = Object.freeze(["succeeded", "failed", "cancelled"]);
export const CANDIDATE_KINDS = Object.freeze(["code", "research"]);

/** Evidence & Autonomy §5. "waived" is a limitation the owner accepted, never a pass. */
export const EVIDENCE_STATES = Object.freeze([
  "missing",
  "satisfied",
  "failed",
  "inconclusive",
  "stale",
  "waived",
]);

/** Which claim a criterion carries (Evidence & Autonomy §2, required_for). */
export const CRITERION_REQUIRED_FOR = Object.freeze(["candidate", "disposition", "both"]);

/**
 * Observation kinds, one row per line of the Evidence & Autonomy §3 eligibility
 * table. The kind is what makes an observation *eligible*; it is deliberately
 * not a quality ranking, and there is no subsumption ladder — a stronger-sounding
 * kind does not silently satisfy a criterion that asked for another one.
 */
export const OBSERVATION_KINDS = Object.freeze([
  "source_match", // text/structure present in identified source
  "diff", // complete base-to-candidate transformation
  "command", // actual compiler/test process execution
  "interaction", // mounted/browser action with observed values
  "screenshot", // appearance under a named viewport/theme/build
  "attributed", // owner/device observation attributed to a person and scenario
  "research", // source-backed report with verified citations
]);

/** Why a criterion is not satisfied. Callers and tests match on codes, not prose. */
export const EVIDENCE_REASONS = Object.freeze({
  NO_OBSERVATION: "no-observation",
  FORBIDDEN_SUBSTITUTE: "forbidden-substitute",
  INELIGIBLE_OBSERVER: "ineligible-observer",
  STALE_INPUT: "stale-input",
  MALFORMED: "malformed-observation",
  INTERRUPTED: "interrupted-observation",
  ZERO_EXECUTED: "zero-executed",
  NONZERO_EXIT: "nonzero-exit",
  VALUE_MISMATCH: "value-mismatch",
  SURPLUS_CHANGE: "surplus-change",
  UNDECLARED_FILE: "undeclared-file",
  SCOPE_VIOLATION: "scope-violation",
  DECLARED_CHANGE_MISSING: "declared-change-missing",
  NO_CHANGES: "no-changes",
  UNATTRIBUTED: "unattributed-observation",
});

/** Why a selection could not be resolved (Architecture §4, invariant V2-I01). */
export const RESOLUTION_REASONS = Object.freeze({
  NOT_FOUND: "not-found",
  AMBIGUOUS_ALIAS: "ambiguous-alias",
  AMBIGUOUS_TEXT: "ambiguous-text",
  STALE_SOURCE: "stale-source",
  BAD_LOCATOR: "bad-locator",
  OUT_OF_RANGE: "out-of-range",
});

// ---------------------------------------------------------------------------
// Content addressing
// ---------------------------------------------------------------------------

/** Recursively sorted JSON — two structurally equal values always serialize identically. */
export function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ContractError("canonicalJson cannot encode a non-finite number");
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new ContractError("canonicalJson cannot encode " + typeof value);
  }
  return JSON.stringify(value);
}

/** "sha256:<hex>" over a string. The prefix keeps the algorithm visible in stored records. */
export function fingerprint(text) {
  return "sha256:" + createHash("sha256").update(String(text == null ? "" : text), "utf8").digest("hex");
}

/** Content-derived identifier: "<prefix>-<12 hex>" of the canonical encoding. */
export function contentId(prefix, value) {
  const hex = createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
  return prefix + "-" + hex.slice(0, 12);
}

/**
 * Collapse a source line to the form its fingerprint is taken over.
 *
 * Whitespace only. Markdown is deliberately NOT stripped: a contract is frozen
 * against the bytes the owner actually wrote, and a "harmless" reformat is
 * exactly the kind of change that should force a re-read rather than silently
 * keep an old authorization alive (Architecture §4, Evidence & Autonomy §5).
 */
export function normalizeSourceText(text) {
  return String(text == null ? "" : text).replace(/\s+/gu, " ").trim();
}

/**
 * Freeze an object graph so an authorized record cannot be edited in place.
 *
 * Generic rather than untyped so the frozen record keeps its shape downstream:
 * an authoritative record that degrades to `any` on its way out of a constructor
 * takes every consumer's type checking with it.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepFreeze(value) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return value;
  // Binary payloads travel through records (artifact bytes, raw transcripts) and
  // cannot be frozen at all — `Object.freeze` throws on a typed array with
  // elements. Leaving them alone is correct rather than merely convenient: their
  // integrity is established by hash, which is a stronger guarantee than
  // immutability of the reference.
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  if (!Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) deepFreeze(value[key]);
  }
  return value;
}

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ContractError(field + " must be one of " + allowed.join("|") + ", got " + JSON.stringify(value));
  }
  return value;
}

function frozenList(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new ContractError(field + " must be an array");
  return Object.freeze([...value]);
}

/** Repo-relative path with forward slashes. Used everywhere a path is compared. */
export function normalizePath(path) {
  return String(path == null ? "" : path).replace(/\\/gu, "/").replace(/^\.\//u, "").trim();
}

// ---------------------------------------------------------------------------
// WorkRef (Architecture §4)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} SourceLocator
 * @property {string} file repo/PM-relative markdown file holding the intent
 * @property {(string|null)} alias human ID chip (BUD-14) — an alias, never authority
 * @property {string} textFingerprint fingerprint of the normalized item text
 * @property {(string|null)} heading section heading observed at selection, context only
 * @property {number} mappingRevision bumped only by an explicit rebind
 */

/**
 * Build the exact origin locator a WorkRef is resolved through.
 *
 * There is no ordinal in this record on purpose. A checkbox ordinal is how the
 * PM UI reports *what the owner clicked*, and D01 is what happens when it is
 * also allowed to be what the runner later looks up: a row inserted above the
 * selection silently retargets the work. The ordinal survives only as an
 * observation of where the item was found at a point in time.
 *
 * @param {{file:string, alias?:(string|null), textFingerprint:string,
 *   heading?:(string|null), mappingRevision?:number}} input
 * @returns {SourceLocator}
 */
export function makeLocator({ file, alias = null, textFingerprint, heading = null, mappingRevision = 1 }) {
  if (!isNonEmptyString(file)) throw new ContractError("locator.file is required");
  if (!isNonEmptyString(textFingerprint)) throw new ContractError("locator.textFingerprint is required");
  if (!Number.isInteger(mappingRevision) || mappingRevision < 1) {
    throw new ContractError("locator.mappingRevision must be a positive integer");
  }
  return deepFreeze({
    file: normalizePath(file),
    alias: isNonEmptyString(alias) ? alias.trim().toUpperCase() : null,
    textFingerprint,
    heading: isNonEmptyString(heading) ? heading.trim() : null,
    mappingRevision,
  });
}

/**
 * Derive the stable work identity for a locator.
 *
 * With an alias the identity is (file, alias), so reordering, retitling the
 * section or ticking the box all leave it untouched — that is the "stable across
 * an unambiguous move" clause. Without an alias the only stable handle is the
 * text itself, so identity is (file, textFingerprint) and an intent edit forces
 * re-resolution rather than guessing. A move between files is not unambiguous
 * and is not silently preserved.
 *
 * @param {SourceLocator} locator
 * @returns {string}
 */
export function deriveWorkId(locator) {
  return locator.alias
    ? contentId("w", { v: 1, file: locator.file, alias: locator.alias })
    : contentId("w", { v: 1, file: locator.file, textFingerprint: locator.textFingerprint });
}

/**
 * @typedef {object} WorkRef
 * @property {string} work_id
 * @property {SourceLocator} locator
 * @property {(string|null)} alias
 * @property {string} source_fingerprint
 * @property {number} mapping_revision
 */

/**
 * @param {SourceLocator} locator
 * @returns {WorkRef}
 */
export function makeWorkRef(locator) {
  return deepFreeze({
    work_id: deriveWorkId(locator),
    locator,
    alias: locator.alias,
    source_fingerprint: locator.textFingerprint,
    mapping_revision: locator.mappingRevision,
  });
}

/**
 * Point an existing work identity at a re-read locator, bumping the mapping
 * revision. This is the only way a WorkRef's bound source changes: resolution
 * itself never mutates one, so re-reading unchanged content is idempotent.
 *
 * @param {WorkRef} workRef
 * @param {SourceLocator} locator
 * @returns {WorkRef}
 */
export function rebindWorkRef(workRef, locator) {
  const next = makeLocator({ ...locator, mappingRevision: workRef.mapping_revision + 1 });
  const rebound = makeWorkRef(next);
  if (rebound.work_id !== workRef.work_id) {
    throw new ContractError(
      "rebind would change work identity (" + workRef.work_id + " -> " + rebound.work_id + "); resolve the ambiguity instead",
    );
  }
  return rebound;
}

// ---------------------------------------------------------------------------
// Criterion (Evidence & Autonomy §2)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Criterion
 * @property {string} criterion_id
 * @property {number} revision
 * @property {string} proposition
 * @property {Record<string, unknown>} scope
 * @property {{kind:string, expected:Record<string, unknown>}} observer
 * @property {string} oracle_ref
 * @property {readonly string[]} freshness_inputs
 * @property {string} required_for
 * @property {readonly string[]} forbidden_substitutes
 */

/**
 * @param {{criterion_id:string, revision?:number, proposition:string,
 *   scope:Record<string, unknown>, observer:{kind:string, expected?:Record<string, unknown>},
 *   oracle_ref:string, freshness_inputs:readonly string[], required_for?:string,
 *   forbidden_substitutes?:readonly string[]}} input
 * @returns {Criterion}
 */
export function makeCriterion({
  criterion_id,
  revision = 1,
  proposition,
  scope,
  observer,
  oracle_ref,
  freshness_inputs,
  required_for = "candidate",
  forbidden_substitutes = [],
}) {
  if (!isNonEmptyString(criterion_id)) throw new ContractError("criterion_id is required");
  if (!Number.isInteger(revision) || revision < 1) throw new ContractError("criterion revision must be >= 1");
  if (!isNonEmptyString(proposition)) throw new ContractError("criterion.proposition is required");
  if (!isNonEmptyString(oracle_ref)) throw new ContractError("criterion.oracle_ref is required");
  if (!scope || typeof scope !== "object") throw new ContractError("criterion.scope is required");
  if (!observer || typeof observer !== "object") throw new ContractError("criterion.observer is required");
  requireEnum(observer.kind, OBSERVATION_KINDS, "criterion.observer.kind");
  requireEnum(required_for, CRITERION_REQUIRED_FOR, "criterion.required_for");
  const freshness = frozenList(freshness_inputs, "criterion.freshness_inputs");
  if (freshness.length === 0) {
    // A criterion with no freshness inputs can never go stale, which is how a
    // C1 observation ends up certifying C2 (Evidence & Autonomy §5).
    throw new ContractError("criterion.freshness_inputs must name at least one input");
  }
  for (const substitute of forbidden_substitutes || []) {
    requireEnum(substitute, OBSERVATION_KINDS, "criterion.forbidden_substitutes[]");
  }
  return deepFreeze({
    criterion_id,
    revision,
    proposition,
    scope: { ...scope },
    observer: { kind: observer.kind, expected: { ...(observer.expected || {}) } },
    oracle_ref,
    freshness_inputs: freshness,
    required_for,
    forbidden_substitutes: frozenList(forbidden_substitutes, "criterion.forbidden_substitutes"),
  });
}

/**
 * @param {Criterion} criterion
 * @returns {{criterion_id:string, revision:number}}
 */
export function criterionRef(criterion) {
  return Object.freeze({ criterion_id: criterion.criterion_id, revision: criterion.revision });
}

// ---------------------------------------------------------------------------
// Resource-policy basis (Context & Agent Model §7)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ResourceBasis
 * @property {string} unit
 * @property {(number|null)} reconciledBilled
 * @property {(number|null)} providerReported
 * @property {(number|null)} estimatedApiEquivalent
 * @property {(string|number|null)} subscriptionConsumption
 * @property {(number|null)} reserved
 * @property {readonly string[]} unknown
 * @property {string} enforcementProfile
 * @property {boolean} strictBound
 * @property {(string|null)} strictBoundRefusalReason
 */

/**
 * The four quantities the plan insists are never one number: reconciled billed
 * cost, provider-reported/list cost, estimated API-equivalent cost and
 * subscription consumption. "unknown" is a first-class list, not a zero.
 *
 * @param {{unit?:string, reconciledBilled?:(number|null), providerReported?:(number|null),
 *   estimatedApiEquivalent?:(number|null), subscriptionConsumption?:(string|number|null),
 *   reserved?:(number|null), unknown?:string[], enforcementProfile?:string,
 *   strictBound?:boolean, strictBoundRefusalReason?:(string|null)}} [input]
 * @returns {ResourceBasis}
 */
export function makeResourceBasis({
  unit = "usd",
  reconciledBilled = null,
  providerReported = null,
  estimatedApiEquivalent = null,
  subscriptionConsumption = null,
  reserved = null,
  unknown = [],
  enforcementProfile = "unqualified",
  strictBound = false,
  strictBoundRefusalReason = null,
} = {}) {
  if (strictBound && enforcementProfile === "unqualified") {
    // Context §7: the supervisor cannot manufacture a billing guarantee the
    // executor does not supply.
    throw new ContractError("strictBound cannot be claimed under an unqualified enforcement profile");
  }
  if (!strictBound && !isNonEmptyString(strictBoundRefusalReason)) {
    throw new ContractError("a non-strict resource basis must state why the strict bound is refused");
  }
  return deepFreeze({
    unit,
    reconciledBilled,
    providerReported,
    estimatedApiEquivalent,
    subscriptionConsumption,
    reserved,
    unknown: frozenList(unknown, "resourceBasis.unknown"),
    enforcementProfile,
    strictBound,
    strictBoundRefusalReason,
  });
}

// ---------------------------------------------------------------------------
// Contract (Architecture §4)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Contract
 * @property {string} contract_id
 * @property {string} work_id
 * @property {number} revision
 * @property {string} source_fingerprint
 * @property {string} outcome
 * @property {readonly string[]} exclusions
 * @property {Record<string, unknown>} scratchScope
 * @property {{allowedPaths:readonly string[], changeConstraints:Record<string, unknown>}} publicationScope
 * @property {readonly {criterion_id:string, revision:number}[]} criteria_refs
 * @property {string} requestedDisposition
 * @property {readonly string[]} policy_refs
 * @property {(string|null)} supersedes
 * @property {(string|null)} revision_reason
 * @property {(string|null)} owner_decision_ref
 * @property {(string|null)} authorized_at
 */

/**
 * Freeze one authorized Contract revision.
 *
 * contract_id is derived from the semantic content only — never from a clock —
 * so authorizing the same intent against the same source twice produces the same
 * identifier instead of two contracts that differ by microseconds. authorized_at
 * is carried alongside as an observation, outside the digest.
 *
 * source_fingerprint is the *selected item's* fingerprint, not the whole file's.
 * A whole-file hash would stale this contract every time an unrelated row in the
 * same checklist changed, which Migration §3 explicitly calls out as fiction.
 *
 * @param {{work_id:string, revision?:number, source_fingerprint:string, outcome:string,
 *   exclusions?:string[], scratchScope:Record<string, unknown>,
 *   publicationScope:{allowedPaths?:string[], changeConstraints?:Record<string, unknown>},
 *   criteria_refs?:{criterion_id:string, revision:number}[], requestedDisposition:string,
 *   policy_refs?:string[], supersedes?:(string|null), revision_reason?:(string|null),
 *   owner_decision_ref?:(string|null), authorized_at?:(string|null)}} input
 * @returns {Contract}
 */
export function authorizeContract({
  work_id,
  revision = 1,
  source_fingerprint,
  outcome,
  exclusions = [],
  scratchScope,
  publicationScope,
  criteria_refs = [],
  requestedDisposition,
  policy_refs = [],
  supersedes = null,
  revision_reason = null,
  owner_decision_ref = null,
  authorized_at = null,
}) {
  if (!isNonEmptyString(work_id)) throw new ContractError("contract.work_id is required");
  if (!Number.isInteger(revision) || revision < 1) throw new ContractError("contract.revision must be >= 1");
  if (!isNonEmptyString(source_fingerprint)) throw new ContractError("contract.source_fingerprint is required");
  if (!isNonEmptyString(outcome)) throw new ContractError("contract.outcome is required");
  if (!scratchScope || typeof scratchScope !== "object") throw new ContractError("contract.scratchScope is required");
  if (!publicationScope || typeof publicationScope !== "object") {
    throw new ContractError("contract.publicationScope is required");
  }
  requireEnum(requestedDisposition, REQUESTED_DISPOSITIONS, "contract.requestedDisposition");

  const allowedPaths = frozenList(publicationScope.allowedPaths, "publicationScope.allowedPaths").map(normalizePath);
  const changeConstraints = { ...(publicationScope.changeConstraints || {}) };
  const refs = criteria_refs.map((ref) => ({ criterion_id: ref.criterion_id, revision: ref.revision }));

  const semantic = {
    v: 1,
    work_id,
    revision,
    source_fingerprint,
    outcome,
    exclusions: [...exclusions].sort(),
    scratchScope,
    publicationScope: { allowedPaths, changeConstraints },
    criteria_refs: refs,
    requestedDisposition,
    policy_refs: [...policy_refs].sort(),
    supersedes,
  };

  return deepFreeze({
    contract_id: contentId("c", semantic),
    work_id,
    revision,
    source_fingerprint,
    outcome,
    exclusions: frozenList(exclusions, "contract.exclusions"),
    scratchScope: { ...scratchScope },
    publicationScope: { allowedPaths: Object.freeze(allowedPaths), changeConstraints },
    criteria_refs: Object.freeze(refs.map((ref) => Object.freeze({ ...ref }))),
    requestedDisposition,
    policy_refs: frozenList(policy_refs, "contract.policy_refs"),
    supersedes,
    revision_reason,
    owner_decision_ref,
    authorized_at,
  });
}

/**
 * Create the successor revision an intent edit obliges.
 *
 * The active Contract is immutable, so the only legal response to changed source
 * or changed intent is a new revision that names what it supersedes and why.
 *
 * requestedDisposition cannot move without an owner decision reference — in
 * either direction. Architecture §5 warns these are not a numeric ladder, so
 * there is no "downgrade" test to write here that would not be an invented
 * ordering; requiring an explicit owner decision for any change is the honest
 * rule, and it is what stops a candidate-only capability from quietly rewriting a
 * request for a deployed fix.
 *
 * @param {Contract} previous
 * @param {Partial<Contract> & {revision_reason:string}} changes
 * @returns {Contract}
 */
export function reviseContract(previous, changes) {
  if (!previous || !previous.contract_id) throw new ContractError("reviseContract requires the previous contract");
  if (!changes || !isNonEmptyString(changes.revision_reason)) {
    throw new ContractError("a successor revision must state revision_reason");
  }
  const nextDisposition = changes.requestedDisposition ?? previous.requestedDisposition;
  if (nextDisposition !== previous.requestedDisposition && !isNonEmptyString(changes.owner_decision_ref)) {
    throw new ContractError(
      "changing requestedDisposition requires owner_decision_ref; the original request is not rewritten to fit capability",
    );
  }
  return authorizeContract({
    work_id: previous.work_id,
    revision: previous.revision + 1,
    source_fingerprint: changes.source_fingerprint ?? previous.source_fingerprint,
    outcome: changes.outcome ?? previous.outcome,
    exclusions: changes.exclusions ? [...changes.exclusions] : [...previous.exclusions],
    scratchScope: changes.scratchScope ?? previous.scratchScope,
    publicationScope: changes.publicationScope ?? previous.publicationScope,
    criteria_refs: changes.criteria_refs ? [...changes.criteria_refs] : [...previous.criteria_refs],
    requestedDisposition: nextDisposition,
    policy_refs: changes.policy_refs ? [...changes.policy_refs] : [...previous.policy_refs],
    supersedes: previous.contract_id,
    revision_reason: changes.revision_reason,
    owner_decision_ref: changes.owner_decision_ref ?? null,
    authorized_at: changes.authorized_at ?? null,
  });
}

/**
 * Does the frozen contract still describe the source in front of us?
 *
 * Returns the obligation rather than a boolean, because "the item was edited" is
 * not an error — it is a supersession obligation the caller must discharge with
 * reviseContract before any further paid dispatch.
 *
 * @param {Contract} contract
 * @param {string} currentSourceFingerprint
 */
export function contractFreshness(contract, currentSourceFingerprint) {
  const fresh = contract.source_fingerprint === currentSourceFingerprint;
  return deepFreeze({
    fresh,
    obligation: fresh ? null : "successor-revision-required",
    boundFingerprint: contract.source_fingerprint,
    observedFingerprint: currentSourceFingerprint,
  });
}

// ---------------------------------------------------------------------------
// Disposition (Architecture §5, Evidence & Autonomy §6)
// ---------------------------------------------------------------------------

/**
 * What is still outstanding between what was asked for and what has been
 * established.
 *
 * There is no ladder arithmetic here: observed === requested is the only way a
 * requested disposition is met, and every criterion that carries the disposition
 * claim must be "satisfied" by eligible evidence. A "waived" criterion keeps the
 * limitation visible and never completes the disposition.
 *
 * @param {Contract} contract
 * @param {{observedDisposition?:string,
 *   criterionStates?:{criterion_id:string, required_for:string, state:string}[]}} [observed]
 */
export function dispositionObligations(contract, observed = {}) {
  const observedDisposition = observed.observedDisposition ?? "none";
  requireEnum(observedDisposition, OBSERVED_DISPOSITIONS, "observedDisposition");
  const states = observed.criterionStates || [];
  /** @type {Record<string, unknown>[]} */
  const outstanding = [];

  for (const entry of states) {
    if (entry.required_for !== "disposition" && entry.required_for !== "both") continue;
    if (entry.state !== "satisfied") {
      outstanding.push({ kind: "criterion", criterion_id: entry.criterion_id, state: entry.state });
    }
  }
  if (observedDisposition !== contract.requestedDisposition) {
    outstanding.push({
      kind: "disposition",
      requested: contract.requestedDisposition,
      observed: observedDisposition,
    });
  }

  return deepFreeze({
    requestedDisposition: contract.requestedDisposition,
    observedDisposition,
    satisfied: outstanding.length === 0,
    outstanding,
  });
}

// ---------------------------------------------------------------------------
// Checkpoint (Context & Agent Model §5) — added for S1.3
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Finding
 * @property {string} statement
 * @property {readonly string[]} source_refs
 * @property {(string|null)} reconsider_when
 */

/**
 * @typedef {object} Remaining
 * @property {string} ref criterion or question reference
 * @property {string} next_action
 * @property {string} resolver who or what can settle it
 */

/**
 * Build the compact portable handoff.
 *
 * Context §5's canonical field list, and nothing else. It is "a compact portable
 * handoff, not a mandatory seven-part dossier or transcript summary" — so there
 * is no place here for a phase, a narrative, a plan or a model's confidence.
 *
 * Two constraints are enforced rather than suggested, both from the same
 * sentence — "The engineer may draft findings and the next action. They remain
 * assertions with provenance; the supervisor binds references and authority":
 *
 *   - every finding must carry at least one source reference. A finding with no
 *     provenance is a claim, and storing claims as findings is how a successor
 *     inherits a hallucination as settled fact.
 *   - decision_refs must be references. They are "binding owner decisions from
 *     authoritative records, never reconstructed from model prose", so this
 *     accepts identifiers and refuses free text that merely describes a decision.
 *
 * @param {{run_id:string, contract_revision:number, created_at:string,
 *   source_manifest_ref:string, candidate_ref?:(string|null), decision_refs?:string[],
 *   findings?:{statement:string, source_refs:string[], reconsider_when?:(string|null)}[],
 *   remaining?:{ref:string, next_action:string, resolver:string}[],
 *   native_record_refs?:string[], next_action:string}} input
 */
export function makeCheckpoint({
  run_id,
  contract_revision,
  created_at,
  source_manifest_ref,
  candidate_ref = null,
  decision_refs = [],
  findings = [],
  remaining = [],
  native_record_refs = [],
  next_action,
}) {
  if (!isNonEmptyString(run_id)) throw new ContractError("checkpoint.run_id is required");
  if (!Number.isInteger(contract_revision)) throw new ContractError("checkpoint.contract_revision is required");
  if (!isNonEmptyString(created_at)) throw new ContractError("checkpoint.created_at is required");
  if (!isNonEmptyString(source_manifest_ref)) throw new ContractError("checkpoint.source_manifest_ref is required");
  if (!isNonEmptyString(next_action)) throw new ContractError("checkpoint.next_action is required");

  for (const ref of decision_refs) {
    if (!isNonEmptyString(ref) || /\s/u.test(ref.trim())) {
      throw new ContractError(
        "checkpoint.decision_refs must be references to authoritative records, not prose: " + JSON.stringify(ref),
      );
    }
  }

  const boundFindings = (findings || []).map((finding) => {
    if (!isNonEmptyString(finding.statement)) throw new ContractError("a finding needs a statement");
    const sources = frozenList(finding.source_refs, "finding.source_refs");
    if (sources.length === 0) {
      throw new ContractError(
        "finding without provenance: " + finding.statement + " — a finding with no source reference is a claim",
      );
    }
    return Object.freeze({
      statement: finding.statement,
      source_refs: sources,
      reconsider_when: finding.reconsider_when ?? null,
    });
  });

  const boundRemaining = (remaining || []).map((entry) => {
    if (!isNonEmptyString(entry.ref) || !isNonEmptyString(entry.next_action) || !isNonEmptyString(entry.resolver)) {
      throw new ContractError("every remaining item needs a ref, a next_action and a resolver");
    }
    return Object.freeze({ ref: entry.ref, next_action: entry.next_action, resolver: entry.resolver });
  });

  const semantic = {
    v: 1,
    run_id,
    contract_revision,
    source_manifest_ref,
    candidate_ref,
    decision_refs: [...decision_refs],
    findings: boundFindings,
    remaining: boundRemaining,
    native_record_refs: [...native_record_refs],
    next_action,
  };

  return deepFreeze({
    checkpoint_id: contentId("ckpt", semantic),
    run_id,
    contract_revision,
    created_at,
    source_manifest_ref,
    candidate_ref,
    decision_refs: frozenList(decision_refs, "checkpoint.decision_refs"),
    findings: Object.freeze(boundFindings),
    remaining: Object.freeze(boundRemaining),
    native_record_refs: frozenList(native_record_refs, "checkpoint.native_record_refs"),
    next_action,
  });
}

// ---------------------------------------------------------------------------
// Grant (Architecture §4) — added for S1.2
// ---------------------------------------------------------------------------

/** What a Grant may authorize. Naming them is what stops "it seemed implied". */
export const PERMITTED_EFFECTS = Object.freeze([
  "native_dispatch", // start / resume / repair / review a confined native job
  "protected_check", // run an approved observation on a frozen candidate
  "candidate_export", // freeze and hash the writer's output
  "record_disposition", // attribute an owner observation
  "publish", // apply or release — not granted by the initial FAST policy
]);

/** Why a Grant does not authorize the thing being asked. */
export const GRANT_REFUSALS = Object.freeze({
  REVOKED: "grant-revoked",
  EXPIRED: "grant-expired",
  CONTRACT_MOVED: "contract-revision-moved",
  EFFECT_NOT_PERMITTED: "effect-not-permitted",
  EXECUTOR_NOT_PERMITTED: "executor-not-permitted",
  ALLOWANCE_EXHAUSTED: "allowance-exhausted",
  POLICY_MOVED: "policy-revision-moved",
});

/**
 * @typedef {object} Grant
 * @property {string} grant_id
 * @property {string} contract_id
 * @property {number} contract_revision
 * @property {number} policy_revision
 * @property {readonly string[]} permitted_effects
 * @property {readonly string[]} permitted_executors qualified profile ids
 * @property {{unit:string, allowance:(number|null), strict:boolean}} resource_policy
 * @property {(string|null)} expires_at
 * @property {number} revocation_version 0 means never revoked
 * @property {(string|null)} actor
 * @property {readonly string[]} decision_refs
 */

/**
 * Authorize a Grant.
 *
 * The Grant, not the Contract, is where permission lives. That split is what lets
 * a Contract go on asking for `verified_deployment` while the current Grant
 * permits only a candidate export: the request stays intact, and the shortfall
 * shows up as an outstanding obligation rather than a quietly rewritten goal.
 *
 * `allowance: null` is permitted and means "no numeric ceiling is being claimed",
 * which is the honest state under a backend with no monetary reading. It is not
 * an infinite allowance, and a strict policy over it is refused outright — there
 * would be nothing to enforce.
 *
 * @param {{grant_id?:string, contract_id:string, contract_revision:number,
 *   policy_revision?:number, permitted_effects:string[], permitted_executors?:string[],
 *   resource_policy:{unit:string, allowance?:(number|null), strict?:boolean},
 *   expires_at?:(string|null), revocation_version?:number, actor?:(string|null),
 *   decision_refs?:string[]}} input
 * @returns {Grant}
 */
export function authorizeGrant({
  grant_id,
  contract_id,
  contract_revision,
  policy_revision = 1,
  permitted_effects,
  permitted_executors = [],
  resource_policy,
  expires_at = null,
  revocation_version = 0,
  actor = null,
  decision_refs = [],
}) {
  if (!isNonEmptyString(contract_id)) throw new ContractError("grant.contract_id is required");
  if (!Number.isInteger(contract_revision) || contract_revision < 1) {
    throw new ContractError("grant.contract_revision must be a positive integer");
  }
  if (!Array.isArray(permitted_effects) || permitted_effects.length === 0) {
    throw new ContractError("a grant with no permitted effects authorizes nothing; state the effects");
  }
  for (const effect of permitted_effects) requireEnum(effect, PERMITTED_EFFECTS, "grant.permitted_effects[]");
  if (!resource_policy || !isNonEmptyString(resource_policy.unit)) {
    throw new ContractError("grant.resource_policy must state its unit");
  }
  const allowance = resource_policy.allowance == null ? null : Number(resource_policy.allowance);
  const strict = Boolean(resource_policy.strict);
  if (strict && allowance == null) {
    throw new ContractError("a strict resource policy needs a numeric allowance; there is nothing to enforce otherwise");
  }
  const semantic = {
    v: 1,
    contract_id,
    contract_revision,
    policy_revision,
    permitted_effects: [...permitted_effects].sort(),
    permitted_executors: [...permitted_executors].sort(),
    resource_policy: { unit: resource_policy.unit, allowance, strict },
    expires_at,
  };
  return deepFreeze({
    grant_id: grant_id || contentId("g", semantic),
    contract_id,
    contract_revision,
    policy_revision,
    permitted_effects: frozenList([...permitted_effects].sort(), "grant.permitted_effects"),
    permitted_executors: frozenList([...permitted_executors].sort(), "grant.permitted_executors"),
    resource_policy: Object.freeze({ unit: resource_policy.unit, allowance, strict }),
    expires_at,
    revocation_version,
    actor,
    decision_refs: frozenList(decision_refs, "grant.decision_refs"),
  });
}

/**
 * Revoke a Grant.
 *
 * A version bump rather than a deletion, because the run's history has to keep
 * referring to the authority each job actually had. Architecture §7: cancellation
 * removes publication authority immediately at the supervisor, and a late result
 * from an already-dispatched job still cannot publish.
 *
 * @param {Grant} grant
 */
export function revokeGrant(grant) {
  return deepFreeze({ ...grant, revocation_version: grant.revocation_version + 1 });
}

/**
 * May this exact thing happen right now?
 *
 * Every check is against *current* state, which is the point: Context §6 requires
 * the same admission for a native resume, a repair, a successor engineer and a
 * separate reviewer, and Evidence & Autonomy §8 requires authority to be
 * revalidated on resume rather than inherited from the launch.
 *
 * `settled + reserved + next` is compared against the allowance, so an unresolved
 * reservation from an unknown job keeps blocking new paid work until someone
 * reconciles it. Deliberate: a job whose cost nobody knows is not free capacity.
 *
 * @param {Grant} grant
 * @param {{now?:string, contract?:Contract, executor_profile_id?:(string|null), effect:string,
 *   settled?:number, reserved?:number, nextJob?:(number|null), policy_revision?:(number|null),
 *   revoked?:boolean}} context
 */
export function evaluateGrant(grant, context) {
  const refusals = [];
  const add = (code, detail) => refusals.push({ code, detail });

  if (context.revoked || grant.revocation_version > 0) {
    add(GRANT_REFUSALS.REVOKED, "revocation_version=" + grant.revocation_version);
  }
  if (grant.expires_at && context.now && String(context.now) >= String(grant.expires_at)) {
    add(GRANT_REFUSALS.EXPIRED, "expired at " + grant.expires_at);
  }
  if (context.contract) {
    if (context.contract.contract_id !== grant.contract_id) {
      add(GRANT_REFUSALS.CONTRACT_MOVED, "grant is bound to " + grant.contract_id);
    } else if (context.contract.revision !== grant.contract_revision) {
      add(
        GRANT_REFUSALS.CONTRACT_MOVED,
        "grant authorizes revision " + grant.contract_revision + ", contract is at " + context.contract.revision,
      );
    }
  }
  if (context.policy_revision != null && context.policy_revision !== grant.policy_revision) {
    add(GRANT_REFUSALS.POLICY_MOVED, "policy moved to revision " + context.policy_revision);
  }
  if (!grant.permitted_effects.includes(context.effect)) {
    add(GRANT_REFUSALS.EFFECT_NOT_PERMITTED, context.effect);
  }
  if (
    context.executor_profile_id &&
    grant.permitted_executors.length > 0 &&
    !grant.permitted_executors.includes(context.executor_profile_id)
  ) {
    add(GRANT_REFUSALS.EXECUTOR_NOT_PERMITTED, context.executor_profile_id);
  }

  const allowance = grant.resource_policy.allowance;
  if (allowance != null) {
    const settled = Number(context.settled || 0);
    const reserved = Number(context.reserved || 0);
    const next = context.nextJob == null ? 0 : Number(context.nextJob);
    if (settled + reserved + next > allowance) {
      add(
        GRANT_REFUSALS.ALLOWANCE_EXHAUSTED,
        "settled " + settled + " + reserved " + reserved + " + next " + next + " exceeds allowance " + allowance,
      );
    }
  }

  return deepFreeze({
    permitted: refusals.length === 0,
    refusals: Object.freeze(refusals),
    grant_id: grant.grant_id,
    effect: context.effect,
  });
}
