// src/lib/schedule/materializeOccurrence.ts
// Single source of truth for merging a recurrence exception override onto a
// base item to produce the "view" of one specific occurrence.
//
// All views (calendar, week, day, reminders, journal, activity, AI context)
// MUST go through this helper instead of inlining their own merge loops. That
// guarantees that whichever fields are overridable for one occurrence stay
// truly per-occurrence and never leak into other dates or the series.

import type {
  ItemPriority,
  ItemWithDetails,
  RecurrenceException,
} from "@/types/items";
import { getOccurrenceAlert, type ResolvedAlert } from "./alertResolution";

/** All fields that may be overridden on a single occurrence. */
export const OVERRIDABLE_FIELDS = [
  "title",
  "description",
  "start_at",
  "end_at",
  "location_text",
  "location_context",
  "priority",
  "categories",
  "responsible_user_id",
  "notify_all_household",
  "is_public",
  "rescheduled_date",
  "exception_alert",
] as const;

export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

export interface OverridePayload {
  modified_fields?: OverridableField[];
  title?: string;
  description?: string | null;
  start_at?: string;
  end_at?: string;
  location_text?: string | null;
  location_context?: "home" | "outside" | "anywhere" | null;
  priority?: ItemPriority;
  categories?: string[];
  responsible_user_id?: string | null;
  notify_all_household?: boolean;
  is_public?: boolean;
  rescheduled_to?: string;
  exception_alert?: {
    offsetMinutes: number;
    customTime?: string | null;
  } | null;
  exception_alert_id?: string;
}

/**
 * The materialized view of one occurrence. Same shape as `ItemWithDetails`
 * with the override applied, plus a few `_isException`-style metadata flags.
 */
export type OccurrenceView = ItemWithDetails & {
  _isException?: boolean;
  _rescheduledFrom?: string; // ISO original exdate
  _occurrenceDate?: string; // ISO of the date this view represents
  _effectiveAlert?: ResolvedAlert;
};

/**
 * Apply an exception override (if any) to a base item, producing the view
 * that should be rendered for `occurrenceDate`.
 *
 * Untouched fields fall through from the base series. Per the design rule,
 * the override mutates ONLY the returned view object; the base item passed
 * in is never modified.
 */
export function materializeOccurrence(
  item: ItemWithDetails,
  occurrenceDate: Date,
  exception?: RecurrenceException | null,
): OccurrenceView {
  const view: OccurrenceView = {
    ...item,
    _occurrenceDate: occurrenceDate.toISOString(),
  };

  if (!exception) {
    view._effectiveAlert = getOccurrenceAlert(item, occurrenceDate);
    return view;
  }

  const payload = (exception.override_payload_json ??
    null) as OverridePayload | null;

  view._isException = true;

  if (!payload) {
    // Exception with no override = "skipped occurrence" marker. Caller is
    // responsible for filtering these out when expanding a range.
    view._effectiveAlert = getOccurrenceAlert(item, occurrenceDate);
    return view;
  }

  if (payload.title !== undefined) view.title = payload.title;
  if (payload.description !== undefined) view.description = payload.description;
  if (payload.priority !== undefined) view.priority = payload.priority;
  if (payload.categories !== undefined) view.categories = payload.categories;
  if (
    payload.responsible_user_id !== undefined &&
    payload.responsible_user_id !== null
  )
    view.responsible_user_id = payload.responsible_user_id;
  if (payload.notify_all_household !== undefined)
    view.notify_all_household = payload.notify_all_household;
  if (payload.is_public !== undefined) view.is_public = payload.is_public;
  if (payload.location_context !== undefined)
    view.location_context = payload.location_context;
  if (payload.location_text !== undefined)
    view.location_text = payload.location_text;

  // Time / location overrides for events.
  if (item.event_details) {
    view.event_details = {
      ...item.event_details,
      ...(payload.start_at !== undefined ? { start_at: payload.start_at } : {}),
      ...(payload.end_at !== undefined ? { end_at: payload.end_at } : {}),
      ...(payload.location_text !== undefined
        ? { location_text: payload.location_text }
        : {}),
    };
  }
  // Time override for reminder/task: shift due_at if start_at present.
  if (item.reminder_details && payload.start_at !== undefined) {
    view.reminder_details = {
      ...item.reminder_details,
      due_at: payload.start_at,
    };
  }

  if (payload.rescheduled_to) {
    view._rescheduledFrom = exception.exdate;
  }

  view._effectiveAlert = getOccurrenceAlert(item, occurrenceDate);
  return view;
}

/**
 * Whether an exception with no override means "this occurrence is skipped".
 * (Used by view code when deciding whether to render the occurrence at all.)
 */
export function isSkippedException(
  exception: RecurrenceException | null | undefined,
): boolean {
  return !!exception && !exception.override_payload_json;
}

/**
 * Whether this exception moves the occurrence to a new date.
 */
export function isRescheduledException(
  exception: RecurrenceException | null | undefined,
): boolean {
  if (!exception?.override_payload_json) return false;
  const p = exception.override_payload_json as OverridePayload;
  return Boolean(p.rescheduled_to);
}
