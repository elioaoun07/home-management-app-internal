// scripts/delivery/memory.mjs
// The Delivery-owned memory ledger: durable requirements, constraints,
// decisions, and Q&A — independent of any provider's chat history. This is
// the L1 "structured Delivery memory" half of DW-1's transcript work (raw
// history) — see ERA Notes/10 - Project Management/Delivery Workspace/ (DW-5).
//
// Pure schema + updater functions only. File I/O (versioned writes to
// memory/ledger.json + memory/history/ledger-VVVV.json) lives in
// run-session.mjs, matching every other file in this module.
//
// Design point worth stating explicitly: decisions/constraints/requirements/
// questions are NEVER summarized away by later compaction work (DW-7) — this
// ledger is always sent in full to the model. Only free-flowing conversation
// narrative gets compacted; durable facts don't.

export class MemoryError extends Error {}

export const QUESTION_KINDS = Object.freeze(["blocking", "advisory"]);
export const QUESTION_STATUSES = Object.freeze(["open", "answered", "dismissed", "superseded"]);
export const QUESTION_SOURCES = Object.freeze(["agent", "owner"]);

/**
 * @typedef {{id:string, askedAt:string, phase:(string|null), source:string, text:string,
 *   kind:string, status:string, answer:({text:string,at:string,via:(string|null)}|null),
 *   evidence:(object|null)}} LedgerQuestion
 * @typedef {{v:1, rev:number, updatedAt:(string|null),
 *   objective:{itemText:(string|null), problem:(string|null), proposedBehavior:(string|null)},
 *   requirements:object[], constraints:object[], decisions:object[], questions:LedgerQuestion[],
 *   rejectedApproaches:object[], fileIndex:object[], testResults:object[], risks:object[],
 *   configHistory:object[], workspace:(object|null)}} Ledger
 */

/** A brand-new, empty ledger (memory/ledger.json's initial shape). @returns {Ledger} */
export function emptyLedger() {
  return {
    v: 1,
    rev: 0,
    updatedAt: null,
    objective: { itemText: null, problem: null, proposedBehavior: null },
    requirements: [],
    constraints: [],
    decisions: [],
    questions: [],
    rejectedApproaches: [],
    fileIndex: [],
    testResults: [],
    risks: [],
    configHistory: [],
    workspace: null,
  };
}

/** @param {Ledger} ledger @param {object} patch @returns {Ledger} */
function bump(ledger, patch, { now = () => new Date() } = {}) {
  return { ...ledger, ...patch, rev: (ledger.rev || 0) + 1, updatedAt: now().toISOString() };
}

/**
 * Seed the objective + requirements from a DISCOVERY-phase structured spec
 * (run-session.mjs's `parseSpecOutput` shape — `openQuestions` is
 * `{text}[]`, no id: the agent never invents ids). Also raises a blocking
 * question per `spec.openQuestions` entry, with a deterministic id
 * (`q-<turnId>-<i>`) the caller can thread into the state-machine's
 * `awaiting.questions` so the eventual answer can be matched back here.
 * @param {Ledger} ledger
 * @param {{itemText?:string, problem?:string, proposedBehavior?:string,
 *   acceptanceCriteria?:{id:string,text:string}[], openQuestions?:{text:string}[]}} spec
 * @param {{itemText?:string, turnId?:string, phase?:string, now?:()=>Date}} [ctx]
 * @returns {{ledger:Ledger, questionIds:string[]}}
 */
export function applySpec(ledger, spec, { itemText, turnId = null, phase = "DISCOVERY", now = () => new Date() } = {}) {
  const requirements = (spec.acceptanceCriteria || []).map((ac) => ({
    id: ac.id,
    text: ac.text,
    source: { artifact: "spec.json" },
  }));
  const questionIds = [];
  const newQuestions = (spec.openQuestions || []).map((entry, i) => {
    const id = `q-${turnId || ledger.rev}-${i}`;
    questionIds.push(id);
    return buildQuestion({
      id,
      askedAt: now().toISOString(),
      phase,
      source: "agent",
      text: entry.text,
      kind: "blocking",
      evidence: turnId ? { turnId, seq: null } : null,
    });
  });
  const nextLedger = bump(ledger, {
    objective: {
      itemText: itemText != null ? itemText : ledger.objective.itemText,
      problem: spec.problem != null ? spec.problem : ledger.objective.problem,
      proposedBehavior: spec.proposedBehavior != null ? spec.proposedBehavior : ledger.objective.proposedBehavior,
    },
    requirements,
    questions: [...ledger.questions, ...newQuestions],
  }, { now });
  return { ledger: nextLedger, questionIds };
}

/**
 * Record a PLAN phase's risk flags into the ledger's `risks` list.
 * @param {Ledger} ledger
 * @param {{riskFlags?:string[]}} plan
 * @returns {Ledger}
 */
export function applyPlan(ledger, plan, { now = () => new Date() } = {}) {
  const risks = (plan.riskFlags || []).map((flag) => ({ flag, status: "open" }));
  return bump(ledger, { risks }, { now });
}

/**
 * Append one gate/owner decision to the durable decisions ledger. `id` is
 * caller-assigned so it can match the decision file's own seq (traceable
 * both directions).
 * @param {Ledger} ledger
 * @param {{id:string, at?:string, gate:string, decision:string, note?:(string|null),
 *   typed?:boolean, source?:object, phase?:(string|null)}} entry
 * @returns {Ledger}
 */
export function applyDecision(ledger, entry, { now = () => new Date() } = {}) {
  if (!entry || !entry.gate || !entry.decision) throw new MemoryError("decision entry requires gate + decision");
  const record = {
    id: entry.id,
    at: entry.at || now().toISOString(),
    gate: entry.gate,
    decision: entry.decision,
    note: entry.note != null ? entry.note : null,
    typed: !!entry.typed,
    source: entry.source || null,
    phase: entry.phase != null ? entry.phase : null,
  };
  return bump(ledger, { decisions: [...ledger.decisions, record] }, { now });
}

/**
 * Append a config (model/effort/provider) change into `configHistory`.
 * @param {Ledger} ledger
 * @param {{at?:string, from:object, to:object, via?:string}} fields
 * @returns {Ledger}
 */
export function applyConfigChange(ledger, { at, from, to, via }, { now = () => new Date() } = {}) {
  return bump(ledger, {
    configHistory: [...ledger.configHistory, { at: at || now().toISOString(), from, to, via: via || null }],
  }, { now });
}

function buildQuestion({ id, askedAt, phase = null, source, text, kind, evidence = null }) {
  if (!id) throw new MemoryError("question.id is required");
  if (!QUESTION_SOURCES.includes(source)) throw new MemoryError(`unknown question source "${source}"`);
  if (!QUESTION_KINDS.includes(kind)) throw new MemoryError(`unknown question kind "${kind}"`);
  if (typeof text !== "string" || !text.trim()) throw new MemoryError("question.text is required");
  return { id, askedAt: askedAt, phase, source, text, kind, status: "open", answer: null, evidence };
}

/**
 * Raise a new question (blocking — from a DISCOVERY spec, handled by
 * `applySpec` — or advisory, from an owner `ask` control / agent aside).
 * @param {Ledger} ledger
 * @param {{id:string, phase?:(string|null), source:"agent"|"owner", text:string,
 *   kind:"blocking"|"advisory", evidence?:object}} question
 * @returns {Ledger}
 */
export function applyQuestionRaised(ledger, question, { now = () => new Date() } = {}) {
  const built = buildQuestion({ ...question, askedAt: question.askedAt || now().toISOString() });
  return bump(ledger, { questions: [...ledger.questions, built] }, { now });
}

/**
 * Answer a ledger-tracked question by id. Marks it `answered` and records
 * the answer text/timestamp/source. Throws if the id isn't found or the
 * question is already answered (answers are append-immutable — a changed
 * answer should raise a new question referencing the old one, not silently
 * overwrite it, so the history stays honest).
 * @param {Ledger} ledger
 * @param {{questionId:string, text:string, via?:string}} fields
 * @returns {Ledger}
 */
export function applyAnswer(ledger, { questionId, text, via }, { now = () => new Date() } = {}) {
  const idx = ledger.questions.findIndex((q) => q.id === questionId);
  if (idx === -1) throw new MemoryError(`no question with id "${questionId}"`);
  if (ledger.questions[idx].status === "answered") {
    throw new MemoryError(`question "${questionId}" is already answered`);
  }
  const at = now().toISOString();
  const questions = ledger.questions.slice();
  questions[idx] = { ...questions[idx], status: "answered", answer: { text, at, via: via || null } };
  return bump(ledger, { questions }, { now });
}

/** Mark a question dismissed/superseded without an answer (owner call). @param {Ledger} ledger @returns {Ledger} */
export function applyQuestionStatus(ledger, { questionId, status }, { now = () => new Date() } = {}) {
  if (!QUESTION_STATUSES.includes(status)) throw new MemoryError(`unknown question status "${status}"`);
  const idx = ledger.questions.findIndex((q) => q.id === questionId);
  if (idx === -1) throw new MemoryError(`no question with id "${questionId}"`);
  const questions = ledger.questions.slice();
  questions[idx] = { ...questions[idx], status };
  return bump(ledger, { questions }, { now });
}

/** All open questions, split by kind — the Q&A tab's two lists. @param {Ledger} ledger */
export function splitOpenQuestions(ledger) {
  const open = (ledger.questions || []).filter((q) => q.status === "open");
  return {
    blocking: open.filter((q) => q.kind === "blocking"),
    advisory: open.filter((q) => q.kind === "advisory"),
  };
}

/** Render the ledger into a compact markdown block for prompt inclusion (DW-7 context packages). @param {Ledger} ledger */
export function renderLedgerMd(ledger) {
  const lines = [];
  if (ledger.objective && (ledger.objective.problem || ledger.objective.proposedBehavior)) {
    lines.push("## Objective");
    if (ledger.objective.problem) lines.push(`Problem: ${ledger.objective.problem}`);
    if (ledger.objective.proposedBehavior) lines.push(`Proposed behavior: ${ledger.objective.proposedBehavior}`);
  }
  if (ledger.requirements && ledger.requirements.length) {
    lines.push("", "## Requirements");
    for (const r of ledger.requirements) lines.push(`- ${r.id}: ${r.text}`);
  }
  if (ledger.decisions && ledger.decisions.length) {
    lines.push("", "## Decisions");
    for (const d of ledger.decisions) lines.push(`- [${d.gate}] ${d.decision}${d.note ? ` — ${d.note}` : ""}`);
  }
  const answered = (ledger.questions || []).filter((q) => q.status === "answered");
  if (answered.length) {
    lines.push("", "## Answered questions");
    for (const q of answered) lines.push(`- Q: ${q.text}\n  A: ${q.answer && q.answer.text}`);
  }
  return lines.join("\n");
}
