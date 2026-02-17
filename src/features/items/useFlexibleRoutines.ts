// src/features/items/useFlexibleRoutines.ts
// Hook for managing flexible recurring tasks - tasks that need to be done within a period
// but don't have a fixed day (e.g., "weekly chores" - do anytime during the week)

import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  FlexiblePeriod,
  FlexibleSchedule,
  ItemWithDetails,
} from "@/types/items";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { type ItemOccurrenceAction } from "./useItemActions";
import { itemsKeys, type SubtaskCompletion } from "./useItems";

// ============================================
// QUERY KEYS
// ============================================

export const flexibleRoutinesKeys = {
  all: ["flexible-routines"] as const,
  schedules: () => [...flexibleRoutinesKeys.all, "schedules"] as const,
  schedulesForPeriod: (periodStart: string) =>
    [...flexibleRoutinesKeys.schedules(), periodStart] as const,
  patterns: () => [...flexibleRoutinesKeys.all, "patterns"] as const,
  patternForItem: (itemId: string) =>
    [...flexibleRoutinesKeys.patterns(), itemId] as const,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate period boundaries based on flexible_period type
 */
export function getPeriodBoundaries(
  date: Date,
  period: FlexiblePeriod,
): { start: Date; end: Date } {
  switch (period) {
    case "weekly":
      // Week starts on Monday (weekStartsOn: 1)
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case "biweekly": {
      // Bi-weekly, aligned to ISO week numbers (even weeks)
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekNumber = parseInt(format(weekStart, "w"));
      // If odd week, go back one week to start of bi-week period
      const periodStart =
        weekNumber % 2 === 1 ? addWeeks(weekStart, -1) : weekStart;
      const periodEnd = addWeeks(periodStart, 2);
      periodEnd.setDate(periodEnd.getDate() - 1); // Last day of 2nd week
      return { start: periodStart, end: periodEnd };
    }
    case "monthly":
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
      };
    default:
      // Default to weekly
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      };
  }
}

/**
 * Format period label for display
 */
export function formatPeriodLabel(period: FlexiblePeriod, date: Date): string {
  const { start, end } = getPeriodBoundaries(date, period);
  switch (period) {
    case "weekly":
      return `This Week (${format(start, "MMM d")} - ${format(end, "MMM d")})`;
    case "biweekly":
      return `This Bi-Week (${format(start, "MMM d")} - ${format(end, "MMM d")})`;
    case "monthly":
      return `This Month (${format(start, "MMMM yyyy")})`;
    default:
      return `This Period`;
  }
}

/**
 * Get date string for period start (YYYY-MM-DD format)
 */
export function getPeriodStartString(
  date: Date,
  period: FlexiblePeriod,
): string {
  const { start } = getPeriodBoundaries(date, period);
  return format(start, "yyyy-MM-dd");
}

// ============================================
// TYPES
// ============================================

export interface FlexibleRoutineItem extends ItemWithDetails {
  flexibleSchedule?: FlexibleSchedule | null;
  isScheduledForCurrentPeriod: boolean;
  isCompletedForCurrentPeriod: boolean;
  periodStart: string;
  periodEnd: string;
  subtaskProgress?: {
    completed: number;
    total: number;
  };
}

export interface ScheduleRoutineInput {
  itemId: string;
  periodStartDate: string;
  scheduledForDate: string;
  scheduledForTime?: string | null;
}

export interface FlexibleRoutinesResult {
  unscheduled: FlexibleRoutineItem[];
  scheduled: FlexibleRoutineItem[];
  completed: FlexibleRoutineItem[];
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
}

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch all flexible schedules for the user
 */
async function fetchFlexibleSchedules(): Promise<FlexibleSchedule[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("item_flexible_schedules")
    .select("*")
    .order("period_start_date", { ascending: false });

  if (error) throw error;
  return data as FlexibleSchedule[];
}

/**
 * Fetch flexible items with their schedules and completion status
 */
async function fetchFlexibleRoutines(
  items: ItemWithDetails[],
  schedules: FlexibleSchedule[],
  actions: ItemOccurrenceAction[],
  subtaskCompletions: SubtaskCompletion[],
  referenceDate: Date = new Date(),
): Promise<FlexibleRoutinesResult> {
  // Filter items that have flexible recurrence rules
  const flexibleItems = items.filter(
    (item) => item.recurrence_rule?.is_flexible === true,
  );

  // Group items by their period for the reference date
  const result: FlexibleRoutinesResult = {
    unscheduled: [],
    scheduled: [],
    completed: [],
    periodLabel: "",
    periodStart: new Date(),
    periodEnd: new Date(),
  };

  // Use the most common period type, defaulting to weekly
  const mostCommonPeriod =
    flexibleItems.reduce<FlexiblePeriod | null>((acc, item) => {
      const period = item.recurrence_rule?.flexible_period;
      if (period && !acc) return period;
      return acc;
    }, null) || "weekly";

  const { start: periodStart, end: periodEnd } = getPeriodBoundaries(
    referenceDate,
    mostCommonPeriod,
  );
  const periodStartStr = format(periodStart, "yyyy-MM-dd");

  result.periodStart = periodStart;
  result.periodEnd = periodEnd;
  result.periodLabel = formatPeriodLabel(mostCommonPeriod, referenceDate);

  for (const item of flexibleItems) {
    const period = item.recurrence_rule?.flexible_period || "weekly";
    const { start, end } = getPeriodBoundaries(referenceDate, period);
    const itemPeriodStartStr = format(start, "yyyy-MM-dd");

    // Find schedule for this item in current period
    const schedule = schedules.find(
      (s) =>
        s.item_id === item.id && s.period_start_date === itemPeriodStartStr,
    );

    // Check if completed for this period
    // For flexible tasks, we consider it completed if there's a completion action
    // with an occurrence_date within the current period
    const isCompleted = actions.some((action) => {
      if (action.item_id !== item.id) return false;
      if (action.action_type !== "completed") return false;
      const actionDate = parseISO(action.occurrence_date);
      return isWithinInterval(actionDate, { start, end });
    });

    // Calculate subtask progress for current period
    let subtaskProgress: { completed: number; total: number } | undefined;
    if (item.subtasks && item.subtasks.length > 0) {
      // For flexible items, check subtask_completions for this period
      const periodStartForComparison = format(start, "yyyy-MM-dd");
      const subtaskIds = new Set(item.subtasks.map((s) => s.id));

      // Count completions for this period
      const periodCompletions = subtaskCompletions.filter((c) => {
        if (!subtaskIds.has(c.subtask_id)) return false;
        // Parse occurrence_date and compare to period start
        try {
          const completionDate = format(
            parseISO(c.occurrence_date),
            "yyyy-MM-dd",
          );
          return completionDate === periodStartForComparison;
        } catch {
          return false;
        }
      });

      const completedSubtaskIds = new Set(
        periodCompletions.map((c) => c.subtask_id),
      );

      subtaskProgress = {
        completed: completedSubtaskIds.size,
        total: item.subtasks.length,
      };
    }

    const flexibleItem: FlexibleRoutineItem = {
      ...item,
      flexibleSchedule: schedule || null,
      isScheduledForCurrentPeriod: !!schedule,
      isCompletedForCurrentPeriod: isCompleted,
      periodStart: itemPeriodStartStr,
      periodEnd: format(end, "yyyy-MM-dd"),
      subtaskProgress,
    };

    if (isCompleted) {
      result.completed.push(flexibleItem);
    } else if (schedule) {
      result.scheduled.push(flexibleItem);
    } else {
      result.unscheduled.push(flexibleItem);
    }
  }

  return result;
}

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Hook to fetch all flexible schedules
 */
export function useFlexibleSchedules() {
  return useQuery({
    queryKey: flexibleRoutinesKeys.schedules(),
    queryFn: fetchFlexibleSchedules,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch subtask completions for flexible items
 */
export function useFlexibleSubtaskCompletions(
  items: ItemWithDetails[] | undefined,
) {
  return useQuery({
    queryKey: [...flexibleRoutinesKeys.all, "subtask-completions"],
    queryFn: async () => {
      if (!items) return [];

      // Get flexible items only
      const flexibleItems = items.filter(
        (item) => item.recurrence_rule?.is_flexible === true,
      );

      if (flexibleItems.length === 0) return [];

      // Get all subtask IDs from flexible items
      const subtaskIds = flexibleItems.flatMap(
        (item) => item.subtasks?.map((s) => s.id) || [],
      );

      if (subtaskIds.length === 0) return [];

      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from("item_subtask_completions")
        .select("*")
        .in("subtask_id", subtaskIds);

      if (error) throw error;
      return data as SubtaskCompletion[];
    },
    enabled: !!items && items.length > 0,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Main hook to get flexible routines organized by status
 */
export function useFlexibleRoutines(
  items: ItemWithDetails[] | undefined,
  actions: ItemOccurrenceAction[] | undefined,
  referenceDate: Date = new Date(),
) {
  const { data: schedules = [] } = useFlexibleSchedules();
  const { data: subtaskCompletions = [] } =
    useFlexibleSubtaskCompletions(items);

  return useQuery({
    queryKey: [
      ...flexibleRoutinesKeys.all,
      "organized",
      format(referenceDate, "yyyy-MM-dd"),
      items?.length,
      schedules.length,
      actions?.length,
      subtaskCompletions.length,
    ],
    queryFn: () =>
      fetchFlexibleRoutines(
        items || [],
        schedules,
        actions || [],
        subtaskCompletions,
        referenceDate,
      ),
    enabled: !!items && items.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Schedule a flexible routine for a specific date
 */
export function useScheduleRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ScheduleRoutineInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert the schedule (update if exists for same period, insert if not)
      const { data, error } = await supabase
        .from("item_flexible_schedules")
        .upsert(
          {
            item_id: input.itemId,
            period_start_date: input.periodStartDate,
            scheduled_for_date: input.scheduledForDate,
            scheduled_for_time: input.scheduledForTime || null,
            created_by: user.id,
          },
          {
            onConflict: "item_id,period_start_date",
          },
        )
        .select()
        .single();

      if (error) throw error;
      return data as FlexibleSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: flexibleRoutinesKeys.schedules(),
      });
      queryClient.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
    },
  });
}

/**
 * Remove a schedule for a flexible routine
 */
export function useUnscheduleRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      periodStartDate,
    }: {
      itemId: string;
      periodStartDate: string;
    }) => {
      const supabase = supabaseBrowser();

      const { error } = await supabase
        .from("item_flexible_schedules")
        .delete()
        .eq("item_id", itemId)
        .eq("period_start_date", periodStartDate);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: flexibleRoutinesKeys.schedules(),
      });
      queryClient.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
    },
  });
}

/**
 * Complete a flexible routine for the current period
 * This creates a completion action with the scheduled date as occurrence_date
 */
export function useCompleteFlexibleRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      occurrenceDate,
      reason,
    }: {
      itemId: string;
      occurrenceDate: string;
      reason?: string;
    }) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .insert({
          item_id: itemId,
          occurrence_date: occurrenceDate,
          action_type: "completed",
          reason,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.allActions() });
      queryClient.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
    },
  });
}

/**
 * Mark a flexible routine as skipped for the current period
 */
export function useSkipFlexibleRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      periodStartDate,
      reason,
    }: {
      itemId: string;
      periodStartDate: string;
      reason?: string;
    }) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .insert({
          item_id: itemId,
          occurrence_date: periodStartDate,
          action_type: "skipped",
          reason,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.allActions() });
      queryClient.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
    },
  });
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Check if there are any unscheduled flexible routines
 */
export function useHasUnscheduledRoutines(
  items: ItemWithDetails[] | undefined,
  actions: ItemOccurrenceAction[] | undefined,
): boolean {
  const { data: routines } = useFlexibleRoutines(items, actions);
  return (routines?.unscheduled?.length ?? 0) > 0;
}

// ============================================
// COMPLETION PATTERNS
// ============================================

interface CompletionPattern {
  item_id: string;
  user_id: string;
  title: string;
  total_completions: number;
  last_completed_at: string | null;
  first_completed_at: string | null;
  preferred_day_of_week: number | null; // 0=Sunday, 6=Saturday
  preferred_hour_of_day: number | null; // 0-23
  day_of_week_histogram: Record<string, number>;
  hour_of_day_histogram: Record<string, number>;
  avg_days_between_completions: number | null;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Get completion patterns for a specific item
 * Useful for showing historical patterns and AI suggestions
 */
export function useCompletionPatterns(itemId?: string) {
  return useQuery({
    queryKey: [...flexibleRoutinesKeys.all, "patterns", itemId],
    queryFn: async () => {
      if (!itemId) return null;

      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from("item_completion_patterns")
        .select("*")
        .eq("item_id", itemId)
        .maybeSingle();

      if (error) throw error;
      return data as CompletionPattern | null;
    },
    enabled: !!itemId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get completion patterns for multiple items (batch)
 */
export function useCompletionPatternsForItems(itemIds: string[]) {
  return useQuery({
    queryKey: [
      ...flexibleRoutinesKeys.all,
      "patterns",
      "batch",
      itemIds.join(","),
    ],
    queryFn: async () => {
      if (itemIds.length === 0) return [];

      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from("item_completion_patterns")
        .select("*")
        .in("item_id", itemIds);

      if (error) throw error;
      return data as CompletionPattern[];
    },
    enabled: itemIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Format pattern data into a human-readable suggestion
 */
export function formatPatternSuggestion(
  pattern: CompletionPattern | null | undefined,
): string | null {
  if (!pattern || pattern.total_completions < 2) return null;

  const parts: string[] = [];

  // Suggest preferred day
  if (pattern.preferred_day_of_week !== null) {
    parts.push(`Usually done on ${DAY_NAMES[pattern.preferred_day_of_week]}`);
  }

  // Suggest preferred time
  if (pattern.preferred_hour_of_day !== null) {
    const hour = pattern.preferred_hour_of_day;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    parts.push(`around ${displayHour}:00 ${period}`);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Get the best suggested day/time for scheduling based on patterns
 */
export function getSuggestedSchedule(
  pattern: CompletionPattern | null | undefined,
  periodBounds: { start: Date; end: Date },
): Date | null {
  if (!pattern || pattern.total_completions < 2) return null;

  const { start, end } = periodBounds;
  let suggestedDay: Date | null = null;

  // Find the preferred day within the period
  if (pattern.preferred_day_of_week !== null) {
    // Start from period start and find the first occurrence of preferred day
    const currentDay = new Date(start);
    while (currentDay <= end) {
      if (currentDay.getDay() === pattern.preferred_day_of_week) {
        suggestedDay = new Date(currentDay);
        break;
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }

  // If no preferred day found in period, use period start
  if (!suggestedDay) {
    suggestedDay = new Date(start);
  }

  // Set preferred time if available
  if (pattern.preferred_hour_of_day !== null) {
    suggestedDay.setHours(pattern.preferred_hour_of_day, 0, 0, 0);
  } else {
    // Default to 10 AM if no preference
    suggestedDay.setHours(10, 0, 0, 0);
  }

  return suggestedDay;
}
