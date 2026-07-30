// scripts/delivery/acceptance.mjs
// DLV-10: the acceptance-criteria coverage matrix — per-AC status with an
// evidence pointer, reconciled by the RUNNER rather than asserted by the agent.
//
// The failure this exists to make impossible: in BUD-11 the build log said
// "✅ COMPLETED" and "Perfect!" while `validation-report.md` recorded a red
// typecheck with ~48 errors, and ACs 6/7/8 were simply never done — with
// nothing anywhere recording that. AC status lived only in prose written by the
// party being graded.
//
// The rule here is therefore not "believe the agent" or "ignore the agent", but
// "the agent may CLAIM, the runner CONFIRMS": a claim of `met` survives only if
// its evidence resolves against something the runner itself owns — a file that
// exists, a file this session actually changed, or a validation rung the runner
// recorded as passing. Everything else stays `unmet`, and a `met` claim made
// while validation is red becomes `failed`, which is the specific lie BUD-11
// told.
//
// Zero-dependency and pure: the caller supplies the filesystem/validation
// facts, this module never reads them itself.

export const AC_STATUSES = Object.freeze(["unmet", "met", "waived", "failed"]);

/**
 * One row of the coverage matrix.
 * @typedef {{id:string, text:string, status:string, evidence:(string|null),
 *   evidenceKind:(string|null), updatedBy:(string|null), updatedAt:string,
 *   note:(string|null)}} AcceptanceRow
 */
/**
 * What a turn asserts about one criterion. `status` and `evidence` are both
 * optional because a malformed or partial claim is a case this module must
 * handle, not one it may assume away.
 * `evidence` is nullable, not merely optional: the VALIDATING re-check feeds
 * existing rows back in as claims, and a row that was never evidenced carries
 * an explicit `null`.
 * @typedef {{id:string, status?:(string|null), evidence?:(string|null), note?:(string|null)}} AcceptanceClaim
 */
/**
 * The runner-owned facts a claim is checked against.
 * @typedef {{turnId?:(string|null), validationPassed?:boolean, changedFiles?:string[],
 *   fileExists?:((p:string)=>boolean), passingRungs?:string[], at?:string}} AcceptanceFacts
 */

/** Statuses that satisfy the UAT_READY precondition. */
const SATISFIED = Object.freeze(new Set(["met", "waived"]));

/** Validation rung names, plus the plural forms an agent naturally writes. */
const RUNG_ALIASES = Object.freeze({
  test: "test",
  tests: "test",
  typecheck: "typecheck",
  types: "typecheck",
  lint: "lint",
});

/**
 * Seed the matrix from the spec's acceptance criteria. Called at spec approval,
 * where the AC list becomes final (and, after DLV-7, possibly narrowed to one
 * decomposition slice).
 * Malformed entries (no id, or null) are dropped rather than rejected, so the
 * parameter type reflects what callers really pass — spec output that has not
 * been validated field-by-field.
 * @param {({id?:string, text?:string}|null|undefined)[]} acceptanceCriteria
 * @param {{at?:string}} [opts]
 * @returns {AcceptanceRow[]}
 */
export function initAcceptance(acceptanceCriteria = [], { at = new Date().toISOString() } = {}) {
  return (acceptanceCriteria || [])
    .filter((ac) => ac && typeof ac.id === "string" && ac.id)
    .map((ac) => ({
      id: ac.id,
      text: typeof ac.text === "string" ? ac.text : "",
      status: "unmet",
      evidence: null,
      evidenceKind: null,
      updatedBy: null,
      updatedAt: at,
      note: null,
    }));
}

/**
 * Resolve one evidence string against facts the runner owns.
 * @param {string} evidence
 * @param {{changedFiles?:string[], fileExists?:(p:string)=>boolean, passingRungs?:string[]}} facts
 * @returns {{ok:boolean, kind:(string|null)}}
 */
export function resolveEvidence(evidence, facts = {}) {
  if (typeof evidence !== "string" || !evidence.trim()) return { ok: false, kind: null };
  const value = evidence.trim();

  const rung = RUNG_ALIASES[value.toLowerCase()];
  if (rung) {
    // A rung only counts while it actually passed *in this session's own
    // validation run*. This is the whole point: "the tests prove it" is
    // evidence exactly when the runner watched the tests pass, and is worth
    // nothing when it watched them fail.
    return { ok: (facts.passingRungs || []).includes(rung), kind: "validation" };
  }

  const normalized = value.replace(/\\/g, "/");
  // Strip a `path:line` suffix — the house convention for citing code.
  const pathOnly = normalized.replace(/:\d+(?:-\d+)?$/, "");
  const changed = (facts.changedFiles || []).map((p) => String(p).replace(/\\/g, "/"));
  if (changed.includes(pathOnly)) return { ok: true, kind: "diff" };
  if (typeof facts.fileExists === "function" && facts.fileExists(pathOnly)) return { ok: true, kind: "file" };
  return { ok: false, kind: null };
}

/**
 * Reconcile agent-claimed AC statuses against the runner's own facts.
 *
 * Claims are only ever *downgraded* by this function, never invented: an AC the
 * agent said nothing about keeps whatever status it already had.
 *
 * @param {AcceptanceRow[]} matrix
 * @param {AcceptanceClaim[]} claims
 * @param {AcceptanceFacts} facts
 * @returns {{matrix:AcceptanceRow[], downgraded:{id:string, claimed:string, actual:string, reason:string}[]}}
 */
export function reconcileAcceptance(matrix, claims = [], facts = {}) {
  const at = facts.at || new Date().toISOString();
  const byId = new Map((claims || []).filter((c) => c && typeof c.id === "string").map((c) => [c.id, c]));
  const downgraded = [];

  const next = (matrix || []).map((row) => {
    const claim = byId.get(row.id);
    if (!claim) return row;
    // A waiver is an owner act (see `waiveAcceptance`), never an agent claim —
    // an agent that could waive its own criteria has no criteria.
    const claimed = claim.status === "met" ? "met" : claim.status === "failed" ? "failed" : "unmet";
    const base = { ...row, updatedBy: facts.turnId || row.updatedBy, updatedAt: at, note: claim.note || row.note };

    if (claimed !== "met") {
      return { ...base, status: claimed, evidence: claim.evidence || null, evidenceKind: null };
    }

    if (facts.validationPassed === false) {
      downgraded.push({ id: row.id, claimed: "met", actual: "failed", reason: "validation did not pass" });
      return { ...base, status: "failed", evidence: claim.evidence || null, evidenceKind: null };
    }
    const resolved = resolveEvidence(claim.evidence, facts);
    if (!resolved.ok) {
      downgraded.push({
        id: row.id,
        claimed: "met",
        actual: "unmet",
        reason: claim.evidence ? `evidence "${claim.evidence}" did not resolve` : "no evidence pointer supplied",
      });
      return { ...base, status: "unmet", evidence: claim.evidence || null, evidenceKind: null };
    }
    return { ...base, status: "met", evidence: claim.evidence, evidenceKind: resolved.kind };
  });

  return { matrix: next, downgraded };
}

/**
 * Owner-authored waiver, audited. `ids` empty/omitted waives every unsatisfied row.
 * @param {AcceptanceRow[]} matrix
 * @param {(string[]|null)} [ids]
 * @param {{note?:(string|null), at?:string}} [opts]
 * @returns {AcceptanceRow[]}
 */
export function waiveAcceptance(matrix, ids = null, { note = null, at = new Date().toISOString() } = {}) {
  const wanted = ids && ids.length ? new Set(ids) : null;
  return (matrix || []).map((row) => {
    if (SATISFIED.has(row.status)) return row;
    if (wanted && !wanted.has(row.id)) return row;
    return { ...row, status: "waived", note: note || row.note, updatedBy: "owner", updatedAt: at };
  });
}

/**
 * Ids that still block UAT_READY.
 * @param {AcceptanceRow[]} matrix
 * @returns {string[]}
 */
export function unsatisfiedAcceptance(matrix) {
  return (matrix || []).filter((row) => !SATISFIED.has(row.status)).map((row) => row.id);
}

/**
 * @param {AcceptanceRow[]} matrix
 * @returns {boolean}
 */
export function isAcceptanceComplete(matrix) {
  // An empty matrix is complete: a session whose spec declared no ACs has
  // nothing to prove, and inventing a blocker there would strand it.
  return unsatisfiedAcceptance(matrix).length === 0;
}

/**
 * Counts for the session header / fleet metrics.
 * @param {AcceptanceRow[]} matrix
 * @returns {{total:number, met:number, waived:number, unmet:number, failed:number}}
 */
export function summarizeAcceptance(matrix) {
  const summary = { total: (matrix || []).length, met: 0, waived: 0, unmet: 0, failed: 0 };
  for (const row of matrix || []) {
    if (summary[row.status] !== undefined) summary[row.status] += 1;
  }
  return summary;
}

const STATUS_LABEL = Object.freeze({ met: "MET", waived: "WAIVED", unmet: "UNMET", failed: "FAILED" });

/**
 * Owner-facing matrix, rendered so a failed or unevidenced AC cannot read as a pass.
 * @param {AcceptanceRow[]} matrix
 * @returns {string}
 */
export function renderAcceptanceMd(matrix) {
  if (!matrix || !matrix.length) return "# Acceptance criteria\n\n(The spec declared no acceptance criteria.)\n";
  const rows = matrix.map((row) => {
    const evidence = row.evidence ? `\`${row.evidence}\`${row.evidenceKind ? ` (${row.evidenceKind})` : ""}` : "—";
    return `| ${row.id} | ${STATUS_LABEL[row.status] || row.status} | ${evidence} | ${row.text.replace(/\|/g, "\\|")} |`;
  });
  const s = summarizeAcceptance(matrix);
  return [
    "# Acceptance criteria",
    "",
    `${s.met} met · ${s.waived} waived · ${s.unmet} unmet · ${s.failed} failed (of ${s.total})`,
    "",
    "| AC | Status | Evidence | Criterion |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}
