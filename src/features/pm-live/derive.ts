// src/features/pm-live/derive.ts
// Pure derivations behind the board and the dashboard widgets. Kept free of
// React so the grouping/sorting/rollup logic — the part most likely to break
// silently — is unit-testable in this repo's node-environment test setup.
// selectors.ts is the thin memoized hook layer over these.

import { matchesQuery, type ParsedQuery } from "./query";
import type { GroupBy, SortBy } from "./viewState";
import { LANES, SEVERITIES } from "./types";
import type {
  CampaignRollup,
  CompletedDay,
  FleetSnapshot,
  HistorySnapshot,
  PmTask,
  RollupsSnapshot,
  SessionSnapshot,
} from "./types";

export const TERMINAL_STATES = new Set(["SHIPPED", "CANCELLED"]);

const SEVERITY_RANK: Record<string, number> = { blocker: 0, friction: 1, annoyance: 2, parked: 3 };
const EFFORT_RANK: Record<string, number> = { S: 0, M: 1, L: 2 };

const severityRank = (t: PmTask) => (t.severity ? SEVERITY_RANK[t.severity] : 9);
const effortRank = (t: PmTask) => (t.effort ? (EFFORT_RANK[t.effort] ?? 8) : 9);

export const COMPARATORS: Record<SortBy, (a: PmTask, b: PmTask) => number> = {
  lane: (a, b) => a.sectionRank - b.sectionRank || a.module.localeCompare(b.module) || a.cbidx - b.cbidx,
  severity: (a, b) => severityRank(a) - severityRank(b) || a.sectionRank - b.sectionRank || a.cbidx - b.cbidx,
  effort: (a, b) => effortRank(a) - effortRank(b) || a.sectionRank - b.sectionRank || a.cbidx - b.cbidx,
  campaign: (a, b) => a.module.localeCompare(b.module) || a.sectionRank - b.sectionRank || a.cbidx - b.cbidx,
  file: (a, b) => a.file.localeCompare(b.file) || a.cbidx - b.cbidx,
};

const GROUP_KEY: Record<GroupBy, (t: PmTask) => string> = {
  campaign: (t) => t.module,
  lane: (t) => t.section,
  severity: (t) => t.severity || "unrated",
  effort: (t) => t.effort || "unsized",
  none: () => "All",
};

/** Group order is meaningful for lane/severity/effort; alphabetical elsewhere. */
const GROUP_ORDER: Partial<Record<GroupBy, readonly string[]>> = {
  lane: LANES,
  severity: [...SEVERITIES, "unrated"],
  effort: ["S", "M", "L", "unsized"],
};

export const pmTaskKey = (task: PmTask) => `${task.file}::${task.cbidx}`;

/**
 * The board is a working queue, so done items are hidden unless the query asks
 * for them explicitly (`is:done` / `is:open`). A done item only sits in a lane
 * at all when a sweep to `1 - Feature State.md` is overdue — lint W1.
 */
export function filterTasks(tasks: PmTask[], parsed: ParsedQuery): PmTask[] {
  const explicitState = !!parsed.filters.is;
  return tasks.filter((t) => (explicitState || t.state !== "done") && matchesQuery(t, parsed));
}

export interface TaskGroup {
  key: string;
  tasks: PmTask[];
}

export function groupTasks(tasks: PmTask[], groupBy: GroupBy, sortBy: SortBy): TaskGroup[] {
  const sorted = [...tasks].sort(COMPARATORS[sortBy]);
  const keyOf = GROUP_KEY[groupBy];
  const map = new Map<string, PmTask[]>();
  for (const task of sorted) {
    const key = keyOf(task);
    const list = map.get(key);
    if (list) list.push(task);
    else map.set(key, [task]);
  }

  const order = GROUP_ORDER[groupBy];
  const groups = Array.from(map.entries()).map(([key, groupTasksList]) => ({ key, tasks: groupTasksList }));
  groups.sort((a, b) => {
    if (order) {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      if (ia !== ib) return (ia < 0 ? order.length : ia) - (ib < 0 ? order.length : ib);
    }
    return a.key.localeCompare(b.key);
  });
  return groups;
}

// ---- overview aggregates ---------------------------------------------------

export interface PmKpis {
  open: number;
  blockers: number;
  campaigns: number;
  lintErrors: number;
  activeSessions: number;
  totalSpendUsd: number;
  shippedLast7: number;
  rollupsMissing: boolean;
}

export function computeKpis(
  tasks: PmTask[],
  rollups: RollupsSnapshot | null,
  history: HistorySnapshot | null,
  fleet: FleetSnapshot | null,
  now = Date.now(),
): PmKpis {
  const open = tasks.filter((t) => t.state !== "done");
  const cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    // Prefer the rollup, but stay useful on an older bridge by deriving from tasks.
    open: rollups?.totals.open ?? open.length,
    blockers: rollups?.totals.blockers ?? open.filter((t) => t.severity === "blocker").length,
    campaigns: rollups?.totals.campaigns ?? new Set(open.map((t) => t.module)).size,
    lintErrors: rollups?.totals.lintErrors ?? 0,
    activeSessions: (fleet?.sessions || []).filter((s) => !TERMINAL_STATES.has(s.state)).length,
    totalSpendUsd: fleet?.totalSpendUsd ?? 0,
    shippedLast7: (history?.completions || []).filter((c) => c.date >= cutoff).length,
    rollupsMissing: !rollups,
  };
}

export interface SeveritySlice {
  severity: string;
  count: number;
}

/** Open-item severity mix across the whole board. */
export function computeSeverityMix(tasks: PmTask[], rollups: RollupsSnapshot | null): SeveritySlice[] {
  const counts: Record<string, number> = { blocker: 0, friction: 0, annoyance: 0, parked: 0, unrated: 0 };
  if (rollups) {
    for (const campaign of rollups.campaigns) {
      for (const severity of SEVERITIES) counts[severity] += campaign.checklist.bySeverity[severity];
      counts.unrated += campaign.checklist.bySeverity.none;
    }
  } else {
    for (const task of tasks.filter((t) => t.state !== "done")) counts[task.severity || "unrated"] += 1;
  }
  return Object.entries(counts).map(([severity, count]) => ({ severity, count }));
}

export interface VelocityPoint {
  date: string;
  count: number;
  cumulative: number;
}

/**
 * Completions per day plus a running total, over the `days` window ending on
 * the last recorded completion. Sparse by nature: done-stamps are only as
 * complete as each campaign's sweep discipline.
 */
export function computeVelocity(completedByDay: CompletedDay[], days = 30): VelocityPoint[] {
  if (!completedByDay.length) return [];
  const counts = new Map(completedByDay.map((d) => [d.date, d.count]));
  const end = new Date(`${completedByDay[completedByDay.length - 1].date}T00:00:00Z`);
  const out: VelocityPoint[] = [];
  let cumulative = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const count = counts.get(date) || 0;
    cumulative += count;
    out.push({ date, count, cumulative });
  }
  return out;
}

export interface AttentionItem {
  kind: "gate" | "error" | "blocker";
  sessionId?: string;
  label: string;
  detail: string;
  task?: PmTask;
}

/**
 * "Needs you" — a stalled gate is the thing that actually blocks delivery, so
 * gates rank above errors, which rank above not-yet-started Now-lane blockers.
 */
export function computeAttention(
  fleet: FleetSnapshot | null,
  sessions: Record<string, SessionSnapshot>,
  tasks: PmTask[],
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const row of fleet?.sessions || []) {
    if (TERMINAL_STATES.has(row.state)) continue;
    const detail = sessions[row.sessionId];
    const gate = (detail?.awaiting ?? row.awaiting)?.gate;
    if (gate) {
      out.push({
        kind: "gate",
        sessionId: row.sessionId,
        label: gate === "question" ? "Agent asked a question" : `Waiting on the ${gate} gate`,
        detail: row.item.text,
      });
    }
    if (detail?.lastError?.message) {
      out.push({ kind: "error", sessionId: row.sessionId, label: "Session error", detail: detail.lastError.message });
    }
  }
  for (const task of tasks.filter((t) => t.state !== "done" && t.severity === "blocker" && t.section === "Now")) {
    out.push({ kind: "blocker", label: task.idChip || "Blocker", detail: task.text, task });
  }
  return out;
}

/** Campaign rollups sorted by what hurts most: blockers, then open volume. */
export function sortCampaigns(campaigns: CampaignRollup[]): CampaignRollup[] {
  return [...campaigns].sort(
    (a, b) =>
      b.checklist.bySeverity.blocker - a.checklist.bySeverity.blocker ||
      b.checklist.open - a.checklist.open ||
      a.campaign.localeCompare(b.campaign),
  );
}

export interface TokenTotals {
  input: number;
  cachedInput: number;
  output: number;
}

export function computeTokenTotals(fleet: FleetSnapshot | null, sessions: Record<string, SessionSnapshot>): TokenTotals {
  return (fleet?.sessions || []).reduce(
    (acc, row) => {
      const usage = sessions[row.sessionId]?.usageTotal ?? row.usageTotal;
      if (!usage) return acc;
      return {
        input: acc.input + usage.input,
        cachedInput: acc.cachedInput + usage.cachedInput,
        output: acc.output + usage.output,
      };
    },
    { input: 0, cachedInput: 0, output: 0 },
  );
}
