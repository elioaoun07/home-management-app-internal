"use client";

import { useTaggableTrips } from "@/features/trips/hooks";
import { cn } from "@/lib/utils";
import { Plane } from "lucide-react";
import { useState } from "react";

interface TripTagRowProps {
  value: string | null;
  onChange: (tripId: string | null) => void;
}

/** Pill + inline trip chips. Renders nothing when there is no trip to tag. */
export function TripTagRow({ value, onChange }: TripTagRowProps) {
  const { data: trips = [] } = useTaggableTrips(value);
  const [open, setOpen] = useState(false);

  if (trips.length === 0) return null;

  const selected = trips.find((t) => t.id === value);

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        suppressHydrationWarning
        className={cn(
          "relative h-9 px-4 max-w-full rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5",
          selected
            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-400/40"
            : "bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60",
        )}
      >
        <Plane className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{selected ? selected.name : "Trip"}</span>
      </button>

      {open && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {trips.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onChange(t.id === value ? null : t.id);
                setOpen(false);
              }}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-medium border transition-all active:scale-95",
                t.id === value
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10",
              )}
            >
              {t.name}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="h-8 px-3 rounded-full text-xs font-medium border border-white/10 text-white/50 hover:bg-white/10 active:scale-95"
            >
              None
            </button>
          )}
        </div>
      )}
    </div>
  );
}
