import { cleanInlineText } from "./text.mjs";
import { idSection, workIds } from "./work-id.mjs";
import { CANCELLED_LOG_FILE, historyRecords } from "./history.mjs";
import { executionKind } from "./work-lifecycle.mjs";

// Presentation only. Checklists, books and the decision register remain the
// authorities; this read model never persists or infers delivery permission.
// Shared by the primary React app, the classic reference build and the relay
// (Command Center Phase 6 moved it out of the classic namespace; `src/lib/product.js`
// re-exports it).
export function workTitle(task) {
  let text = task?.text || "Untitled work";
  const id = task?.idChip || task?.id;
  if (id && text.startsWith(`${id} `)) text = text.slice(id.length).trim();
  return text.replace(/\s*[—→]\s*(?:criteria|scope)\s*$/i, "");
}

export function section(raw = "", title, level = 2) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${"#".repeat(level)} ${title}`);
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !new RegExp(`^#{1,${level}} `).test(lines[end])) end++;
  return lines.slice(start + 1, end).join("\n").trim();
}

export function parseDecisions(raw = "") {
  return section(raw, "Open choices").split(/\r?\n/).flatMap((line) => {
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((v) => v.trim());
    if (!/^DEC-\d+$/.test(cells[0] || "")) return [];
    return [{ id: cells[0], text: cells[1], constraint: cells[2], provenance: cells[3] }];
  });
}

/** History records for one campaign — the one parser in `shared/history.mjs`. */
export function parseOutcomes(raw = "", campaign, file, cancelled = false) {
  return historyRecords(raw, { campaign, file, status: cancelled ? "Cancelled" : "Shipped" });
}

export function deriveCampaigns(files, tasks, cancelledRaw = "") {
  return files.filter((file) => /^[^/_][^/]*\/4\s*-\s*Checklist\.md$/i.test(file.relPath) && !file.inFabled).map((checklist) => {
    const name = checklist.relPath.split("/")[0];
    const book = files.find((file) => file.module === name && / — Master Book\.md$/.test(file.relPath));
    const items = tasks.filter((task) => task.file === checklist.relPath && executionKind(idSection(book?.raw, task.idChip)?.body || "") === "delivery");
    const shipped = parseOutcomes(book?.raw, name, book?.relPath || checklist.relPath);
    const cancelled = parseOutcomes(cancelledRaw, name, CANCELLED_LOG_FILE, true);
    const open = items.filter((task) => task.state === "open");
    const held = open.filter((task) => /\bHELD\b/i.test(task.text));
    return { name, checklist, book, items, open, held, shipped, cancelled,
      blockers: open.filter((task) => task.severity === "blocker"),
      now: open.filter((task) => task.section === "Now"),
      purpose: cleanInlineText(section(book?.raw, "Purpose & ownership")),
      decisions: section(book?.raw, "Vision & Decisions"),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function taskHref(task, from = "/work") {
  const identity = task.idChip || `@${task.cbidx}`;
  return `#/work/item/${encodeURIComponent(task.module)}/${encodeURIComponent(identity)}?from=${encodeURIComponent(from)}`;
}

export function taskContext(task, campaign, decisions = []) {
  const raw = idSection(campaign?.book?.raw, task.idChip)?.body || "";
  const refs = workIds(raw).filter((id) => id !== task.idChip);
  const related = decisions.filter((decision) => `${raw} ${task.text}`.includes(decision.id) || new RegExp(`\\b${task.idChip?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(decision.constraint));
  return { raw, refs, decisions: related, held: /\bHELD\b/i.test(task.text) };
}

export function sessionForTask(task, sessions) {
  return sessions.find((s) => !isTerminal(s.state) && s.item?.campaign === task.module && (task.idChip ? s.item?.id === task.idChip : s.item?.pmFile === task.file && s.item?.cbidx === task.cbidx));
}

export const isTerminal = (state) => ["SHIPPED", "CANCELLED", "FAILED"].includes(state);
export const phaseLabel = (state) => ({ SELECTED: "Queued", DISCOVERY: "Understanding scope", SPEC_READY: "Scope review", PLAN: "Planning", PLANNING: "Planning", PLAN_READY: "Plan review", BUILDING: "Building", VALIDATING: "Checking", REVIEWING: "Reviewing", UAT_PREP: "Preparing handoff", UAT_READY: "Ready for review", ACCEPTED: "Accepted · awaiting shipment", SHIPPED: "Shipped", CANCELLED: "Cancelled", FAILED: "Failed", BLOCKED: "Blocked", NEEDS_DECISION: "Needs a decision" }[state] || state || "Unknown");
export const gateLabel = (gate) => ({ spec: "Review scope", plan: "Review plan", uat: "Review outcome", question: "Answer question", blocked: "Resolve blocker", budget: "Review budget", shipped: "Confirm shipment" }[gate] || "Review session");
export function sessionStatus(session) {
  if (isTerminal(session.state)) return phaseLabel(session.state);
  if (session.awaiting) return gateLabel(session.awaiting.gate);
  if (session.execution?.paused) return "Paused";
  if (session.runnerAlive === false) return "Stopped";
  return phaseLabel(session.state);
}
export function timeLabel(stamp) {
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
