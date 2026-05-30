export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly";

export type CalculateNextDueDateInput = {
  currentDueDate: string;
  recurrenceType: RecurrenceType;
  recurrenceDay?: number | null;
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_RE.exec(value);

  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function clampDay(year: number, monthIndex: number, day: number): number {
  return Math.min(Math.max(1, day), daysInUtcMonth(year, monthIndex));
}

function addUtcMonths(date: Date, months: number, preferredDay: number): Date {
  const targetMonth = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const day = clampDay(targetYear, normalizedMonth, preferredDay);
  return new Date(Date.UTC(targetYear, normalizedMonth, day));
}

function addUtcYears(date: Date, years: number, preferredDay: number): Date {
  const targetYear = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = clampDay(targetYear, month, preferredDay);
  return new Date(Date.UTC(targetYear, month, day));
}

function nextWeeklyDate(date: Date, recurrenceDay?: number | null): Date {
  const next = new Date(date);

  if (recurrenceDay === undefined || recurrenceDay === null) {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const normalizedDay = ((Math.trunc(recurrenceDay) % 7) + 7) % 7;
  const currentDay = next.getUTCDay();
  const daysUntil = (normalizedDay - currentDay + 7) % 7 || 7;
  next.setUTCDate(next.getUTCDate() + daysUntil);
  return next;
}

export function calculateNextDueDate({
  currentDueDate,
  recurrenceType,
  recurrenceDay,
}: CalculateNextDueDateInput): string {
  const current = parseDateOnly(currentDueDate);

  switch (recurrenceType) {
    case "daily": {
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + 1);
      return formatDateOnly(next);
    }
    case "weekly":
      return formatDateOnly(nextWeeklyDate(current, recurrenceDay));
    case "monthly": {
      const preferredDay = recurrenceDay ?? current.getUTCDate();
      return formatDateOnly(addUtcMonths(current, 1, preferredDay));
    }
    case "yearly":
      return formatDateOnly(addUtcYears(current, 1, current.getUTCDate()));
  }
}
