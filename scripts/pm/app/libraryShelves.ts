import { workOutcomes } from "../shared/metrics.mjs";
import { groupedTasks, OWNER_GROUP } from "../shared/tasks.mjs";
import { cleanInlineText, stripFences } from "../shared/text.mjs";
import { executionKind } from "../shared/work-lifecycle.mjs";
import { bucketOf, canDeliver, sourceFile } from "./model";
import { fieldMarkdown } from "./workAcceptance";
import type { World, Receipt, Space, Work } from "./types";

export const cabinetShelves = [
  { id: "now", name: "To do now" },
  { id: "next", name: "Next" },
  { id: "waiting", name: "Blocked" },
  { id: "later", name: "Later" },
  { id: "finished", name: "Finished" },
] as const;
export type CabinetShelf = (typeof cabinetShelves)[number]["id"];
export interface CabinetEntry {
  id: string;
  title: string;
  shelf: CabinetShelf;
  work: Work | null;
  receipt: Receipt | null;
}

export function cabinetMedium(campaign: string) {
  if (campaign === "Budget") return "tablet";
  if (campaign === "Hub & ERA") return "glass";
  return ["Kitchen", "Recipes"].includes(campaign) ? "book" : "folio";
}

function entryTitle(title: string, id: string) {
  const trimmed = title.replace(/\s*[→—]\s*(?:record|criteria)\s*$/i, "").trim();
  if (trimmed.slice(0, id.length).toUpperCase() !== id.toUpperCase()) return trimmed;
  const rest = trimmed.slice(id.length);
  return /^[\s·:—–-]/u.test(rest) ? rest.replace(/^[\s·:—–-]+/u, "") || id : trimmed;
}

export function libraryShelves(space: Space, readiness?: World["planningReadiness"]): CabinetEntry[] {
  const open = space.work.filter(work => work.state === "open").map((work): CabinetEntry => ({
    id: work.id, title: entryTitle(work.title, work.id), work, receipt: null,
    shelf: readiness?.[work.id]?.state === "blocked" ? "waiting" : bucketOf(work),
  }));
  // workOutcomes resolves exact identities, reopening, cancellations, repeat
  // receipts and checked rows awaiting their sweep using the dashboard rules.
  const completed: { workId: string; item: Work | null; record: Receipt | null }[] = workOutcomes(space).completed;
  const checked = new Map(space.work.filter(work => work.state === "done").map(work => [work.id.toUpperCase(), work]));
  const finished = completed.map(({ workId, item, record }): CabinetEntry => {
    const work = item || checked.get(workId) || null;
    return { id: work?.id || workId, title: entryTitle(work?.title || record?.text || workId, workId), shelf: "finished", work, receipt: record };
  });
  // Legacy checklist rows without an ID still have a usable checklist ordinal.
  for (const work of checked.values()) {
    if (!work.idChip) finished.push({ id: work.id, title: work.title, work, receipt: null, shelf: "finished" });
  }
  return [...open, ...finished.sort((a, b) => (b.receipt?.date || "").localeCompare(a.receipt?.date || ""))];
}

export const libraryCabinetCount = (space: Space) => libraryShelves(space).length;

export function libraryDeliveryBlock(world: World, work: Work): string | null {
  if (work.state !== "open") return "Finished";
  const row = groupedTasks(sourceFile(world, work.file)?.raw || "").find(task => task.line === work.line);
  if (row?.group === OWNER_GROUP || executionKind(work.contract) === "owner") return "Needs you";
  if (work.blocked || world.planningReadiness?.[work.id]?.state === "blocked") return "Blocked";
  return canDeliver(work) ? null : "Unavailable";
}

export function libraryPlanNotes(raw: string) {
  return fieldMarkdown(raw, /^(?:Plan(?: brief)?|Execution plan)$/i, "")
    || fieldMarkdown(raw, /^Reading guide(?:\s*\(.*\))?$/i, "");
}

export function libraryBrief(raw: string) {
  // Only interpret a single authored plan. Unrecognised and legacy formats
  // remain readable verbatim in the plan brief.
  const blocks = [...raw.matchAll(/^```delivery-plan-v1[^\S\n]*\n([\s\S]*?)^```[^\S\n]*$/gmu)];
  let steps: string[] = [], acceptance: string[] = [], planOutcome = "";
  if (blocks.length === 1) {
    try {
      const plan = JSON.parse(blocks[0][1]);
      const strings = (value: unknown): string[] =>
        Array.isArray(value) && value.every(line => typeof line === "string") ? value : [];
      steps = strings(plan?.steps);
      acceptance = strings(plan?.acceptance);
      planOutcome = typeof plan?.outcome === "string" ? plan.outcome : "";
    } catch { /* The full source remains available. */ }
  }
  const prose = stripFences(raw);
  const outcome = prose.match(/^\s*(?:-\s*)?\*\*Outcome:\*\*\s*([^\r\n]+)/im)?.[1];
  return { steps, acceptance, outcome: cleanInlineText(outcome || planOutcome) };
}
