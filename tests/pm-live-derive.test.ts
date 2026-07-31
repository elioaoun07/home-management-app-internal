// tests/pm-live-derive.test.ts
// The derivations behind /pm/live's board and dashboard widgets. These are the
// parts that fail silently — a wrong group order or a KPI that quietly reads 0
// looks like a normal board — so they're covered here rather than left to a
// visual check.
import { describe, expect, it } from "vitest";

import {
  computeAttention,
  computeKpis,
  computeSeverityMix,
  computeTokenTotals,
  computeVelocity,
  displayText,
  filterTasks,
  groupTasks,
  sortCampaigns,
} from "../src/features/pm-live/derive";
import { formatUsd } from "../src/features/pm-live/chartTheme";
import { parseQuery } from "../src/features/pm-live/query";
import type {
  CampaignRollup,
  ChecklistRollup,
  FleetSnapshot,
  PmTask,
  RollupsSnapshot,
  SessionSnapshot,
} from "../src/features/pm-live/types";

function task(overrides: Partial<PmTask> = {}): PmTask {
  return {
    idChip: "BUD-1",
    text: "An outcome",
    severity: "friction",
    effort: "M",
    state: "open",
    section: "Next",
    sectionRank: 1,
    cbidx: 0,
    file: "Budget/4 - Checklist.md",
    module: "Budget",
    textHash: "h",
    lineText: "- [ ] **BUD-1** An outcome _(friction - M)_",
    ...overrides,
  };
}

const BOARD: PmTask[] = [
  task({ idChip: "BUD-1", module: "Budget", section: "Later", sectionRank: 2, severity: "parked", effort: "L", cbidx: 2 }),
  task({ idChip: "BUD-2", module: "Budget", section: "Now", sectionRank: 0, severity: "blocker", effort: "S", cbidx: 0 }),
  task({ idChip: "SCH-1", module: "Schedule", section: "Now", sectionRank: 0, severity: "friction", effort: "M", cbidx: 1, file: "Schedule/4 - Checklist.md" }),
  task({ idChip: "KIT-1", module: "Kitchen", section: "Next", sectionRank: 1, severity: null, effort: null, cbidx: 0, file: "Kitchen/4 - Checklist.md" }),
  task({ idChip: "BUD-3", module: "Budget", section: "Now", sectionRank: 0, severity: "blocker", effort: "S", cbidx: 3, state: "done" }),
];

describe("displayText", () => {
  it("strips the leading ID chip and trailing (severity - effort) suffix", () => {
    const t = task({
      idChip: "BUD-11",
      text: "BUD-11 [TEST] Verify queryConfig cache timings align with API response patterns (annoyance - S)",
    });
    expect(displayText(t)).toBe("[TEST] Verify queryConfig cache timings align with API response patterns");
  });

  it("handles a dotted sub-item ID and an uppercase X effort", () => {
    const t = task({ idChip: "SCH-1c.1", text: "SCH-1c.1 Guard the placement rule (blocker - X)" });
    expect(displayText(t)).toBe("Guard the placement rule");
  });

  it("is a no-op when the text has neither an ID chip nor a meta suffix", () => {
    const t = task({ idChip: null, text: "A plain bullet with no chip" });
    expect(displayText(t)).toBe("A plain bullet with no chip");
  });

  it("does not touch ordinary prose with no leading ID pattern", () => {
    const t = task({ idChip: null, text: "Improving UX for the whole team" });
    expect(displayText(t)).toBe("Improving UX for the whole team");
  });
});

describe("filterTasks", () => {
  it("hides done items by default — the board is a queue, not an archive", () => {
    const out = filterTasks(BOARD, parseQuery(""));
    expect(out).toHaveLength(4);
    expect(out.every((t) => t.state === "open")).toBe(true);
  });

  it("reveals done items only when the query names a state explicitly", () => {
    expect(filterTasks(BOARD, parseQuery("is:done")).map((t) => t.idChip)).toEqual(["BUD-3"]);
    expect(filterTasks(BOARD, parseQuery("is:open"))).toHaveLength(4);
  });

  it("combines a filter with free text", () => {
    expect(filterTasks(BOARD, parseQuery("m:Budget s:blocker")).map((t) => t.idChip)).toEqual(["BUD-2"]);
    expect(filterTasks(BOARD, parseQuery("outcome")).length).toBe(4);
    expect(filterTasks(BOARD, parseQuery("nothing-matches-this"))).toEqual([]);
  });

  it("matches an ID chip by free text, so pasting an ID finds its row", () => {
    expect(filterTasks(BOARD, parseQuery("SCH-1")).map((t) => t.idChip)).toEqual(["SCH-1"]);
  });
});

describe("groupTasks", () => {
  const open = filterTasks(BOARD, parseQuery(""));

  it("orders lanes Now → Next → Later, not alphabetically", () => {
    expect(groupTasks(open, "lane", "lane").map((g) => g.key)).toEqual(["Now", "Next", "Later"]);
  });

  it("orders severity by rank and parks unrated last", () => {
    expect(groupTasks(open, "severity", "severity").map((g) => g.key)).toEqual(["blocker", "friction", "parked", "unrated"]);
  });

  it("orders effort S → M → L with unsized last", () => {
    expect(groupTasks(open, "effort", "effort").map((g) => g.key)).toEqual(["S", "M", "L", "unsized"]);
  });

  it("falls back to alphabetical for campaigns", () => {
    expect(groupTasks(open, "campaign", "campaign").map((g) => g.key)).toEqual(["Budget", "Kitchen", "Schedule"]);
  });

  it("collapses to a single bucket when grouping is off, still sorted", () => {
    const groups = groupTasks(open, "none", "lane");
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((t) => t.idChip)).toEqual(["BUD-2", "SCH-1", "KIT-1", "BUD-1"]);
  });

  it("sorts by severity across groups when asked", () => {
    expect(groupTasks(open, "none", "severity")[0].tasks.map((t) => t.idChip)).toEqual(["BUD-2", "SCH-1", "BUD-1", "KIT-1"]);
  });
});

// ---------------------------------------------------------------------------

function checklist(overrides: Partial<ChecklistRollup> = {}): ChecklistRollup {
  return {
    total: 4,
    done: 1,
    open: 3,
    byLane: { Now: 1, Next: 1, Later: 1 },
    bySeverity: { blocker: 1, friction: 1, annoyance: 0, parked: 1, none: 0 },
    byEffort: { S: 1, M: 1, L: 1, other: 0 },
    ...overrides,
  };
}

function campaign(name: string, overrides: Partial<CampaignRollup> = {}): CampaignRollup {
  return {
    campaign: name,
    prefix: name.slice(0, 3).toUpperCase(),
    checklist: checklist(),
    pain: { blocker: 0, friction: 0, annoyance: 0, parked: 0 },
    updated: "2026-07-25",
    mtimeMs: 0,
    lint: { errors: 0, warnings: 0 },
    ...overrides,
  };
}

const ROLLUPS: RollupsSnapshot = {
  generatedAt: "2026-07-25T00:00:00.000Z",
  campaigns: [campaign("Budget"), campaign("Schedule")],
  totals: { campaigns: 2, total: 8, done: 2, open: 6, blockers: 2, painBlockers: 0, lintErrors: 3, lintWarnings: 5 },
};

const FLEET: FleetSnapshot = {
  sessions: [
    {
      sessionId: "s-1",
      state: "BUILDING",
      awaiting: null,
      agent: "claude",
      item: { text: "Live one", id: "BUD-2", campaign: "Budget", pmFile: "Budget/4 - Checklist.md", cbidx: 0 },
      updatedAt: "2026-07-25T10:00:00.000Z",
      usageTotal: { input: 100, cachedInput: 900, output: 50, costUsd: 1.25 },
      runnerAlive: true,
    },
    {
      sessionId: "s-2",
      state: "SHIPPED",
      awaiting: null,
      agent: "codex",
      item: { text: "Done one", id: "SCH-1", campaign: "Schedule", pmFile: "Schedule/4 - Checklist.md", cbidx: 1 },
      updatedAt: "2026-07-24T10:00:00.000Z",
      usageTotal: { input: 20, cachedInput: 10, output: 5, costUsd: 0.75 },
      runnerAlive: false,
    },
  ],
  buildLockActive: true,
  totalSpendUsd: 2,
  byState: { BUILDING: 1, SHIPPED: 1 },
  generatedAt: "2026-07-25T10:00:00.000Z",
};

describe("computeKpis", () => {
  const now = Date.parse("2026-07-25T12:00:00.000Z");

  it("prefers rollup totals when the bridge publishes them", () => {
    const kpis = computeKpis(BOARD, ROLLUPS, null, FLEET, now);
    expect(kpis).toMatchObject({ open: 6, blockers: 2, campaigns: 2, lintErrors: 3, rollupsMissing: false });
  });

  it("still works on an older bridge by deriving from the tasks row", () => {
    const kpis = computeKpis(BOARD, null, null, FLEET, now);
    // 4 open tasks, 1 of them a blocker, across 3 campaigns.
    expect(kpis).toMatchObject({ open: 4, blockers: 1, campaigns: 3, lintErrors: 0, rollupsMissing: true });
  });

  it("counts only non-terminal sessions as active", () => {
    expect(computeKpis(BOARD, ROLLUPS, null, FLEET, now).activeSessions).toBe(1);
    expect(computeKpis(BOARD, ROLLUPS, null, FLEET, now).totalSpendUsd).toBe(2);
  });

  it("counts completions inside the trailing 7 days only", () => {
    const history = {
      generatedAt: "",
      completedByDay: [],
      completions: [
        { date: "2026-07-24", campaign: "Budget", idChip: "BUD-9", text: "recent" },
        { date: "2026-07-19", campaign: "Budget", idChip: "BUD-8", text: "on the boundary" },
        { date: "2026-06-01", campaign: "Budget", idChip: "BUD-7", text: "old" },
      ],
    };
    expect(computeKpis(BOARD, ROLLUPS, history, FLEET, now).shippedLast7).toBe(2);
  });

  it("survives every snapshot being absent", () => {
    expect(computeKpis([], null, null, null, now)).toMatchObject({ open: 0, blockers: 0, activeSessions: 0, totalSpendUsd: 0 });
  });
});

describe("computeSeverityMix", () => {
  it("sums across campaigns from the rollup", () => {
    expect(computeSeverityMix([], ROLLUPS)).toEqual([
      { severity: "blocker", count: 2 },
      { severity: "friction", count: 2 },
      { severity: "annoyance", count: 0 },
      { severity: "parked", count: 2 },
      { severity: "unrated", count: 0 },
    ]);
  });

  it("falls back to counting open tasks, bucketing null severity as unrated", () => {
    expect(computeSeverityMix(BOARD, null)).toEqual([
      { severity: "blocker", count: 1 },
      { severity: "friction", count: 1 },
      { severity: "annoyance", count: 0 },
      { severity: "parked", count: 1 },
      { severity: "unrated", count: 1 },
    ]);
  });
});

describe("computeVelocity", () => {
  it("fills gap days with zero and accumulates a running total", () => {
    const series = computeVelocity(
      [
        { date: "2026-07-23", count: 2, byCampaign: { Budget: 2 } },
        { date: "2026-07-25", count: 3, byCampaign: { Schedule: 3 } },
      ],
      4,
    );
    expect(series).toEqual([
      { date: "2026-07-22", count: 0, cumulative: 0 },
      { date: "2026-07-23", count: 2, cumulative: 2 },
      { date: "2026-07-24", count: 0, cumulative: 2 },
      { date: "2026-07-25", count: 3, cumulative: 5 },
    ]);
  });

  it("returns nothing rather than a flat zero line when no work is dated", () => {
    expect(computeVelocity([], 30)).toEqual([]);
  });
});

describe("computeAttention", () => {
  it("ranks gates first, then errors, then Now-lane blockers", () => {
    const fleet: FleetSnapshot = {
      ...FLEET,
      sessions: [{ ...FLEET.sessions[0], awaiting: { gate: "uat" } }, FLEET.sessions[1]],
    };
    const sessions: Record<string, SessionSnapshot> = {
      "s-1": {
        sessionId: "s-1",
        state: "REVIEWING",
        awaiting: { gate: "uat" },
        agent: "claude",
        item: { text: "Live one", id: "BUD-2", campaign: "Budget" },
        usageTotal: null,
        budgetCurrent: null,
        build: null,
        lastError: { message: "validation failed" },
        updatedAt: "",
        runner: { alive: true, heartbeatAt: null },
        eventsTail: [],
      },
    };
    expect(computeAttention(fleet, sessions, BOARD).map((a) => a.kind)).toEqual(["gate", "error", "blocker"]);
  });

  it("ignores terminal sessions and done blockers", () => {
    // s-2 is SHIPPED; BUD-3 is a done Now-lane blocker.
    expect(computeAttention({ ...FLEET, sessions: [FLEET.sessions[1]] }, {}, BOARD)).toEqual([
      { kind: "blocker", label: "BUD-2", detail: "An outcome", task: expect.objectContaining({ idChip: "BUD-2" }) },
    ]);
  });

  it("says nothing when nothing is waiting", () => {
    expect(computeAttention(null, {}, [])).toEqual([]);
  });
});

describe("sortCampaigns", () => {
  it("puts the most blocked campaign first, then the most open", () => {
    const sorted = sortCampaigns([
      campaign("Quiet", { checklist: checklist({ open: 1, bySeverity: { blocker: 0, friction: 1, annoyance: 0, parked: 0, none: 0 } }) }),
      campaign("Busy", { checklist: checklist({ open: 20, bySeverity: { blocker: 0, friction: 20, annoyance: 0, parked: 0, none: 0 } }) }),
      campaign("Blocked", { checklist: checklist({ open: 2, bySeverity: { blocker: 3, friction: 0, annoyance: 0, parked: 0, none: 0 } }) }),
    ]);
    expect(sorted.map((c) => c.campaign)).toEqual(["Blocked", "Busy", "Quiet"]);
  });

  it("does not mutate its input", () => {
    const input = [campaign("B"), campaign("A")];
    sortCampaigns(input);
    expect(input.map((c) => c.campaign)).toEqual(["B", "A"]);
  });
});

describe("computeTokenTotals", () => {
  it("sums across sessions and tolerates a missing usage record", () => {
    expect(computeTokenTotals(FLEET, {})).toEqual({ input: 120, cachedInput: 910, output: 55 });
    expect(computeTokenTotals(null, {})).toEqual({ input: 0, cachedInput: 0, output: 0 });
  });

  it("prefers the richer per-session snapshot over the fleet row", () => {
    const sessions: Record<string, SessionSnapshot> = {
      "s-1": {
        sessionId: "s-1",
        state: "BUILDING",
        awaiting: null,
        agent: "claude",
        item: { text: "", id: null, campaign: null },
        usageTotal: { input: 1, cachedInput: 2, output: 3, costUsd: 9 },
        budgetCurrent: null,
        build: null,
        lastError: null,
        updatedAt: "",
        runner: { alive: true, heartbeatAt: null },
        eventsTail: [],
      },
    };
    expect(computeTokenTotals(FLEET, sessions)).toEqual({ input: 21, cachedInput: 12, output: 8 });
  });
});

describe("formatUsd", () => {
  it("renders unavailable provider cost without throwing or inventing a zero", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(formatUsd(1.25)).toBe("$1.25");
  });
});
