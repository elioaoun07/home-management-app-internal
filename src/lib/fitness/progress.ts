// src/lib/fitness/progress.ts
// Pure display math over the server's reward state. The server
// (fitness_recompute_rewards_for) decides what is earned; this file only
// arranges it. Rules always come from the bundle (fitness_rules()).
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { slotTitle, workoutById, type PTWorkout } from "./ptPlan";
import type {
  FitnessBundle,
  FitnessRules,
  FitnessSlot,
  LivePlan,
  OpenSession,
  PlanPause,
  PreviousSet,
  RankId,
  RecentSession,
  RewardEvent,
  WeekSummary,
} from "./types";

/** Monday-start local week, identical to Schedule's flexible period start. */
export function localWeekStart(date: Date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}
export const localDate = (date: Date = new Date()) => format(date, "yyyy-MM-dd");
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export const shiftWeek = (week: string, by: number) => format(addDays(parseISO(week), by * 7), "yyyy-MM-dd");

// ── Level & rank ────────────────────────────────────────────────────────────

export interface LevelProgress {
  xp: number;
  level: number;
  rank: RankId;
  nextRank: { id: RankId; level: number } | null;
  xpInLevel: number;
  xpPerLevel: number;
  pct: number;
}

export function levelProgress(xp: number, rules: FitnessRules): LevelProgress {
  const per = rules.xp_per_level;
  const level = 1 + Math.floor(Math.max(0, xp) / per);
  const ranks = [...rules.ranks].sort((a, b) => a.level - b.level);
  const rank = [...ranks].reverse().find((r) => r.level <= level)?.id ?? "initiate";
  const xpInLevel = Math.max(0, xp) % per;
  return {
    xp,
    level,
    rank,
    nextRank: ranks.find((r) => r.level > level) ?? null,
    xpInLevel,
    xpPerLevel: per,
    pct: xpInLevel / per,
  };
}

export const RANK_LABEL: Record<RankId, string> = {
  initiate: "Initiate",
  momentum: "Momentum",
  vanguard: "Vanguard",
  apex: "Apex",
};

// ── Week slots ──────────────────────────────────────────────────────────────

export type SlotStatus = "done" | "active" | "open" | "skipped";

export interface SlotView {
  slot: FitnessSlot;
  index: number;
  title: string;
  workout: PTWorkout | undefined;
  status: SlotStatus;
  placement: { date: string; time: string | null } | null;
  sessionId: string | null;
}

function actionWeek(a: FitnessSlot["actions"][number]): string {
  const pf = typeof a.metadata_json?.planned_for === "string" ? (a.metadata_json.planned_for as string) : null;
  return localWeekStart(parseISO(pf ?? a.occurrence_date));
}

export function weekSlots(
  live: LivePlan,
  sessions: Pick<RecentSession, "id" | "slot_id" | "period_start" | "status">[],
  open: OpenSession | null,
  week: string,
): SlotView[] {
  const content = live.version.content;
  return live.slots.map((slot) => {
    const done = sessions.find((s) => s.slot_id === slot.id && s.period_start === week && s.status === "completed");
    const scheduleDone = slot.actions.some((a) => a.action_type === "completed" && actionWeek(a) === week);
    const skipped = slot.actions.some((a) => (a.action_type === "skipped" || a.action_type === "cancelled") && actionWeek(a) === week);
    const active = open && open.slot_id === slot.id && open.period_start === week ? open : null;
    const placement = slot.placements.find((p) => p.period_start_date === week && p.occurrence_index === 0);
    const status: SlotStatus = done || scheduleDone ? "done" : active ? "active" : skipped ? "skipped" : "open";
    return {
      slot,
      index: slot.slot_index,
      title: slotTitle(content, slot.slot_index),
      workout: workoutById(content, content.workout_order[slot.slot_index]),
      status,
      placement: placement ? { date: placement.scheduled_for_date, time: placement.scheduled_for_time } : null,
      sessionId: done?.id ?? active?.id ?? null,
    };
  });
}

/** The open workout first, then the first unfinished slot in weekly order. */
export function nextSlot(views: SlotView[]): SlotView | null {
  return views.find((v) => v.status === "active") ?? views.find((v) => v.status === "open") ?? null;
}

// ── Streak ──────────────────────────────────────────────────────────────────

/**
 * Consecutive weeks meeting the plan's training target. The current week,
 * paused weeks and a partial first week are neutral (neither extend nor break).
 */
export function trainingStreak(input: {
  weeks: WeekSummary[];
  currentWeek: string;
  activatedWeek: string | null;
  activatedOn: string | null;
  pauses: Pick<PlanPause, "paused_on" | "resumed_on">[];
  target: number;
}): number {
  const { weeks, currentWeek, activatedWeek, activatedOn, pauses, target } = input;
  if (!activatedWeek) return 0;
  const byWeek = new Map(weeks.map((w) => [w.week_start, w]));
  const partialFirst = !!activatedOn && activatedOn > activatedWeek;
  let streak = 0;
  for (let w = currentWeek, i = 0; w >= activatedWeek && i < 260; w = shiftWeek(w, -1), i++) {
    const summary = byWeek.get(w);
    const goal = summary?.target ?? target;
    const met = goal > 0 && (summary?.training_done ?? 0) >= goal;
    const end = shiftWeek(w, 1);
    const paused = pauses.some((p) => p.paused_on < end && (p.resumed_on === null || p.resumed_on > w));
    if (met) streak++;
    else if (w === currentWeek || paused || (partialFirst && w === activatedWeek)) continue;
    else break;
  }
  return streak;
}

// ── Quests & badges ─────────────────────────────────────────────────────────

export interface QuestView {
  id: "training" | "recovery" | "log";
  label: string;
  progress: number;
  goal: number;
  xp: number;
  done: boolean;
}

export function weeklyQuests(week: WeekSummary | undefined, target: number, rules: FitnessRules): QuestView[] {
  const goal = week?.target ?? target;
  const quests: QuestView[] = [];
  if (goal > 0)
    quests.push({ id: "training", label: "Training target", progress: Math.min(week?.training_done ?? 0, goal), goal, xp: rules.quest_training, done: (week?.training_done ?? 0) >= goal });
  quests.push({ id: "recovery", label: "Recovery session", progress: Math.min(week?.recovery_done ?? 0, 1), goal: 1, xp: rules.quest_recovery, done: (week?.recovery_done ?? 0) >= 1 });
  quests.push({ id: "log", label: "Fully logged workout", progress: week?.any_full_log ? 1 : 0, goal: 1, xp: rules.quest_full_log, done: !!week?.any_full_log });
  return quests;
}

export const BADGE_LABEL: Record<string, string> = {
  "first-workout": "First workout",
  "ten-workouts": "10 workouts",
  "first-record": "First record",
  "four-weeks": "4 strong weeks",
};

export function badgeShelf(rules: FitnessRules, earned: RewardEvent[]) {
  return rules.badges.map((b) => {
    const e = earned.find((x) => x.kind === "badge" && x.payload.badge === b.id);
    return { id: b.id, label: BADGE_LABEL[b.id] ?? b.id, earned: !!e, earnedOn: e?.earned_on ?? null };
  });
}

/** Uncelebrated, unrevoked milestones worth a reveal (never plain XP rows). */
export function pendingCelebrations(events: RewardEvent[]): RewardEvent[] {
  return events.filter((e) => e.celebrated_at === null && e.kind !== "xp");
}

// ── Sets ────────────────────────────────────────────────────────────────────

/** Volume only for comparable externally loaded sets with known reps & load. */
export function comparableVolume(sets: { status: string; load_kind: string; load_kg: number | null; reps: number | null }[]): number | null {
  const eligible = sets.filter((s) => s.status === "done" && s.load_kind === "external" && s.load_kg !== null && s.reps !== null);
  if (!eligible.length) return null;
  return Math.round(eligible.reduce((sum, s) => sum + s.load_kg! * s.reps!, 0) * 10) / 10;
}

export function previousFor(previous: PreviousSet[], workoutId: string, exerciseId: string, setIndex: number): PreviousSet | null {
  return previous.find((p) => p.workout_id === workoutId && p.exercise_id === exerciseId && p.set_index === setIndex) ?? null;
}

// ── Brief read interface (future ERA integration) ───────────────────────────

export interface FitnessSummary {
  rank: RankId;
  level: number;
  streak: number;
  week: { done: number; target: number } | null;
  next: { title: string; kind: string } | null;
  openWorkout: string | null;
}

export function summarizeFitness(bundle: FitnessBundle, now = new Date()): FitnessSummary {
  const week = localWeekStart(now);
  const live = bundle.live_plan;
  const views = live ? weekSlots(live, bundle.recent_sessions, bundle.open_session, week) : [];
  const next = nextSlot(views);
  const target = live?.version.training_target ?? 0;
  const summary = bundle.weeks.find((w) => w.week_start === week);
  return {
    rank: bundle.rewards.totals.rank,
    level: bundle.rewards.totals.level,
    streak: live
      ? trainingStreak({
          weeks: bundle.weeks, currentWeek: week, activatedWeek: live.plan.activated_week,
          activatedOn: live.plan.activated_at ? localDate(parseISO(live.plan.activated_at)) : null,
          pauses: live.pauses, target,
        })
      : 0,
    week: live ? { done: summary?.training_done ?? 0, target } : null,
    next: next ? { title: next.title, kind: next.workout?.kind ?? "strength" } : null,
    openWorkout: bundle.open_session?.workout_name ?? null,
  };
}
