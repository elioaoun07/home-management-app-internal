// Command Center Phase 6 metric contract (PM Tooling R62): one history parser,
// distinct work outcomes, attempts kept apart from work, units kept apart, and
// every chart total reconciling to the records its drilldown lists.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHistory, receiptIdentity } from "../../scripts/pm/shared/history.mjs";
import { parseOutcomes } from "../../scripts/pm/shared/product.mjs";
import {
  HISTORY_CATEGORIES,
  PRIORITIES,
  bugs,
  deliveryAttempts,
  historyCoverage,
  openWork,
  outcomeSeries,
  resourceRows,
  sprintProgress,
  weekOf,
  weekOfEntry,
  workOutcomes,
} from "../../scripts/pm/shared/metrics.mjs";
import { buildCorpusRows } from "../../scripts/pm/relay.mjs";
import { assembleSnapshot } from "../../scripts/pm/relay-shared.mjs";
import {
  buildWorld,
  dashboardQueryString,
  laneOf,
  matchesBoardFilters,
  parseDashboardQuery,
} from "../../scripts/pm/app/model";
import type { Snapshot, World } from "../../scripts/pm/app/types";

const BOOK = [
  "# Budget — Master Book",
  "## Purpose & ownership",
  "Totals.",
  "## Pain Inventory",
  "- ✅ 2026-09-01 — **BUD-50** outside the log",
  "## Acceptance Criteria Index",
  "### BUD-1",
  "**Outcome:** Totals.",
  "### BUD-2",
  "**Outcome:** Rounding.",
  "- **Kind:** bug",
  "### BUD-3",
  "**Outcome:** After totals.",
  "- **Depends on:** BUD-1.",
  "### BUD-5",
  "**Outcome:** Later.",
  "- **Kind:** feature",
  "## Shipped Log",
  "- ✅ 2026-09-08 — **BUD-10** Done once.",
  "- ✅ 2026-09-09 — **BUD-10** Stamped again.",
  "- ✅ 2026-09-02 — **BUD-11: Titled** done.",
  "- ✅ 2026-09-03 — **BUD-12 + BUD-13** a pair.",
  "- ✅ 2026-09-04 — **BUD-2** shipped before it reopened.",
  "- ✅ 2026-09-06/08 — **BUD-17** a range across two weeks.",
  "- ✅ 2026-09-09/10 — **BUD-14** a range inside one week.",
  "- ✅ *(date unrecorded)* — **BUD-15** undated.",
  "- ✅ 2026-07-01 — plain prose record.",
  "Earlier work lives in the archive.",
  "```md",
  "- ✅ 2026-09-10 — **BUD-99** example in a fence",
  "```",
  "## Delivery session log",
  "- ✅ 2026-09-10 — **BUD-16** a session line",
].join("\n");

const SNAPSHOT: Snapshot = {
  generatedAt: "2026-09-12T10:00:00Z",
  files: [
    {
      relPath: "Budget/4 - Checklist.md",
      raw: [
        "## Now",
        "- [ ] **BUD-1** Fix totals _(blocker - M)_",
        "- [ ] **BUD-2** Rounding _(friction - S)_",
        "## Next",
        "- [ ] **BUD-3** After totals _(friction - S)_",
        "- [x] **BUD-4** Ticked, not swept _(annoyance - S)_",
        "## Later",
        "- [ ] **BUD-5** Later _(parked - S)_",
      ].join("\n"),
    },
    { relPath: "Budget/Budget — Master Book.md", raw: BOOK },
    { relPath: "Kitchen/4 - Checklist.md", raw: "## Now\n- [ ] **KIT-1** Meal plan _(friction - M)_\n" },
    { relPath: "Kitchen/Kitchen — Master Book.md", raw: "## Shipped Log\n- ✅ 2026-09-09 — **KIT-9** Shipped.\n" },
  ],
  cancelledLog: "## Budget\n- ❌ 2026-09-09 — **BUD-20** Removed.\n## Kitchen\n",
};
const TODAY = "2026-09-12";

const total = (series: ReturnType<typeof outcomeSeries>, category: string) =>
  series.buckets.reduce((sum, bucket) => sum + (bucket as unknown as Record<string, unknown[]>)[category].length, 0) +
  (series.undated as unknown as Record<string, unknown[]>)[category].length +
  (series.before as unknown as Record<string, unknown[]>)[category].length +
  (series.after as unknown as Record<string, unknown[]>)[category].length;

function expectReconciled(world: World, weeks: number, today = TODAY) {
  const outcomes = workOutcomes(world);
  const series = outcomeSeries(outcomes, { weeks, today });
  for (const category of HISTORY_CATEGORIES) {
    expect(total(series, category)).toBe(series.totals[category]);
    for (const bucket of series.buckets) {
      // A record sits in a week only when its stated date is inside that week.
      for (const entry of (bucket as unknown as Record<string, { date: string; dateEnd: string | null; datePrecision: string }[]>)[category]) {
        expect(weekOfEntry(entry)).toBe(bucket.week);
      }
    }
  }
  expect(series.totals.completed).toBe(outcomes.completed.length);
  expect(new Set(outcomes.completed.map((entry) => entry.workId)).size).toBe(outcomes.completed.length);
  const open = openWork(world.work, { order: world.spaces.map((space) => space.name) });
  expect(open.rows.reduce((sum, row) => sum + PRIORITIES.reduce((lanes, lane) => lanes + row.lanes[lane].length, 0), 0)).toBe(open.total);
  expect(historyCoverage(world).reduce((sum, row) => sum + row.records, 0)).toBe(world.history.length);
  return { outcomes, series, open };
}

describe("history records", () => {
  it("classifies identity from the bold lead without guessing", () => {
    expect(receiptIdentity("DLV-1: Flight recorder foundation.")).toMatchObject({ identity: "exact", workId: "DLV-1" });
    expect(receiptIdentity("DLV-6 (D9)")).toMatchObject({ identity: "exact", workId: "DLV-6" });
    expect(receiptIdentity("SCH-4.3b")).toMatchObject({ identity: "exact", workId: "SCH-4.3B" });
    expect(receiptIdentity("R57")).toMatchObject({ identity: "exact", workId: "R57" });
    for (const lead of ["DLV-17 (D12, partial)", "DLV-33 / DLV-35", "DLV-53…DLV-60", "BUD-34 + BUD-37", "HUB-25 fix", "HUB-28..31", "DLV-1 (rest of DLV-40)"]) {
      expect(receiptIdentity(lead)).toMatchObject({ identity: "referenced", workId: null });
    }
    for (const lead of ["R-series", "V2 S1.4 (entry point)", "Decision 1 shipped", "W9 surface consolidation", null]) {
      expect(receiptIdentity(lead)).toMatchObject({ identity: "unidentified", workId: null });
    }
  });

  it("reads only Shipped Log bullets, keeps stated date precision and returns other lines as notes", () => {
    const { records, notes } = parseHistory(BOOK, { campaign: "Budget", file: "Budget/Budget — Master Book.md" });
    expect(records.map((record) => record.id)).toEqual(["BUD-10", "BUD-10", "BUD-11: Titled", "BUD-12 + BUD-13", "BUD-2", "BUD-17", "BUD-14", "BUD-15", null]);
    expect(records.find((record) => record.id === "BUD-17")).toMatchObject({ date: "2026-09-06", dateEnd: "2026-09-08", datePrecision: "range" });
    expect(records.find((record) => record.id === "BUD-15")).toMatchObject({ date: "", datePrecision: "unrecorded", dateNote: "date unrecorded" });
    expect(notes.map((note) => note.text)).toEqual(["Earlier work lives in the archive."]);
    expect(parseOutcomes(BOOK, "Budget", "Budget/Budget — Master Book.md")).toEqual(records);
    const cancelled = parseHistory("## Budget\n- ✅ 2026-09-09 — **BUD-21** wrong mark\n- ❌ 2026-09-09 — **BUD-20** Removed.\n", { campaign: "Budget", file: "c", status: "Cancelled" });
    expect(cancelled.records.map((record) => record.workId)).toEqual(["BUD-20"]);
    expect(cancelled.notes).toHaveLength(1);
  });
});

describe("work outcomes", () => {
  const world = buildWorld(SNAPSHOT);

  it("counts distinct exact IDs, keeps cancellations apart and never completes an open item", () => {
    const outcomes = workOutcomes(world, { campaign: "Budget" });
    expect(outcomes.completed.map((entry) => entry.workId).sort()).toEqual(["BUD-10", "BUD-11", "BUD-14", "BUD-15", "BUD-17", "BUD-4"]);
    const repeated = outcomes.completed.find((entry) => entry.workId === "BUD-10")!;
    expect(repeated).toMatchObject({ date: "2026-09-09", repeated: 1 });
    expect(outcomes.completed.find((entry) => entry.workId === "BUD-4")).toMatchObject({ source: "checklist", date: "", datePrecision: "unrecorded" });
    expect(outcomes.cancelled.map((entry) => entry.workId)).toEqual(["BUD-20"]);
    expect(outcomes.historical.map((record) => record.identity)).toEqual(["referenced", "unidentified"]);
    expect(outcomes.conflicts.map((entry) => entry.workId)).toEqual(["BUD-2"]);
  });

  it("buckets by week with every total reconciling to its drilldown and no invented dates", () => {
    const { series } = expectReconciled(world, 2);
    expect(series.buckets.map((bucket) => bucket.week)).toEqual(["2026-08-31", "2026-09-07"]);
    const [first, second] = series.buckets;
    expect(first.completed.map((entry) => entry.workId)).toEqual(["BUD-11"]);
    expect(second.completed.map((entry) => entry.workId).sort()).toEqual(["BUD-10", "BUD-14", "KIT-9"]);
    expect(second.cancelled.map((entry) => entry.workId)).toEqual(["BUD-20"]);
    expect(series.undated.completed.map((entry) => entry.workId).sort()).toEqual(["BUD-15", "BUD-17", "BUD-4"]);
    expect(series.before.historical).toHaveLength(1);
    expectReconciled(world, 0);
    expect(outcomeSeries(workOutcomes(world), { weeks: 0, today: TODAY }).start).toBe(weekOf("2026-07-01"));
  });

  it("reports history coverage from the same parser", () => {
    const budget = historyCoverage(world, { campaign: "Budget" })[0];
    expect(budget).toMatchObject({ records: 10, exact: 8, referenced: 1, unidentified: 1, day: 7, range: 2, unrecorded: 1, earliest: "2026-07-01" });
    expect(budget.records).toBe(world.history.filter((record) => record.campaign === "Budget").length);
    expect(budget.notes).toHaveLength(1);
    expect(sprintProgress()).toEqual({ available: false, reason: "no-planning-file" });
  });
});

describe("open work and bugs", () => {
  const world = buildWorld(SNAPSHOT);

  it("counts distinct open WorkRefs by priority, blocked separately, reconciling to the Board", () => {
    const open = openWork(world.work, { order: world.spaces.map((space) => space.name) });
    expect(open.total).toBe(5);
    expect(open.blocked.map((item) => item.id)).toEqual(["BUD-3"]);
    const budget = open.rows.find((row) => row.campaign === "Budget")!;
    expect(PRIORITIES.map((lane) => budget.lanes[lane].length)).toEqual([2, 1, 1]);
    for (const row of open.rows) {
      for (const lane of PRIORITIES) {
        const board = world.work.filter((item) => matchesBoardFilters(item, [], { status: "open", campaigns: [row.campaign], kind: null }) && laneOf(item) === lane);
        expect(board.length).toBe(row.lanes[lane].length);
      }
      const blocked = world.work.filter((item) => matchesBoardFilters(item, [], { status: "blocked", campaigns: [row.campaign], kind: null }));
      expect(blocked.length).toBe(row.blocked.length);
    }
    const doubled = openWork([...world.work, { ...world.work[0], key: "copy" }]);
    expect(doubled.total).toBe(5);
    expect(doubled.duplicates).toHaveLength(1);
  });

  it("counts only explicitly declared bugs and groups them by severity", () => {
    const result = bugs(world.work, { campaign: "Budget" });
    expect(result.total).toBe(1);
    expect(result.declared).toBe(2);
    expect(result.open).toBe(4);
    expect(result.rows.find((row) => row.severity === "friction")?.items.map((item) => item.id)).toEqual(["BUD-2"]);
    expect(result.rows.find((row) => row.severity === "blocker")?.items).toEqual([]);
  });
});

describe("delivery attempts and resources", () => {
  const world = buildWorld(SNAPSHOT);
  const v1 = [
    { sessionId: "s1", state: "CANCELLED", agent: "claude", item: { id: "BUD-1", campaign: "Budget" }, updatedAt: "2026-09-10T00:00:00Z", usageTotal: { input: 10, output: 20, costUsd: null } },
    { sessionId: "s2", state: "SHIPPED", agent: "claude", item: { id: "BUD-3", campaign: "Budget" }, updatedAt: "2026-09-11T00:00:00Z", usageTotal: { input: 5, output: 5, cachedRead: 100, cacheCreation: 50, costUsd: 1.5 } },
  ];
  const run = { engine: "v2", title: "t", file: null, waiting_reason: null, model: null, effort: null, stage: "Check", branch: null, active: false, ownerAction: "", created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z" };
  const v2 = [
    { ...run, run_id: "r1", lifecycle: "CLOSED", closed_outcome: "verified_candidate", application: null, alias: "BUD-5", campaign: "Budget", executor: "codex", resources: { unit: "usd", settled: 0, reserved: 0, unknown: 1, providerReportedUsd: null, measuredTokens: { input: 7, cachedInput: 1, output: 2, reasoningOutput: 3 } } },
    { ...run, run_id: "r2", lifecycle: "CLOSED", closed_outcome: "verified_candidate", application: { application_id: "a", state: "applied" }, alias: "BUD-1", campaign: "Budget", executor: "claude", resources: { unit: "usd", settled: 0.4, reserved: 0, unknown: 0, providerReportedUsd: 0.4, measuredTokens: { input: 1, cachedInput: 0, output: 1, reasoningOutput: 0 } } },
    { ...run, run_id: "r3", lifecycle: "ACTIVE", closed_outcome: null, application: null, alias: "KIT-1", campaign: "Kitchen", executor: "claude", resources: null },
  ];

  it("keeps attempts apart from work and dispositions as reached levels", () => {
    const before = workOutcomes(world);
    const delivery = deliveryAttempts({ v1, v2 });
    expect(workOutcomes(world)).toEqual(before);
    expect(before.cancelled.map((entry) => entry.workId)).toEqual(["BUD-20"]);
    expect(world.work.find((item) => item.id === "BUD-1")?.state).toBe("open");
    const count = (engine: "v1" | "v2", outcome: string) => delivery[engine].find((row) => row.outcome === outcome)!.attempts.length;
    expect([count("v1", "cancelled"), count("v1", "accepted"), count("v1", "verified_candidate")]).toEqual([1, 1, 0]);
    expect([count("v2", "verified_candidate"), count("v2", "in_progress")]).toEqual([2, 1]);
    expect(delivery.dispositions.verifiedCandidate.map((attempt) => attempt.id).sort()).toEqual(["r1", "r2"]);
    expect(delivery.dispositions.appliedChange.map((attempt) => attempt.id)).toEqual(["r2"]);
    expect(delivery.dispositions.unrecorded).toHaveLength(2);
    expect(deliveryAttempts({ v1, v2 }, { campaign: "Kitchen" }).total).toBe(1);
  });

  it("sums estimates, tokens and settled amounts separately with coverage", () => {
    const delivery = deliveryAttempts({ v1, v2 });
    const rows = resourceRows(delivery.attempts);
    expect(rows.reduce((sum, row) => sum + row.runs.length, 0)).toBe(delivery.total);
    const v1Claude = rows.find((row) => row.key === "v1:claude")!;
    expect(v1Claude.estimatedUsd).toEqual({ sum: 1.5, known: 1 });
    expect(v1Claude.tokens).toEqual({ input: 15, output: 25, cache: 150, known: 2 });
    const codex = rows.find((row) => row.key === "v2:codex")!;
    expect(codex.estimatedUsd).toEqual({ sum: 0, known: 0 });
    expect(codex.unknownReadings).toBe(1);
    expect(codex.tokens).toMatchObject({ output: 2, cache: 0, known: 1 });
    const v2Claude = rows.find((row) => row.key === "v2:claude")!;
    expect(v2Claude.settled).toEqual({ usd: 0.4 });
    expect(v2Claude.tokens.known).toBe(1);
    expect(v2Claude.runs).toHaveLength(2);
  });
});

describe("dashboard query and relay parity", () => {
  it("round-trips filters and selection through the URL", () => {
    const query = parseDashboardQuery(new URLSearchParams("campaign=Budget&weeks=8&week=2026-09-07"));
    expect(query).toEqual({ campaign: "Budget", weeks: 8, week: "2026-09-07", set: null });
    expect(parseDashboardQuery(new URLSearchParams(dashboardQueryString(query).slice(1)))).toEqual(query);
    expect(parseDashboardQuery(new URLSearchParams("weeks=5&set=bogus"))).toEqual({ campaign: null, weeks: 16, week: null, set: null });
    expect(dashboardQueryString({ campaign: null, weeks: 16, week: null, set: "undated" })).toBe("?set=undated");
  });

  it("computes the same metrics from the relay corpus as from the local snapshot", () => {
    const rows = buildCorpusRows({ data: SNAPSHOT, installation_id: "inst-0123456789ab" });
    const assembled = assembleSnapshot(rows.manifest.payload, new Map(rows.upserts.map((row: { payload: { relPath: string; raw: string; sha: string; mtimeMs?: number } }) => [row.payload.relPath, row.payload])));
    expect(assembled.ok).toBe(true);
    const local = buildWorld(SNAPSHOT);
    const relay = buildWorld(assembled.snapshot!);
    expect(workOutcomes(relay)).toEqual(workOutcomes(local));
    expect(outcomeSeries(workOutcomes(relay), { today: TODAY })).toEqual(outcomeSeries(workOutcomes(local), { today: TODAY }));
    expect(openWork(relay.work).rows).toEqual(openWork(local.work).rows);
    expect(historyCoverage(relay)).toEqual(historyCoverage(local));
  });
});

describe("live PM corpus (read-only)", () => {
  const PM = join(process.cwd(), "ERA Notes/10 - Project Management");
  const files = existsSync(PM)
    ? readdirSync(PM, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && existsSync(join(PM, entry.name, "4 - Checklist.md")))
        .flatMap((entry) =>
          ["4 - Checklist.md", `${entry.name} — Master Book.md`]
            .filter((name) => existsSync(join(PM, entry.name, name)))
            .map((name) => ({ relPath: `${entry.name}/${name}`, raw: readFileSync(join(PM, entry.name, name), "utf8") })),
        )
    : [];
  it.runIf(files.length > 0)("reconciles every chart total to its records", () => {
    const cancelled = join(PM, "_Archive/Cancelled Log.md");
    const world = buildWorld({ generatedAt: "live", files, cancelledLog: existsSync(cancelled) ? readFileSync(cancelled, "utf8") : "" });
    for (const weeks of [8, 16, 26, 0]) expectReconciled(world, weeks);
    const outcomes = workOutcomes(world);
    for (const record of world.history) {
      if (record.workId) expect(record.ids).toEqual([record.workId]);
      if (record.datePrecision === "unrecorded") expect(record.date).toBe("");
    }
    expect(outcomes.completed.length + outcomes.cancelled.length + outcomes.conflicts.length).toBeLessThanOrEqual(world.history.filter((record) => record.workId).length + world.work.filter((item) => item.state === "done").length);
  });
});
