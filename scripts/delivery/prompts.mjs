// scripts/delivery/prompts.mjs
// Phase prompt templates (doc 3 §3: orchestrator phase → artifact contracts).
// Every template is artifact-first: a small framing block + a compact packet
// HEADER (item/ACs/scope/constraints only — the full packet.json is read by
// path, DLV-8) + PATHS to artifacts ("read <session dir>/artifacts/spec.md"),
// never pasted history. Skills are referenced by repo-relative path only —
// bodies are never inlined, so the agent pays their token cost only if it
// actually reads the file.
//
// All session-owned artifact paths (packet.json, spec.md, plan.md,
// build-log.md, uat/**) MUST go through `sessionArtifactPath`/`sessionDirRel`
// — the agent's cwd is the REPO root, not the session directory (see
// `run-session.mjs`'s `main()`), so a bare "artifacts/x.md" resolves to the
// wrong place. This was a real, previously undocumented bug (see
// `sessionDirRel`'s doc comment).
//
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
 * DLV-32: BUILDING is the one phase-producing turn with no structured
 * output contract at all — `outputSchema: false`, free text appended
 * verbatim to build-log.md — so it can't gain an `openQuestions` JSON field
 * the way DISCOVERY/PLAN/REVIEWING did. Reuses this repo's own established
 * pattern instead (REVIEWING's "VERDICT: PASS" sentinel line, same file):
 * a required-format first line the runner greps for, cheaper than
 * retrofitting a real schema onto a phase that has never had one. Exported
 * so run-session.mjs's detection uses the exact same literal — never
 * hand-copy this string (doc 7 / DLV-26's own lesson about drift).
 */
export const BLOCKING_QUESTION_MARKER = "BLOCKING QUESTION:";

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

/**
 * DLV-36: the driver now runs with `settingSources: []`, so CLAUDE.md is no
 * longer force-loaded into every model call — read it by path instead,
 * same artifact-first doctrine as `renderSkillPaths`. Only in the phases
 * that shape or execute the change (DISCOVERY scopes risk flags, PLAN sets
 * them at the gate, BUILDING actually writes code); REVIEWING/UAT/HANDOFF
 * work over already-produced artifacts against a narrower, skill-specific
 * checklist and don't need the full house-rules doc re-read.
 */
export const DOCTRINE_POINTER =
  "\nHouse rules: read CLAUDE.md at the repository root (path only, not pasted here) before making any " +
  "code, schema, or UI decision — it is this repo's mandatory rule set (hard rules, money/RLS/schema " +
  "rules, UI guardrails, module boundaries). Do not skip it because it wasn't force-loaded into this " +
  "prompt.\n";

/**
 * The session's own directory, relative to the repo root — which is the
 * agent's `cwd` for every turn (`getHandle` always passes `cwd: repoRoot`,
 * never `sessionDir`; confirmed against `main()`'s
 * `sessionDir = join(REPO_ROOT, ".delivery", "sessions", sessionId)`). Every
 * session-owned artifact path (packet.json, spec.md, plan.md, build-log.md,
 * uat/**) must be anchored here — a bare `"artifacts/spec.md"` resolves
 * against the REPO root, not the session's own artifacts folder.
 *
 * Found while shrinking the packet payload (DLV-8/Cost Anatomy §5): this
 * repo's own `whdv` postmortem records exactly this failure as "artifacts/
 * at repo root (untracked)" — build-log.md and other agent-authored files
 * landing outside the session directory entirely, invisible to the runner's
 * own artifact tracking. Fake-driver tests never caught it because the fake
 * driver never performs real file I/O.
 */
export function sessionDirRel(packet) {
  return `.delivery/sessions/${packet.sessionId}`;
}

/** A path under this session's own directory, repo-root-relative (see `sessionDirRel`). */
export function sessionArtifactPath(packet, relPath) {
  return `${sessionDirRel(packet)}/${relPath}`;
}

/**
 * DLV-8/Cost Anatomy §5: the full packet JSON used to be re-serialized into
 * every prompt — 3,883 of one real prompt's 4,047 tokens (96%), including
 * the flight-check's own context-manifest estimate, re-transmitted on every
 * turn. The packet is immutable for the life of the session and already
 * persisted to disk at launch (`packet.json` under the session directory) —
 * same artifact-first doctrine as skills and prior-phase artifacts: a small
 * header of the fields every phase actually needs inline (the work item,
 * its acceptance criteria, scope hints, constraints), plus a path to the
 * full packet for anything else (capabilities, flightCheck, budget,
 * workspace baseline).
 */
function packetHeader(packet) {
  const header = {
    sessionId: packet.sessionId,
    item: packet.item,
    acceptanceCriteria: packet.acceptanceCriteria,
    scopeHints: packet.scopeHints,
    constraints: packet.constraints,
  };
  return (
    `\nWork item (JSON — the full packet, including capabilities/flightCheck/budget/workspace, ` +
    `is at ${sessionArtifactPath(packet, "packet.json")}, read by path only if you need it):\n` +
    `${JSON.stringify(header, null, 2)}\n`
  );
}

/**
 * DLV-60 — bounded read windows.
 *
 * DLV-45 narrowed what the *runner sends*; nothing ever told the *agent how to
 * read*. On s-20260730-104900-9mfu the work item ended in an explicit
 * `MobileExpenseForm.tsx:1144` pointer, and DISCOVERY's first code read was
 * `Read {file_path, limit: 2000}` with **no offset** — 69,204 bytes of a
 * 3,099-line / 134 KB component. Its very next call was `Read {offset: 1140}`,
 * i.e. the agent already knew where to look and read the whole file anyway.
 *
 * The cost is not the one read. That turn ran 7 internal model calls, so the
 * ~18K-token result was re-sent on all 5 subsequent ones: ~90K of the turn's
 * 147,952-token occupancy (74% of a 200K window) to change one character.
 * Tool output is the most expensive thing a phase can produce, because it is
 * paid for once per read and again on every internal turn that follows.
 *
 * Deliberately applied to **every lane**, unlike DLV-45's FAST-only narrowing:
 * that traded context for speed and is a real tradeoff, while reading 3,099
 * lines to change one is never the better choice. A DEEP session that genuinely
 * needs whole-file context is still free to widen — this is guidance with a
 * stated escape, not a tool restriction.
 */
const READ_WINDOW_BEFORE = 40;
const READ_WINDOW_LINES = 120;

/**
 * `path:line` pointers the item's own text names, e.g.
 * `src/components/expense/MobileExpenseForm.tsx:1144`. Matches a
 * dot-bearing repo-relative path followed by `:<digits>`; backticks and the
 * `→` the checklist grammar uses as a target marker fall outside the class
 * and are skipped naturally.
 * @param {{text?:string, lineText?:string}|null|undefined} item
 * @returns {{path:string, line:number}[]}
 */
export function extractFilePointers(item) {
  if (!item) return [];
  const haystack = `${item.text || ""}\n${item.lineText || ""}`;
  const re = /([A-Za-z0-9_@./-]*[A-Za-z0-9_-]\.[A-Za-z0-9]+):(\d+)/g;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(haystack)) !== null) {
    const path = m[1];
    const line = Number(m[2]);
    if (!Number.isFinite(line) || line <= 0) continue;
    const key = `${path}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ path, line });
  }
  return out;
}

/**
 * The read-window block for one phase. Returns "" when the item names no
 * `file:line`, so callers can splice it in unconditionally — an item with no
 * pointer gets the general guidance only, never an invented offset.
 * @param {object} packet
 */
export function renderReadWindowGuidance(packet) {
  const pointers = extractFilePointers(packet && packet.item);
  const general =
    "\nReading budget: tool output is re-sent to the model on every internal turn that follows it, " +
    "so a single unbounded Read is charged many times over. Locate before you read — " +
    "use Grep to find the symbol, then Read a bounded window around the hit. " +
    "Do not read a whole file to inspect one region of it. " +
    "If you genuinely need more, widen deliberately rather than starting wide.\n";
  if (pointers.length === 0) return general;
  const lines = pointers.map(({ path, line }) => {
    const offset = Math.max(1, line - READ_WINDOW_BEFORE);
    return `- ${path}:${line} → Read {file_path: "${path}", offset: ${offset}, limit: ${READ_WINDOW_LINES}}`;
  });
  return (
    general +
    "\nThe work item names an exact location. Start there, with this window — not at line 1:\n" +
    `${lines.join("\n")}\n`
  );
}

/**
 * DLV-7 — the scope contract, stated at the one moment it can still be cheap.
 *
 * BUD-11 was filed as an S "verify" item, and its own DISCOVERY turn measured
 * 72 occurrences across 25 files — in an artifact it wrote itself, without ever
 * revisiting the S label. Nothing asked it to reconcile the two, so nothing did.
 *
 * The counts are asked for as *measurements*, not judgments, because that is
 * what a model can actually do reliably here: grep and count. The size class is
 * derived by the runner from owner-set thresholds (`scope.mjs`), so the agent is
 * never grading its own homework.
 *
 * The decomposition ask is conditional on the agent's own comparison, which is
 * deliberate: it costs nothing when scope matches (the common case), and when it
 * does not, the proposal arrives *with* the spec rather than a rejection round
 * trip later — one turn instead of three.
 */
function renderScopeContract(packet) {
  const effort = (packet && packet.item && packet.item.effort) || null;
  const declared = effort
    ? `This work item is filed as **${effort}-effort**. `
    : "This work item records no effort class. ";
  return (
    "\nScope contract (required): before writing the spec, measure the change you are proposing and return " +
    "`scopeEstimate: {files, occurrences, modules, note?}` — `files` = how many files must be edited, " +
    "`occurrences` = how many distinct code sites must change across them (grep and count; 1 for a " +
    "single-site edit), `modules` = how many feature/module directories are involved. These are counts you " +
    "have verified, not guesses: if you have not looked, look before answering.\n" +
    declared +
    "If your measured scope is clearly larger than that class implies (an S item that turns out to touch " +
    "many files or many sites), also return `decomposition`: 2-4 slices, each with a `title`, a short " +
    "`rationale`, and the `acceptanceCriteriaIds` it covers, ordered so slice 1 is the one worth doing " +
    "first and can ship on its own. Omit `decomposition` entirely when the scope matches.\n"
  );
}

/**
 * DLV-62: the extra ask that turns a DISCOVERY turn into a merged
 * DISCOVERY+PLAN turn. Only ever appended for a FAST-lane item that names
 * exactly one file, where the plan cannot meaningfully diverge from the spec.
 * The three approval gates are unchanged — this halves the turns, not the
 * oversight — so the plan produced here still faces its own gate.
 */
function renderMergedPlanAsk(packet, maxPlanSteps) {
  const onlyPath = ((packet.scopeHints && packet.scopeHints.globs) || [])[0];
  return (
    "\nThis is a FAST-lane session for a change confined to a single file" +
    `${onlyPath ? ` (${onlyPath})` : ""}, so you are producing the spec AND the plan in this one turn ` +
    "instead of two. Include a `plan` object alongside the spec fields: " +
    "plan{steps[{id,description,paths[string],validationHint}], testPlan, riskFlags[string], rollbackSketch, " +
    "noNewDeps=true, openQuestions[{text}]}.\n" +
    (maxPlanSteps
      ? `The same step budget applies: at most ${maxPlanSteps} steps, and for a single-file change one step is ` +
        "almost always right. Do not add steps that re-verify what you have just established in the spec — put " +
        "those checks in the step's `validationHint` — and none for anything a human must do by hand.\n"
      : "") +
    "You will still be stopped for approval after the spec, and again after the plan. If you cannot write a " +
    "sound plan without an answer, raise it in the spec's `openQuestions` rather than guessing — the plan you " +
    "write here is the one that will be executed.\n"
  );
}

/**
 * DISCOVERY phase: explore read-only and return the structured spec payload.
 * The runner, not the analysis agent, writes artifacts/spec.{json,md}.
 * @param {{packet:object, campaignFilePaths?:string[], skillPaths?:string[],
 *   includeDoctrine?:boolean, ownerMessages?:string[], includePlan?:boolean,
 *   maxPlanSteps?:(number|null)}} input
 */
export function buildDiscoveryPrompt({
  packet,
  campaignFilePaths = [],
  skillPaths = [],
  // DLV-45: FAST drops the doctrine re-read in the phases that produce prose
  // (see run-session.mjs's phaseContextPolicy). Defaults to true so every
  // existing caller and lane keeps today's behavior.
  includeDoctrine = true,
  ownerMessages = [],
  // DLV-62 — see renderMergedPlanAsk. Defaults false: every existing caller
  // and every non-FAST lane keeps the two-turn shape.
  includePlan = false,
  maxPlanSteps = null,
}) {
  const campaignBlock =
    campaignFilePaths.length > 0
      ? `\nCampaign context files (read by path, relative to the repository root — pass them to your Read tool exactly as written, do not turn them into absolute paths):\n${campaignFilePaths
          .map((p) => `- ${p}`)
          .join("\n")}\n`
      : // Saying nothing here would read as an omission the agent might try to
        // repair by hunting for the campaign docs itself — the opposite of the
        // saving. State that the narrow scope is deliberate.
        "\nThis is a FAST-lane session: no campaign strategy docs are in scope. " +
        "The work item above (with its file:line pointer, where it has one) is your starting point — " +
        "go straight to the code. Do not go looking for campaign or roadmap documents.\n";
  return (
    `Phase: ${includePlan ? "DISCOVERY + PLAN (merged)" : "DISCOVERY"}\n` +
    "You are the Delivery Orchestrator investigating one work item read-only. " +
    "Explore the codebase and return only the structured JSON payload requested below. " +
    `Do not create, edit, or delete any file; the runner writes ${sessionArtifactPath(packet, "artifacts/spec.md")} after validating your JSON.\n` +
    packetHeader(packet) +
    campaignBlock +
    renderReadWindowGuidance(packet) +
    renderSkillPaths(skillPaths) +
    renderScopeContract(packet) +
    "\nReturn an object with: problem, currentBehavior with file:line evidence, proposedBehavior, " +
    "acceptanceCriteria[{id,text}], affectedPaths[string], riskFlags[string], " +
    "openQuestions[{text}], scopeEstimate{files,occurrences,modules}, and decomposition[] only when the " +
    "scope contract above calls for it. " +
    "If you have a concrete open question that blocks writing the spec, raise it as a " +
    'question ("question.raised") instead of guessing.\n' +
    (includePlan ? renderMergedPlanAsk(packet, maxPlanSteps) : "") +
    renderOwnerMessages(ownerMessages) +
    (includeDoctrine ? DOCTRINE_POINTER : "") +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * DLV-55: the step ceiling, stated to the planner *at generation time*.
 *
 * `maxPlanSteps` existed as a post-hoc advisory only: the runner emitted
 * `plan.step_count.warning` after the plan was written and then proceeded. On
 * s-20260730-104900-9mfu it duly fired `{stepCount: 6, maxPlanSteps: 5}` for a
 * **one-line string replacement** — and of those 6 steps only one was
 * executable work. Three re-verified what DISCOVERY had already established and
 * two were manual browser checks BUILDING cannot perform at all. Since every
 * step is its own full-context BUILDING turn (~$0.10–0.19 measured), that plan
 * was a ~$0.6–1.1 BUILDING phase for one character of change.
 *
 * The agent was never told a ceiling existed. Telling it here costs nothing —
 * no extra turn, no rejection loop — and attacks the cause rather than
 * reporting the symptom after the money is already committed. The post-hoc
 * warning stays as a backstop for when this guidance is ignored.
 */
function renderPlanStepBudget(maxPlanSteps) {
  if (!maxPlanSteps) return "";
  return (
    `\nStep budget: at most ${maxPlanSteps} steps, and **fewer is better** — each step becomes its own separate ` +
    `agent turn that re-establishes full context, so a step costs real money whether it does much or little. ` +
    `Rules: one step per real edit; do NOT add steps that re-verify what the spec already establishes — put those ` +
    `checks in that step's \`validationHint\`; do NOT add steps for anything a human must do in a browser or by ` +
    `hand — those belong in the UAT package, not the plan. A one-line change should be a one-step plan.\n`
  );
}

/**
 * PLAN phase: read the approved spec and return the structured plan payload.
 * The runner, not the analysis agent, writes artifacts/plan.{json,md}.
 * @param {{packet:object, specPath?:string, approvalNote?:string, skillPaths?:string[],
 *   includeDoctrine?:boolean, maxPlanSteps?:(number|null), ownerMessages?:string[]}} input
 */
export function buildPlanPrompt({
  packet,
  specPath = null,
  approvalNote = "",
  skillPaths = [],
  includeDoctrine = true, // DLV-45 — see buildDiscoveryPrompt
  maxPlanSteps = null, // DLV-55 — see renderPlanStepBudget
  ownerMessages = [],
}) {
  const resolvedSpecPath = specPath || sessionArtifactPath(packet, "artifacts/spec.md");
  return (
    "Phase: PLAN\n" +
    `Read the approved spec at ${resolvedSpecPath} (path only — do not ask for it inline). ` +
    "Return only the structured JSON payload requested below. Do not create, edit, or delete any file; " +
    `the runner writes ${sessionArtifactPath(packet, "artifacts/plan.md")} after validating your JSON.\n` +
    packetHeader(packet) +
    (approvalNote ? `\nOwner's approval note:\n${approvalNote}\n` : "") +
    renderSkillPaths(skillPaths) +
    renderPlanStepBudget(maxPlanSteps) +
    "\nReturn an object with: steps[{id,description,paths[string],validationHint}], testPlan, " +
    "riskFlags[string], rollbackSketch, noNewDeps=true, and openQuestions[{text}]. " +
    "If you have a concrete open question that blocks writing a sound plan, raise it as a " +
    'question ("question.raised") instead of guessing at scope or approach.\n' +
    renderOwnerMessages(ownerMessages) +
    (includeDoctrine ? DOCTRINE_POINTER : "") +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * BUILDING phase: execute one plan step against the live working tree.
 * @param {{packet:object, planPath?:string, stepId:string, priorValidationExcerpt?:string,
 *   includeDoctrine?:boolean, ownerMessages?:string[]}} input
 */
export function buildBuildingPrompt({
  packet,
  planPath = null,
  stepId,
  priorValidationExcerpt = "",
  // DLV-45: BUILDING is the phase that writes code, so the doctrine pointer is
  // never trimmed here in any lane. The parameter exists only so the contract
  // is uniform across phases; passing `false` would be a mistake.
  includeDoctrine = true,
  ownerMessages = [],
}) {
  if (!stepId) throw new Error("buildBuildingPrompt requires stepId");
  const resolvedPlanPath = planPath || sessionArtifactPath(packet, "artifacts/plan.md");
  return (
    "Phase: BUILDING\n" +
    `Read the approved plan at ${resolvedPlanPath} and execute step "${stepId}" against the live working tree. ` +
    `Append a short entry to ${sessionArtifactPath(packet, "artifacts/build-log.md")} describing what you changed. ` +
    `If you hit a concrete question that blocks completing this step — not a minor judgment call — do not ` +
    `guess or skip it: make no file changes and respond with a single line of the exact form ` +
    `"${BLOCKING_QUESTION_MARKER} <your question>" instead of a build-log entry.\n` +
    packetHeader(packet) +
    // DLV-60: BUILDING re-reads the file it is about to edit, so it pays the
    // same unbounded-read tax DISCOVERY did — and at `medium` effort, over more
    // internal turns. The Edit tool needs the exact target text, not the file.
    renderReadWindowGuidance(packet) +
    (priorValidationExcerpt
      ? `\nPrior validation failure (last 200 lines, bounded excerpt):\n${priorValidationExcerpt}\n`
      : "") +
    renderOwnerMessages(ownerMessages) +
    (includeDoctrine ? DOCTRINE_POINTER : "") +
    `\n${GIT_BAN_TEXT}\n`
  );
}

/**
 * DLV-10 — how to claim an acceptance criterion, and what will happen to the
 * claim.
 *
 * Stating the reconciliation rule to the agent is not a courtesy: an agent that
 * knows an unevidenced `met` will be silently demoted to `unmet` has a reason to
 * supply the pointer, whereas one that believes its own assertion is the record
 * has none. BUD-11's build log said "✅ COMPLETED" over a red typecheck; nothing
 * in its prompt had ever suggested that claim would be checked.
 */
export const ACCEPTANCE_CLAIM_GUIDANCE =
  "\nAcceptance criteria: for each AC in the work item, report " +
  "acceptanceCriteria[{id, status: \"met\"|\"unmet\"|\"failed\", evidence}]. " +
  "`evidence` must be one of: a repo-relative file path you changed or that demonstrates the behavior " +
  "(optionally with `:line`), or the name of a validation rung (`typecheck`, `lint`, `test`). " +
  "The runner re-checks every claim against its own records — a `met` with evidence that does not " +
  "resolve is recorded as UNMET, and any `met` claimed while validation is failing is recorded as " +
  "FAILED. Do not claim `met` for work you did not do; an honest `unmet` costs nothing and a false " +
  "`met` is simply overwritten.\n";

/**
 * REVIEWING phase (Phase 1 = lite self-review on the primary thread).
 * @param {{packet:object, specPath?:string, dodSkillPath?:string, ownerMessages?:string[]}} input
 */
export function buildSelfReviewPrompt({
  packet,
  specPath = null,
  dodSkillPath = ".claude/skills/finish-task/SKILL.md",
  ownerMessages = [],
}) {
  const resolvedSpecPath = specPath || sessionArtifactPath(packet, "artifacts/spec.md");
  const reviewPath = sessionArtifactPath(packet, "artifacts/review-self.md");
  return (
    "Phase: REVIEWING (lite self-review)\n" +
    `Read ${dodSkillPath} (path only) and apply its checklist against the diff you produced vs the ` +
    `session baseline, cross-checked with ${resolvedSpecPath}. Write your findings to ${reviewPath}.\n` +
    packetHeader(packet) +
    `\n${reviewPath} MUST start with a line of the exact form ` +
    '"VERDICT: PASS" or "VERDICT: PASS_WITH_NOTES" or "VERDICT: BLOCK", followed by a findings table. ' +
    "If reviewing surfaces a genuine ambiguity you cannot resolve from the spec and the diff — not a " +
    "stylistic nitpick — include an openQuestions[{text}] array in your JSON response instead of guessing " +
    "or silently verdict-ing around it (empty array or omit the field when there is nothing open).\n" +
    ACCEPTANCE_CLAIM_GUIDANCE +
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
    packetHeader(packet) +
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
export function buildUatPrompt({ packet, priorArtifactPaths = null, ownerMessages = [] }) {
  const resolvedPaths =
    priorArtifactPaths ||
    ["artifacts/spec.md", "artifacts/plan.md", "artifacts/validation-report.md", "artifacts/review-self.md"].map((p) =>
      sessionArtifactPath(packet, p),
    );
  const uatDir = sessionArtifactPath(packet, "artifacts/uat/**");
  const inputs = resolvedPaths.map((p) => `- ${p}`).join("\n") || "(none)";
  return (
    "Phase: UAT PREP\n" +
    `Read the prior phase artifacts below (by path) and assemble the manual UAT package under ${uatDir}.\n` +
    packetHeader(packet) +
    `\nPrior artifacts (read by path):\n${inputs}\n` +
    "\nThe UAT package must be executable as written against the owner's own running dev app — write it " +
    `read-only under ${uatDir}; do not modify any other file in this phase.\n` +
    ACCEPTANCE_CLAIM_GUIDANCE +
    renderOwnerMessages(ownerMessages) +
    `\n${GIT_BAN_TEXT}\n`
  );
}
