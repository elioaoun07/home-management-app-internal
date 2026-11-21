import { describe, expect, it } from "vitest";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import {
  cleanShipIncrement,
  cleanStageStreak,
  localRunTokens,
  localStageGame,
} from "../../scripts/pm/app/stage/game";
import type { Cockpit, Flight } from "../../scripts/pm/app/cockpitTypes";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";

const epoch = Date.parse("2026-11-15T10:00:00Z");
const at = (seconds: number) => new Date(epoch + seconds * 1000).toISOString();
const row = (
  seconds: number,
  kind: string,
  summary: string,
  seq = seconds,
) => ({ at: at(seconds), kind, summary, seq, job_id: "native" });
function run(changes: Partial<LocalRunView> = {}): LocalRunView {
  return {
    run_id: "local-game-fixture",
    phase: "building",
    workspace: "C:/fixture",
    branch: "delivery/R122",
    head: null,
    current_head: null,
    canShip: false,
    canUndo: false,
    interrupted: false,
    work: { id: "R122", title: "Stage fixture" },
    activity: [row(0, "status", "Native session started")],
    checks: [],
    usage: null,
    handover: null,
    ...changes,
  };
}
function facts(value: LocalRunView, seconds?: number) {
  const timeline = buildTimeline(value);
  return localStageGame(
    timeline,
    sceneAt(
      timeline,
      seconds === undefined ? (timeline.end ?? epoch) : epoch + seconds * 1000,
    ),
  );
}
const passed = (second: number): LocalRunView["checks"] =>
  ["typecheck", "lint", "test", "pm:lint"].map((name, index) => ({
    name,
    exit: 0,
    error: null,
    stdout: "",
    stderr: "",
    finished_at: at(second + index),
  }));

function canonicalFlight(id: string, second: number, runId: string): Flight {
  const record: Flight = {
    session: {
      id,
      agent: "claude",
      coverage: "transcript",
      tier: "CLAUDE_MID",
      effort: "medium",
      base: "a".repeat(40),
      head: "b".repeat(40),
      startedAt: at(second),
      endedAt: at(second + 1),
      setup: { fingerprint: "sha256:fixture" },
      skills: [],
      reads: [],
      timeline: [],
      usage: {},
      turns: null,
      runId,
    },
    events: [],
    verdicts: Array.from({ length: 29 }, (_, index) => ({
      rule: `HR-${index + 1}`,
      verdict: "pass",
      level: "checked",
      added: 0,
      removed: 0,
    })),
    checks: [
      "typecheck",
      "lint",
      "test",
      "pm:lint",
      "docs:check",
      "os:check",
    ].map((name) => ({ id: name, name, source: "supervisor", exitCode: 0 })),
  };
  record.session.scorecard = sessionScorecard(record, []);
  return record;
}

const cockpit = (records: Flight[]): Cockpit => ({
  records,
  setup: null,
  conflicts: [],
  filed: [],
  deliveries: [],
  groups: [],
  warnings: [],
});

describe("Foundry game evidence", () => {
  it("counts a trailing chain only while gaps and current silence remain at most20s", () => {
    const value = run({
      activity: [
        row(0, "status", "Native session started"),
        row(10, "edit", "src/a.ts"),
        row(30, "edit", "src/a.ts"),
      ],
    });
    expect(facts(value, 30)).toMatchObject({
      combo: 3,
      peakCombo: 3,
      tier: "WARM",
      charge: 1,
    });
    expect(facts(value, 47.5).charge).toBe(0.5);
    expect(facts(value, 50).combo).toBe(3);
    expect(facts(value, 50.001)).toMatchObject({
      combo: 0,
      peakCombo: 3,
      tier: null,
      charge: 0,
    });
    expect(
      facts(
        run({ activity: [...value.activity, row(51, "edit", "src/b.ts")] }),
        51,
      ).combo,
    ).toBe(1);
  });
  it("awards row thresholds and remembers peak flow after the chain breaks", () => {
    const activity = [
      row(0, "status", "Native session started"),
      ...Array.from({ length: 15 }, (_, i) =>
        row(i + 1, "command", `cat src/a${i}.ts`),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        row(i + 20, "edit", `src/b${i}.ts`),
      ),
    ];
    const result = facts(run({ activity }), 60);
    expect(result.combo).toBe(0);
    expect(result.peakCombo).toBe(26);
    expect(result.badges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining([
        "First contact",
        "Scout",
        "Cartographer",
        "First cut",
        "Builder",
        "Architect",
        "Warm",
        "Flow",
        "Overdrive",
      ]),
    );
    expect(new Set(result.badges.map((badge) => badge.id)).size).toBe(
      result.badges.length,
    );
  });
  it("awards gate badges only from host checks, never an agent command or claimed success", () => {
    const activity = [
      row(0, "status", "Native session started"),
      row(1, "command", "pnpm typecheck"),
      row(2, "message", "All four checks passed"),
    ];
    expect(
      facts(run({ activity })).badges.some((badge) =>
        badge.id.startsWith("gate:"),
      ),
    ).toBe(false);
    const checked = facts(run({ activity, checks: passed(10) }));
    expect(
      checked.badges.filter((badge) => badge.id.startsWith("gate:")),
    ).toHaveLength(4);
    expect(checked.badges.some((badge) => badge.label === "Full seal")).toBe(
      true,
    );
    const uncertain = passed(10);
    uncertain[2].exit = null;
    expect(
      facts(run({ activity, checks: uncertain })).badges.some(
        (badge) => badge.label === "Full seal",
      ),
    ).toBe(false);
  });
  it("ranks a complete first clean ship S, later/stale ships A, and owner test B", () => {
    const activity = [
      row(0, "status", "Native session started"),
      row(10, "status", "Host checks started"),
      row(20, "status", "Ready for owner UAT"),
      row(30, "status", "Owner shipped merge"),
    ];
    const shipped = run({
      phase: "shipped",
      activity,
      checks: passed(12),
      merge: "abc123",
    });
    expect(facts(shipped)).toMatchObject({
      rank: "S",
      everStale: false,
      completeHistory: true,
    });
    expect(facts({ ...shipped, branch: "delivery/R122-second" }).rank).toBe(
      "A",
    );
    expect(
      facts({
        ...shipped,
        activity: [
          activity[0],
          row(241, "status", "Host checks started"),
          row(250, "status", "Owner shipped merge"),
        ],
        checks: passed(242),
      }),
    ).toMatchObject({ rank: "A", everStale: true });
    expect(
      facts({ ...shipped, phase: "uat-ready", activity: activity.slice(0, 3) })
        .rank,
    ).toBe("B");
    for (const phase of ["failed", "cancelled", "reverted", "building"])
      expect(facts({ ...shipped, phase }).rank).toBeNull();
    expect(facts({ ...shipped, interrupted: true }).rank).toBeNull();
  });
  it("does not infer never-stale, first-contact or Sprint from a truncated/missing beginning", () => {
    const activity = Array.from({ length: 200 }, (_, i) =>
      row(i, "edit", "src/a.ts"),
    );
    activity.push(row(201, "status", "Owner shipped merge"));
    const result = facts(
      run({ phase: "shipped", activity, checks: passed(198) }),
    );
    expect(result).toMatchObject({
      completeHistory: false,
      everStale: null,
      rank: "A",
    });
    expect(
      result.badges.some((badge) =>
        ["contact", "cut", "sprint"].includes(badge.id),
      ),
    ).toBe(false);
    expect(
      facts(
        run({
          phase: "shipped",
          activity: [
            row(0, "edit", "src/a.ts"),
            row(30, "status", "Owner shipped merge"),
          ],
          checks: passed(10),
        }),
      ),
    ).toMatchObject({ rank: "A", everStale: null });
  });
  it("uses phase thresholds and host completions instead of owner waiting gaps", () => {
    const activity = [
      row(0, "status", "Native session started"),
      row(100, "status", "Host checks started"),
      row(1100, "status", "Ready for owner UAT"),
      row(10_000, "status", "Owner shipped merge"),
    ];
    const result = facts(
      run({ phase: "shipped", activity, checks: passed(550) }),
    );
    expect(result.everStale).toBe(false);
    expect(result.rank).toBe("S");
  });
  it("awards Sprint only from the real first-row to owner-ready interval", () => {
    const activity = [
      row(0, "status", "Native session started"),
      row(600, "status", "Ready for owner UAT"),
    ];
    expect(
      facts(run({ phase: "uat-ready", activity })).badges.some(
        (badge) => badge.id === "sprint",
      ),
    ).toBe(true);
    expect(
      facts(
        run({
          phase: "uat-ready",
          activity: [activity[0], row(601, "status", "Ready for owner UAT")],
        }),
      ).badges.some((badge) => badge.id === "sprint"),
    ).toBe(false);
    const timeline = buildTimeline(run({ phase: "uat-ready", activity }));
    const before = localStageGame(timeline, sceneAt(timeline, epoch + 1000));
    expect(
      before.badges.some(
        (badge) => badge.id === "handover" || badge.id === "sprint",
      ),
    ).toBe(false);
  });
  it("does not turn absent, pending, stale or unordered canonical streak data into a count", () => {
    expect(cleanStageStreak()).toBeNull();
    const empty: Cockpit = {
      records: [],
      setup: null,
      conflicts: [],
      filed: [],
      deliveries: [],
      groups: [],
      warnings: [],
    };
    expect(cleanStageStreak(empty)).toBe(0);
    expect(cleanStageStreak({ ...empty, pending: true })).toBeNull();
    expect(cleanStageStreak({ ...empty, stale: true })).toBeNull();
    const undated: Flight = {
      session: {
        id: "undated",
        agent: "claude",
        coverage: "transcript",
        tier: "CLAUDE_MID",
        effort: "medium",
        base: "a".repeat(40),
        head: "b".repeat(40),
        startedAt: null,
        endedAt: null,
        setup: null,
        skills: [],
        reads: [],
        timeline: [],
        usage: {},
        turns: null,
      },
      events: [],
      checks: [],
      verdicts: [],
    };
    expect(cleanStageStreak({ ...empty, records: [undated] })).toBeNull();
  });
});

describe("Foundry clean-ship increment", () => {
  it("emits once only for the newly joined current run and exact candidate", () => {
    const prior = canonicalFlight("prior", 1, "local-prior"),
      current = canonicalFlight("current", 10, "local-game-fixture");
    const before = cockpit([prior]),
      after = cockpit([prior, current]);
    const shipped = run({ phase: "shipped", head: "b".repeat(40) });
    expect(cleanShipIncrement(before, after, shipped)).toEqual({
      runId: shipped.run_id,
      sessionId: "current",
      from: 1,
      to: 2,
      amount: 1,
    });
    expect(cleanShipIncrement(after, after, shipped)).toBeNull();
    expect(
      cleanShipIncrement(before, after, { ...shipped, phase: "uat-ready" }),
    ).toBeNull();
    expect(
      cleanShipIncrement(before, after, { ...shipped, head: "c".repeat(40) }),
    ).toBeNull();
    expect(
      cleanShipIncrement(before, after, { ...shipped, run_id: "local-other" }),
    ).toBeNull();
    expect(
      cleanShipIncrement(before, { ...after, stale: true }, shipped),
    ).toBeNull();
    expect(cleanShipIncrement(null, after, shipped)).toBeNull();
  });
  it("does not upgrade four Local host checks to the canonical six-check clean verdict", () => {
    const current = canonicalFlight(
      "four-host-checks",
      10,
      "local-game-fixture",
    );
    current.checks = current.checks.slice(0, 4);
    current.session.scorecard = sessionScorecard(current, []);
    const before = cockpit([]),
      after = cockpit([current]);
    expect(cleanStageStreak(after)).toBe(0);
    expect(
      cleanShipIncrement(
        before,
        after,
        run({ phase: "shipped", head: "b".repeat(40) }),
      ),
    ).toBeNull();
  });
});

describe("Foundry flow at session boundaries", () => {
  it.each([
    "failed",
    "cancelled",
    "reverted",
    "shipped",
    "uat-ready",
    "push-pending",
    "revert-push-pending",
  ])("parks current flow at0 for%s while retaining peak awards", (phase) => {
    const activity = [
      row(0, "status", "Native session started"),
      row(1, "edit", "src/a.ts"),
      row(2, "edit", "src/b.ts"),
    ];
    const result = facts(run({ phase, activity }));
    expect(result).toMatchObject({
      combo: 0,
      charge: 0,
      tier: null,
      peakCombo: 3,
    });
    expect(result.badges.some((badge) => badge.label === "Warm")).toBe(true);
  });
  it("parks flow on signal loss without deleting its recorded history", () => {
    const result = facts(
      run({
        interrupted: true,
        activity: [
          row(0, "status", "Native session started"),
          row(1, "edit", "src/a.ts"),
        ],
      }),
    );
    expect(result).toMatchObject({ combo: 0, charge: 0, peakCombo: 2 });
  });
});

describe("Recorded Local token totals", () => {
  it("uses normalized input+output without adding cache or reasoning subsets twice", () => {
    expect(
      localRunTokens({
        input: 120,
        output: 30,
        cachedInput: 80,
        cacheCreation: 5,
        reasoningOutput: 10,
        total_tokens: 999,
      }),
    ).toBe(150);
    expect(localRunTokens({ input: 0, output: 0 })).toBe(0);
  });
  it("preserves previously recorded total and snake-case usage formats", () => {
    expect(localRunTokens({ total_tokens: 42 })).toBe(42);
    expect(localRunTokens({ input_tokens: 5, output_tokens: 6 })).toBe(11);
  });
  it("keeps missing, invalid and amount-only observations unknown", () => {
    const observations: LocalRunView["usage"][] = [
      null,
      {},
      { input: 12, output: null },
      { input: -1, output: 4 },
      { input: NaN, output: 4 },
      { unit: "usd", costUsd: 1.2 },
    ];
    for (const usage of observations) expect(localRunTokens(usage)).toBeNull();
  });
});
