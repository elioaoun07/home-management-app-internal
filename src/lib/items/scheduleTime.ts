// src/lib/items/scheduleTime.ts
// Shared "effective scheduled time" resolver for items.
//
// An item's scheduled timestamp lives across three optional sources:
//   1. event_details.start_at      (events)
//   2. reminder_details.due_at     (reminders/tasks)
//   3. item_alerts[].trigger_at    (custom-time alerts)
//
// Priority (highest → lowest): event > reminder > earliest active alert.
// Items where reminder_details.completed_at is set are considered done and
// should typically be excluded by callers (we expose `isCompleted` separately).
//
// Used by both the ERA Hub schedule widget and the Schedule face dashboard
// so the two views stay in sync.

export interface ItemAlertRow {
  trigger_at: string | null;
  active: boolean;
}

export interface ReminderDetailsRow {
  due_at: string | null;
  completed_at: string | null;
}

export interface EventDetailsRow {
  start_at: string | null;
  end_at: string | null;
  all_day: boolean | null;
}

export interface ScheduleSourceRow {
  reminder_details?: ReminderDetailsRow | ReminderDetailsRow[] | null;
  event_details?: EventDetailsRow | EventDetailsRow[] | null;
  item_alerts?: ItemAlertRow[] | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export interface EffectiveSchedule {
  /** ISO timestamp of the effective schedule, or null if none. */
  scheduledAt: string | null;
  /** Where the timestamp came from. */
  source: "event" | "reminder" | "alert" | "none";
  /** True if reminder_details.completed_at is set (item is finished). */
  isCompleted: boolean;
  /** End timestamp if this is an event with a defined end_at. */
  endAt: string | null;
  /** True for all-day events (consumers may render differently). */
  allDay: boolean;
}

export function getEffectiveSchedule(
  row: ScheduleSourceRow,
): EffectiveSchedule {
  const reminder = pickOne(row.reminder_details);
  const event = pickOne(row.event_details);
  const alerts = row.item_alerts ?? [];

  const isCompleted = !!reminder?.completed_at;

  if (event?.start_at) {
    return {
      scheduledAt: event.start_at,
      source: "event",
      isCompleted,
      endAt: event.end_at ?? null,
      allDay: !!event.all_day,
    };
  }

  if (reminder?.due_at) {
    return {
      scheduledAt: reminder.due_at,
      source: "reminder",
      isCompleted,
      endAt: null,
      allDay: false,
    };
  }

  // Earliest active alert with a trigger_at.
  let earliestAlert: string | null = null;
  for (const a of alerts) {
    if (!a.active || !a.trigger_at) continue;
    if (earliestAlert === null || a.trigger_at < earliestAlert) {
      earliestAlert = a.trigger_at;
    }
  }
  if (earliestAlert) {
    return {
      scheduledAt: earliestAlert,
      source: "alert",
      isCompleted,
      endAt: null,
      allDay: false,
    };
  }

  return {
    scheduledAt: null,
    source: "none",
    isCompleted,
    endAt: null,
    allDay: false,
  };
}

export type ScheduleBucket =
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later"
  | "none";

export function bucketSchedule(
  scheduledAt: string | null,
  now: Date = new Date(),
): ScheduleBucket {
  if (!scheduledAt) return "none";

  const at = new Date(scheduledAt);
  if (Number.isNaN(at.getTime())) return "none";

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (at < todayStart) return "overdue";
  if (at <= todayEnd) return "today";
  if (at <= tomorrowEnd) return "tomorrow";
  if (at <= weekEnd) return "thisWeek";
  return "later";
}
