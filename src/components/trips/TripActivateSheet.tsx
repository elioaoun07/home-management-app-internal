"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useActivateTrip } from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/trips";
import { AlertTriangle, Calendar, MapPin, Plane, Users } from "lucide-react";

interface TripActivateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
}

export function TripActivateSheet({ open, onOpenChange, trip }: TripActivateSheetProps) {
  const tc = useThemeClasses();
  const activate = useActivateTrip();

  const canActivate = !!(trip.start_date && trip.end_date);

  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const handleActivate = async () => {
    await activate.mutateAsync(trip.id);
    onOpenChange(false);
  };

  const sideEffects =
    trip.scope === "household"
      ? ["Chore occurrences will be skipped", "Recurring events paused", "One-time events cleared", "Meal plans skipped"]
      : ["Your chores and events reassigned to partner", "Meal planning untouched (partner is home)"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage, "max-h-[85vh] overflow-y-auto")}>
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Plane className={cn("w-4 h-4", tc.text)} />
            Activate Trip
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          <div className={cn("rounded-xl border p-4 space-y-2", tc.border, "bg-white/5")}>
            <p className="font-medium text-white">{trip.name}</p>
            {trip.destination_name && (
              <p className={cn("text-sm flex items-center gap-1.5", tc.textMuted)}>
                <MapPin className="w-3.5 h-3.5" />
                {trip.destination_name}
              </p>
            )}
            {trip.start_date && trip.end_date && (
              <p className={cn("text-sm flex items-center gap-1.5", tc.textMuted)}>
                <Calendar className="w-3.5 h-3.5" />
                {fmt(trip.start_date)} → {fmt(trip.end_date)}
              </p>
            )}
            <p className={cn("text-sm flex items-center gap-1.5", tc.textMuted)}>
              <Users className="w-3.5 h-3.5" />
              {trip.scope === "household" ? "Household trip" : "Solo trip"}
            </p>
          </div>

          {!canActivate && (
            <div className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Add start and end dates before activating.</p>
            </div>
          )}

          <div className="space-y-2">
            <p className={cn("text-xs font-medium uppercase tracking-wider", tc.textFaint)}>What will happen</p>
            <ul className="space-y-2">
              {sideEffects.map((effect) => (
                <li key={effect} className={cn("text-sm flex items-start gap-2", tc.textMuted)}>
                  <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0", tc.text === "text-pink-400" ? "bg-pink-400" : "bg-cyan-400")} />
                  {effect}
                </li>
              ))}
              <li className={cn("text-sm flex items-start gap-2", tc.textMuted)}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />
                A dedicated expense account is created for this trip
              </li>
            </ul>
            <p className={cn("text-xs mt-3", tc.textFaint)}>
              All changes are reversed when you complete the trip. The expense account is kept for records.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1 border text-white/60 border-white/20"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!canActivate || activate.isPending}
              className={cn("flex-1 border font-semibold", tc.bgSurface, tc.text, tc.border)}
              onClick={handleActivate}
            >
              {activate.isPending ? "Activating…" : "Activate"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
