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
