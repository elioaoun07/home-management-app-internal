// src/lib/schedule/expandOccurrences.ts
// Single canonical "given a range, return all occurrence views" helper.
// Replaces inline expansion+merge loops in WebCalendar, WebWeekView,
// WebTodayView, WebDayPlanner, ItemsListView, etc.
//
// Concerns handled here, in order:
//   1. Expand recurrence via getOccurrencesInRange (which already handles
//      bi-weekly phase flips).
//   2. Skip occurrences inside an active recurrence_pause window.
//   3. Skip occurrences whose exdate is "skipped" (exception with no
//      override_payload_json).
//   4. Skip occurrences whose exdate is rescheduled_to elsewhere.
//   5. Add rescheduled_to occurrences ON the new date.
//   6. Filter out occurrences with completed/cancelled/postponed actions.
//   7. Apply field overrides via materializeOccurrence.

import type { ItemOccurrenceAction } from "@/features/items/useItemActions";
import { isOccurrenceCompleted } from "@/features/items/useItemActions";
import { getOccurrencesInRange } from "@/lib/utils/date";
import type { ItemWithDetails, RecurrencePause } from "@/types/items";
import { format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import {
  isRescheduledException,
  isSkippedException,
  materializeOccurrence,
  type OccurrenceView,
  type OverridePayload,
} from "./materializeOccurrence";

export interface ExpandOptions {
  /** Items returned from useItems / useSchedule. */
  items: ItemWithDetails[];
  /** Window to expand into. */
  rangeStart: Date;
  rangeEnd: Date;
  /** Action history (completion/cancel/postpone). */
  occurrenceActions?: ItemOccurrenceAction[];
  /** Include items that have been completed/cancelled? Defaults to false. */
  includeHandled?: boolean;
  /** Include flexible-recurrence items? They are typically rendered separately. */
  includeFlexible?: boolean;
}

/**
 * Determine whether `occurrenceDate` falls inside any active pause window
 * for the given pauses array.
 */
function isPaused(pauses: RecurrencePause[] | undefined, date: Date): boolean {
  if (!pauses || pauses.length === 0) return false;
  const dateStr = format(date, "yyyy-MM-dd");
  return pauses.some(
    (p) =>
      dateStr >= p.pause_start &&
      (p.pause_end === null || dateStr <= p.pause_end),
  );
}

/**
 * Expand every item in `items` into per-occurrence views inside [rangeStart,
 * rangeEnd], applying pauses, exceptions (skip, reschedule, override), and
 * occurrence-action suppression.
 */
export function expandOccurrencesForRange(
  options: ExpandOptions,
): OccurrenceView[] {
  const {
    items,
    rangeStart,
    rangeEnd,
    occurrenceActions = [],
    includeHandled = false,
    includeFlexible = false,
  } = options;

  const result: OccurrenceView[] = [];

  for (const item of items) {
    // Non-recurring item: emit it directly if its single date is in range.
    if (!item.recurrence_rule?.rrule) {
      const itemDate = getItemPrimaryDate(item);
      if (
        itemDate &&
        isWithinInterval(itemDate, {
          start: rangeStart,
          end: rangeEnd,
        }) &&
        (includeHandled ||
          !isOccurrenceCompleted(item.id, itemDate, occurrenceActions))
      ) {
        result.push(materializeOccurrence(item, itemDate, null));
      }
      continue;
    }

    if (item.recurrence_rule.is_flexible && !includeFlexible) continue;

    const exceptions = item.recurrence_rule.exceptions ?? [];
    const itemAnchor = item.recurrence_rule.start_anchor
      ? parseISO(item.recurrence_rule.start_anchor)
      : (getItemPrimaryDate(item) ?? rangeStart);

    // 1. Add rescheduled_to occurrences whose new date falls in range.
    for (const exception of exceptions) {
      if (!isRescheduledException(exception)) continue;
      const payload = exception.override_payload_json as OverridePayload;
      const newDate = parseISO(payload.rescheduled_to as string);
      if (!isWithinInterval(newDate, { start: rangeStart, end: rangeEnd }))
        continue;
      const handled = isOccurrenceCompleted(
        item.id,
        parseISO(exception.exdate),
        occurrenceActions,
      );
      if (!includeHandled && handled) continue;
      result.push({
        ...materializeOccurrence(item, newDate, exception),
        _rescheduledFrom: exception.exdate,
        _occurrenceDate: newDate.toISOString(),
      });
    }

    // 2. Expand normal occurrences in range.
    const occurrences = getOccurrencesInRange(
      item.recurrence_rule,
      itemAnchor,
      rangeStart,
      rangeEnd,
    );

    for (const occ of occurrences) {
      if (isPaused(item.pauses, occ)) continue;

      const matchingException = exceptions.find((ex) =>
        isSameDay(parseISO(ex.exdate), occ),
      );

      if (isSkippedException(matchingException)) continue;
      if (isRescheduledException(matchingException)) continue; // shown on new date above

      if (
        !includeHandled &&
        isOccurrenceCompleted(item.id, occ, occurrenceActions)
      )
        continue;

      result.push(materializeOccurrence(item, occ, matchingException));
    }
  }

  return result;
}

/** Pick the canonical date of an item that's not recurring (or anchor). */
function getItemPrimaryDate(item: ItemWithDetails): Date | null {
  if (item.event_details?.start_at) {
    return parseISO(item.event_details.start_at);
  }
  if (item.reminder_details?.due_at) {
    return parseISO(item.reminder_details.due_at);
  }
  return null;
}
