// src/types/items.ts
// TypeScript types for the unified Items system (reminders, events, tasks)

export type UUID = string;

// ============================================
// ENUMS
// ============================================

export type ItemType = "reminder" | "event" | "task";

export type ItemPriority = "low" | "normal" | "high" | "urgent";

export type ItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived"
  | "dormant";

export type AlertChannel = "push" | "email" | "sms" | "in_app";

export type AlertRelativeTo = "start" | "end" | "due";

export type AlertKind = "absolute" | "relative";

// ============================================
// CORE TYPES
// ============================================

/** Base Item - the core entity for reminders, events, and notes */
export interface Item {
  id: UUID;
  user_id: UUID;
  type: ItemType;
  title: string;
  description?: string | null;
  priority: ItemPriority;
  status?: ItemStatus | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  archived_at?: string | null; // ISO timestamp
  is_public: boolean;
  responsible_user_id: UUID;
  notify_all_household?: boolean; // When true, alerts are sent to ALL household members
  google_event_id?: string | null;
  categories?: string[]; // Array of category IDs (e.g., ["work", "personal"])
  subtask_kanban_enabled?: boolean; // Whether kanban view is enabled for subtasks
  subtask_kanban_stages?: string[]; // Array of kanban stage names (e.g., ["To Do", "In Progress", "Done"])
  // Catalogue template link
  source_catalogue_item_id?: UUID | null; // Reference to the catalogue template this item was created from
  is_template_instance?: boolean; // True if this item syncs with a catalogue template
}

/** Item with related data for display */
export interface ItemWithDetails extends Item {
  reminder_details?: ReminderDetails | null;
  event_details?: EventDetails | null;
  subtasks?: Subtask[];
  alerts?: ItemAlert[];
  recurrence_rule?: RecurrenceRule | null;
  attachments?: ItemAttachment[];
  prerequisites?: import("@/types/prerequisites").ItemPrerequisite[];
}

/** Item Category for organizing items */
export interface ItemCategory {
  id: UUID;
  name: string;
  color_hex?: string | null;
  created_at: string;
  updated_at: string;
  position: number;
  user_id: UUID;
}

/** Reminder-specific details */
export interface ReminderDetails {
  item_id: UUID;
  due_at?: string | null; // ISO timestamp
  completed_at?: string | null; // ISO timestamp
  estimate_minutes?: number | null;
  has_checklist: boolean;
}

/** Event-specific details */
export interface EventDetails {
  item_id: UUID;
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  all_day: boolean;
  location_text?: string | null;
}

/** Subtask for checklists */
export interface Subtask {
  id: UUID;
  parent_item_id: UUID;
  parent_subtask_id?: UUID | null; // Reference to parent subtask for nested subtasks
  title: string;
  occurrence_date?: string | null; // ISO timestamp - which occurrence this subtask belongs to (null for non-recurring)
  done_at?: string | null; // ISO timestamp
  order_index: number;
  priority?: number | null; // Numeric priority (1 = highest). NULL means use order_index
  kanban_stage?: string | null; // Current kanban stage name (e.g., "To Do", "In Progress", "Done")
  previous_kanban_stage?: string | null; // Previous stage before moving to "Later" (for undo)
  created_at: string;
  updated_at: string;
}

/** Subtask with nested children for display */
export interface SubtaskWithChildren extends Subtask {
  children?: SubtaskWithChildren[];
}

/** Alert for notifications */
export interface ItemAlert {
  id: UUID;
  item_id: UUID;
  kind: AlertKind;
  trigger_at?: string | null; // ISO timestamp (for absolute alerts)
  offset_minutes?: number | null; // For relative alerts
  relative_to?: AlertRelativeTo | null; // For relative alerts
  custom_time?: string | null; // HH:MM format - when set, fires at this specific time on the calculated day
  repeat_every_minutes?: number | null;
  max_repeats?: number | null;
  channel: AlertChannel;
  active: boolean;
  last_fired_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Snooze for alerts */
export interface ItemSnooze {
  id: UUID;
  alert_id: UUID;
  item_id: UUID;
  snoozed_until: string; // ISO timestamp
  created_at: string;
}

/** Flexible period for recurring tasks */
export type FlexiblePeriod = "weekly" | "biweekly" | "monthly";

export const FLEXIBLE_PERIOD_LABELS: Record<FlexiblePeriod, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};

/** Recurrence rule for repeating items */
export interface RecurrenceRule {
  id: UUID;
  item_id: UUID;
  rrule: string; // iCal RRULE format
  start_anchor: string; // ISO timestamp
  end_until?: string | null; // ISO timestamp
  count?: number | null;
  exceptions?: RecurrenceException[]; // Exceptions for this rule
  // Flexible routine fields
  is_flexible?: boolean; // If true, no fixed day - user schedules within period
  flexible_period?: FlexiblePeriod | null; // Period within which task must be done
}

/** Schedule for a flexible routine within a specific period */
export interface FlexibleSchedule {
  id: UUID;
  item_id: UUID;
  period_start_date: string; // Date string (YYYY-MM-DD)
  scheduled_for_date: string; // Date string (YYYY-MM-DD)
  scheduled_for_time?: string | null; // Time string (HH:MM) or null for anytime
  created_at: string; // ISO timestamp
  created_by?: UUID | null;
}

/** Completion pattern analytics for an item */
export interface CompletionPattern {
  item_id: UUID;
  user_id: UUID;
  title: string;
  total_completions: number;
  last_completed_at?: string | null;
  first_completed_at?: string | null;
  preferred_day_of_week?: number | null; // 0=Sunday, 6=Saturday
  preferred_hour_of_day?: number | null; // 0-23
  day_of_week_histogram: Record<string, number>; // e.g., {"0": 2, "5": 8}
  hour_of_day_histogram: Record<string, number>; // e.g., {"19": 5, "20": 3}
  avg_days_between_completions?: number | null;
}

/** Recurrence exception */
export interface RecurrenceException {
  id: UUID;
  rule_id: UUID;
  exdate: string; // ISO timestamp
  override_payload_json?: Record<string, unknown> | null;
}

/** File attachment */
export interface ItemAttachment {
  id: UUID;
  item_id: UUID;
  storage_key?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at: string;
}

/** Alert preset */
export interface AlertPreset {
  id: UUID;
  user_id: UUID;
  name: string;
  description?: string | null;
  preset_config: AlertPresetConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertPresetConfig {
  kind: AlertKind;
  offset_minutes?: number;
  relative_to?: AlertRelativeTo;
  channel: AlertChannel;
  repeat_every_minutes?: number;
  max_repeats?: number;
}

// ============================================
// CREATE/UPDATE TYPES
// ============================================

/** Input for creating a new item */
export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string | null;
  priority?: ItemPriority;
  status?: ItemStatus | null;
  metadata_json?: Record<string, unknown> | null;
  is_public?: boolean;
  responsible_user_id?: UUID; // Defaults to current user
  notify_all_household?: boolean; // When true, alerts are sent to ALL household members
  // Catalogue template link
  source_catalogue_item_id?: UUID; // Link to catalogue template
  is_template_instance?: boolean; // True if this is a template instance
  // Prerequisites (triggers) - items start dormant until conditions met
  prerequisites?: import("@/types/prerequisites").CreatePrerequisiteInput[];
}

/** Input for creating a reminder */
export interface CreateReminderInput extends CreateItemInput {
  type: "reminder";
  due_at?: string | null;
  estimate_minutes?: number | null;
  has_checklist?: boolean;
  subtasks?: CreateSubtaskInput[];
  alerts?: CreateAlertInput[];
  category_ids?: UUID[];
  recurrence_rule?: CreateRecurrenceInput;
}

/** Input for creating an event */
export interface CreateEventInput extends CreateItemInput {
  type: "event";
  start_at: string;
  end_at: string;
  all_day?: boolean;
  location_text?: string | null;
  alerts?: CreateAlertInput[];
  category_ids?: UUID[];
  recurrence_rule?: CreateRecurrenceInput;
}

/** Input for creating a task */
export interface CreateTaskInput extends CreateItemInput {
  type: "task";
  due_at?: string | null;
  estimate_minutes?: number | null;
  alerts?: CreateAlertInput[];
  category_ids?: UUID[];
  recurrence_rule?: CreateRecurrenceInput;
}

/** Input for creating a subtask */
export interface CreateSubtaskInput {
  title: string;
  order_index?: number;
}

/** Input for creating an alert */
export interface CreateAlertInput {
  kind: AlertKind;
  trigger_at?: string | null; // For absolute alerts
  offset_minutes?: number | null; // For relative alerts
  relative_to?: AlertRelativeTo | null;
  custom_time?: string | null; // HH:MM format - when set, fires at this specific time
  repeat_every_minutes?: number | null;
  max_repeats?: number | null;
  channel?: AlertChannel;
}

/** Input for creating a recurrence rule */
export interface CreateRecurrenceInput {
  rrule: string;
  start_anchor: string;
  end_until?: string | null;
  count?: number | null;
  is_flexible?: boolean;
  flexible_period?: FlexiblePeriod | null;
}

/** Input for updating an item */
export interface UpdateItemInput {
  title?: string;
  description?: string | null;
  priority?: ItemPriority;
  status?: ItemStatus | null;
  metadata_json?: Record<string, unknown> | null;
  is_public?: boolean;
  archived_at?: string | null;
  categories?: string[];
  responsible_user_id?: string | null;
  notify_all_household?: boolean; // When true, alerts are sent to ALL household members
}

/** Input for updating reminder details */
export interface UpdateReminderInput extends UpdateItemInput {
  due_at?: string | null;
  estimate_minutes?: number | null;
  has_checklist?: boolean;
  completed_at?: string | null;
}

/** Input for updating event details */
export interface UpdateEventInput extends UpdateItemInput {
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  location_text?: string | null;
}

// ============================================
// UTILITY TYPES
// ============================================

/** Filter options for querying items */
export interface ItemsFilter {
  type?: ItemType | ItemType[];
  status?: ItemStatus | ItemStatus[];
  priority?: ItemPriority | ItemPriority[];
  category_ids?: UUID[];
  archived?: boolean;
  search?: string;
  date_from?: string;
  date_to?: string;
  has_alerts?: boolean;
  is_overdue?: boolean;
}

/** Sort options for items */
export interface ItemsSort {
  field:
    | "created_at"
    | "updated_at"
    | "due_at"
    | "start_at"
    | "priority"
    | "title";
  direction: "asc" | "desc";
}

/** Pagination options */
export interface ItemsPagination {
  page: number;
  limit: number;
}

/** Type guards */
export function isReminder(item: Item): item is Item & { type: "reminder" } {
  return item.type === "reminder";
}

export function isEvent(item: Item): item is Item & { type: "event" } {
  return item.type === "event";
}

export function isTask(item: Item): item is Item & { type: "task" } {
  return item.type === "task";
}

/** Priority level for sorting */
export const PRIORITY_LEVELS: Record<ItemPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/** Priority colors (theme-aware) */
export const PRIORITY_COLORS: Record<
  ItemPriority,
  { blue: string; pink: string }
> = {
  urgent: { blue: "text-red-400", pink: "text-red-400" },
  high: { blue: "text-orange-400", pink: "text-orange-400" },
  normal: { blue: "text-cyan-400", pink: "text-pink-400" },
  low: { blue: "text-cyan-400/60", pink: "text-pink-400/60" },
};

/** Status colors (theme-aware) */
export const STATUS_COLORS: Record<ItemStatus, { blue: string; pink: string }> =
  {
    pending: { blue: "text-cyan-400", pink: "text-pink-400" },
    in_progress: { blue: "text-amber-400", pink: "text-amber-400" },
    completed: { blue: "text-green-400", pink: "text-green-400" },
    cancelled: { blue: "text-gray-400", pink: "text-gray-400" },
    archived: { blue: "text-gray-500", pink: "text-gray-500" },
    dormant: { blue: "text-purple-400", pink: "text-purple-400" },
  };

// ============================================
// REMINDER TEMPLATES
// ============================================

/** Reminder template for quick task creation */
export interface ReminderTemplate {
  id: UUID;
  user_id: UUID;
  name: string;
  title: string;
  description?: string | null;
  priority: ItemPriority;
  item_type: ItemType;
  default_duration_minutes?: number | null;
  default_start_time?: string | null; // e.g., "19:00"
  location_text?: string | null;
  icon?: string | null;
  color?: string | null;
  use_count: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Input for creating a reminder template */
export interface CreateReminderTemplateInput {
  name: string;
  title: string;
  description?: string | null;
  priority?: ItemPriority;
  item_type?: ItemType;
  default_duration_minutes?: number | null;
  default_start_time?: string | null;
  location_text?: string | null;
  icon?: string | null;
  color?: string | null;
}

/** Input for updating a reminder template */
export interface UpdateReminderTemplateInput {
  name?: string;
  title?: string;
  description?: string | null;
  priority?: ItemPriority;
  item_type?: ItemType;
  default_duration_minutes?: number | null;
  default_start_time?: string | null;
  location_text?: string | null;
  icon?: string | null;
  color?: string | null;
}

/** Input for launching a reminder template (creating an item from it) */
export interface LaunchReminderTemplateInput {
  template_id: UUID;
  start_at: string; // ISO timestamp
  duration_minutes?: number; // Override default duration
}

// ============================================
// EDIT SCOPE TYPES (for catalogue-linked items)
// ============================================

/** Scope for editing a template instance */
export type ItemEditScope =
  | "this_occurrence" // Edit only this occurrence (creates exception)
  | "future_only" // Edit this and all future occurrences
  | "update_template"; // Update the catalogue template (and optionally linked items)

/** Scope for catalogue edits propagating to linked items */
export type CatalogueEditScope =
  | "future_only" // Only update future occurrences
  | "all"; // Update all occurrences including history

/** Scope for disabling a catalogue item's calendar presence */
export type CatalogueDisableScope =
  | "pause" // Pause recurrence (keep history)
  | "delete_future"; // Delete future occurrences (keep history)

/** Input for promoting a calendar item to catalogue */
export interface PromoteToTemplateInput {
  item_id: UUID;
  module_id: UUID;
  category_id?: UUID;
  keep_linked?: boolean; // Default: true
}

/** Result of promoting an item to catalogue */
export interface PromoteToTemplateResult {
  success: boolean;
  catalogue_item_id?: UUID;
  linked?: boolean;
  error?: string;
}
