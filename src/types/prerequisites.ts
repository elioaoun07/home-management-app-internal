// src/types/prerequisites.ts
// TypeScript types for the Prerequisite Engine

export type UUID = string;

// ============================================
// CONDITION TYPES
// ============================================

export type PrerequisiteConditionType =
  | "nfc_state_change"
  | "item_completed"
  | "weather"
  | "time_window"
  | "schedule"
  | "custom_formula";

// ============================================
// CONDITION CONFIGS (discriminated by type)
// ============================================

export interface NfcStateChangeConfig {
  tag_id: UUID;
  target_state: string;
}

export interface ItemCompletedConfig {
  prerequisite_item_id: UUID;
}

export interface WeatherConfig {
  condition: string; // e.g. "rain", "snow", "clear"
  location: string; // "auto" or coordinates
}

export interface TimeWindowConfig {
  start: string; // HH:MM
  end: string; // HH:MM
  days?: string[]; // ["mon", "tue", ...]
}

export interface ScheduleConfig {
  cron: string; // cron expression
}

export interface CustomFormulaConfig {
  expression: string; // e.g. "nfc.oven.state == 'on'"
}

export type PrerequisiteConditionConfig =
  | NfcStateChangeConfig
  | ItemCompletedConfig
  | WeatherConfig
  | TimeWindowConfig
  | ScheduleConfig
  | CustomFormulaConfig;

// ============================================
// PREREQUISITE RECORD
// ============================================

export interface ItemPrerequisite {
  id: UUID;
  item_id: UUID;
  condition_type: PrerequisiteConditionType;
  condition_config: PrerequisiteConditionConfig;
  logic_group: number; // same group = AND, different groups = OR
  is_active: boolean;
  last_evaluated_at: string | null;
  last_result: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePrerequisiteInput {
  condition_type: PrerequisiteConditionType;
  condition_config: PrerequisiteConditionConfig;
  logic_group?: number;
}

// ============================================
// EVALUATION RESULT
// ============================================

export interface ConditionResult {
  prerequisite_id: UUID;
  condition_type: PrerequisiteConditionType;
  met: boolean;
  reason?: string;
}

export interface PrerequisiteEvaluation {
  item_id: UUID;
  met: boolean;
  results: ConditionResult[];
}

// ============================================
// TRIGGER EVENTS
// ============================================

export type TriggerEvent =
  | { type: "nfc_state_change"; tag_id: UUID; new_state: string }
  | { type: "item_completed"; item_id: UUID };
