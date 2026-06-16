// Shared "what lands on date X" expansion — single source of truth for the
// flexible-item placement rule (skip RRULE loop, inject item_flexible_schedules rows).
// Extracted from the local expandRecurringItems() that used to live in WebTodayView.tsx
// so the day planner can reuse the exact same placement logic.

import type { FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import type { ItemWithDetails } from "@/types/items";
import { addDays, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { adjustOccurrenceToWallClock, getOccurrencesInRange } from "./date";

export interface ExpandedOccurrence {
  item: ItemWithDetails;
  occurrenceDate: Date;
  isCompleted: boolean;
  isPostponed?: boolean;
  originalDate?: Date;
}

export function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr: string | null | undefined =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
}

/**
 * Expand items into concrete occurrences within [startDate, endDate].
 * Flexible items are skipped here and injected from `scheduledFlexible` instead —
 * never consult `recurrence_rule.rrule` for a flexible item.
 */
export function expandOccurrencesInRange(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
  actions: ItemOccurrenceAction[],
  scheduledFlexible: FlexibleRoutineItem[] = [],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    // Flexible items are placed via item_flexible_schedules — handled below
    if (item.recurrence_rule?.is_flexible) continue;

    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const occurrences = getOccurrencesInRange(
          item.recurrence_rule,
          itemDate,
          startDate,
          endDate,
        );
        for (const occ of occurrences) {
          const adjusted = adjustOccurrenceToWallClock(occ, itemDate);
          const isCompleted = isOccurrenceCompleted(item.id, occ, actions);
          result.push({ item, occurrenceDate: adjusted, isCompleted });
        }
      } catch (error) {
        console.error("Error parsing RRULE:", error);
      }
    } else if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
      const isCompleted =
        item.status === "completed" ||
        isOccurrenceCompleted(item.id, itemDate, actions);
      result.push({ item, occurrenceDate: itemDate, isCompleted });
    }
  }

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayPostponed = getPostponedOccurrencesForDate(items, currentDate, actions);
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) => r.item.id === p.item.id && isSameDay(r.occurrenceDate, p.occurrenceDate),
      );
      if (!alreadyExists) {
        result.push({
          item: p.item,
          occurrenceDate: p.occurrenceDate,
          isCompleted: false,
          isPostponed: true,
          originalDate: p.originalDate,
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  // Inject scheduled flexible routines (source of truth: item_flexible_schedules)
  for (const si of scheduledFlexible) {
    const sched = si.flexibleSchedule;
    if (!sched?.scheduled_for_date) continue;
    let schedDate: Date;
    try {
      schedDate = parseISO(sched.scheduled_for_date);
    } catch {
      continue;
    }
    if (!isWithinInterval(schedDate, { start: startDate, end: endDate })) continue;

    const [hh, mm] = (sched.scheduled_for_time ?? "09:00")
      .split(":")
      .map((n) => parseInt(n, 10));
    const occurrenceDate = new Date(schedDate);
    occurrenceDate.setHours(hh || 9, mm || 0, 0, 0);

    const isCompleted = si.isCompletedForCurrentPeriod;
    if (
      result.some(
        (r) => r.item.id === si.id && isSameDay(r.occurrenceDate, occurrenceDate),
      )
    ) {
      continue;
    }
    result.push({ item: si, occurrenceDate, isCompleted });
  }

  return result.sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());
}

/** Convenience wrapper: everything landing on a single calendar day. */
export function getOccurrencesForDay(
  items: ItemWithDetails[],
  date: Date,
  actions: ItemOccurrenceAction[],
  scheduledFlexible: FlexibleRoutineItem[] = [],
): ExpandedOccurrence[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);
  return expandOccurrencesInRange(items, dayStart, dayEnd, actions, scheduledFlexible);
}
