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

import { RRule } from "rrule";

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

/**
 * Generate all RRule occurrences in [rangeStart, rangeEnd], respecting a
 * bi-weekly phase flip if one has been recorded on the rule.
 *
 * Without a flip: uses start_anchor (falls back to itemDate) as DTSTART.
 * With a flip (phase_changed_at + previous_start_anchor set):
 *   - dates before phase_changed_at → previous_start_anchor (old phase)
 *   - dates on/after phase_changed_at → start_anchor (new phase)
 *
 * This is the single source of truth for occurrence generation. All views
 * should call this instead of building the RRule string inline.
 */
export function getOccurrencesInRange(
  rule: {
    rrule: string;
    start_anchor: string;
    end_until?: string | null;
    count?: number | null;
    phase_changed_at?: string | null;
    previous_start_anchor?: string | null;
  },
  itemDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  if (!rule.phase_changed_at || !rule.previous_start_anchor) {
    // Simple case: no flip recorded
    const anchor = rule.start_anchor ? new Date(rule.start_anchor) : itemDate;
    const rruleStr = buildFullRRuleString(anchor, rule);
    return RRule.fromString(rruleStr).between(rangeStart, rangeEnd, true);
  }

  const changeDate = new Date(rule.phase_changed_at);
  const results: Date[] = [];

  // Pre-flip: use previous_start_anchor, capped at changeDate
  if (rangeStart < changeDate) {
    const preAnchor = new Date(rule.previous_start_anchor);
    const preEnd = rangeEnd < changeDate ? rangeEnd : new Date(changeDate.getTime() - 1);
    const preRRule = RRule.fromString(buildFullRRuleString(preAnchor, rule));
    results.push(...preRRule.between(rangeStart, preEnd, true));
  }

  // Post-flip: use start_anchor from changeDate onward
  if (rangeEnd >= changeDate) {
    const postAnchor = new Date(rule.start_anchor);
    const postStart = rangeStart >= changeDate ? rangeStart : changeDate;
    const postRRule = RRule.fromString(buildFullRRuleString(postAnchor, rule));
    results.push(...postRRule.between(postStart, rangeEnd, true));
  }

  return results;
}

/**
 * Compute the new start_anchor for a bi-weekly "flip" that only affects
 * the current occurrence and future ones.
 *
 * Instead of shifting the anchor backward (which would rewrite all past
 * occurrence dates), this finds the first occurrence in the flipped phase
 * that falls on or after today. Past occurrence records are untouched.
 */
export function firstBiweeklyFlippedAnchor(currentAnchor: Date): Date {
  // Theoretical flipped base = shift the anchor by one week
  const flippedBase = new Date(currentAnchor);
  flippedBase.setDate(flippedBase.getDate() + 7);

  // Compare calendar days only (strip time for the comparison, preserve time in result)
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const flippedBaseMidnight = new Date(flippedBase);
  flippedBaseMidnight.setHours(0, 0, 0, 0);

  const daysSince = Math.floor(
    (todayMidnight.getTime() - flippedBaseMidnight.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (daysSince <= 0) {
    // Flipped base is today or in the future — use it directly
    return flippedBase;
  }

  // Advance by whole bi-weekly periods until we're on or after today
  const periodsElapsed = Math.ceil(daysSince / 14);
  const result = new Date(flippedBase);
  result.setDate(result.getDate() + periodsElapsed * 14);
  return result;
}
