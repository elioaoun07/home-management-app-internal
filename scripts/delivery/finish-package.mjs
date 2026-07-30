// scripts/delivery/finish-package.mjs
// DLV-12: the finish package — what a session actually left behind, written on
// EVERY exit to a terminal, blocked, or paused state.
//
// The failure this exists to prevent: BUD-11 died leaving a partial migration,
// a failing enforcement test, and 67 unconverted occurrences — and the only
// record of any of it was a paragraph inside `build-log.md`, written by the
// agent, in prose, under a "✅ COMPLETED" heading. There was no ownership
// manifest (which of those changed files were even this session's?), no
// remaining-work package, no revert instructions, and no risk register. A
// human had to reconstruct all of it by reading a transcript.
//
// Two deliberate constraints:
//
//  1. **Recovery instructions are display-only text.** The runner never runs a
//     git write of any kind (doc 4 §3, and the owner's standing rule). The
//     recovery file is something the owner reads and chooses to run, never
//     something this code executes — so it is generated as markdown, not as a
//     script, and says so.
//
//  2. **Ownership is reported, not assumed.** A file this session touched that
//     was ALREADY dirty at launch is `shared`, not `own` — reverting it would
//     destroy the owner's own uncommitted work. That distinction is the whole
//     reason the manifest exists rather than a bare file list.
//
// Pure: takes state/packet/artifacts as data, returns file contents. The
// caller writes them.

import { summarizeAcceptance, unsatisfiedAcceptance } from "./acceptance.mjs";

export const FINISH_SCHEMA_VERSION = 1;

/** Human-readable framing per exit reason — the first thing the owner reads. */
const REASON_HEADLINE = Object.freeze({
  shipped: "Session shipped",
  cancelled: "Session cancelled",
  blocked: "Session blocked",
  "needs-decision": "Session paused — waiting on you",
  "budget-exhausted": "Session paused — budget exhausted",
  "runner-crash": "Session parked — the runner hit an unexpected error",
  "fix-loop-exhausted": "Session blocked — the fix loop is exhausted",
});

function headline(reason) {
  return REASON_HEADLINE[reason] || `Session finished (${reason})`;
}

/**
 * Ownership manifest: every file this session recorded as changed, tagged with
 * whether the session owns it outright or shares it with pre-existing edits.
 */
export function buildOwnershipManifest(state) {
  const workspace = state.workspace || {};
  const changed = workspace.changedFiles || [];
  const preExisting = new Set(
    (workspace.preExistingChanges || []).map((entry) => (typeof entry === "string" ? entry : entry && entry.path)).filter(Boolean),
  );
  // `changeOwnership` is classifyChangeOwnership's output when it ran; falling
  // back to recomputing the same distinction here keeps the manifest correct
  // for a session that exited before any validation pass populated it.
  const recorded = new Map(
    ((workspace.changeOwnership && workspace.changeOwnership.files) || []).map((f) => [f.path, f.ownership]),
  );
  return {
    baseHead: workspace.baseHead || null,
    dirtyAtStart: !!workspace.dirtyAtStart,
    files: changed.map((path) => ({
      path,
      ownership: recorded.get(path) || (preExisting.has(path) ? "shared" : "own"),
    })),
  };
}

/**
 * Un-executed plan steps + unmet acceptance criteria — shaped so DLV-13's
 * salvage flow can build a continuation packet straight from this file rather
 * than re-deriving it from a transcript.
 */
export function buildRemainingWork(state, plan) {
  const steps = (plan && plan.steps) || [];
  const build = state.build || null;
  // A session that never entered BUILDING has every step remaining; one that
  // finished (build === null after `build.complete`) has none.
  const doneThrough = build && build.mode === "plan" ? build.stepIndex : build ? steps.length : state.state === "SHIPPED" ? steps.length : 0;
  const remainingSteps = steps.slice(Math.max(0, doneThrough)).map((s) => ({
    id: s.id,
    description: s.description,
    paths: s.paths || [],
    validationHint: s.validationHint || null,
  }));
  const matrix = state.acceptance || [];
  const unsatisfiedIds = new Set(unsatisfiedAcceptance(matrix));
  return {
    acceptanceCriteria: matrix
      .filter((row) => unsatisfiedIds.has(row.id))
      .map((row) => ({ id: row.id, text: row.text, status: row.status, evidence: row.evidence })),
    planSteps: remainingSteps,
    // What a continuation session would need to be told, in one line.
    summary:
      remainingSteps.length || unsatisfiedIds.size
        ? `${unsatisfiedIds.size} acceptance criteria and ${remainingSteps.length} plan step(s) remain.`
        : "Nothing recorded as remaining.",
  };
}

/**
 * The risk register: everything the session learned that a human should weigh
 * before trusting, reverting, or continuing this work. Assembled from what the
 * runner itself recorded, never from the agent's own summary prose.
 */
export function buildRiskRegister({ state, packet, spec, plan, validation, review, reason }) {
  const risks = [];

  if (reason !== "shipped") {
    risks.push({
      code: "incomplete-exit",
      severity: "high",
      detail: `The session exited at ${state.state} with reason "${reason}". Any changed file below is mid-flight work, not a finished change.`,
    });
  }
  const manifest = buildOwnershipManifest(state);
  const shared = manifest.files.filter((f) => f.ownership === "shared");
  if (shared.length) {
    risks.push({
      code: "shared-ownership",
      severity: "high",
      detail:
        `${shared.length} file(s) were already modified before this session started and were then written to by it: ` +
        `${shared.map((f) => f.path).join(", ")}. Reverting these would also discard your own pre-existing edits.`,
    });
  }
  if (validation && validation.passes === false) {
    const failing = Object.entries(validation.results || {})
      .filter(([, r]) => r && !r.ok && !r.skipped)
      .map(([key]) => key);
    if (failing.length) {
      risks.push({ code: "validation-red", severity: "high", detail: `Validation is failing: ${failing.join(", ")}.` });
    }
  }
  const skipped = Object.entries((validation && validation.results) || {})
    .filter(([, r]) => r && r.skipped)
    .map(([key, r]) => `${key} (${r.reason || "no reason recorded"})`);
  if (skipped.length) {
    risks.push({ code: "validation-skipped", severity: "medium", detail: `Rungs not run: ${skipped.join("; ")}.` });
  }
  const matrix = state.acceptance || [];
  const summary = summarizeAcceptance(matrix);
  if (summary.failed || summary.unmet) {
    risks.push({
      code: "acceptance-incomplete",
      severity: summary.failed ? "high" : "medium",
      detail: `${summary.unmet} acceptance criteria unmet and ${summary.failed} failed, of ${summary.total}.`,
    });
  }
  if (summary.waived) {
    risks.push({ code: "acceptance-waived", severity: "medium", detail: `${summary.waived} acceptance criteria were waived by the owner.` });
  }
  if (state.scope && state.scope.mismatch) {
    risks.push({
      code: "scope-mismatch",
      severity: "medium",
      detail: `${state.scope.reason}${state.scope.selectedSlice ? ` Narrowed to slice ${state.scope.selectedSlice.index}: ${state.scope.selectedSlice.title}.` : " Built at full measured scope."}`,
    });
  }
  for (const flag of new Set([...((spec && spec.riskFlags) || []), ...((plan && plan.riskFlags) || [])])) {
    risks.push({ code: `risk-flag:${flag}`, severity: "medium", detail: `The spec or plan flagged this change as "${flag}".` });
  }
  for (const finding of (review && review.findings) || []) {
    if (!finding) continue;
    const text = typeof finding === "string" ? finding : finding.detail || finding.text || finding.summary;
    if (text) risks.push({ code: "review-finding", severity: finding.severity || "low", detail: String(text) });
  }
  if (state.lastError && state.lastError.message) {
    risks.push({ code: "last-error", severity: "high", detail: state.lastError.message });
  }
  void packet;
  return risks;
}

/**
 * Display-only recovery instructions. Never executed by anything in this repo —
 * see the module header.
 */
export function renderRecoveryMd({ state, packet, manifest, reason }) {
  const own = manifest.files.filter((f) => f.ownership === "own").map((f) => f.path);
  const shared = manifest.files.filter((f) => f.ownership === "shared").map((f) => f.path);
  const lines = [
    "# Recovery",
    "",
    "**These commands are for you to read and decide on. Nothing in this repository runs them —",
    "the delivery runner never performs a git write of any kind.**",
    "",
    `Session: \`${packet.sessionId}\` · exited at **${state.state}** (${reason})`,
    `Baseline commit at launch: \`${manifest.baseHead || "(not recorded)"}\``,
    "",
  ];

  if (!manifest.files.length) {
    lines.push("This session changed no files. There is nothing to revert.", "");
    return lines.join("\n");
  }

  if (own.length) {
    lines.push(
      "## Files this session created or modified, and nothing else had touched",
      "",
      "Safe to discard if you want this session's work gone:",
      "",
      "```",
      ...own.map((p) => `git checkout -- ${p}`),
      "```",
      "",
    );
  }
  if (shared.length) {
    lines.push(
      "## Files that were ALREADY modified before this session started",
      "",
      "**Do not blindly revert these.** They contain your own pre-existing uncommitted edits as well as",
      "this session's. Review the diff and revert selectively:",
      "",
      "```",
      ...shared.map((p) => `git diff -- ${p}`),
      "```",
      "",
    );
  }
  lines.push(
    "## Full change list",
    "",
    ...manifest.files.map((f) => `- \`${f.path}\` — ${f.ownership}`),
    "",
  );
  return lines.join("\n");
}

function renderRisksMd(risks) {
  if (!risks.length) return "# Risks\n\n(No risks recorded for this session.)\n";
  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...risks].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  return [
    "# Risks",
    "",
    ...sorted.map((r) => `- **${String(r.severity).toUpperCase()}** (${r.code}) — ${r.detail}`),
    "",
  ].join("\n");
}

function renderSummaryMd({ state, packet, reason, manifest, remainingWork, acceptanceSummary, risks }) {
  const usage = (state.usage && state.usage.total) || {};
  const cost = usage.costUsd != null ? `$${Number(usage.costUsd).toFixed(4)}` : usage.costEstUsd != null ? `~$${Number(usage.costEstUsd).toFixed(4)} (est.)` : "unavailable";
  return [
    `# ${headline(reason)}`,
    "",
    `- Work item: **${(packet.item && packet.item.id) || "(no id)"}** — ${(packet.item && packet.item.text) || ""}`,
    `- Final state: **${state.state}**`,
    `- Files changed: ${manifest.files.length} (${manifest.files.filter((f) => f.ownership === "shared").length} shared with pre-existing edits)`,
    `- Acceptance: ${acceptanceSummary.met} met · ${acceptanceSummary.waived} waived · ${acceptanceSummary.unmet} unmet · ${acceptanceSummary.failed} failed`,
    `- Remaining: ${remainingWork.summary}`,
    `- Recorded cost: ${cost}`,
    `- Risks recorded: ${risks.length}`,
    "",
    "Files in this package:",
    "",
    "- `manifest.json` — every changed file and who owns it",
    "- `acceptance.json` — the acceptance-criteria matrix as it stood at exit",
    "- `remaining-work.json` — unmet criteria and un-executed plan steps (salvage reads this)",
    "- `recovery.md` — display-only revert guidance",
    "- `risks.md` — the risk register",
    "",
  ].join("\n");
}

/**
 * Assemble the whole package.
 * @param {{state:object, packet:object, reason:string, at?:string,
 *   spec?:object|null, plan?:object|null, validation?:object|null, review?:object|null}} args
 * @returns {{files:{name:string, json?:object, text?:string}[], summary:object}}
 */
export function buildFinishPackage({ state, packet, reason, at = new Date().toISOString(), spec = null, plan = null, validation = null, review = null }) {
  const manifest = buildOwnershipManifest(state);
  const remainingWork = buildRemainingWork(state, plan);
  const risks = buildRiskRegister({ state, packet, spec, plan, validation, review, reason });
  const acceptanceSummary = summarizeAcceptance(state.acceptance || []);

  const manifestJson = {
    schemaVersion: FINISH_SCHEMA_VERSION,
    at,
    reason,
    sessionId: packet.sessionId,
    finalState: state.state,
    ...manifest,
    usage: state.usage || { perPhase: {}, total: {} },
  };

  return {
    summary: { reason, at, finalState: state.state, acceptance: acceptanceSummary, risks: risks.length, changedFiles: manifest.files.length },
    files: [
      { name: "manifest.json", json: manifestJson },
      { name: "acceptance.json", json: { schemaVersion: FINISH_SCHEMA_VERSION, at, summary: acceptanceSummary, criteria: state.acceptance || [] } },
      { name: "remaining-work.json", json: { schemaVersion: FINISH_SCHEMA_VERSION, at, reason, sessionId: packet.sessionId, ...remainingWork } },
      { name: "recovery.md", text: renderRecoveryMd({ state, packet, manifest, reason }) },
      { name: "risks.md", text: renderRisksMd(risks) },
      { name: "risks.json", json: { schemaVersion: FINISH_SCHEMA_VERSION, at, risks } },
      { name: "summary.md", text: renderSummaryMd({ state, packet, reason, manifest, remainingWork, acceptanceSummary, risks }) },
    ],
  };
}
