// scripts/delivery/prompts.mjs
// Phase prompt templates (doc 3 §3: orchestrator phase → artifact contracts).
// Every template is artifact-first: a small framing block + the packet JSON +
// PATHS to artifacts ("read artifacts/spec.md"), never pasted history. Skills
// are referenced by repo-relative path only — bodies are never inlined, so the
// agent pays their token cost only if it actually reads the file.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/4 - Agent Drivers & Security.md §5.
//
// Zero-dependency: pure string templates, no imports.

/**
 * Banned-forever git text, included verbatim in every phase prompt. Deliberately
 * describes the policy generally rather than enumerating banned subcommands by
 * name — the enforcement is the allowlist in gitread.mjs, not this wording, and
 * this file must stay grep-clean of any alternate-checkout terminology (doc 6 §2).
 */
export const GIT_BAN_TEXT =
  "Git policy: you must NEVER run any git command that changes repository state — " +
  "no new branches, checkouts, commits, pushes, pulls, fetches, merges, rebases, " +
  "resets, restores, stashes, tags, git config edits, or any alternate copy of this " +
  "repository. Read-only git commands (status, diff, log, show, rev-parse, " +
  "for-each-ref) are allowed for your own orientation. Every commit and every " +
  "revert is performed by the human owner only, never by you.";

const OWNER_GUIDANCE_HEADING = "## Owner guidance (mid-session)";

/**
 * Render the "Owner guidance (mid-session)" section from drained composer
 * messages (doc 3 §2). Returns "" when there are no messages so callers can
 * splice it in unconditionally.
 */
export function renderOwnerMessages(messages = []) {
  if (!messages || messages.length === 0) return "";
  const lines = messages.map((m) => `- ${typeof m === "string" ? m : m.text}`);
  return `\n${OWNER_GUIDANCE_HEADING}\n${lines.join("\n")}\n`;
}

/** Render skill references by path only — never inline the skill file's body. */
function renderSkillPaths(skillPaths = []) {
  if (!skillPaths || skillPaths.length === 0) return "";
  const lines = skillPaths.map((p) => `- ${p} (read this file before acting; do not skip)`);
  return `\nRelevant skills (read by path, not pasted here):\n${lines.join("\n")}\n`;
}

function packetBlock(packet) {
  return `\nPacket (JSON):\n${JSON.stringify(packet, null, 2)}\n`;
}

/**
 * DISCOVERY phase: explore read-only and return the structured spec payload.
 * The runner, not the analysis agent, writes artifacts/spec.{json,md}.
 * @param {{packet:object, campaignFilePaths?:string[], skillPaths?:string[], ownerMessages?:string[]}} input
 */
export function buildDiscoveryPrompt({ packet, campaignFilePaths = [], skillPaths = [], ownerMessages = [] }) {
  const inputs = campaignFilePaths.map((p) => `- ${p}`).join("\n") || "(none)";
  return (
    "Phase: DISCOVERY\n" +
    "You are the Delivery Orchestrator investigating one work item read-only. " +
    "Explore the codebase and return only the structured JSON payload requested below. " +
    "Do not create, edit, or delete any file; the runner writes artifacts/spec.md after validating your JSON.\n" +
    packetBlock(packet) +
    `\nCampaign context files (read by path, relative to the repository root — pass them to your Read tool exactly as written, do not turn them into absolute paths):\n${inputs}\n` +
    renderSkillPaths(skillPaths) +
    "\nReturn an object with: problem, currentBehavior with file:line evidence, proposedBehavior, " +
    "acceptanceCriteria[{id,text}], affectedPaths[string], riskFlags[string], " +
    "openQuestions[{text}]. " +
    "If you have a concrete open question that blocks writing the spec, raise it as a " +
    'question ("question.raised") instead of guessing.\n' +
    renderOwnerMessages(ownerMessages) +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * PLAN phase: read the approved spec and return the structured plan payload.
 * The runner, not the analysis agent, writes artifacts/plan.{json,md}.
 * @param {{packet:object, specPath?:string, approvalNote?:string, skillPaths?:string[], ownerMessages?:string[]}} input
 */
export function buildPlanPrompt({
  packet,
  specPath = "artifacts/spec.md",
  approvalNote = "",
  skillPaths = [],
  ownerMessages = [],
}) {
  return (
    "Phase: PLAN\n" +
    `Read the approved spec at ${specPath} (path only — do not ask for it inline). ` +
    "Return only the structured JSON payload requested below. Do not create, edit, or delete any file; " +
    "the runner writes artifacts/plan.md after validating your JSON.\n" +
    packetBlock(packet) +
    (approvalNote ? `\nOwner's approval note:\n${approvalNote}\n` : "") +
    renderSkillPaths(skillPaths) +
    "\nReturn an object with: steps[{id,description,paths[string],validationHint}], testPlan, " +
    "riskFlags[string], rollbackSketch, and noNewDeps=true.\n" +
    renderOwnerMessages(ownerMessages) +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * BUILDING phase: execute one plan step against the live working tree.
 * @param {{packet:object, planPath?:string, stepId:string, priorValidationExcerpt?:string, ownerMessages?:string[]}} input
 */
export function buildBuildingPrompt({
  packet,
  planPath = "artifacts/plan.md",
  stepId,
  priorValidationExcerpt = "",
  ownerMessages = [],
}) {
  if (!stepId) throw new Error("buildBuildingPrompt requires stepId");
  return (
    "Phase: BUILDING\n" +
    `Read the approved plan at ${planPath} and execute step "${stepId}" against the live working tree. ` +
    "Append a short entry to artifacts/build-log.md describing what you changed.\n" +
    packetBlock(packet) +
    (priorValidationExcerpt
      ? `\nPrior validation failure (last 200 lines, bounded excerpt):\n${priorValidationExcerpt}\n`
      : "") +
    renderOwnerMessages(ownerMessages) +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * REVIEWING phase (Phase 1 = lite self-review on the primary thread).
 * @param {{packet:object, specPath?:string, dodSkillPath?:string, ownerMessages?:string[]}} input
 */
export function buildSelfReviewPrompt({
  packet,
  specPath = "artifacts/spec.md",
  dodSkillPath = ".claude/skills/finish-task/SKILL.md",
  ownerMessages = [],
}) {
  return (
    "Phase: REVIEWING (lite self-review)\n" +
    `Read ${dodSkillPath} (path only) and apply its checklist against the diff you produced vs the ` +
    `session baseline, cross-checked with ${specPath}. Write your findings to artifacts/review-self.md.\n` +
    packetBlock(packet) +
    "\nartifacts/review-self.md MUST start with a line of the exact form " +
    '"VERDICT: PASS" or "VERDICT: PASS_WITH_NOTES" or "VERDICT: BLOCK", followed by a findings table.\n' +
    renderOwnerMessages(ownerMessages) +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * Provider handoff verification (DW-8): the new provider reads the durable
 * context package (never the old provider's native session — that never
 * transfers) and restates its understanding before the runner lets it
 * continue the phase. Readonly, cheap-effort turn.
 * @param {{packet:object, contextPackageMd:string, fromProvider:string, toProvider:string}} input
 */
export function buildHandoffVerificationPrompt({ packet, contextPackageMd, fromProvider, toProvider }) {
  return (
    "Phase: HANDOFF VERIFICATION\n" +
    `This Delivery was running on ${fromProvider} and has just switched to you (${toProvider}). ` +
    "The provider session/thread never transfers between providers — everything you need is in the " +
    "context package below, which is this Delivery's durable, provider-neutral memory. " +
    "Do not create, edit, or delete any file.\n" +
    packetBlock(packet) +
    `\nContext package:\n${contextPackageMd}\n` +
    "\nReturn an object with: understandingSummary (a few sentences restating the objective and where " +
    "this Delivery currently stands), currentPhase, nextAction, and gaps[string] — anything the context " +
    "package left ambiguous, contradictory, or missing that you would need clarified before continuing " +
    "(empty array if none).\n" +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * UAT prep: assemble the artifacts/uat/** package from prior artifacts.
 * @param {{packet:object, priorArtifactPaths?:string[], ownerMessages?:string[]}} input
 */
export function buildUatPrompt({ packet, priorArtifactPaths = [], ownerMessages = [] }) {
  const inputs = priorArtifactPaths.map((p) => `- ${p}`).join("\n") || "(none)";
  return (
    "Phase: UAT PREP\n" +
    "Read the prior phase artifacts below (by path) and assemble the manual UAT package under artifacts/uat/**.\n" +
    packetBlock(packet) +
    `\nPrior artifacts (read by path):\n${inputs}\n` +
    "\nThe UAT package must be executable as written against the owner's own running dev app — write it " +
    "read-only under artifacts/uat/**; do not modify any other file in this phase.\n" +
    renderOwnerMessages(ownerMessages) +
    `\n${GIT_BAN_TEXT}\n`
  );
}
