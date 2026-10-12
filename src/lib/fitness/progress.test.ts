import { describe, expect, it } from "vitest";
import { FIXTURE_RULES, fixtureBundle } from "./fixtures";
import {
  comparableVolume,
  levelProgress,
  localWeekStart,
  nextSlot,
  pendingCelebrations,
  shiftWeek,
  summarizeFitness,
  trainingStreak,
  weekSlots,
  weeklyQuests,
} from "./progress";

describe("level and rank", () => {
  it("follows level = 1 + floor(xp / 500) and the rank thresholds", () => {
    expect(levelProgress(0, FIXTURE_RULES)).toMatchObject({ level: 1, rank: "initiate", nextRank: { id: "momentum" } });
    expect(levelProgress(499, FIXTURE_RULES).level).toBe(1);
    expect(levelProgress(2000, FIXTURE_RULES)).toMatchObject({ level: 5, rank: "momentum", xpInLevel: 0 });
    expect(levelProgress(4500, FIXTURE_RULES).rank).toBe("vanguard");
    expect(levelProgress(9500, FIXTURE_RULES)).toMatchObject({ rank: "apex", nextRank: null });
  });
});

describe("weekly slots", () => {
  it("keeps repeated workouts distinct, suggests the open workout first, and allows out-of-order", () => {
    const b = fixtureBundle("active");
    const week = localWeekStart();
    const views = weekSlots(b.live_plan!, b.recent_sessions, b.open_session, week);
    expect(views.map((v) => [v.title, v.status])).toEqual([
      ["Upper", "active"], ["Lower", "done"], ["Upper · 2", "open"], ["Mobility", "open"],
    ]);
    expect(nextSlot(views)?.index).toBe(0);
    expect(nextSlot(views.map((v) => (v.status === "active" ? { ...v, status: "done" as const } : v)))?.title).toBe("Upper · 2");
  });

  it("does not carry last week's missed slots into this week", () => {
    const b = fixtureBundle("active");
    const views = weekSlots(b.live_plan!, [], null, shiftWeek(localWeekStart(), 1));
    expect(views.every((v) => v.status === "open")).toBe(true);
    expect(views).toHaveLength(4);
  });

  it("marks Schedule skips without completing them", () => {
    const b = fixtureBundle("active");
    const week = localWeekStart();
    b.live_plan!.slots[3].actions = [{ id: "a", action_type: "skipped", occurrence_date: `${week}T10:00:00.000Z`, metadata_json: null }];
    expect(weekSlots(b.live_plan!, [], null, week)[3].status).toBe("skipped");
  });
});

describe("streak", () => {
  const base = { activatedWeek: "2026-09-07", activatedOn: "2026-09-09", pauses: [], target: 3 };
  const w = (week_start: string, training_done: number) => ({ week_start, training_done, recovery_done: 0, target: 3, any_full_log: false });

  it("counts consecutive met weeks; the current week and partial first week are neutral", () => {
    const weeks = [w("2026-09-07", 1), w("2026-09-14", 3), w("2026-09-21", 3), w("2026-09-28", 0 + 3), w("2026-10-05", 1)];
    expect(trainingStreak({ ...base, weeks, currentWeek: "2026-10-05" })).toBe(3);
  });

  it("breaks on a missed week but treats paused weeks as neutral", () => {
    const weeks = [w("2026-09-14", 3), w("2026-09-28", 3)];
    expect(trainingStreak({ ...base, weeks, currentWeek: "2026-10-05" })).toBe(1);
    expect(trainingStreak({ ...base, weeks, currentWeek: "2026-10-05", pauses: [{ paused_on: "2026-09-22", resumed_on: "2026-09-27" }] })).toBe(2);
  });
});

describe("quests, celebrations and volume", () => {
  it("projects the server's weekly progress onto the three quests", () => {
    const q = weeklyQuests({ week_start: "x", training_done: 2, recovery_done: 1, target: 3, any_full_log: false }, 3, FIXTURE_RULES);
    expect(q.map((x) => [x.id, x.progress, x.goal, x.done])).toEqual([["training", 2, 3, false], ["recovery", 1, 1, true], ["log", 0, 1, false]]);
  });

  it("reveals only uncelebrated milestones", () => {
    const keys = pendingCelebrations(fixtureBundle("rankup").rewards.events).map((e) => e.kind);
    expect(keys.sort()).toEqual(["badge", "rank", "record"]);
    expect(pendingCelebrations(fixtureBundle("week").rewards.events)).toEqual([]);
  });

  it("totals volume only for comparable external loads; unknown stays unknown", () => {
    expect(comparableVolume([
      { status: "done", load_kind: "external", load_kg: 60, reps: 10 },
      { status: "done", load_kind: "bodyweight", load_kg: null, reps: 20 },
      { status: "done", load_kind: "external", load_kg: null, reps: 8 },
      { status: "skipped", load_kind: "external", load_kg: 60, reps: null },
    ])).toBe(600);
    expect(comparableVolume([{ status: "done", load_kind: "bodyweight", load_kg: null, reps: 20 }])).toBeNull();
  });

  it("offers a brief read interface for future ERA use", () => {
    const s = summarizeFitness(fixtureBundle("active"));
    expect(s).toMatchObject({ rank: "initiate", week: { done: 1, target: 3 }, openWorkout: "Upper" });
    expect(s.streak).toBeGreaterThanOrEqual(4);
  });
});
