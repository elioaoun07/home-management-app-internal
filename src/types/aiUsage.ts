// src/types/aiUsage.ts
// Types for the AI Usage standalone module.

export type UUID = string;

export type RefreshFrequency = "weekly" | "monthly";

/** A tracked AI model with its current billing cycle and usage. */
export interface AIUsageModel {
  id: UUID;
  user_id: UUID;
  name: string;
  refresh_frequency: RefreshFrequency;
  /** ISO date (YYYY-MM-DD) — start of the current cycle. Advances on refresh. */
  cycle_start_date: string;
  /** For monthly: day of month (1-31) when cycle resets. For weekly: day of week (1=Mon..7=Sun). */
  cycle_start_day: number | null;
  /** Optional immutable anchor date (YYYY-MM-DD). When set, cycles roll forward from this date (+7d weekly / +1 month monthly), ignoring cycle_start_day. */
  cycle_anchor_date: string | null;
  /** 0–100+ (overshoot allowed). */
  current_usage_pct: number;
  last_updated_at: string;
  position: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A named session template (e.g. "Application" = 25%). Survives cycle refresh. */
export interface AISessionType {
  id: UUID;
  user_id: UUID;
  model_id: UUID;
  name: string;
  estimated_usage_pct: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Inputs
// ============================================

export interface CreateAIModelInput {
  name: string;
  refresh_frequency: RefreshFrequency;
  cycle_start_date?: string; // defaults to today server-side
  cycle_start_day?: number | null; // for monthly: day 1-31; for weekly: day 1-7
  cycle_anchor_date?: string | null; // anchor-date reset mode (YYYY-MM-DD)
  current_usage_pct?: number; // defaults to 0
  notes?: string | null;
}

export interface UpdateAIModelInput {
  name?: string;
  refresh_frequency?: RefreshFrequency;
  cycle_start_date?: string;
  cycle_start_day?: number | null;
  cycle_anchor_date?: string | null;
  current_usage_pct?: number;
  notes?: string | null;
  position?: number;
}

export interface CreateSessionTypeInput {
  name: string;
  estimated_usage_pct: number;
}

export interface UpdateSessionTypeInput {
  name?: string;
  estimated_usage_pct?: number;
}

// ============================================
// Computed status
// ============================================

export type PaceStatus = "ahead" | "on-pace" | "behind" | "critical";

export interface AIUsageStatus {
  cycleStart: string; // YYYY-MM-DD
  cycleEnd: string; // YYYY-MM-DD (inclusive)
  daysTotal: number;
  daysElapsed: number; // 1..daysTotal
  daysRemaining: number; // 0..daysTotal-1
  cycleExpired: boolean; // today > cycleEnd
  currentPct: number;
  expectedPct: number; // ideal pace today
  remainingPct: number; // max(0, 100 - current)
  deltaPct: number; // current - expected (positive = over)
  dailyPaceSoFar: number; // currentPct / daysElapsed
  paceToFinish: number; // remaining / max(1, daysRemaining)
  restDaysNeeded: number; // 0 if on-pace or ahead
  status: PaceStatus;
  /** Short human-friendly advice line for the UI. */
  advice: string;
}

// ============================================
// Items linkage (no schema change — uses items.metadata_json)
// ============================================

/** Shape stored in `items.metadata_json.ai_usage` to link a task to a model+session. */
export interface ItemAIUsageLink {
  model_id: UUID;
  session_type_id: UUID;
}

/** An upcoming AI-tagged item resolved against the module's models/types. */
export interface UpcomingAISession {
  item_id: UUID;
  item_title: string;
  item_type: "reminder" | "event" | "task";
  /** Event start_at or reminder due_at (ISO) — may be null for pure tasks. */
  when_at: string | null;
  model_id: UUID;
  session_type_id: UUID;
  session_type_name: string;
  estimated_usage_pct: number;
}
