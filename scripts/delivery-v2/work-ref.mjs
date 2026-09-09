// scripts/delivery-v2/work-ref.mjs
// PM Delivery V2 — S0.1: select and freeze one item.
//
// Resolves a selected Markdown checklist row into a stable WorkRef and an
// immutable Contract revision, and refuses rather than guesses when the source
// is ambiguous or has moved on. Implements invariant V2-I01 ("selection binds
// stable work identity and the intended source revision; ordinals and guessed
// aliases never launch work") from "PM Delivery — V2 Architecture.md" §3, and the
// F-ID fixture family from "PM Delivery — Evidence & Autonomy.md" §9.
//
// Reuse, and the one thing deliberately not reused
// ------------------------------------------------
// The Markdown scanner (scripts/pm/shared/md-scan.mjs) and the checklist grammar
// reader (scripts/pm/shared/tasks.mjs) are correct and are imported as-is, so V2
// and the PM dashboard cannot disagree about what a checklist row *is*. What is
// not carried over is the *authority* the checkbox ordinal has in V1:
// scripts/pm/mutations.mjs and scripts/delivery/packet.mjs both address an item
// as (file, cbidx), and Diagnosis D01 is the consequence — a row prepended above
// the selection takes over its ordinal, so a stale toggle or a launch hits the
// wrong item with no error at all.
//
// Here an ordinal is only ever an *input from the click* and an *observation of
// where the row was found*. Nothing resolves through it. That single change is
// most of what S0.1 exists to establish.
//
// Pure: takes raw markdown text, returns records. No fs, no clock, no mutation of
// the source.

import { scanLines } from "../pm/shared/md-scan.mjs";
import { parseTaskMeta } from "../pm/shared/tasks.mjs";
import {
  ContractError,
  RESOLUTION_REASONS,
  authorizeContract,
  contractFreshness,
  criterionRef,
  deepFreeze,
  fingerprint,
  makeLocator,
  makeWorkRef,
  normalizePath,
  normalizeSourceText,
} from "./contracts.mjs";

/**
 * @typedef {object} WorkItem
 * @property {(string|null)} alias human ID chip, uppercased; null when the row has none
 * @property {string} text display text with inline markdown cleaned
 * @property {string} rest raw line content after the checkbox marker
 * @property {string} textFingerprint fingerprint of the normalized raw content
 * @property {(string|null)} severity
 * @property {(string|null)} effort
 * @property {string} section nearest preceding heading
 * @property {string} state "open" | "done"
 * @property {number} line 0-based source line, an observation only
 * @property {number} cbidx checkbox ordinal, an observation only
 */

/**
 * Read every checklist row in a markdown file.
 *
 * The fingerprint is taken over the *raw* row content rather than the cleaned
 * display text, so a formatting-only edit still counts as an edit. Conservative
 * on purpose: the cost of a false "stale" is one re-read, and the cost of a false
 * "fresh" is a contract frozen against text the owner has since changed.
 *
 * The checkbox state is excluded from the fingerprint, so ticking or unticking a
 * row does not stale its contract — and, unlike D01, state is never part of how a
 * row is found either.
 *
 * @param {string} raw
 * @returns {WorkItem[]}
 */
export function parseWorkItems(raw) {
  let section = "";
  /** @type {WorkItem[]} */
  const items = [];
  for (const line of scanLines(raw).lines) {
    if (line.type === "heading") {
      section = String(line.text || "");
      continue;
    }
    if (line.type !== "checkbox") continue;
    const meta = parseTaskMeta(line.rest);
    const rest = String(line.rest || "");
    items.push({
      alias: meta.idChip ? String(meta.idChip).toUpperCase() : null,
      text: meta.text,
      rest,
      textFingerprint: fingerprint(normalizeSourceText(rest)),
      severity: meta.severity,
      effort: meta.effort,
      section,
      state: line.state,
      line: line.line,
      cbidx: line.cbidx,
    });
  }
  return items;
}

/**
 * @typedef {object} SelectionOutcome
 * @property {boolean} ok
 * @property {(string|null)} reason one of RESOLUTION_REASONS
 * @property {(import("./contracts.mjs").SourceLocator|null)} locator
 * @property {(WorkItem|null)} item
 * @property {WorkItem[]} candidates rows that matched ambiguously, for the owner to disambiguate
 */

/** @returns {SelectionOutcome} */
function selectionFailure(reason, candidates = []) {
  return deepFreeze({ ok: false, reason, locator: null, item: null, candidates });
}

/**
 * Turn what the owner clicked into a locator that no longer depends on the click.
 *
 * A checkbox ordinal is accepted here because it is genuinely how the existing PM
 * surface reports a selection — and it is spent immediately: the returned locator
 * carries file, alias and text fingerprint, and never the ordinal. An out-of-range
 * ordinal refuses instead of clamping.
 *
 * @param {{raw:string, file:string, cbidx:number}} input
 * @returns {SelectionOutcome}
 */
export function selectWorkItem({ raw, file, cbidx }) {
  if (!file || typeof file !== "string") return selectionFailure(RESOLUTION_REASONS.BAD_LOCATOR);
  const items = parseWorkItems(raw);
  if (!Number.isInteger(cbidx) || cbidx < 0 || cbidx >= items.length) {
    return selectionFailure(RESOLUTION_REASONS.OUT_OF_RANGE);
  }
  const item = items[cbidx];
  // Selecting a row whose alias is shared with another row is already ambiguous:
  // binding it now would produce a locator that can never be re-resolved.
  if (item.alias && items.filter((other) => other.alias === item.alias).length > 1) {
    return selectionFailure(
      RESOLUTION_REASONS.AMBIGUOUS_ALIAS,
      items.filter((other) => other.alias === item.alias),
    );
  }
  const locator = makeLocator({
    file,
    alias: item.alias,
    textFingerprint: item.textFingerprint,
    heading: item.section || null,
  });
  return deepFreeze({ ok: true, reason: null, locator, item, candidates: [] });
}

/**
 * @typedef {object} ResolutionOutcome
 * @property {boolean} ok
 * @property {(string|null)} reason
 * @property {(import("./contracts.mjs").WorkRef|null)} workRef
 * @property {(WorkItem|null)} observation where the row is *now*, including its current ordinal
 * @property {WorkItem[]} candidates
 */

/** @returns {ResolutionOutcome} */
function resolutionFailure(reason, candidates = [], observation = null) {
  return deepFreeze({ ok: false, reason, workRef: null, observation, candidates });
}

/**
 * Re-resolve a locator against current file content.
 *
 * Deterministic and idempotent: identical content in, identical WorkRef out,
 * including its mapping revision. Nothing about the caller's timing, the row's
 * position or its checkbox state can change the answer.
 *
 * Refusals, in the order they are checked:
 *   - the alias names two rows  -> ambiguous-alias   (never pick one)
 *   - the alias names no row    -> not-found
 *   - the alias' row was edited -> stale-source      (successor revision owed)
 *   - no alias, and the text now appears twice -> ambiguous-text
 *
 * @param {{raw:string, locator:import("./contracts.mjs").SourceLocator}} input
 * @returns {ResolutionOutcome}
 */
export function resolveWorkRef({ raw, locator }) {
  if (!locator || !locator.file || !locator.textFingerprint) {
    return resolutionFailure(RESOLUTION_REASONS.BAD_LOCATOR);
  }
  const items = parseWorkItems(raw);

  if (locator.alias) {
    const byAlias = items.filter((item) => item.alias === locator.alias);
    if (byAlias.length > 1) return resolutionFailure(RESOLUTION_REASONS.AMBIGUOUS_ALIAS, byAlias);
    if (byAlias.length === 0) return resolutionFailure(RESOLUTION_REASONS.NOT_FOUND);
    const found = byAlias[0];
    if (found.textFingerprint !== locator.textFingerprint) {
      // The alias still points at a row, but not the row that was authorized.
      // This is a supersession obligation, not a resolution — see reviseContract.
      return resolutionFailure(RESOLUTION_REASONS.STALE_SOURCE, [found], found);
    }
    return deepFreeze({ ok: true, reason: null, workRef: makeWorkRef(locator), observation: found, candidates: [] });
  }

  const byText = items.filter((item) => item.textFingerprint === locator.textFingerprint);
  if (byText.length > 1) return resolutionFailure(RESOLUTION_REASONS.AMBIGUOUS_TEXT, byText);
  if (byText.length === 0) return resolutionFailure(RESOLUTION_REASONS.NOT_FOUND);
  return deepFreeze({ ok: true, reason: null, workRef: makeWorkRef(locator), observation: byText[0], candidates: [] });
}

/**
 * Select and freeze in one step: click -> WorkRef -> immutable Contract revision.
 *
 * The requested disposition is supplied by the caller and copied verbatim into
 * the Contract. There is no inference step that could quietly turn a request for
 * a deployed fix into a candidate-only promise because a candidate is all the
 * current policy can produce; what the executor can reach is a Grant/result
 * question, and Contract.requestedDisposition is not where it is answered.
 *
 * @param {{raw:string, file:string, cbidx:number, outcome?:string,
 *   requestedDisposition:string, criteria?:import("./contracts.mjs").Criterion[],
 *   scratchScope:Record<string, unknown>,
 *   publicationScope:{allowedPaths?:string[], changeConstraints?:Record<string, unknown>},
 *   exclusions?:string[], policy_refs?:string[], authorized_at?:(string|null)}} input
 */
export function freezeSelectedItem({
  raw,
  file,
  cbidx,
  outcome,
  requestedDisposition,
  criteria = [],
  scratchScope,
  publicationScope,
  exclusions = [],
  policy_refs = [],
  authorized_at = null,
}) {
  const selection = selectWorkItem({ raw, file, cbidx });
  if (!selection.ok || !selection.locator || !selection.item) {
    return deepFreeze({ ok: false, reason: selection.reason, workRef: null, contract: null, item: null });
  }
  const workRef = makeWorkRef(selection.locator);
  const contract = authorizeContract({
    work_id: workRef.work_id,
    source_fingerprint: workRef.source_fingerprint,
    outcome: outcome && outcome.trim() ? outcome : selection.item.text,
    exclusions,
    scratchScope,
    publicationScope,
    criteria_refs: criteria.map(criterionRef),
    requestedDisposition,
    policy_refs,
    authorized_at,
  });
  return deepFreeze({ ok: true, reason: null, workRef, contract, item: selection.item });
}

/**
 * Re-read the bound source and report what the contract now owes.
 *
 * Three distinguishable answers, and none of them is "launch anyway":
 *   - resolved + fresh   -> the contract still describes the source
 *   - resolved + stale   -> successor-revision-required
 *   - unresolved         -> the refusal reason, with candidates when ambiguous
 *
 * @param {{raw:string, workRef:import("./contracts.mjs").WorkRef,
 *   contract:import("./contracts.mjs").Contract}} input
 */
export function recheckContractSource({ raw, workRef, contract }) {
  if (contract.work_id !== workRef.work_id) {
    throw new ContractError("contract " + contract.contract_id + " does not belong to work " + workRef.work_id);
  }
  const resolution = resolveWorkRef({ raw, locator: workRef.locator });
  if (!resolution.ok) {
    return deepFreeze({
      resolved: false,
      reason: resolution.reason,
      candidates: resolution.candidates,
      freshness: resolution.observation
        ? contractFreshness(contract, resolution.observation.textFingerprint)
        : null,
    });
  }
  return deepFreeze({
    resolved: true,
    reason: null,
    candidates: [],
    observation: resolution.observation,
    freshness: contractFreshness(contract, resolution.observation.textFingerprint),
  });
}

/** Convenience for callers that hold a PM-relative path in either separator style. */
export const workFilePath = normalizePath;
