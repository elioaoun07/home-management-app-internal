// src/lib/fitness/types.ts
// Fitness domain types, mirroring migrations/2026-10-12_fitness-module.sql and
// the get_fitness_bundle() payload. Shared layer so API routes, the feature
// hooks and future ERA read interfaces use one shape.
import type { LoadKind, PlanIssue, PTPlanV1, PTWorkout, WorkoutKind } from "./ptPlan";

export type RankId = "initiate" | "momentum" | "vanguard" | "apex";
export type PlanStatus = "draft" | "ready" | "active" | "paused" | "archived";
export type SessionStatus = "in_progress" | "completed" | "abandoned";

export interface FitnessRules {
  xp_training: number;
  xp_recovery: number;
  quest_training: number;
  quest_recovery: number;
  quest_full_log: number;
  xp_per_level: number;
  ranks: { id: RankId; level: number }[];
  badges: { id: string; threshold: number }[];
}

export interface FitnessPreferences {
  user_id: string;
  share_summary: boolean;
  effects_enabled: boolean;
  sound_enabled: boolean;
  cosmetic: RankId | null;
}

export interface FitnessPlan {
  id: string;
  user_id: string;
  name: string;
  status: PlanStatus;
  content_fingerprint: string;
  current_version: number;
  timezone: string | null;
  activated_week: string | null;
  ends_week: string | null;
  archived_from: PlanStatus | null;
  activated_at: string | null;
  paused_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FitnessPlanSummary {
  id: string;
  name: string;
  status: PlanStatus;
  current_version: number;
  activated_week: string | null;
  ends_week: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_from: PlanStatus | null;
  issues: PlanIssue[];
  acknowledged: string[];
  slot_count: number;
  training_target: number;
  trainer: string | null;
  goal: string | null;
  duration_weeks: number | null;
}

export interface FitnessPlanVersion {
  id: string;
  plan_id: string;
  version: number;
  content: PTPlanV1;
  fingerprint: string;
  issues: PlanIssue[];
  acknowledged: string[];
  slot_count: number;
  training_target: number;
  created_at: string;
}

export interface FlexiblePlacement {
  id: string;
  item_id: string;
  period_start_date: string;
  scheduled_for_date: string;
  scheduled_for_time: string | null;
  occurrence_index: number;
}

export interface SlotAction {
  id: string;
  action_type: "completed" | "postponed" | "cancelled" | "skipped";
  occurrence_date: string;
  metadata_json: Record<string, unknown> | null;
}

export interface FitnessSlot {
  id: string;
  slot_index: number;
  item_id: string | null;
  placements: FlexiblePlacement[];
  actions: SlotAction[];
}

export interface PlanPause {
  id: string;
  plan_id: string;
  paused_on: string;
  resumed_on: string | null;
}

export interface LivePlan {
  plan: FitnessPlan;
  version: FitnessPlanVersion;
  pauses: PlanPause[];
  slots: FitnessSlot[];
}

export interface FitnessSetLog {
  id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  exercise_name: string;
  equipment: string | null;
  load_kind: LoadKind;
  substitution: string | null;
  status: "done" | "skipped";
  reps: number | null;
  load_kg: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  rpe: number | null;
  rir: number | null;
  notes: string | null;
  logged_at: string;
  revision: number;
  /** Client-only: queued offline, not yet acknowledged by the server. */
  pending?: boolean;
}

export interface FitnessSession {
  id: string;
  user_id: string;
  plan_id: string;
  version: number;
  slot_id: string | null;
  period_start: string | null;
  workout_id: string;
  workout_name: string;
  kind: WorkoutKind;
  snapshot: PTWorkout;
  training_target: number;
  status: SessionStatus;
  source: "fitness" | "schedule";
  started_at: string;
  finished_at: string | null;
  local_date: string | null;
  has_sets: boolean;
  fully_logged: boolean;
  notes: string | null;
  revision: number;
  deleted_at: string | null;
  /** Client-only: the start or finish is queued offline. */
  pending?: boolean;
}

export interface OpenSession extends FitnessSession {
  sets: FitnessSetLog[];
}

export interface RecentSession extends Omit<FitnessSession, "snapshot"> {
  sets_done: number;
  volume_kg: number | null;
}

export interface PreviousSet extends FitnessSetLog {
  workout_id: string;
  finished_at: string;
}

export interface WeekSummary {
  week_start: string;
  training_done: number;
  recovery_done: number;
  target: number | null;
  any_full_log: boolean;
}

export interface RewardEvent {
  id: string;
  source_key: string;
  kind: "xp" | "badge" | "record" | "rank";
  xp: number;
  session_id: string | null;
  earned_on: string | null;
  payload: Record<string, unknown>;
  awarded_at: string;
  celebrated_at: string | null;
}

export interface RewardTotals {
  xp: number;
  level: number;
  rank: RankId;
}

export interface RecordRow {
  exercise: string;
  equipment: string | null;
  load_kind: LoadKind;
  best_load_kg: number | null;
  best_reps: number | null;
  best_duration_seconds: number | null;
  best_distance_m: number | null;
  last_at: string;
}

export interface SharedSummary {
  user_id: string;
  rank: RankId;
  badges: string[];
  week: { week_start: string; done: number; target: number };
}

export interface FitnessBundle {
  rules: FitnessRules;
  preferences: FitnessPreferences;
  plans: FitnessPlanSummary[];
  live_plan: LivePlan | null;
  open_session: OpenSession | null;
  previous_sets: PreviousSet[];
  recent_sessions: RecentSession[];
  weeks: WeekSummary[];
  rewards: { totals: RewardTotals; events: RewardEvent[]; badges: RewardEvent[] };
  records: RecordRow[];
  health_profile: { id: string; name: string } | null;
  partner: SharedSummary | null;
}
