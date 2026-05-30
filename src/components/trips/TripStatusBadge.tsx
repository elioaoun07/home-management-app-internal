"use client";

import { cn } from "@/lib/utils";
import { TRIP_STATUS_LABELS, type TripStatus } from "@/types/trips";

const STATUS_STYLES: Record<TripStatus, string> = {
  draft: "bg-white/10 text-white/50",
  upcoming: "bg-cyan-500/15 text-cyan-400",
  active: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]",
  completed: "bg-white/10 text-white/50",
  archived: "bg-white/5 text-white/30",
};

export function TripStatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_STYLES[status], className)}>
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
