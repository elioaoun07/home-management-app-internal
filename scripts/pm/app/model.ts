import { fileTasks } from "../shared/tasks.mjs";
import { parseFrontmatter } from "../shared/frontmatter.mjs";
import { slugify } from "../shared/links.mjs";
import { deliveryBlockReason } from "../shared/work-lifecycle.mjs";
import { idSection } from "../shared/work-id.mjs";
import {
  deriveCampaigns,
  parseDecisions,
  workTitle,
  isTerminal,
} from "../shared/product.mjs";
import { acceptanceStatements, buildPortfolio, KINDS } from "../shared/portfolio.mjs";
import type {
  Bucket,
  Receipt,
  RunSummary,
  Snapshot,
  Space,
  Work,
  World,
} from "./types";
export const buckets: { id: Bucket; label: string; note: string }[] = [
  { id: "now", label: "Now", note: "In focus" },
  { id: "next", label: "Up next", note: "Ready to follow" },
  { id: "waiting", label: "Waiting", note: "A prerequisite remains" },
  { id: "later", label: "Someday", note: "Kept for later" },
];
export function bucketOf(work: Work): Bucket {
  return work.blocked
    ? "waiting"
    : work.section === "Now"
      ? "now"
      : work.section === "Next"
        ? "next"
        : "later";
}
export function buildWorld(snapshot: Snapshot): World {
  const files = snapshot.files.map((file) => ({
    ...file,
    module: file.relPath.split("/")[0],
    inFabled: /^(superseded|baseline-frozen|template)$/.test(
      String(
        (parseFrontmatter(file.raw).meta as Record<string, unknown>).status ||
          "",
      ),
    ),
  }));
  const tasks = files.flatMap((file) =>
    fileTasks(file.raw).map((task) => ({
      ...task,
      file: file.relPath,
      module: file.module,
      key: `${file.relPath}::${task.cbidx}`,
    })),
  );
  const choices = parseDecisions(
    files.find((file) => file.relPath === "_Decisions.md")?.raw,
  );
  const portfolio = buildPortfolio(
    deriveCampaigns(files, tasks, snapshot.cancelledLog || ""),
    choices,
  );
  const work: Work[] = portfolio.items.map((item) => ({
    ...item,
    id: item.idChip || `@${item.cbidx}`,
    label: item.idLabel || item.idChip || `@${item.cbidx}`,
    title: workTitle(item),
    rawLine:
      files.find((file) => file.relPath === item.file)?.raw.split("\n")[
        item.line
      ] || "",
  }));
  const spaces: Space[] = portfolio.campaigns.map(
    (space: {
      name: string;
      purpose: string;
      book?: { relPath: string; raw: string };
      shipped: Receipt[];
      cancelled: Receipt[];
    }) => ({
      name: space.name,
      purpose: space.purpose,
      book: space.book,
      work: work.filter((item) => item.module === space.name),
      history: [...space.shipped, ...space.cancelled].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    }),
  );
  return {
    spaces,
    work,
    choices,
    history: spaces
      .flatMap((space) => space.history)
      .sort((a, b) => b.date.localeCompare(a.date)),
    files: snapshot.files,
    // Explicitly read history, never part of the scanned backlog.
    sources:
      snapshot.cancelledLog == null
        ? []
        : [{ relPath: CANCELLED_LOG, raw: snapshot.cancelledLog }],
    generatedAt: snapshot.generatedAt,
    offline: !!snapshot.offline,
    cachedAt: snapshot.cachedAt,
  };
}
const aliases: Record<string, string> = {
  ai: "intelligence",
  ux: "experience",
  ui: "experience",
  mobile: "mobile",
  offline: "sync",
  household: "household",
  notifications: "notifications",
};
export function discover(work: Work[], query: string): Work[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return work.filter((item) =>
    terms.every(
      (term) =>
        item.topicIds.includes(aliases[term]) ||
        `${item.id} ${item.title} ${item.module} ${item.outcome} ${acceptanceStatements(item.contract).join(" ")}`
          .toLowerCase()
          .includes(term),
    ),
  );
}
export const liveRuns = (runs: RunSummary[]) =>
  runs.filter((run) => !isTerminal(run.state));
export const runFor = (work: Work, runs: RunSummary[]) =>
  liveRuns(runs).find(
    (run) => run.item.id === work.id && run.item.campaign === work.module,
  );
export const backPath = (from: string | null, fallback = "/") =>
  from?.startsWith("/") && !from.startsWith("//") ? from : fallback;
export const workPath = (work: Work, from = "/explore") =>
  `/work/${encodeURIComponent(work.module)}/${encodeURIComponent(work.id)}?from=${encodeURIComponent(from)}`;
export const canDeliver = (work: Work) => !work.blocked && !/\bHELD\b/i.test(work.text) && !deliveryBlockReason({ file: work.file, state: work.state, contract: work.contract });

/** One completed outcome per identity; an explicitly reopened item stays open. */
export function doneReceipts(world: World): Receipt[] {
  const latest = new Map<string, Receipt>();
  for (const entry of world.history) {
    if (!entry.workId) continue;
    const key = `${entry.campaign}:${entry.workId}`;
    if (!latest.has(key)) latest.set(key, entry);
  }
  return [...latest.values()].filter((entry) => entry.status === "Shipped" && !world.work.some((work) => work.module === entry.campaign && work.id === entry.workId)).map((entry) => {
    const book = world.spaces.find((space) => space.name === entry.campaign)?.book;
    const outcome = idSection(book?.raw, entry.workId)?.body.match(/\*\*Outcome:\*\*\s*([^\r\n]+)/)?.[1];
    return outcome ? { ...entry, text: `${entry.workId} · ${outcome}` } : entry;
  });
}
export const spacePath = (name: string) => `/space/${encodeURIComponent(name)}`;
const CANCELLED_LOG = "_Archive/Cancelled Log.md";
export const readerPath = (file: string, anchor?: string | null, from?: string) =>
  `/read?file=${encodeURIComponent(file)}${anchor ? `&anchor=${encodeURIComponent(anchor)}` : ""}${from ? `&from=${encodeURIComponent(from)}` : ""}`;
const chipAnchor = (work: Work) => slugify(work.idChip || work.id);
/** The exact checklist row this chip identifies — always the owning checklist file. */
export const checklistPath = (work: Work, from?: string) =>
  readerPath(work.file, chipAnchor(work), from);
/** The exact acceptance heading when the book has one; otherwise the owning checklist row. */
export function briefPath(work: Work, world: World, from?: string) {
  const book = world.spaces.find((space) => space.name === work.module)?.book;
  return book && work.briefAnchor
    ? readerPath(book.relPath, work.briefAnchor, from)
    : checklistPath(work, from);
}
export const historyPath = (entry: Receipt) =>
  readerPath(
    entry.file,
    slugify(entry.status === "Cancelled" ? entry.campaign : "Shipped Log"),
  );
export const sourceFile = (world: World, relPath: string) =>
  world.files.find((file) => file.relPath === relPath) ||
  world.sources?.find((file) => file.relPath === relPath);
export function historyDays(history: Receipt[], today = new Date()) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - 13 + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      count: history.filter(
        // A date range or an unrecorded date is never placed on a single day.
        (entry) =>
          entry.date === key &&
          entry.datePrecision === "day" &&
          entry.status === "Shipped",
      ).length,
    };
  });
}

// --- Dashboard: filters and drilldown selection round-trip through the URL. ---
export const DASHBOARD_WEEKS = [8, 16, 26, 0] as const;
export type DashboardSet = "undated" | "before" | "all" | "reopened";
export interface DashboardQuery {
  campaign: string | null;
  /** 0 = from the first dated record. */
  weeks: number;
  week: string | null;
  set: DashboardSet | null;
}
export function parseDashboardQuery(query: URLSearchParams): DashboardQuery {
  const weeks = Number(query.get("weeks"));
  const set = query.get("set") as DashboardSet | null;
  return {
    campaign: query.get("campaign") || null,
    weeks: (DASHBOARD_WEEKS as readonly number[]).includes(weeks) && query.has("weeks") ? weeks : 16,
    week: /^\d{4}-\d{2}-\d{2}$/.test(query.get("week") || "") ? query.get("week") : null,
    set: set && ["undated", "before", "all", "reopened"].includes(set) ? set : null,
  };
}
export function dashboardQueryString(query: DashboardQuery): string {
  const params = new URLSearchParams();
  if (query.campaign) params.set("campaign", query.campaign);
  if (query.weeks !== 16) params.set("weeks", String(query.weeks));
  if (query.week) params.set("week", query.week);
  else if (query.set) params.set("set", query.set);
  return params.size ? `?${params}` : "";
}

// --- Board/List: Now/Next/Later stay the persisted priority. Blocked, active
// and review are read-only badges over the same rows — never a fourth lane
// and never a relocation of a checked-in priority. ---
export type Lane = "Now" | "Next" | "Later";
export const LANES: Lane[] = ["Now", "Next", "Later"];
export const laneOf = (work: Work): Lane =>
  (LANES as string[]).includes(work.section) ? (work.section as Lane) : "Later";
export function laneGroups(work: Work[]): Record<Lane, Work[]> {
  const groups: Record<Lane, Work[]> = { Now: [], Next: [], Later: [] };
  for (const item of work) groups[laneOf(item)].push(item);
  return groups;
}
export type Activity = "blocked" | "active" | "review";
/** Every badge that currently applies; an item can be both blocked and active. */
export function activityBadges(work: Work, runs: RunSummary[]): Activity[] {
  const badges: Activity[] = [];
  if (work.state === "open" && work.blocked) badges.push("blocked");
  if (runFor(work, runs)) badges.push("active");
  if (work.state === "done") badges.push("review");
  return badges;
}
// "unclassified" is not a guess — it is the honest label until a Master Book
// ID section declares `**Kind:**` for that row.
export const KIND_OPTIONS = [...KINDS, "unclassified"] as const;
export type Status = "open" | "blocked" | "active" | "review";
export const STATUS_OPTIONS: Status[] = ["open", "blocked", "active", "review"];
export interface BoardFilters {
  view: "board" | "list";
  status: Status;
  campaigns: string[];
  kind: string | null;
  lane: Lane;
}
export function parseBoardQuery(query: URLSearchParams): BoardFilters {
  const status = STATUS_OPTIONS.includes(query.get("status") as Status)
    ? (query.get("status") as Status)
    : "open";
  const lane = LANES.includes(query.get("lane") as Lane)
    ? (query.get("lane") as Lane)
    : "Now";
  return {
    view: query.get("view") === "list" ? "list" : "board",
    status,
    campaigns: (query.get("campaigns") || "").split(",").filter(Boolean),
    kind: query.get("kind") || null,
    lane,
  };
}
/**
 * Every filter round-trips through the URL so a filtered board can be
 * reloaded and shared. `view` is always written (never the omitted default)
 * — an absent `view` is what tells the Work page to show Search instead.
 */
export function boardQueryString(filters: BoardFilters): string {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  if (filters.status !== "open") params.set("status", filters.status);
  if (filters.campaigns.length) params.set("campaigns", filters.campaigns.join(","));
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.lane !== "Now") params.set("lane", filters.lane);
  return params.size ? `?${params}` : "";
}
export function matchesBoardFilters(
  work: Work,
  runs: RunSummary[],
  filters: Pick<BoardFilters, "status" | "campaigns" | "kind">,
): boolean {
  if (filters.campaigns.length && !filters.campaigns.includes(work.module))
    return false;
  if (filters.kind && work.kind !== filters.kind) return false;
  if (filters.status === "review") return work.state === "done";
  if (work.state !== "open") return false;
  return (
    filters.status === "open" ||
    activityBadges(work, runs).includes(filters.status)
  );
}
