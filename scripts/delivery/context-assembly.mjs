// scripts/delivery/context-assembly.mjs
// Pure layered context-package builder (DW-7). Used for rotation, provider
// handoff, fork, and the Context tab's "what would the next turn see"
// preview — the same function, four call sites. Preserves the artifact-first
// doctrine (prompts.mjs): approved prior-phase artifacts are referenced by
// **path**, never pasted; only small Delivery-owned layers (ledger content,
// digests, pins, a short recent tail) are inlined.
//
// Ledgers, decisions, constraints, and open/answered questions are NEVER
// summarized away — only the "digests" layer (compacted conversation
// narrative) is ever compacted; everything else renders in full every time.
//
// Pure function, no I/O — run-session.mjs gathers the ledger/digests/pins/
// recent-turn inputs and calls this to produce {layers, renderedMd,
// tokenEstimate, evidence}.

/** Rough chars-per-token heuristic (~4 chars/token) — no tokenizer dependency. */
export function estimateTokens(text) {
  const s = String(text == null ? "" : text);
  return s.trim() ? Math.ceil(s.length / 4) : 0;
}

function renderObjective(ledger) {
  const o = (ledger && ledger.objective) || {};
  const lines = [];
  if (o.itemText) lines.push(`Item: ${o.itemText}`);
  if (o.problem) lines.push(`Problem: ${o.problem}`);
  if (o.proposedBehavior) lines.push(`Proposed behavior: ${o.proposedBehavior}`);
  return lines.join("\n");
}

function renderRequirementsAndConstraints(ledger, packet) {
  const lines = [];
  for (const r of (ledger && ledger.requirements) || []) lines.push(`- [requirement ${r.id}] ${r.text}`);
  for (const c of (ledger && ledger.constraints) || []) lines.push(`- [constraint ${c.id || ""}] ${c.text}`);
  const pc = (packet && packet.constraints) || {};
  if (pc.forbiddenPaths && pc.forbiddenPaths.length) lines.push(`- [constraint] forbidden paths: ${pc.forbiddenPaths.join(", ")}`);
  if (pc.gitPolicy) lines.push(`- [constraint] git policy: ${pc.gitPolicy}`);
  if (pc.maxFixLoops != null) lines.push(`- [constraint] max fix loops: ${pc.maxFixLoops}`);
  return lines.join("\n");
}

function renderDecisions(ledger) {
  return ((ledger && ledger.decisions) || [])
    .map((d) => `- [${d.gate}] ${d.decision}${d.note ? ` — ${d.note}` : ""}${d.typed ? " (typed approval)" : ""}`)
    .join("\n");
}

function renderQuestions(ledger) {
  const lines = [];
  for (const q of (ledger && ledger.questions) || []) {
    if (q.status === "answered") {
      lines.push(`- Q (${q.kind}): ${q.text}\n  A: ${q.answer && q.answer.text}`);
    } else if (q.status === "open") {
      lines.push(`- Q (${q.kind}, OPEN — unanswered): ${q.text}`);
    }
  }
  return lines.join("\n");
}

function renderArtifactPaths(paths) {
  return (paths || []).map((p) => `- ${p}`).join("\n");
}

function renderDigests(digests) {
  return (digests || []).map((d) => d.summaryMd || "").filter(Boolean).join("\n\n");
}

function renderPins(pins) {
  return (pins || []).map((p) => `[pinned turn ${p.turnId}${p.note ? ` — ${p.note}` : ""}]\n${p.text || ""}`).join("\n\n");
}

function renderRecentTail(recentTurns) {
  return (recentTurns || [])
    .map((t) => `[turn ${t.turnId}${t.phase ? ` · ${t.phase}` : ""}]\n${t.finalText || ""}`)
    .filter((s) => s.trim())
    .join("\n\n");
}

function renderWorkspaceDelta(workspaceDelta) {
  if (!workspaceDelta) return "";
  const files = workspaceDelta.changedFiles || [];
  if (!files.length) return `No changes vs baseline ${workspaceDelta.baseHead || ""}`.trim();
  return `Changed vs baseline ${workspaceDelta.baseHead || ""}:\n${files.map((f) => `- ${f}`).join("\n")}`;
}

/**
 * Build one context package. Every layer carries its own token estimate so
 * the inspector can show where the budget goes; empty layers are dropped.
 * @param {{modeFraming?:string, gitBanText?:string, packet:object, ledger:object,
 *   artifactPaths?:string[], digests?:object[], pins?:object[], recentTurns?:object[],
 *   workspaceDelta?:(object|null), nextAction?:string}} input
 * @returns {{layers:{name:string,source:string,tokensEst:number,text:string}[],
 *   renderedMd:string, tokenEstimate:number, evidence:{name:string,tokensEst:number}[]}}
 */
export function buildContextPackage({
  modeFraming = "",
  gitBanText = "",
  packet,
  ledger,
  artifactPaths = [],
  digests = [],
  pins = [],
  recentTurns = [],
  workspaceDelta = null,
  nextAction = "",
} = {}) {
  if (!packet) throw new Error("buildContextPackage requires packet");
  if (!ledger) throw new Error("buildContextPackage requires ledger");

  const raw = [
    { name: "instructions", source: "static", text: [modeFraming, gitBanText].filter(Boolean).join("\n") },
    { name: "objective", source: "ledger", text: renderObjective(ledger) },
    { name: "packet", source: "packet", text: JSON.stringify(packet, null, 2) },
    { name: "artifacts", source: "paths", text: renderArtifactPaths(artifactPaths) },
    { name: "decisions", source: "ledger", text: renderDecisions(ledger) },
    { name: "constraints", source: "ledger+packet", text: renderRequirementsAndConstraints(ledger, packet) },
    { name: "questions", source: "ledger", text: renderQuestions(ledger) },
    { name: "digests", source: "compaction", text: renderDigests(digests) },
    { name: "pins", source: "pins", text: renderPins(pins) },
    { name: "recentTail", source: "transcript", text: renderRecentTail(recentTurns) },
    { name: "workspaceDelta", source: "git", text: renderWorkspaceDelta(workspaceDelta) },
    { name: "nextAction", source: "state", text: nextAction || "" },
  ];

  const layers = raw
    .filter((l) => l.text && l.text.trim())
    .map((l) => ({ ...l, tokensEst: estimateTokens(l.text) }));

  const renderedMd = layers.map((l) => `## ${l.name}\n${l.text}`).join("\n\n");
  const tokenEstimate = layers.reduce((sum, l) => sum + l.tokensEst, 0);
  const evidence = layers.map((l) => ({ name: l.name, tokensEst: l.tokensEst }));

  return { layers, renderedMd, tokenEstimate, evidence };
}

/**
 * Mechanical (free, deterministic) digest of a phase from turn metadata —
 * the owner-approved default digest mode (2026-07-16): no agent call, built
 * entirely from `transcript/turns.ndjson` entries + an optional artifact
 * summary line. Agent-written digests (better prose, costs tokens) are a
 * later `config.context.digestMode` option, not implemented here.
 * @param {{phase:string, turns?:object[], artifactSummary?:string}} input
 * @returns {string} markdown summary, suitable for a `digests` layer / compactions/*.md
 */
export function buildMechanicalDigest({ phase, turns = [], artifactSummary = "" }) {
  const lines = [`Phase ${phase} — ${turns.length} turn${turns.length === 1 ? "" : "s"}.`];
  for (const t of turns) {
    const usage = t.usage ? `${t.usage.input || 0} in / ${t.usage.output || 0} out` : "no usage recorded";
    lines.push(`- turn ${t.turnId} (${t.result}, ${t.strategy}): ${usage}`);
  }
  if (artifactSummary) lines.push(artifactSummary);
  return lines.join("\n");
}
