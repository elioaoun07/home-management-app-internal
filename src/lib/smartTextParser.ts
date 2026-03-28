/**
 * Smart Text Parser for Quick Item Entry
 * Parses natural language input to extract item type, dates, times, recurrence, and priority
 */

import type { ItemPriority, ItemType } from "@/types/items";

// ============================================
// TYPES
// ============================================

export interface ParsedItem {
  type: ItemType;
  title: string;
  originalInput: string;
  dueDate?: string; // yyyy-MM-dd format for reminders/tasks
  dueTime?: string; // HH:mm format
  startDate?: string; // yyyy-MM-dd format for events
  startTime?: string; // HH:mm format
  endDate?: string; // yyyy-MM-dd format for events
  endTime?: string; // HH:mm format
  recurrenceRule?: string; // iCal RRULE format
  priority: ItemPriority;
  categoryIds?: string[]; // Detected category IDs
  confidence: {
    type: number;
    date: number;
    time: number;
    recurrence: number;
    priority: number;
    categories: number;
  };
}

// ============================================
// TIME DEFAULTS (Optimized based on common usage)
// ============================================

const TIME_DEFAULTS: Record<string, string> = {
  // Pre-dawn / dawn
  dawn: "05:30",
  sunrise: "06:00",

  // Morning times
  "early morning": "06:00",
  morning: "07:00",
  "late morning": "09:00",
  "mid morning": "09:00",
  "mid-morning": "09:00",

  // Noon times
  noon: "12:00",
  midday: "12:00",
  "at lunch": "13:00",
  lunchtime: "13:00",
  lunch: "13:00",

  // Afternoon times
  "early afternoon": "14:00",
  afternoon: "17:00",
  "late afternoon": "16:00",

  // Evening times
  "early evening": "18:00",
  evening: "19:00",
  "late evening": "20:00",

  // Dusk / sunset
  dusk: "18:30",
  sunset: "18:30",

  // Night times
  night: "21:00",
  "late night": "22:00",
  tonight: "20:00",

  // Midnight
  midnight: "23:59",

  // End of day
  eod: "17:00",
  "end of day": "17:00",
  "close of business": "17:00",
  cob: "17:00",
};

// ============================================
// SHORT DAY NAME MAP
// ============================================

const SHORT_DAY_MAP: Record<string, string> = {
  mon: "monday",
  tue: "tuesday",
  tues: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

// ============================================
// TYPE DETECTION PATTERNS
// ============================================

const TYPE_PATTERNS: Record<ItemType, RegExp[]> = {
  reminder: [
    /\bremind(?:er)?\s*(?:me)?\s*(?:to)?\b/i,
    /\bdon'?t\s+forget\s*(?:to)?\b/i,
    /\bremember\s*(?:to)?\b/i,
    /\bneed\s+to\b/i,
    /\bmust\s+(?:do|call|email|send|pay|buy|get|pick|finish|complete)\b/i,
    /\b(?:put|set)\s+(?:a\s+|an\s+)?(?:alarm|reminder)\s*(?:for)?\b/i,
    /\balert\s+me\b/i,
    /\bnotify\s+me\b/i,
    /\bping\s+me\b/i,
    /\bbuzz\s+me\b/i,
    /\bpick\s*[-\s]?up\b/i,
    /\bdrop\s*[-\s]?off\b/i,
    /\b(?:call|text|email|message)(?!\s+with)\b/i,
    /\b(?:pay|renew|cancel|subscribe)\b/i,
  ],
  event: [
    /\bevent\s*(?:on)?\b/i,
    /\bmeeting\s*(?:on|at|with)?\b/i,
    /\bappointment\s*(?:on|at|with)?\b/i,
    /\bschedule\s+(?:a|an)?\b/i,
    /\bcall\s+with\b/i,
    /\bparty\s*(?:on|at)?\b/i,
    /\bconference\b/i,
    /\bdinner\s+(?:with|at)\b/i,
    /\blunch\s+with\b/i,
    /\bbreakfast\s+with\b/i,
    /\bbirthday\b/i,
    /\banniversary\b/i,
    /\bwedding\b/i,
    /\bgraduation\b/i,
    /\b(?:visit|trip|flight|vacation)\b/i,
    /\b(?:reservation|booking)\b/i,
    /\b(?:doctor|dentist|checkup|therapy)\b/i,
    /\b(?:lecture|seminar|workshop|training)\b/i,
    /\binterview\b/i,
  ],
  task: [
    /\btask\b/i,
    /\bto\s*-?\s*do\b/i,
    /\bcomplete\b/i,
    /\bfinish\b/i,
    /\bwork\s+on\b/i,
    /\bnote\s+to\s+(?:my)?self\b/i,
    /\bdeadline\b/i,
    /\b(?:buy|purchase)\b/i,
    /\bshop\s+for\b/i,
    /\bget\s+some\b/i,
    /\b(?:fix|repair|clean|organize)\b/i,
  ],
};

// ============================================
// HOLIDAY HELPERS
// ============================================

interface Holiday {
  name: string;
  date: Date;
}

/**
 * Computes Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Returns the Nth occurrence of a weekday in a given month
 * e.g., 2nd Sunday of May = Mother's Day
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number, // 0-indexed
  weekday: number, // 0=Sun, 1=Mon, ...
  n: number, // 1-based, or -1 for last
): Date {
  if (n === -1) {
    // Last occurrence
    const lastDay = new Date(year, month + 1, 0);
    const diff = (weekday - lastDay.getDay() + 7) % 7;
    return new Date(year, month, lastDay.getDate() - diff);
  }
  const first = new Date(year, month, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff + (n - 1) * 7);
}

/**
 * Returns all well-known holidays for a given year
 */
function getHolidaysForYear(year: number): Holiday[] {
  const holidays: Holiday[] = [
    // Fixed holidays
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: "Valentine's Day", date: new Date(year, 1, 14) },
    { name: "Independence Day", date: new Date(year, 6, 4) },
    { name: "Halloween", date: new Date(year, 9, 31) },
    { name: "Christmas Eve", date: new Date(year, 11, 24) },
    { name: "Christmas", date: new Date(year, 11, 25) },
    { name: "New Year's Eve", date: new Date(year, 11, 31) },
    // Computed holidays
    { name: "Easter", date: computeEaster(year) },
    { name: "Mother's Day", date: getNthWeekdayOfMonth(year, 4, 0, 2) }, // 2nd Sunday of May
    { name: "Father's Day", date: getNthWeekdayOfMonth(year, 5, 0, 3) }, // 3rd Sunday of June
    { name: "Labor Day", date: getNthWeekdayOfMonth(year, 8, 1, 1) }, // 1st Monday of September
    { name: "Memorial Day", date: getNthWeekdayOfMonth(year, 4, 1, -1) }, // Last Monday of May
    { name: "Thanksgiving", date: getNthWeekdayOfMonth(year, 10, 4, 4) }, // 4th Thursday of November
  ];
  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Returns the next holiday after the reference date
 */
function getNextHoliday(
  referenceDate: Date = new Date(),
): { name: string; date: Date } | null {
  const refTime = referenceDate.getTime();
  const years = [referenceDate.getFullYear(), referenceDate.getFullYear() + 1];

  for (const year of years) {
    const holidays = getHolidaysForYear(year);
    for (const h of holidays) {
      if (h.date.getTime() > refTime) {
        return h;
      }
    }
  }
  return null;
}

// ============================================
// DATE RANGE HELPERS
// ============================================

function getEndOfWeek(ref: Date = new Date()): Date {
  const result = new Date(ref);
  const day = result.getDay(); // 0=Sun, 5=Fri, 6=Sat
  let daysToFriday: number;
  if (day === 5) {
    daysToFriday = 0; // Today is Friday
  } else if (day === 6) {
    daysToFriday = 6; // Saturday → next Friday
  } else {
    daysToFriday = 5 - day;
  }
  result.setDate(result.getDate() + daysToFriday);
  return result;
}

function getEndOfMonth(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
}

function getEndOfYear(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), 11, 31);
}

function getStartOfNextWeek(ref: Date = new Date()): Date {
  const result = new Date(ref);
  const day = result.getDay();
  const daysToNextMonday = day === 0 ? 1 : 8 - day;
  result.setDate(result.getDate() + daysToNextMonday);
  return result;
}

function getStartOfNextMonth(ref: Date = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
}

/**
 * Returns the next occurrence of a day-of-month (e.g., "the 15th")
 */
function getNextOrdinalDay(dayOfMonth: number, ref: Date = new Date()): Date {
  const result = new Date(ref);
  result.setDate(dayOfMonth);
  // If this month's date has already passed (or is today), go to next month
  if (result <= ref) {
    result.setMonth(result.getMonth() + 1);
    result.setDate(dayOfMonth);
  }
  return result;
}

// ============================================
// DATE PATTERNS
// ============================================

/**
 * Gets the next occurrence of a weekday
 */
function getNextWeekday(dayName: string, fromDate: Date = new Date()): Date {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDay = days.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return fromDate;

  const result = new Date(fromDate);
  const currentDay = result.getDay();
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7; // Always get next occurrence
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Gets the next business day (Mon-Fri)
 */
function getNextBusinessDay(fromDate: Date = new Date()): Date {
  const result = new Date(fromDate);
  result.setDate(result.getDate() + 1);

  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Normalizes a day name (short or full) to a full lowercase day name
 */
function normalizeDayName(name: string): string {
  const lower = name.toLowerCase();
  return SHORT_DAY_MAP[lower] ?? lower;
}

/**
 * Parses relative date expressions
 */
function parseRelativeDate(
  text: string,
  referenceDate: Date = new Date(),
): { date: Date; matched: string } | null {
  const lowerText = text.toLowerCase();

  // Day after tomorrow (check before "tomorrow")
  if (/\bday\s+after\s+tomorrow\b/.test(lowerText)) {
    const dat = new Date(referenceDate);
    dat.setDate(dat.getDate() + 2);
    return { date: dat, matched: "day after tomorrow" };
  }

  // Tonight — sets today's date (time will be extracted separately by parseTime)
  if (/\btonight\b/.test(lowerText)) {
    return { date: new Date(referenceDate), matched: "tonight" };
  }

  // Next weekend → next Saturday (at least 7 days away)
  if (/\bnext\s+weekend\b/.test(lowerText)) {
    const nextSat = getNextWeekday("saturday", referenceDate);
    // If today is Sat/Sun, push to the Saturday after next
    const dayOfWeek = referenceDate.getDay();
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      nextSat.setDate(nextSat.getDate() + 7);
    }
    return { date: nextSat, matched: "next weekend" };
  }

  // This weekend → nearest upcoming Saturday (could be today)
  if (/\bthis\s+weekend\b/.test(lowerText)) {
    const dayOfWeek = referenceDate.getDay();
    const result = new Date(referenceDate);
    if (dayOfWeek === 6) {
      // Today is Saturday
      return { date: result, matched: "this weekend" };
    } else if (dayOfWeek === 0) {
      // Today is Sunday — treat as tomorrow (for Sunday activities still "this weekend")
      result.setDate(result.getDate() - 1);
      return { date: result, matched: "this weekend" };
    }
    // Otherwise, get next Saturday
    return {
      date: getNextWeekday("saturday", referenceDate),
      matched: "this weekend",
    };
  }

  // End of week / end of the week → Friday
  if (/\bend\s+of\s+(?:the\s+)?week\b/.test(lowerText)) {
    return { date: getEndOfWeek(referenceDate), matched: "end of the week" };
  }

  // End of month / end of the month
  if (/\bend\s+of\s+(?:the\s+)?month\b/.test(lowerText)) {
    return {
      date: getEndOfMonth(referenceDate),
      matched: "end of the month",
    };
  }

  // End of year / end of the year
  if (/\bend\s+of\s+(?:the\s+)?year\b/.test(lowerText)) {
    return { date: getEndOfYear(referenceDate), matched: "end of the year" };
  }

  // Beginning/start of next week
  if (/\b(?:beginning|start)\s+of\s+(?:the\s+)?next\s+week\b/.test(lowerText)) {
    return {
      date: getStartOfNextWeek(referenceDate),
      matched: "start of next week",
    };
  }

  // Beginning/start of next month
  if (
    /\b(?:beginning|start)\s+of\s+(?:the\s+)?next\s+month\b/.test(lowerText)
  ) {
    return {
      date: getStartOfNextMonth(referenceDate),
      matched: "start of next month",
    };
  }

  // Next holiday
  if (/\bnext\s+holiday\b/.test(lowerText)) {
    const holiday = getNextHoliday(referenceDate);
    if (holiday) {
      return { date: holiday.date, matched: "next holiday" };
    }
  }

  // Today
  if (/\btoday\b/.test(lowerText)) {
    return { date: new Date(referenceDate), matched: "today" };
  }

  // Tomorrow
  if (/\btomorrow\b/.test(lowerText)) {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: tomorrow, matched: "tomorrow" };
  }

  // In X days/weeks/months
  const inXMatch = lowerText.match(
    /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(day|week|month)s?\b/i,
  );
  if (inXMatch) {
    const numWord = inXMatch[1].toLowerCase();
    const numMap: Record<string, number> = {
      a: 1,
      an: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
    };
    const num = numMap[numWord] ?? parseInt(numWord);
    const unit = inXMatch[2].toLowerCase();

    const result = new Date(referenceDate);
    if (unit === "day") {
      result.setDate(result.getDate() + num);
    } else if (unit === "week") {
      result.setDate(result.getDate() + num * 7);
    } else if (unit === "month") {
      result.setMonth(result.getMonth() + num);
    }
    return { date: result, matched: inXMatch[0] };
  }

  // X days/weeks/months from now/today
  const fromNowMatch = lowerText.match(
    /\b(\d+|a|an|one|two|three|four|five|six|seven)\s+(day|week|month)s?\s+from\s+(?:now|today)\b/i,
  );
  if (fromNowMatch) {
    const numMap: Record<string, number> = {
      a: 1,
      an: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
    };
    const num = numMap[fromNowMatch[1].toLowerCase()] ?? parseInt(fromNowMatch[1]);
    const unit = fromNowMatch[2].toLowerCase();
    const result = new Date(referenceDate);
    if (unit === "day") result.setDate(result.getDate() + num);
    else if (unit === "week") result.setDate(result.getDate() + num * 7);
    else if (unit === "month") result.setMonth(result.getMonth() + num);
    return { date: result, matched: fromNowMatch[0] };
  }

  // A week/month from today/now
  const aUnitFromMatch = lowerText.match(
    /\ba\s+(week|month)\s+from\s+(?:today|now)\b/i,
  );
  if (aUnitFromMatch) {
    const result = new Date(referenceDate);
    if (aUnitFromMatch[1].toLowerCase() === "week") {
      result.setDate(result.getDate() + 7);
    } else {
      result.setMonth(result.getMonth() + 1);
    }
    return { date: result, matched: aUnitFromMatch[0] };
  }

  // Next business day
  if (/\bnext\s+business\s+day\b/.test(lowerText)) {
    return {
      date: getNextBusinessDay(referenceDate),
      matched: "next business day",
    };
  }

  // Next month (standalone — after "beginning/start of next month")
  if (/\bnext\s+month\b/.test(lowerText)) {
    return { date: getStartOfNextMonth(referenceDate), matched: "next month" };
  }

  // All weekday patterns (next/this/on/bare) — support short names
  const weekdayPattern =
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun/i;

  const nextDayMatch = lowerText.match(
    new RegExp(
      `\\bnext\\s+(${weekdayPattern.source})\\b`,
      "i",
    ),
  );
  if (nextDayMatch) {
    return {
      date: getNextWeekday(normalizeDayName(nextDayMatch[1]), referenceDate),
      matched: nextDayMatch[0],
    };
  }

  const thisDayMatch = lowerText.match(
    new RegExp(
      `\\bthis\\s+(${weekdayPattern.source})\\b`,
      "i",
    ),
  );
  if (thisDayMatch) {
    return {
      date: getNextWeekday(normalizeDayName(thisDayMatch[1]), referenceDate),
      matched: thisDayMatch[0],
    };
  }

  const onDayMatch = lowerText.match(
    new RegExp(
      `\\bon\\s+(${weekdayPattern.source})\\b`,
      "i",
    ),
  );
  if (onDayMatch) {
    return {
      date: getNextWeekday(normalizeDayName(onDayMatch[1]), referenceDate),
      matched: onDayMatch[0],
    };
  }

  // Ordinal day of month: "the 15th", "on the 3rd"
  const ordinalMatch = lowerText.match(
    /\b(?:the|on\s+the)\s+(\d{1,2})(?:st|nd|rd|th)\b/i,
  );
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1]);
    if (day >= 1 && day <= 31) {
      return {
        date: getNextOrdinalDay(day, referenceDate),
        matched: ordinalMatch[0],
      };
    }
  }

  // Bare day name (next occurrence)
  const dayMatch = lowerText.match(
    new RegExp(
      `\\b(${weekdayPattern.source})\\b`,
      "i",
    ),
  );
  if (dayMatch) {
    return {
      date: getNextWeekday(normalizeDayName(dayMatch[1]), referenceDate),
      matched: dayMatch[0],
    };
  }

  // Next week (Monday of next week)
  if (/\bnext\s+week\b/.test(lowerText)) {
    const nextMonday = getNextWeekday("monday", referenceDate);
    // If today is Sunday, nextWeekday returns tomorrow, but we want Monday of NEXT week
    if (referenceDate.getDay() !== 0) {
      nextMonday.setDate(nextMonday.getDate() + 7);
    }
    return { date: nextMonday, matched: "next week" };
  }

  // Specific date formats: 1/18, 1/18/2026, Jan 18, January 18, 18 Jan, etc.
  // MM/DD format
  const mmddMatch = lowerText.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (mmddMatch) {
    const month = parseInt(mmddMatch[1]) - 1;
    const day = parseInt(mmddMatch[2]);
    let year = mmddMatch[3]
      ? parseInt(mmddMatch[3])
      : referenceDate.getFullYear();
    if (year < 100) year += 2000; // Handle 2-digit years

    const date = new Date(year, month, day);
    return { date, matched: mmddMatch[0] };
  }

  // Month name + day: Jan 18, January 18
  const monthDayMatch = lowerText.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:(?:st|nd|rd|th))?(?:\s*,?\s*(\d{4}))?\b/i,
  );
  if (monthDayMatch) {
    const monthNames: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };
    const month = monthNames[monthDayMatch[1].toLowerCase().slice(0, 3)] ?? 0;
    const day = parseInt(monthDayMatch[2]);
    const year = monthDayMatch[3]
      ? parseInt(monthDayMatch[3])
      : referenceDate.getFullYear();

    const date = new Date(year, month, day);
    return { date, matched: monthDayMatch[0] };
  }

  return null;
}

// ============================================
// TIME PARSING
// ============================================

/**
 * Applies PM heuristic: if hour is 1-6 with no explicit period, assume PM
 */
function applyTimePeriod(hours: number, period: string | undefined): number {
  const p = period?.toLowerCase().replace(/\./g, "");
  if (p === "pm" && hours < 12) return hours + 12;
  if (p === "am" && hours === 12) return 0;
  if (!p && hours >= 1 && hours <= 6) return hours + 12;
  return hours;
}

/**
 * Parses time expressions from text
 */
function parseTime(text: string): { time: string; matched: string } | null {
  const lowerText = text.toLowerCase();

  // Check named time periods first (longest-match by iterating sorted entries)
  const sortedTimeEntries = Object.entries(TIME_DEFAULTS).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [name, time] of sortedTimeEntries) {
    if (lowerText.includes(name)) {
      return { time, matched: name };
    }
  }

  // Conversational times: "half past N"
  const halfPastMatch = lowerText.match(
    /\bhalf\s+past\s+(\d{1,2})\s*(am|pm|a\.?m\.?|p\.?m\.)?\b/i,
  );
  if (halfPastMatch) {
    const hours = applyTimePeriod(
      parseInt(halfPastMatch[1]),
      halfPastMatch[2],
    );
    const timeStr = `${hours.toString().padStart(2, "0")}:30`;
    return { time: timeStr, matched: halfPastMatch[0] };
  }

  // "quarter to N"
  const quarterToMatch = lowerText.match(
    /\bquarter\s+to\s+(\d{1,2})\s*(am|pm|a\.?m\.?|p\.?m\.)?\b/i,
  );
  if (quarterToMatch) {
    const rawHour = parseInt(quarterToMatch[1]);
    // "Quarter to 7" means 6:45
    const targetHour = applyTimePeriod(rawHour, quarterToMatch[2]);
    const beforeHour = (targetHour - 1 + 24) % 24;
    const timeStr = `${beforeHour.toString().padStart(2, "0")}:45`;
    return { time: timeStr, matched: quarterToMatch[0] };
  }

  // "quarter past N"
  const quarterPastMatch = lowerText.match(
    /\bquarter\s+past\s+(\d{1,2})\s*(am|pm|a\.?m\.?|p\.?m\.)?\b/i,
  );
  if (quarterPastMatch) {
    const hours = applyTimePeriod(
      parseInt(quarterPastMatch[1]),
      quarterPastMatch[2],
    );
    const timeStr = `${hours.toString().padStart(2, "0")}:15`;
    return { time: timeStr, matched: quarterPastMatch[0] };
  }

  // Explicit time: at 6, at 6pm, at 6:30pm, at 18:00
  const atTimeMatch = lowerText.match(
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?\b/i,
  );
  if (atTimeMatch) {
    let hours = parseInt(atTimeMatch[1]);
    const minutes = atTimeMatch[2] ? parseInt(atTimeMatch[2]) : 0;
    const period = atTimeMatch[3]?.toLowerCase().replace(/\./g, "");

    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    // If no period specified and hour <= 6, assume PM (business hours)
    if (!period && hours <= 6) hours += 12;

    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    return { time: timeStr, matched: atTimeMatch[0] };
  }

  // Time without "at": 6pm, 6:30pm, 18:00
  const timeMatch = lowerText.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)\b/i,
  );
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3].toLowerCase().replace(/\./g, "");

    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    return { time: timeStr, matched: timeMatch[0] };
  }

  // 24-hour format: 18:00, 09:30
  const militaryMatch = lowerText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (militaryMatch) {
    const hours = parseInt(militaryMatch[1]);
    const minutes = parseInt(militaryMatch[2]);
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    return { time: timeStr, matched: militaryMatch[0] };
  }

  return null;
}

// ============================================
// RECURRENCE PARSING
// ============================================

/**
 * Parses recurrence patterns and returns iCal RRULE format
 */
function parseRecurrence(
  text: string,
): { rrule: string; matched: string } | null {
  const lowerText = text.toLowerCase();

  // Every day / daily
  if (/\bevery\s*day\b|\bdaily\b/.test(lowerText)) {
    const matched = lowerText.match(/every\s*day|daily/)?.[0] || "daily";
    return { rrule: "FREQ=DAILY", matched };
  }

  // Every weekday
  if (/\bevery\s*weekday\b|\bweekdays\b/.test(lowerText)) {
    const matched =
      lowerText.match(/every\s*weekday|weekdays/)?.[0] || "weekdays";
    return { rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", matched };
  }

  // Every weekend
  if (/\bevery\s*weekend\b|\bweekends\b/.test(lowerText)) {
    const matched =
      lowerText.match(/every\s*weekend|weekends/)?.[0] || "weekends";
    return { rrule: "FREQ=WEEKLY;BYDAY=SA,SU", matched };
  }

  // Weekly / every week
  if (/\bevery\s*week\b|\bweekly\b/.test(lowerText)) {
    const matched = lowerText.match(/every\s*week|weekly/)?.[0] || "weekly";
    return { rrule: "FREQ=WEEKLY", matched };
  }

  // Bi-weekly / every 2 weeks / every other week
  if (
    /\bbi-?weekly\b|\bevery\s*(2|two|other)\s*weeks?\b|\bfortnightly\b/.test(
      lowerText,
    )
  ) {
    const matched =
      lowerText.match(
        /bi-?weekly|every\s*(2|two|other)\s*weeks?|fortnightly/,
      )?.[0] || "bi-weekly";
    return { rrule: "FREQ=WEEKLY;INTERVAL=2", matched };
  }

  // Monthly / every month
  if (/\bevery\s*month\b|\bmonthly\b/.test(lowerText)) {
    const matched = lowerText.match(/every\s*month|monthly/)?.[0] || "monthly";
    return { rrule: "FREQ=MONTHLY", matched };
  }

  // Every X months
  const everyXMonthsMatch = lowerText.match(
    /\bevery\s+(\d+|two|three|four|five|six)\s+months?\b/i,
  );
  if (everyXMonthsMatch) {
    const numWord = everyXMonthsMatch[1].toLowerCase();
    const numMap: Record<string, number> = {
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
    };
    const interval = numMap[numWord] ?? parseInt(numWord);
    return {
      rrule: `FREQ=MONTHLY;INTERVAL=${interval}`,
      matched: everyXMonthsMatch[0],
    };
  }

  // Quarterly / every quarter
  if (/\bquarterly\b|\bevery\s*quarter\b/.test(lowerText)) {
    const matched =
      lowerText.match(/quarterly|every\s*quarter/)?.[0] || "quarterly";
    return { rrule: "FREQ=MONTHLY;INTERVAL=3", matched };
  }

  // Yearly / annually / every year
  if (/\bevery\s*year\b|\byearly\b|\bannually\b/.test(lowerText)) {
    const matched =
      lowerText.match(/every\s*year|yearly|annually/)?.[0] || "yearly";
    return { rrule: "FREQ=YEARLY", matched };
  }

  // Every specific day: every Monday, every Tuesday, etc.
  const everyDayMatch = lowerText.match(
    /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i,
  );
  if (everyDayMatch) {
    const dayMap: Record<string, string> = {
      monday: "MO",
      tuesday: "TU",
      wednesday: "WE",
      thursday: "TH",
      friday: "FR",
      saturday: "SA",
      sunday: "SU",
    };
    const fullDay = normalizeDayName(everyDayMatch[1]);
    const day = dayMap[fullDay] ?? "MO";
    return { rrule: `FREQ=WEEKLY;BYDAY=${day}`, matched: everyDayMatch[0] };
  }

  return null;
}

// ============================================
// PRIORITY PARSING
// ============================================

/**
 * Parses priority from text
 */
function parsePriority(
  text: string,
): { priority: ItemPriority; matched: string } | null {
  const lowerText = text.toLowerCase();

  // Urgent patterns
  if (
    /\burgent(?:ly)?\b|\basap\b|\bimmediately\b|\bcritical\b|\bemergency\b|\btop\s*priority\b|\bp1\b/.test(
      lowerText,
    )
  ) {
    const matched =
      lowerText.match(
        /urgent(?:ly)?|asap|immediately|critical|emergency|top\s*priority|p1/,
      )?.[0] || "urgent";
    return { priority: "urgent", matched };
  }

  // High priority patterns
  if (
    /\bimportant\b|\bhigh\s*priority\b|\bpriority\s*high\b|\bp2\b/.test(
      lowerText,
    )
  ) {
    const matched =
      lowerText.match(/important|high\s*priority|priority\s*high|p2/)?.[0] ||
      "high";
    return { priority: "high", matched };
  }

  // Standalone "high" (checked after compound "high priority")
  if (/\bhigh\b/.test(lowerText)) {
    return { priority: "high", matched: "high" };
  }

  // Normal/medium patterns (NEW)
  if (/\bmedium\b|\bmoderate\b|\bp3\b/.test(lowerText)) {
    const matched =
      lowerText.match(/medium|moderate|p3/)?.[0] || "medium";
    return { priority: "normal", matched };
  }

  // Low priority patterns
  if (
    /\blow\s*priority\b|\bpriority\s*low\b|\bnot\s*urgent\b|\bwhenever\b|\bno\s*rush\b|\bnot\s*important\b|\bp4\b/.test(
      lowerText,
    )
  ) {
    const matched =
      lowerText.match(
        /low\s*priority|priority\s*low|not\s*urgent|whenever|no\s*rush|not\s*important|p4/,
      )?.[0] || "low";
    return { priority: "low", matched };
  }

  // Standalone "low" (checked after compound "low priority")
  if (/\blow\b/.test(lowerText)) {
    return { priority: "low", matched: "low" };
  }

  return null;
}

// ============================================
// CATEGORY DETECTION
// ============================================

// Category patterns - maps keywords to category IDs
const CATEGORY_PATTERNS: Record<string, string[]> = {
  personal: [
    "personal",
    "myself",
    "me",
    "private",
    "self",
    "health",
    "doctor",
    "gym",
    "workout",
    "medical",
    "dentist",
    "therapy",
    "finance",
    "bank",
    "payment",
    "bill",
  ],
  home: ["home", "house", "household", "domestic", "apartment"],
  family: [
    "family",
    "families",
    "parents",
    "kids",
    "children",
    "spouse",
    "husband",
    "wife",
    "relative",
    "relatives",
  ],
  community: [
    "community",
    "neighborhood",
    "neighbours",
    "neighbors",
    "local",
    "volunteer",
  ],
  friends: [
    "friends",
    "friend",
    "buddy",
    "buddies",
    "pal",
    "pals",
    "mate",
    "mates",
  ],
  work: [
    "work",
    "job",
    "office",
    "business",
    "professional",
    "career",
    "boss",
    "colleague",
    "colleagues",
    "coworker",
    "coworkers",
    "school",
    "university",
    "college",
    "class",
  ],
};

/**
 * Parses categories from text
 */
function parseCategories(
  text: string,
): { categoryIds: string[]; matched: string[] } | null {
  const lowerText = text.toLowerCase();
  const matchedCategories: string[] = [];
  const matchedWords: string[] = [];

  for (const [categoryId, keywords] of Object.entries(CATEGORY_PATTERNS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(lowerText)) {
        if (!matchedCategories.includes(categoryId)) {
          matchedCategories.push(categoryId);
          matchedWords.push(keyword);
        }
        break; // Only match one keyword per category
      }
    }
  }

  if (matchedCategories.length > 0) {
    return { categoryIds: matchedCategories, matched: matchedWords };
  }

  return null;
}

// ============================================
// TITLE EXTRACTION
// ============================================

/**
 * Extracts the title from the input by removing parsed components
 */
function extractTitle(input: string, parsedComponents: string[]): string {
  let title = input;

  // Remove type indicators (leading phrases)
  title = title.replace(/^remind(?:er)?\s*(?:me)?\s*(?:to)?\s*/i, "");
  title = title.replace(/^don'?t\s+forget\s*(?:to)?\s*/i, "");
  title = title.replace(/^remember\s*(?:to)?\s*/i, "");
  title = title.replace(/^need\s+to\s*/i, "");
  title = title.replace(/^task\s*:?\s*/i, "");
  title = title.replace(/^event\s*(?:on|at)?\s*:?\s*/i, "");
  title = title.replace(/^meeting\s*(?:on|at)?\s*:?\s*/i, "");
  title = title.replace(/^schedule\s*(?:a|an)?\s*/i, "");
  title = title.replace(
    /^(?:put|set)\s+(?:a\s+|an\s+)?(?:alarm|reminder)\s*(?:for)?\s*/i,
    "",
  );
  title = title.replace(/^alert\s+me\s*(?:to|about)?\s*/i, "");
  title = title.replace(/^notify\s+me\s*(?:to|about)?\s*/i, "");
  title = title.replace(/^ping\s+me\s*(?:to|about)?\s*/i, "");
  title = title.replace(/^buzz\s+me\s*(?:to|about)?\s*/i, "");
  title = title.replace(/^note\s+to\s+(?:my)?self\s*(?:to|:)?\s*/i, "");

  // Strip trailing exclamation marks used for priority boost
  title = title.replace(/\s*!{2,}\s*$/, "");

  // Sort components by length (longest first) to avoid partial replacements
  const sortedComponents = [...parsedComponents].sort(
    (a, b) => b.length - a.length,
  );

  // Remove parsed date/time/recurrence/priority components
  for (const component of sortedComponents) {
    if (component && component.length > 0) {
      // Escape regex special characters
      const escaped = component.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      title = title.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
    }
  }

  // Clean up extra whitespace and punctuation
  title = title.replace(/\s+/g, " ").trim();
  title = title.replace(/^[,.\s]+|[,.\s]+$/g, "");

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return title;
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parses a natural language input into a structured item
 */
export function parseSmartText(
  input: string,
  referenceDate: Date = new Date(),
): ParsedItem {
  const trimmedInput = input.trim();
  const parsedComponents: string[] = [];

  // Initialize result with defaults
  const result: ParsedItem = {
    type: "reminder", // Default to reminder
    title: "",
    originalInput: trimmedInput,
    priority: "normal",
    confidence: {
      type: 0.5, // Default confidence
      date: 0,
      time: 0,
      recurrence: 0,
      priority: 0.5, // Default priority has base confidence
      categories: 0,
    },
  };

  // 1. Detect type
  let typeDetected = false;
  for (const [type, patterns] of Object.entries(TYPE_PATTERNS) as [
    ItemType,
    RegExp[],
  ][]) {
    for (const pattern of patterns) {
      if (pattern.test(trimmedInput)) {
        result.type = type;
        result.confidence.type = 0.9;
        typeDetected = true;
        break;
      }
    }
    if (typeDetected) break;
  }

  // 2. Parse date
  const parsedDate = parseRelativeDate(trimmedInput, referenceDate);
  if (parsedDate) {
    const dateStr = formatDateToYYYYMMDD(parsedDate.date);

    if (result.type === "event") {
      result.startDate = dateStr;
      result.endDate = dateStr;
    } else {
      result.dueDate = dateStr;
    }

    result.confidence.date = 0.9;
    parsedComponents.push(parsedDate.matched);
  }

  // 3. Parse time
  const parsedTime = parseTime(trimmedInput);
  if (parsedTime) {
    if (result.type === "event") {
      result.startTime = parsedTime.time;
      // Default end time is 1 hour after start
      const [hours, minutes] = parsedTime.time.split(":").map(Number);
      const endHours = (hours + 1) % 24;
      result.endTime = `${endHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    } else {
      result.dueTime = parsedTime.time;
    }

    result.confidence.time = 0.9;
    parsedComponents.push(parsedTime.matched);
  }

  // 4. Parse recurrence
  const parsedRecurrence = parseRecurrence(trimmedInput);
  if (parsedRecurrence) {
    result.recurrenceRule = parsedRecurrence.rrule;
    result.confidence.recurrence = 0.9;
    parsedComponents.push(parsedRecurrence.matched);
  }

  // 5. Parse priority
  const parsedPriority = parsePriority(trimmedInput);
  if (parsedPriority) {
    result.priority = parsedPriority.priority;
    result.confidence.priority = 0.9;
    parsedComponents.push(parsedPriority.matched);
  }

  // 5b. Exclamation mark priority boost (!! or !!!)
  const exclamationMatch = trimmedInput.match(/(!{2,})\s*$/);
  if (exclamationMatch) {
    const boostMap: Record<ItemPriority, ItemPriority> = {
      low: "normal",
      normal: "high",
      high: "urgent",
      urgent: "urgent",
    };
    result.priority = boostMap[result.priority];
    if (result.confidence.priority < 0.9) {
      result.confidence.priority = 0.7;
    }
    parsedComponents.push(exclamationMatch[1]);
  }

  // 6. Parse categories
  const parsedCategories = parseCategories(trimmedInput);
  if (parsedCategories) {
    result.categoryIds = parsedCategories.categoryIds;
    result.confidence.categories = 0.9;
    parsedComponents.push(...parsedCategories.matched);
  }

  // 7. Extract title
  result.title = extractTitle(trimmedInput, parsedComponents);

  // If title is empty, use the original input cleaned up
  if (!result.title) {
    result.title = trimmedInput
      .replace(/^remind(?:er)?\s*(?:me)?\s*(?:to)?\s*/i, "")
      .replace(/^task\s*:?\s*/i, "")
      .replace(/^event\s*(?:on|at)?\s*:?\s*/i, "")
      .trim();

    if (!result.title) {
      result.title = "New item";
    }
  }

  return result;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Formats a Date object to yyyy-MM-dd string
 */
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Gets a human-readable description of a recurrence rule
 */
export function getRecurrenceDescription(rrule: string): string {
  if (!rrule) return "Does not repeat";

  if (rrule === "FREQ=DAILY") return "Every day";
  if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "Every weekday";
  if (rrule === "FREQ=WEEKLY;BYDAY=SA,SU") return "Every weekend";
  if (rrule === "FREQ=WEEKLY") return "Every week";
  if (rrule === "FREQ=WEEKLY;INTERVAL=2") return "Every 2 weeks";
  if (rrule === "FREQ=MONTHLY") return "Every month";
  if (rrule.startsWith("FREQ=MONTHLY;INTERVAL=")) {
    const interval = rrule.split("=")[2];
    if (interval === "3") return "Quarterly";
    return `Every ${interval} months`;
  }
  if (rrule === "FREQ=YEARLY") return "Every year";

  // Weekly with specific day
  if (rrule.startsWith("FREQ=WEEKLY;BYDAY=")) {
    const dayCode = rrule.split("=")[2];
    const dayMap: Record<string, string> = {
      MO: "Monday",
      TU: "Tuesday",
      WE: "Wednesday",
      TH: "Thursday",
      FR: "Friday",
      SA: "Saturday",
      SU: "Sunday",
    };
    const day = dayMap[dayCode] || dayCode;
    return `Every ${day}`;
  }

  return "Repeats";
}

/**
 * Gets a human-readable description of the parsed time
 */
export function getTimeDescription(time: string): string {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayMinutes =
    minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";

  return `${displayHours}${displayMinutes} ${period}`;
}

/**
 * Gets a human-readable description of the parsed date
 */
export function getDateDescription(
  dateStr: string,
  referenceDate: Date = new Date(),
): string {
  if (!dateStr) return "";

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Check if same day
  if (date.getTime() === today.getTime()) {
    return "Today";
  }
  if (date.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }
  if (date.getTime() === dayAfterTomorrow.getTime()) {
    return "Day after tomorrow";
  }

  // Within next week - show day name
  if (date.getTime() < nextWeek.getTime()) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[date.getDay()];
  }

  // Otherwise show date
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
