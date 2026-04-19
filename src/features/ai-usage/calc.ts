// src/features/ai-usage/calc.ts
// Pure calculations for AI usage pace / status / auto cycle advance.
// No React, no fetches — safe to unit test and call from any context.

import type {
  AIUsageModel,
  AIUsageStatus,
  PaceStatus,
  RefreshFrequency,
} from "@/types/aiUsage";

const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD date string as a local-midnight Date. */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Number of days in the cycle starting at `start` for the given frequency and optional monthly reset day. */
function cycleLength(
  start: Date,
  frequency: RefreshFrequency,
  cycleStartDay?: number | null,
): number {
  if (frequency === "weekly") return 7;
  // Monthly with cycle_start_day: days from start day to (start day - 1) of next month.
  // E.g., 15th to 14th = all days in a 30/31-day month (except the last day).
  // For simplicity: always return ~30 days, but the real calculation happens in getCycleWindow.
  if (cycleStartDay) {
    // Days from cycleStartDay of current month to cycleStartDay-1 of next month.
    // This is always 30 or 31 days depending on the month length.
    const nextMonthStart = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      cycleStartDay,
    );
    const currentMonthStart = new Date(
      start.getFullYear(),
      start.getMonth(),
      cycleStartDay,
    );
    return Math.floor(
      (nextMonthStart.getTime() - currentMonthStart.getTime()) / MS_PER_DAY,
    );
  }
  // Fallback for monthly without cycle_start_day: use calendar month length.
  const y = start.getFullYear();
  const m = start.getMonth();
  return new Date(y, m + 1, 0).getDate();
}

/**
 * Full inclusive end date of the cycle: start + (cycleLength - 1) days.
 * For monthly cycles with cycle_start_day, calculates the current cycle window.
 */
export function getCycleWindow(
  model: Pick<
    AIUsageModel,
    | "cycle_start_date"
    | "refresh_frequency"
    | "cycle_start_day"
    | "cycle_anchor_date"
  >,
): {
  start: Date;
  end: Date;
  daysTotal: number;
} {
  // Anchor-date mode: roll forward from the anchor by 7 days (weekly) or 1 month
  // (monthly) until we land in a cycle that contains today.
  if (model.cycle_anchor_date) {
    const anchor = parseLocalDate(model.cycle_anchor_date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cycleStart = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate(),
    );
    let nextStart =
      model.refresh_frequency === "weekly"
        ? new Date(cycleStart.getTime() + 7 * MS_PER_DAY)
        : new Date(
            cycleStart.getFullYear(),
            cycleStart.getMonth() + 1,
            cycleStart.getDate(),
          );
    let guard = 0;
    // Advance forward if today is past this cycle.
    while (today >= nextStart && guard < 2000) {
      cycleStart = nextStart;
      nextStart =
        model.refresh_frequency === "weekly"
          ? new Date(cycleStart.getTime() + 7 * MS_PER_DAY)
          : new Date(
              cycleStart.getFullYear(),
              cycleStart.getMonth() + 1,
              cycleStart.getDate(),
            );
      guard++;
    }
    // Step backward if today is before the anchor (anchor in the future): show the
    // cycle ending at the anchor so stats stay meaningful.
    while (today < cycleStart && guard < 4000) {
      nextStart = cycleStart;
      cycleStart =
        model.refresh_frequency === "weekly"
          ? new Date(cycleStart.getTime() - 7 * MS_PER_DAY)
          : new Date(
              cycleStart.getFullYear(),
              cycleStart.getMonth() - 1,
              cycleStart.getDate(),
            );
      guard++;
    }
    const daysTotal = Math.round(
      (nextStart.getTime() - cycleStart.getTime()) / MS_PER_DAY,
    );
    const end = new Date(nextStart.getTime() - MS_PER_DAY);
    return { start: cycleStart, end, daysTotal };
  }

  if (model.refresh_frequency === "weekly") {
    // Weekly: 7-day cycle starting on a specific day of week (if set)
    const now = new Date();
    let cycleStart: Date;

    if (model.cycle_start_day) {
      // cycle_start_day is ISO weekday: 1=Monday, 7=Sunday
      // Find the most recent occurrence of that weekday
      const targetDay = model.cycle_start_day; // 1-7
      const todayISO = ((now.getDay() + 6) % 7) + 1; // Convert JS (0=Sun) to ISO (1=Mon)
      const daysAgo = (todayISO - targetDay + 7) % 7; // How many days ago was the target day?
      cycleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      cycleStart.setDate(cycleStart.getDate() - daysAgo);
    } else {
      // Fallback: 7-day rolling from cycle_start_date
      cycleStart = parseLocalDate(model.cycle_start_date);
    }

    const daysTotal = 7;
    const end = new Date(cycleStart.getTime() + (daysTotal - 1) * MS_PER_DAY);
    return { start: cycleStart, end, daysTotal };
  }

  // Monthly: calculate current cycle window based on cycle_start_day
  const now = new Date();
  // If cycle_start_day is NULL, default to day 1 (calendar month)
  const cycleDay = model.cycle_start_day ?? 1;
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  // Determine which month's cycle we're in
  let cycleStartDate: Date;
  if (todayDay >= cycleDay) {
    // Cycle started this month
    cycleStartDate = new Date(todayYear, todayMonth, cycleDay);
  } else {
    // Cycle started last month
    cycleStartDate = new Date(todayYear, todayMonth - 1, cycleDay);
  }

  // Cycle ends on cycleDay of next month (exclusive end, but we calculate inclusive)
  const cycleEndExclusive = new Date(
    cycleStartDate.getFullYear(),
    cycleStartDate.getMonth() + 1,
    cycleDay,
  );

  // Inclusive end = day before exclusive end
  const cycleEndInclusive = new Date(cycleEndExclusive.getTime() - MS_PER_DAY);

  // Days total
  const daysTotal =
    Math.round(
      (cycleEndInclusive.getTime() - cycleStartDate.getTime()) / MS_PER_DAY,
    ) + 1;

  return {
    start: cycleStartDate,
    end: cycleEndInclusive,
    daysTotal,
  };
}

/**
 * If today is past the current cycle's end date, return the new
 * cycle_start_date for the next cycle. Otherwise returns null.
 *
 * Handles multi-cycle gaps: if the model was untouched for several cycles,
 * we still advance to the cycle containing today.
 */
export function nextCycleStartIfExpired(
  model: Pick<
    AIUsageModel,
    | "cycle_start_date"
    | "refresh_frequency"
    | "cycle_start_day"
    | "cycle_anchor_date"
  >,
  now: Date = new Date(),
): string | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let { start, daysTotal } = getCycleWindow(model);
  let end = new Date(start.getTime() + (daysTotal - 1) * MS_PER_DAY);
  if (today <= end) return null;

  // Advance cycle-by-cycle until today falls inside.
  let guard = 0;
  while (today > end && guard < 600) {
    const nextStart =
      model.refresh_frequency === "weekly"
        ? new Date(start.getTime() + 7 * MS_PER_DAY)
        : new Date(
            start.getFullYear(),
            start.getMonth() + 1,
            model.cycle_start_day ?? 1,
          );
    start = nextStart;
    daysTotal = cycleLength(
      start,
      model.refresh_frequency,
      model.cycle_start_day,
    );
    end = new Date(start.getTime() + (daysTotal - 1) * MS_PER_DAY);
    guard++;
  }
  return toISODate(start);
}

/**
 * Compute health status + advice for a model. Pure function of model + now.
 */
export function computeStatus(
  model: AIUsageModel,
  now: Date = new Date(),
): AIUsageStatus {
  const { start, end, daysTotal } = getCycleWindow(model);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const cycleExpired = today > end;

  const rawElapsed =
    Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const daysElapsed = Math.max(1, Math.min(daysTotal, rawElapsed));
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);

  const currentPct = Math.max(0, Number(model.current_usage_pct) || 0);
  const expectedPct = (daysElapsed / daysTotal) * 100;
  const remainingPct = Math.max(0, 100 - currentPct);
  const deltaPct = currentPct - expectedPct;

  const dailyPaceSoFar = currentPct / daysElapsed;
  const paceToFinish = remainingPct / Math.max(1, daysRemaining);

  // Rest days to get back on ideal pace.
  // idealPct for today = expectedPct. If we stop consuming, each day the
  // "ideal pace" line advances by (100/daysTotal). So:
  //   restDays = ceil((currentPct - expectedPct) / (100 / daysTotal))
  // Only meaningful when behind (deltaPct > 0).
  // Cap at daysRemaining — can't rest more days than are left in the cycle.
  const pctPerDay = 100 / daysTotal;
  const rawRestDays = deltaPct > 0 ? Math.ceil(deltaPct / pctPerDay) : 0;
  const restDaysNeeded = Math.min(rawRestDays, daysRemaining);

  const status = classify({
    currentPct,
    daysRemaining,
    deltaPct,
    cycleExpired,
  });

  const advice = buildAdvice({
    status,
    cycleExpired,
    currentPct,
    remainingPct,
    daysRemaining,
    paceToFinish,
    restDaysNeeded,
    dailyPaceSoFar,
    deltaPct,
  });

  return {
    cycleStart: toISODate(start),
    cycleEnd: toISODate(end),
    daysTotal,
    daysElapsed,
    daysRemaining,
    cycleExpired,
    currentPct,
    expectedPct,
    remainingPct,
    deltaPct,
    dailyPaceSoFar,
    paceToFinish,
    restDaysNeeded,
    status,
    advice,
  };
}

function classify(args: {
  currentPct: number;
  daysRemaining: number;
  deltaPct: number;
  cycleExpired: boolean;
}): PaceStatus {
  const { currentPct, daysRemaining, deltaPct, cycleExpired } = args;
  if (cycleExpired) return "on-pace";
  if (currentPct >= 90 && daysRemaining > 3) return "critical";
  if (deltaPct > 5) return "behind";
  if (deltaPct < -5) return "ahead";
  return "on-pace";
}

function buildAdvice(args: {
  status: PaceStatus;
  cycleExpired: boolean;
  currentPct: number;
  remainingPct: number;
  daysRemaining: number;
  paceToFinish: number;
  restDaysNeeded: number;
  dailyPaceSoFar: number;
  deltaPct: number;
}): string {
  const {
    status,
    cycleExpired,
    currentPct,
    remainingPct,
    daysRemaining,
    paceToFinish,
    restDaysNeeded,
    dailyPaceSoFar,
    deltaPct,
  } = args;

  const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

  if (cycleExpired) {
    return "Cycle ended. Refresh to start a new one.";
  }
  if (currentPct >= 100) {
    return `You've hit 100%. ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left until refresh.`;
  }
  if (status === "critical") {
    return `Critical — ${fmt(remainingPct)}% left for ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Cap at ${fmt(paceToFinish)}%/day to finish.`;
  }
  if (status === "behind") {
    return `Behind pace by ${fmt(deltaPct)}%. Take ${restDaysNeeded} rest day${restDaysNeeded === 1 ? "" : "s"} or cap at ${fmt(paceToFinish)}%/day.`;
  }
  if (status === "ahead") {
    return `Ahead of pace by ${fmt(-deltaPct)}%. You have ${fmt(paceToFinish)}%/day of headroom.`;
  }
  return `On pace — averaging ${fmt(dailyPaceSoFar)}%/day. Keep at ≤ ${fmt(paceToFinish)}%/day.`;
}

/**
 * Sum estimated consumption across a list of sessions to tell the user how
 * much budget their upcoming plans will burn.
 */
export function forecastTotal(
  sessions: Array<{ estimated_usage_pct: number }>,
): number {
  return sessions.reduce(
    (acc, s) => acc + (Number(s.estimated_usage_pct) || 0),
    0,
  );
}

/**
 * How many more sessions of a given weight fit in the remaining budget?
 */
export function sessionsThatFit(
  remainingPct: number,
  weightPct: number,
): number {
  if (weightPct <= 0) return Infinity;
  return Math.floor(remainingPct / weightPct);
}
