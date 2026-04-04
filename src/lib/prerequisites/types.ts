// src/lib/prerequisites/types.ts
// Re-export from centralized types for convenience within the engine

export type {
  ConditionResult,
  CreatePrerequisiteInput,
  CustomFormulaConfig,
  ItemCompletedConfig,
  ItemPrerequisite,
  NfcStateChangeConfig,
  PrerequisiteConditionConfig,
  PrerequisiteConditionType,
  PrerequisiteEvaluation,
  ScheduleConfig,
  TimeWindowConfig,
  TriggerEvent,
  WeatherConfig,
} from "@/types/prerequisites";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Context provided to evaluators */
export interface EvaluationContext {
  supabase: SupabaseClient;
  userId: string;
}

/** Evaluator function signature */
export type ConditionEvaluator = (
  config: Record<string, unknown>,
  context: EvaluationContext,
) => Promise<{ met: boolean; reason?: string }>;
