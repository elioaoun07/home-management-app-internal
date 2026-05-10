// src/lib/schedule/alertResolution.ts
// Single source of truth for "which alert applies to this item / occurrence?"
//
// Rules:
//   - kind='relative' alerts are SERIES-LEVEL. They apply to every occurrence
//     unless an exception overrides them.
//   - kind='absolute' alerts are OCCURRENCE-SPECIFIC. They are linked from
//     `item_recurrence_exceptions.override_payload_json.exception_alert_id`
//     and must NEVER be shown as the series default.
//
// All UI code that previously did `item.alerts[0]` should use one of these
// helpers instead.

import type {
  ItemAlert,
  ItemWithDetails,
  RecurrenceException,
} from "@/types/items";
import { isSameDay, parseISO } from "date-fns";

export interface ResolvedAlert {
  /** Minutes before due/start time. */
  offsetMinutes: number;
  /** Optional fixed time-of-day override (HH:mm). */
  customTime: string | null;
  /** Underlying alert row (if any). */
  raw: ItemAlert | null;
  /** Whether this alert applies only to one occurrence. */
  isOccurrenceOverride: boolean;
}

/** Empty/no-alert sentinel. */
export const NO_ALERT: ResolvedAlert = {
  offsetMinutes: 0,
  customTime: null,
  raw: null,
  isOccurrenceOverride: false,
};

/**
 * Returns the relative (series-level) alert for an item, or null if none.
 * Filters out any kind='absolute' rows (those are occurrence overrides).
 */
export function getSeriesAlert(item: ItemWithDetails): ResolvedAlert {
  const alerts = item.alerts ?? [];
  const series = alerts.find(
    (a) => a.active !== false && a.kind === "relative",
  );
  if (!series) return NO_ALERT;
  return {
    offsetMinutes: series.offset_minutes ?? 0,
    customTime: series.custom_time ?? null,
    raw: series,
    isOccurrenceOverride: false,
  };
}

/**
 * Returns the alert that applies to a specific occurrence:
 *   1. If the matching exception has an `exception_alert` (or null = cleared)
 *      override, use that.
 *   2. Otherwise fall back to the series alert.
 */
export function getOccurrenceAlert(
  item: ItemWithDetails,
  occurrenceDate: Date,
): ResolvedAlert {
  const exceptions = item.recurrence_rule?.exceptions ?? [];
  const exception = findExceptionForDate(exceptions, occurrenceDate);

  if (exception?.override_payload_json) {
    const payload = exception.override_payload_json as Record<string, unknown>;
    const modifiedFields =
      (payload.modified_fields as string[] | undefined) ?? [];
    const touched = modifiedFields.includes("exception_alert");

    if (touched) {
      const ex = payload.exception_alert as
        | { offsetMinutes?: number; customTime?: string | null }
        | null
        | undefined;
      if (ex === null || ex === undefined) {
        // Explicitly cleared for this occurrence
        return NO_ALERT;
      }
      // Look up the linked alert row by id (if present)
      const alertId = payload.exception_alert_id as string | undefined;
      const raw = alertId
        ? ((item.alerts ?? []).find((a) => a.id === alertId) ?? null)
        : null;
      return {
        offsetMinutes: ex.offsetMinutes ?? 0,
        customTime: ex.customTime ?? null,
        raw,
        isOccurrenceOverride: true,
      };
    }
  }

  return getSeriesAlert(item);
}

/** Find the exception row whose exdate falls on the same calendar day as `date`. */
export function findExceptionForDate(
  exceptions: RecurrenceException[] | undefined,
  date: Date,
): RecurrenceException | undefined {
  if (!exceptions || exceptions.length === 0) return undefined;
  return exceptions.find((ex) => {
    try {
      return isSameDay(parseISO(ex.exdate), date);
    } catch {
      return false;
    }
  });
}
