"use client";

import { cn } from "@/lib/utils";
import { TRIP_STATUS_LABELS, type Trip, type TripStatus } from "@/types/trips";
import { getTripPhase, TRIP_PHASE_LABELS, TRIP_PHASE_STYLES } from "@/features/trips/tripPhase";

const STATUS_STYLES: Record<TripStatus, string> = {
  draft: "bg-white/10 text-white/50",
  upcoming: "bg-cyan-500/15 text-cyan-400",
  active: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]",
  completed: "bg-white/10 text-white/50",
  archived: "bg-white/5 text-white/30",
};

interface TripStatusBadgeProps {
  status: TripStatus;
  className?: string;
  /** When provided (and status is draft/upcoming), renders the date-derived travel phase instead of the raw status. */
  trip?: Pick<Trip, "start_date" | "end_date">;
}

/**
 * A trip can sit in `draft` indefinitely — activation is a deliberate, gated action.
 * For draft/upcoming trips we show the derived phase (Planning/Soon/Travelling/Home) so the
 * badge stays meaningful even if the trip is never activated. `active`/`completed`/`archived`
 * always reflect the real lifecycle status since those only happen via an explicit action.
 */
export function TripStatusBadge({ status, className, trip }: TripStatusBadgeProps) {
  if (trip && (status === "draft" || status === "upcoming")) {
    const phase = getTripPhase(trip);
    if (phase !== "undated") {
      return (
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", TRIP_PHASE_STYLES[phase], className)}>
          {TRIP_PHASE_LABELS[phase]}
        </span>
      );
    }
  }

  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_STYLES[status], className)}>
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
