// src/lib/fitness/fixtures.ts
// Synthetic bundles for visual refinement (/fitness?fixture=…, dev only) and
// tests. Fictional data; never sent to the network. Rules mirror
// fitness_rules() and are asserted against the SQL in fitness.database.test.ts.
import upperLower from "./examples/upper-lower.json";
import type { PTPlanV1 } from "./ptPlan";
import { localWeekStart, shiftWeek } from "./progress";
import type { FitnessBundle, FitnessRules, LivePlan, OpenSession, RecentSession, RewardEvent, WeekSummary } from "./types";

export const FIXTURE_STATES = ["empty", "active", "week", "rankup"] as const;
export type FixtureState = (typeof FIXTURE_STATES)[number];

export const FIXTURE_RULES: FitnessRules = {
  xp_training: 100,
  xp_recovery: 25,
  quest_training: 150,
  quest_recovery: 50,
  quest_full_log: 50,
  xp_per_level: 500,
  ranks: [
    { id: "initiate", level: 1 },
    { id: "momentum", level: 5 },
    { id: "vanguard", level: 10 },
    { id: "apex", level: 20 },
  ],
  badges: [
    { id: "first-workout", threshold: 1 },
    { id: "ten-workouts", threshold: 10 },
    { id: "first-record", threshold: 1 },
    { id: "four-weeks", threshold: 4 },
  ],
};

const U = "00000000-0000-4000-8000-0000000000aa";
const plan = upperLower as PTPlanV1;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function addDaysIso(week: string, days: number, hour = 9): string {
  const d = new Date(`${week}T00:00:00`);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  // Never in the future: "this week" fixtures early in a week collapse to now.
  return new Date(Math.min(d.getTime(), Date.now())).toISOString();
}

function livePlan(week: string): LivePlan {
  return {
    plan: {
      id: id(1), user_id: U, name: plan.name, status: "active", content_fingerprint: "fixture", current_version: 1,
      timezone: "Asia/Beirut", activated_week: shiftWeek(week, -5), ends_week: shiftWeek(week, 3), archived_from: null,
      activated_at: addDaysIso(shiftWeek(week, -5), 0), paused_at: null, archived_at: null,
      created_at: addDaysIso(shiftWeek(week, -6), 0), updated_at: addDaysIso(shiftWeek(week, -5), 0),
    },
    version: {
      id: id(2), plan_id: id(1), version: 1, content: plan, fingerprint: "fixture", issues: [], acknowledged: [],
      slot_count: plan.workout_order.length, training_target: 3, created_at: addDaysIso(shiftWeek(week, -6), 0),
    },
    pauses: [],
    slots: plan.workout_order.map((_, i) => ({
      id: id(10 + i), slot_index: i, item_id: id(20 + i),
      placements: i === 1 ? [{ id: id(30), item_id: id(21), period_start_date: week, scheduled_for_date: addDaysIso(week, 3).slice(0, 10), scheduled_for_time: "18:30:00", occurrence_index: 0 }] : [],
      actions: [],
    })),
  };
}

function session(n: number, slot: number, week: string, day: number, extra: Partial<RecentSession> = {}): RecentSession {
  const w = plan.workouts.find((x) => x.id === plan.workout_order[slot])!;
  const at = addDaysIso(week, day, 18);
  return {
    id: id(100 + n), user_id: U, plan_id: id(1), version: 1, slot_id: id(10 + slot), period_start: week,
    workout_id: w.id, workout_name: w.name, kind: w.kind, training_target: 3, status: "completed", source: "fitness",
    started_at: at, finished_at: at, local_date: at.slice(0, 10), has_sets: true, fully_logged: false, notes: null,
    revision: 3, deleted_at: null, sets_done: 8, volume_kg: w.kind === "strength" ? 2450 : null, ...extra,
  };
}

function reward(key: string, kind: RewardEvent["kind"], xp: number, payload: Record<string, unknown>, celebrated = true): RewardEvent {
  return { id: key, source_key: key, kind, xp, session_id: null, earned_on: null, payload, awarded_at: new Date().toISOString(), celebrated_at: celebrated ? new Date().toISOString() : null };
}

export function fixtureBundle(state: FixtureState, now = new Date()): FitnessBundle {
  const week = localWeekStart(now);
  const base: FitnessBundle = {
    rules: FIXTURE_RULES,
    preferences: { user_id: U, share_summary: false, effects_enabled: true, sound_enabled: false, cosmetic: null },
    plans: [], live_plan: null, open_session: null, previous_sets: [], recent_sessions: [], weeks: [],
    rewards: { totals: { xp: 0, level: 1, rank: "initiate" }, events: [], badges: [] },
    records: [], health_profile: null, partner: null,
  };
  if (state === "empty") return base;

  const live = livePlan(week);
  const history: RecentSession[] = [];
  const weeks: WeekSummary[] = [];
  for (let back = 4; back >= 1; back--) {
    const w = shiftWeek(week, -back);
    [0, 1, 2].forEach((slot, i) => history.push(session(back * 10 + i, slot, w, i * 2)));
    weeks.push({ week_start: w, training_done: 3, recovery_done: back % 2, target: 3, any_full_log: back === 1 });
  }
  const summary = {
    id: live.plan.id, name: live.plan.name, status: live.plan.status, current_version: 1, activated_week: live.plan.activated_week,
    ends_week: live.plan.ends_week, timezone: live.plan.timezone, created_at: live.plan.created_at, updated_at: live.plan.updated_at,
    archived_at: null, archived_from: null, issues: [], acknowledged: [], slot_count: 4, training_target: 3,
    trainer: plan.trainer, goal: plan.goal, duration_weeks: plan.duration_weeks,
  };
  const badges = [reward("badge:first-workout", "badge", 0, { badge: "first-workout" }), reward("badge:ten-workouts", "badge", 0, { badge: "ten-workouts" }),
    reward("badge:first-record", "badge", 0, { badge: "first-record" })];
  const out: FitnessBundle = {
    ...base,
    plans: [summary],
    live_plan: live,
    recent_sessions: history.reverse(),
    weeks: weeks.reverse(),
    rewards: { totals: { xp: 1975, level: 4, rank: "initiate" }, events: badges, badges },
    records: [
      { exercise: "Bench press", equipment: "Barbell", load_kind: "external", best_load_kg: 72.5, best_reps: null, best_duration_seconds: null, best_distance_m: null, last_at: history[0].finished_at! },
      { exercise: "Back squat", equipment: "Barbell", load_kind: "external", best_load_kg: 105, best_reps: null, best_duration_seconds: null, best_distance_m: null, last_at: history[1].finished_at! },
      { exercise: "Push-up", equipment: null, load_kind: "bodyweight", best_load_kg: null, best_reps: 22, best_duration_seconds: null, best_distance_m: null, last_at: history[0].finished_at! },
    ],
    previous_sets: [1, 2, 3].map((si) => ({
      id: id(400 + si), session_id: history[0].id, exercise_id: "bench-press", set_index: si, exercise_name: "Bench press", equipment: "Barbell",
      load_kind: "external", substitution: null, status: "done", reps: 10, load_kg: 70, duration_seconds: null, distance_m: null, rpe: 8, rir: null,
      notes: null, logged_at: history[0].finished_at!, revision: 1, workout_id: "upper", finished_at: history[0].finished_at!,
    })),
    health_profile: { id: id(500), name: "Me" },
  };

  if (state === "active") {
    const thisWeek = [session(1, 1, week, 0)];
    const upper = plan.workouts[0];
    const open: OpenSession = {
      ...thisWeek[0], id: id(200), slot_id: id(10), workout_id: "upper", workout_name: upper.name, kind: "strength",
      snapshot: upper, status: "in_progress", finished_at: null, local_date: null, started_at: new Date(now.getTime() - 22 * 60_000).toISOString(),
      sets: [
        { id: id(300), session_id: id(200), exercise_id: "band-pull-apart", set_index: 0, exercise_name: "Band pull-apart", equipment: "Band", load_kind: "unspecified", substitution: null, status: "done", reps: 15, load_kg: null, duration_seconds: null, distance_m: null, rpe: null, rir: null, notes: null, logged_at: now.toISOString(), revision: 1 },
        { id: id(301), session_id: id(200), exercise_id: "bench-press", set_index: 0, exercise_name: "Bench press", equipment: "Barbell", load_kind: "external", substitution: null, status: "done", reps: 10, load_kg: 20, duration_seconds: null, distance_m: null, rpe: null, rir: null, notes: null, logged_at: now.toISOString(), revision: 1 },
        { id: id(302), session_id: id(200), exercise_id: "bench-press", set_index: 1, exercise_name: "Bench press", equipment: "Barbell", load_kind: "external", substitution: null, status: "done", reps: 11, load_kg: 72.5, duration_seconds: null, distance_m: null, rpe: 8, rir: null, notes: null, logged_at: now.toISOString(), revision: 1 },
      ],
    };
    out.open_session = open;
    out.recent_sessions = [...thisWeek, ...out.recent_sessions];
    out.weeks = [{ week_start: week, training_done: 1, recovery_done: 0, target: 3, any_full_log: false }, ...out.weeks];
  }
  if (state === "week" || state === "rankup") {
    const thisWeek = [0, 1, 2, 3].map((slot) => session(slot + 1, slot, week, slot, slot === 1 ? { fully_logged: true } : {}));
    out.recent_sessions = [...thisWeek.reverse(), ...out.recent_sessions];
    out.weeks = [{ week_start: week, training_done: 3, recovery_done: 1, target: 3, any_full_log: true }, ...out.weeks];
    out.rewards.totals = state === "rankup" ? { xp: 2025, level: 5, rank: "momentum" } : { xp: 1975 + 0, level: 4, rank: "initiate" };
  }
  if (state === "rankup") {
    const fresh = [
      reward("rank:momentum", "rank", 0, { rank: "momentum", level: 5 }, false),
      reward("badge:four-weeks", "badge", 0, { badge: "four-weeks" }, false),
      reward(`pr:${id(104)}:bench:load`, "record", 0, { exercise: "Bench press", equipment: "Barbell", load_kind: "external", metric: "load", value: 75, previous: 72.5 }, false),
    ];
    out.rewards.events = [...fresh, ...out.rewards.events];
    out.rewards.badges = [...out.rewards.badges, fresh[1], fresh[0]];
  }
  return out;
}
