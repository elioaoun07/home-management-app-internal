/**
 * Date utility functions
 * Consolidated date formatting and manipulation utilities
 */

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Alias for formatDate for backward compatibility
 */
export const yyyyMmDd = formatDate;

/**
 * Get start of custom month based on user-defined month start day
 */
export function startOfCustomMonth(date: Date, monthStartDay: number): Date {
  const d = new Date(date);
  const currentDay = d.getDate();
  const s = new Date(d);
  if (currentDay >= monthStartDay) {
    s.setDate(monthStartDay);
  } else {
    s.setMonth(s.getMonth() - 1);
    s.setDate(monthStartDay);
  }
  s.setHours(0, 0, 0, 0);
  return s;
}

/**
 * Get default date range for the current custom month period
 */
export function getDefaultDateRange(monthStartDay: number = 1): {
  start: string;
  end: string;
} {
  const now = new Date();
  const sCustom = startOfCustomMonth(now, monthStartDay);
  const nextPeriod = new Date(sCustom);
  nextPeriod.setMonth(nextPeriod.getMonth() + 1);
  nextPeriod.setDate(monthStartDay);
  const endOfPeriod = new Date(nextPeriod);
  endOfPeriod.setDate(endOfPeriod.getDate() - 1);
  return {
    start: formatDate(sCustom),
    end: formatDate(endOfPeriod),
  };
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return formatDate(date) === formatDate(today);
}

/**
 * Check if a date is yesterday
 */
export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(date) === formatDate(yesterday);
}

/**
 * Convert a local date string and time string to a proper ISO 8601 UTC string.
 * This ensures timezone is preserved when sending to the DB (timestamptz columns).
 *
 * Without this, naive strings like "2026-04-12T21:00:00" sent to Postgres
 * are interpreted as UTC (Supabase default session TZ), losing the user's local offset.
 *
 * @param date - "YYYY-MM-DD" from a date picker
 * @param time - "HH:MM" from a time picker
 * @returns ISO 8601 string in UTC (e.g. "2026-04-12T18:00:00.000Z" for 9 PM UTC+3)
 */
export function localToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * Adjust an rrule-generated occurrence to preserve wall-clock time.
 *
 * rrule.js with UTC DTSTART generates occurrences at a fixed UTC instant.
 * Across DST transitions, this shifts the local wall-clock time (e.g. a
 * 6 PM winter item shows as 7 PM in summer). Users expect recurring items
 * to fire at the same local time regardless of DST.
 *
 * This function takes the local hours/minutes from the original item date
 * and applies them to each occurrence. `Date.setHours()` respects the
 * occurrence date's own DST context, so the UTC instant adjusts correctly.
 */
export function adjustOccurrenceToWallClock(
  occurrence: Date,
  originalItemDate: Date,
): Date {
  const adjusted = new Date(occurrence);
  adjusted.setHours(
    originalItemDate.getHours(),
    originalItemDate.getMinutes(),
    0,
    0,
  );
  return adjusted;
}

/**
 * Format a JavaScript Date to an RRule-compatible DTSTART string in UTC.
 *
 * rrule.js interprets DTSTART without a 'Z' suffix as UTC internally,
 * but format() from date-fns outputs LOCAL time. This mismatch shifts
 * occurrences by the user's UTC offset (e.g. 9 PM local → 12 AM).
 *
 * This function extracts UTC components and appends 'Z' so rrule.js
 * generates occurrences at the correct UTC instant.
 */
export function formatDateToUTCRRule(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Build a full RRule string with DTSTART in UTC.
 * Centralised to avoid the timezone-stripping bug across 6+ files.
 * Handles optional COUNT and UNTIL from recurrence_rule.
 */
export function buildFullRRuleString(
  startDate: Date,
  recurrenceRule: {
    rrule: string;
    count?: number | null;
    end_until?: string | null;
  },
): string {
  let rrulePart = recurrenceRule.rrule;

  // Add COUNT if specified
  if (recurrenceRule.count && !rrulePart.includes("COUNT=")) {
    rrulePart += `;COUNT=${recurrenceRule.count}`;
  }

  // Add UNTIL if specified (and no COUNT)
  if (
    recurrenceRule.end_until &&
    !recurrenceRule.count &&
    !rrulePart.includes("UNTIL=")
  ) {
    const untilStr = formatDateToUTCRRule(new Date(recurrenceRule.end_until));
    rrulePart += `;UNTIL=${untilStr}`;
  }

  if (!rrulePart.startsWith("RRULE:")) {
    rrulePart = `RRULE:${rrulePart}`;
  }

  const dtstart = `DTSTART:${formatDateToUTCRRule(startDate)}`;
  return `${dtstart}\n${rrulePart}`;
}
