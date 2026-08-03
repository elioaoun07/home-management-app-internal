// src/features/trips/tripPhase.ts
//
// Derives a travel phase purely from trip dates — independent of `status`.
// This exists because a trip can sit in `draft` indefinitely (activation is a
// deliberate, gated, human-first action — see the Trips vault doc) while the
// dates still tell a traveller exactly where they are in the journey.

import { differenceInCalendarDays } from "date-fns";
import type { Trip } from "@/types/trips";

export type TripPhase = "undated" | "planning" | "soon" | "travelling" | "home";

const SOON_WINDOW_DAYS = 14;

function parseLocalDate(d: string): Date {
  return new Date(d + "T00:00:00");
}

/** Phase is date-derived only; `completed`/`archived` statuses are handled by the caller (TripStatusBadge). */
export function getTripPhase(trip: Pick<Trip, "start_date" | "end_date">, today: Date = new Date()): TripPhase {
  if (!trip.start_date || !trip.end_date) return "undated";

  const start = parseLocalDate(trip.start_date);
  const end = parseLocalDate(trip.end_date);
  const daysToStart = differenceInCalendarDays(start, today);
  const daysToEnd = differenceInCalendarDays(end, today);

  if (daysToEnd < 0) return "home";
  if (daysToStart <= 0) return "travelling";
  if (daysToStart <= SOON_WINDOW_DAYS) return "soon";
  return "planning";
}

export interface TripCountdown {
  phase: TripPhase;
  label: string;
  /** Days until start (planning/soon), days since end (home), or day-of-trip index (travelling). Null when undated. */
  days: number | null;
  /** Trip length in days inclusive of both endpoints. Null when undated. */
  totalDays: number | null;
}

export function tripCountdown(trip: Pick<Trip, "start_date" | "end_date">, today: Date = new Date()): TripCountdown {
  const phase = getTripPhase(trip, today);

  if (phase === "undated") {
    return { phase, label: "Set dates to begin", days: null, totalDays: null };
  }

  const start = parseLocalDate(trip.start_date!);
  const end = parseLocalDate(trip.end_date!);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  switch (phase) {
    case "planning":
    case "soon": {
      const days = differenceInCalendarDays(start, today);
      return { phase, label: `${days} day${days === 1 ? "" : "s"} to go`, days, totalDays };
    }
    case "travelling": {
      const dayIndex = differenceInCalendarDays(today, start) + 1;
      return { phase, label: `Day ${dayIndex} of ${totalDays}`, days: dayIndex, totalDays };
    }
    case "home": {
      const days = differenceInCalendarDays(today, end);
      return { phase, label: `Home ${days} day${days === 1 ? "" : "s"}`, days, totalDays };
    }
  }
}

export const TRIP_PHASE_LABELS: Record<TripPhase, string> = {
  undated: "Undated",
  planning: "Planning",
  soon: "Soon",
  travelling: "Travelling",
  home: "Home",
};

export const TRIP_PHASE_STYLES: Record<TripPhase, string> = {
  undated: "bg-white/10 text-white/50",
  planning: "bg-white/10 text-white/50",
  soon: "bg-cyan-500/15 text-cyan-400",
  travelling: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]",
  home: "bg-white/10 text-white/50",
};
