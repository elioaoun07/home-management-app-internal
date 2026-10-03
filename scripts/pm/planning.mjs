// R61 filesystem and authenticated HTTP seam. The browser receives projections;
// only this module writes references-only _Planning.json. No workers or production DB calls.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { authenticateLocal } from "../delivery-v2/local-auth.mjs";
import { itemFacts, itemReasons } from "../delivery-v2/coordination.mjs";
import { parseFrontmatter } from "./shared/frontmatter.mjs";
import { fileTasks } from "./shared/tasks.mjs";
import { deriveCampaigns, parseDecisions } from "./shared/product.mjs";
import { buildPortfolio } from "./shared/portfolio.mjs";
import { workOutcomes } from "./shared/metrics.mjs";
import { deliveryBlockReason } from "./shared/work-lifecycle.mjs";
import { idSection, workIds } from "./shared/work-id.mjs";
import { applyPlanningCommand, emptyPlanning, PlanningError, PLANNING_FILE, planningCommandSchema, validatePlanning } from "./shared/planning.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const ownerEvidenceDeclaration = /\b(?:owner(?:\s+(?:DB|RLS))?\s+evidence|owner action|owner check|owner uat|manual verification|device verification)\b/iu;

function declaredPlanDependencies(contract) {
  const dependencies = [];
  for (const match of contract.matchAll(/^```delivery-plan-v1\s*\r?\n([\s\S]*?)^```\s*$/gmu)) {
    try {
      const plan = JSON.parse(match[1]);
      if (Array.isArray(plan.dependencies)) dependencies.push(...plan.dependencies.filter((entry) => typeof entry === "string"));
    } catch { /* Admission owns malformed plans; comments/unknowns are not prerequisites. */ }
  }
  return dependencies;
}

export function readPlanning(pmDir) {
  const file = join(pmDir, PLANNING_FILE);
  if (!existsSync(file)) return emptyPlanning();
  try { return validatePlanning(JSON.parse(readFileSync(file, "utf8"))); }
  catch (error) { throw new PlanningError(409, "Planning file needs repair: " + error.message); }
}

/** Current canonical facts; delivery prerequisites use the same itemReasons.
 * The history parser decides completed/cancelled exact identities, and reopened
 * checklist rows win. Missing rows without receipts never become completed.
 */
function planningCorpus(data) {
  const files = data.files.map((file) => ({ ...file, module: file.relPath.split("/")[0], inFabled: /^(superseded|baseline-frozen|template)$/u.test(String(parseFrontmatter(file.raw).meta.status || "")) }));
  const tasks = files.flatMap((file) => fileTasks(file.raw).map((task) => ({ ...task, file: file.relPath, module: file.module, key: `${file.relPath}::${task.cbidx}` })));
  const choices = parseDecisions(files.find((file) => file.relPath === "_Decisions.md")?.raw);
  const portfolio = buildPortfolio(deriveCampaigns(files, tasks, data.cancelledLog || ""), choices);
  const history = portfolio.campaigns.flatMap((campaign) => [...campaign.shipped, ...campaign.cancelled]);
  const outcomes = workOutcomes({ work: portfolio.items, history });
  return { portfolio, outcomes };
}

/** @returns {Record<string, import("./app/planningTypes").PlanningReadiness>} */
export function buildPlanningFacts(data) {
  const { portfolio, outcomes } = planningCorpus(data);
  const backlog = {
    open: new Set(portfolio.items.filter((item) => item.state === "open").map((item) => item.idChip)),
    completed: new Set(outcomes.completed.map((entry) => entry.workId)),
    cancelled: new Set(outcomes.cancelled.map((entry) => entry.workId)),
  };
  /** @type {Record<string, import("./app/planningTypes").PlanningReadiness>} */
  const facts = {};
  for (const [status, entries] of [["completed", outcomes.completed], ["cancelled", outcomes.cancelled]]) {
    for (const entry of entries) facts[entry.workId] = { status, state: "ready", criteriaRevision: null, effort: null, reasons: [], dependencies: [], file: `${entry.campaign}/4 - Checklist.md` };
  }
  const counts = new Map();
  for (const item of portfolio.items) if (item.idChip) counts.set(item.idChip, (counts.get(item.idChip) || 0) + 1);
  for (const item of portfolio.items) {
    if (!item.idChip) continue;
    const bookRaw = portfolio.campaigns.find((campaign) => campaign.name === item.module)?.book?.raw || "";
    // Portfolio excerpts stop at Provenance, but current executable guidance and
    // owner-evidence declarations can follow it in the same canonical section.
    const fullContract = idSection(bookRaw, item.idChip)?.body || "";
    const declarations = fullContract.replace(/<!--[\s\S]*?-->/gu, "");
    const planDependencies = declaredPlanDependencies(declarations);
    const itemDeclared = itemFacts({ alias: item.idChip, title: item.text, bookRaw });
    const declared = { ...itemDeclared, dependencyIds: [...new Set([...itemDeclared.dependencyIds, ...planDependencies.flatMap(workIds)])].filter((key) => key !== item.idChip) };
    const reasons = itemReasons({ facts: declared, backlog });
    const lifecycle = deliveryBlockReason({ ...item, contract: fullContract });
    if (lifecycle && item.state === "open") reasons.push({ code: lifecycle, with: null });
    if (!item.contract || !/\*\*(?:Acceptance|Verify):\*\*/u.test(item.contract)) reasons.push({ code: "acceptance-required", with: null });
    if (item.effort === "L") reasons.push({ code: "size-needs-split", with: null });
    const readiness = declarations.match(/(?:^|\n)\s*(?:-\s*)?\*\*Readiness:\*\*\s*([^\n]+)/u)?.[1] || "";
    const readingGuide = declarations.match(/(?:^|\n)\s*(?:-\s*)?\*\*Reading guide:\*\*\s*([^\n]+)/u)?.[1] || "";
    if (/^(?:held|trigger held)\b/iu.test(readiness.trim())) reasons.push({ code: "held", with: null });
    if (ownerEvidenceDeclaration.test(readiness)
      || /\b(?:owner setup(?: only)?|no engineering dispatch)\b/iu.test(readiness)
      || /^owner[- ]executed\b/iu.test(readingGuide.trim())
      || planDependencies.some((entry) => ownerEvidenceDeclaration.test(entry))) reasons.push({ code: "owner-evidence", with: null });
    if (/\b(?:decision first|decision required|decision held|needs decision)\b/iu.test(readiness)) reasons.push({ code: "decision-required", with: null });
    if (/\bsplit first\b/iu.test(readiness) && !reasons.some((reason) => reason.code === "size-needs-split")) reasons.push({ code: "split-first", with: null });
    if (item.decisionIds.length) reasons.push({ code: "decision-required", with: item.decisionIds[0] });
    if (counts.get(item.idChip) > 1) reasons.push({ code: "ambiguous-reference", with: item.idChip });
    facts[item.idChip] = {
      status: item.state === "open" ? "open" : "completed",
      state: reasons.some((reason) => /^(dependency-|held)/u.test(reason.code)) ? "blocked" : reasons.length ? "needs-input" : "ready",
      criteriaRevision: fullContract ? digest(fullContract) : null,
      effort: item.effort, reasons, dependencies: declared.dependencyIds, file: item.file,
    };
  }
  // Dependency cycles are a planning defect, even if every member is selected.
  // Existing coordination evaluates each prerequisite at dispatch; this extra
  // graph check prevents a conditional sprint from promising a circular order.
  for (const [key, fact] of Object.entries(facts)) {
    if (fact.status !== "open") continue;
    const visit = (id, seen) => {
      if (id === key) return true;
      if (seen.has(id) || facts[id]?.status !== "open") return false;
      seen.add(id);
      return (facts[id]?.dependencies || []).some((dependency) => visit(dependency, seen));
    };
    if (fact.dependencies.some((dependency) => visit(dependency, new Set()))) {
      fact.reasons.push({ code: "dependency-cycle", with: key });
      fact.state = "blocked";
    }
  }
  return facts;
}

export function planningSnapshot(pmDir, data) {
  let planning = null;
  let planningError = null;
  try { planning = readPlanning(pmDir); } catch (error) { planningError = error.message; }
  return { planning, planningReadiness: buildPlanningFacts(data), planningError };
}

/** Native transaction lock, matching Delivery V2's pinned node:sqlite binding.
 * This DB holds no planning records. Its OS-owned lock disappears on process
 * death/reboot, without timeouts, PID reuse, or racy stale-marker removal.
 */
export function acquirePlanningWriteLock(root) {
  const file = join(root, ".pm", "planning-lock.sqlite");
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try { db.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE;"); }
  catch (error) {
    db.close();
    if (error.errcode === 5 || error.errcode === 6) throw new PlanningError(409, "Sprint plan is being edited. Retry after refresh.");
    throw error;
  }
  return () => { try { db.exec("ROLLBACK;"); } finally { db.close(); } };
}

/** Synchronous lock + atomic rename: two local/relay writers cannot overwrite
 * each other's revision. The idempotency receipt is in the same atomic file.
 */
export function writePlanningCommand({ root, pmDir, data, command, now = new Date().toISOString() }) {
  const parsed = planningCommandSchema.safeParse(command);
  if (!parsed.success) throw new PlanningError(400, "Invalid planning command: " + parsed.error.issues[0].message);
  const release = acquirePlanningWriteLock(root);
  const temp = join(pmDir, PLANNING_FILE + "." + randomUUID() + ".tmp");
  try {
    const current = readPlanning(pmDir);
    const hash = digest(JSON.stringify(canonical(parsed.data)));
    const next = applyPlanningCommand(current, parsed.data, { facts: buildPlanningFacts(data), now, hash });
    if (next.revision === current.revision) return { ok: true, planning: next, appliedRevision: current.commands.find((entry) => entry.id === parsed.data.command_id).revision, replayed: true };
    writeFileSync(temp, JSON.stringify(next, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    renameSync(temp, join(pmDir, PLANNING_FILE));
    let journalRecorded = true;
    try {
      const journal = join(root, ".pm", "planning-events.ndjson");
      mkdirSync(dirname(journal), { recursive: true });
      appendFileSync(journal, JSON.stringify({ commandId: parsed.data.command_id, revision: next.revision, action: parsed.data.action, observedAt: now, occurredAt: now }) + "\n", "utf8");
    } catch { journalRecorded = false; }
    return { ok: true, planning: next, appliedRevision: next.revision, journalRecorded };
  } finally {
    try { if (existsSync(temp)) unlinkSync(temp); }
    finally { release(); }
  }
}

export function planningCommandState(pmDir, commandId) {
  const planning = readPlanning(pmDir);
  const command = planning.commands.find((entry) => entry.id === commandId);
  return command ? { recorded: true, outcome: { ok: true, planning, appliedRevision: command.revision, replayed: true } } : null;
}

function writeObservationFile(file, text) {
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    writeFileSync(temp, text, { encoding: "utf8", flag: "wx" });
    renameSync(temp, file);
  } finally { if (existsSync(temp)) unlinkSync(temp); }
}

/** Watcher/explicit-write observation only; never called by a GET or projection.
 * The journal is authoritative for deduplication; the checkpoint is rebuildable.
 * A crash between journal and checkpoint cannot duplicate an observed change.
 * External edits have an observation time, never an invented occurrence time.
 */
export function observePlanningProgress({ root, pmDir, data, now = new Date().toISOString() }) {
  const release = acquirePlanningWriteLock(root);
  try {
    const planning = readPlanning(pmDir);
    const started = planning.sprints.filter((sprint) => sprint.state !== "draft");
    if (!started.length) return { recorded: 0 };
    const journal = join(root, ".pm", "planning-observations.ndjson");
    const checkpoint = join(root, ".pm", "planning-observations.json");
    const raw = existsSync(journal) ? readFileSync(journal, "utf8") : "";
    const prior = raw.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
    const entries = new Map(prior.map((event) => [event.key, event]));
    const facts = buildPlanningFacts(data);
    const { outcomes } = planningCorpus(data);
    const receipts = new Map([...outcomes.completed, ...outcomes.cancelled].map((outcome) => [outcome.workId, outcome]));
    const observedAt = new Date(now).toISOString();
    const events = [];
    for (const sprint of started) {
      const members = new Set(sprint.members.map((member) => member.workId));
      const ids = new Set([...members, ...[...entries.values()].filter((event) => event.sprintId === sprint.id).map((event) => event.workId)]);
      for (const workId of ids) {
        const key = sprint.id + "::" + workId;
        const previous = entries.get(key);
        // Once closed, only the frozen close record can describe this sprint.
        const status = !members.has(workId) ? "removed"
          : sprint.closed ? sprint.closed.delivered.includes(workId) ? "completed" : sprint.closed.cancelled.includes(workId) ? "cancelled" : "carryover"
          : facts[workId]?.status || "unresolved";
        const receipt = receipts.get(workId);
        const receiptMatches = receipt && ((status === "completed" && receipt.status === "Shipped") || (status === "cancelled" && receipt.status === "Cancelled"));
        const receiptDate = sprint.state === "closed" && (!previous || previous.sprintState === "closed")
          ? previous?.receiptDate || null
          : receiptMatches && receipt.datePrecision === "day" ? receipt.date : null;
        const signature = JSON.stringify([sprint.state, status, receiptDate]);
        if (previous?.signature === signature) continue;
        const event = {
          schema: "pm-planning-observation@1", key, sequence: prior.length + events.length + 1,
          kind: previous ? "change" : "baseline", sprintId: sprint.id, workId,
          sprintState: sprint.state, status, previousStatus: previous?.status || null,
          observedAt, occurredAt: null, receiptDate, signature,
        };
        events.push(event);
        entries.set(key, event);
      }
    }
    if (events.length) writeObservationFile(journal, [...prior, ...events].map((event) => JSON.stringify(event)).join("\n") + "\n");
    let checkpointSequence = -1;
    try { checkpointSequence = JSON.parse(readFileSync(checkpoint, "utf8")).sequence; } catch { /* rebuild a missing/unreadable checkpoint from the journal */ }
    const sequence = prior.length + events.length;
    if (events.length || checkpointSequence !== sequence) writeObservationFile(checkpoint, JSON.stringify({ schema: "pm-planning-observations@1", sequence, observedAt, entries: Object.fromEntries(entries) }, null, 2) + "\n");
    return { recorded: events.length };
  } finally { release(); }
}

/** Same paired-session/CSRF and bridge-credential auth as Delivery V2. */
export function routePlanning(req, { root, pmDir, data, allowedOrigins = [] }) {
  const auth = authenticateLocal({ root, headers: req.headers || {}, allowedOrigins });
  if (!auth.ok || !auth.actor) return { status: auth.status, json: { error: auth.refusal?.code || "unauthenticated", detail: auth.refusal?.detail } };
  try { return { status: 200, json: writePlanningCommand({ root, pmDir, data, command: req.body }) }; }
  catch (error) { return { status: error.status || 500, json: { error: error.message } }; }
}
