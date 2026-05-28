"use client";

import {
  useAllOccurrenceActions,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import {
  getPeriodBoundaries,
  useFlexibleRoutines,
  useScheduleRoutine,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import { useItems } from "@/features/items/useItems";
import type { ItemWithDetails } from "@/types/items";
import { format, isWithinInterval, parseISO } from "date-fns";

function getActionPlannedFor(action: ItemOccurrenceAction): string | null {
  const plannedFor = action.metadata_json?.planned_for;
  return typeof plannedFor === "string" ? plannedFor : null;
}

function actionMatchesDate(
  action: ItemOccurrenceAction,
  itemId: string,
  dateStr: string,
): boolean {
  if (action.item_id !== itemId) return false;
  if (
    action.action_type !== "completed" &&
    action.action_type !== "skipped" &&
    action.action_type !== "cancelled" &&
    action.action_type !== "postponed"
  ) {
    return false;
  }
  const accountingDate = getActionPlannedFor(action) ?? action.occurrence_date;
  try {
    return format(parseISO(accountingDate), "yyyy-MM-dd") === dateStr;
  } catch {
    return false;
  }
}

function toFlexibleRoutineItem(
  item: ItemWithDetails,
  periodStartStr: string,
  periodEndStr: string,
): FlexibleRoutineItem {
  const dueAt = item.reminder_details?.due_at;
  const scheduledForDate = dueAt ? dueAt.split("T")[0] : null;
  const scheduledForTime = dueAt ? format(parseISO(dueAt), "HH:mm") : null;
  return {
    ...item,
    flexibleSchedule: scheduledForDate
      ? {
          id: `one-time-${item.id}` as `${string}-${string}-${string}-${string}-${string}`,
          item_id: item.id as `${string}-${string}-${string}-${string}-${string}`,
          period_start_date: periodStartStr,
          scheduled_for_date: scheduledForDate,
          scheduled_for_time: scheduledForTime,
          occurrence_index: 0,
          created_at: item.created_at ?? new Date().toISOString(),
          created_by: null,
        }
      : null,
    scheduledOccurrences: [],
    targetOccurrences: 1,
    scheduledCount: scheduledForDate ? 1 : 0,
    completedCount: item.status === "completed" ? 1 : 0,
    skippedCount: 0,
    isScheduledForCurrentPeriod: !!scheduledForDate,
    isCompletedForCurrentPeriod: item.status === "completed",
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
  };
}

export function useChores(referenceDate: Date = new Date()) {
  const { data: allItems = [] } = useItems();
  const { data: actions = [] } = useAllOccurrenceActions();

  const choreItems = allItems.filter((item) => item.is_chore);

  // Flexible recurring chores (persistent item + is_flexible recurrence rule)
  const flexibleChores = choreItems.filter(
    (item) => item.recurrence_rule?.is_flexible === true,
  );
  // One-time chores (scheduled via due_at from AddFlexibleFromCatalogueDialog)
  const oneTimeChores = choreItems.filter(
    (item) => item.recurrence_rule?.is_flexible !== true,
  );

  const { data: flexibleData } = useFlexibleRoutines(
    flexibleChores.length > 0 ? flexibleChores : undefined,
    actions,
    referenceDate,
  );

  const { start: weekStart, end: weekEnd } = getPeriodBoundaries(
    referenceDate,
    "weekly",
  );
  const periodStartStr = format(weekStart, "yyyy-MM-dd");
  const periodEndStr = format(weekEnd, "yyyy-MM-dd");

  const oneTimeScheduled: FlexibleRoutineItem[] = [];
  const oneTimeCompleted: FlexibleRoutineItem[] = [];

  for (const item of oneTimeChores) {
    const dueAt = item.reminder_details?.due_at;
    if (!dueAt) continue;
    if (
      item.status === "cancelled" ||
      item.status === "archived" ||
      item.status === "dormant"
    ) {
      continue;
    }
    const inPeriod = isWithinInterval(parseISO(dueAt), {
      start: weekStart,
      end: weekEnd,
    });
    if (!inPeriod) continue;
    const dueDateStr = format(parseISO(dueAt), "yyyy-MM-dd");
    const resolutionAction = actions.find((action) =>
      actionMatchesDate(action, item.id, dueDateStr),
    );
    if (
      item.status === "completed" ||
      resolutionAction?.action_type === "completed"
    ) {
      oneTimeCompleted.push(
        {
          ...toFlexibleRoutineItem(item, periodStartStr, periodEndStr),
          completedAction:
            resolutionAction?.action_type === "completed"
              ? resolutionAction
              : undefined,
        },
      );
    } else if (resolutionAction) {
      continue;
    } else {
      oneTimeScheduled.push(
        toFlexibleRoutineItem(item, periodStartStr, periodEndStr),
      );
    }
  }

  const periodLabel =
    flexibleData?.periodLabel ??
    `This Week (${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")})`;

  return {
    choreItems,
    actions,
    scheduled: [
      ...(flexibleData?.scheduled ?? []),
      ...oneTimeScheduled,
    ],
    unscheduled: flexibleData?.unscheduled ?? [],
    completed: [
      ...(flexibleData?.completed ?? []),
      ...oneTimeCompleted,
    ],
    periodLabel,
    periodStart: flexibleData?.periodStart ?? weekStart,
    periodEnd: flexibleData?.periodEnd ?? weekEnd,
  };
}

export { useScheduleRoutine };
