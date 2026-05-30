"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCompleteTrip } from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/trips";
import { CheckCircle, Plane } from "lucide-react";

interface TripCompleteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
}

export function TripCompleteSheet({ open, onOpenChange, trip }: TripCompleteSheetProps) {
  const tc = useThemeClasses();
  const complete = useCompleteTrip();

  const handleComplete = async () => {
    await complete.mutateAsync(trip.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage)}>
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Complete Trip
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          <div className={cn("rounded-xl border p-4", tc.border, "bg-white/5")}>
            <p className="font-medium text-white flex items-center gap-2">
              <Plane className={cn("w-4 h-4", tc.text)} />
              {trip.name}
            </p>
          </div>

          <div className="space-y-2">
            <p className={cn("text-xs font-medium uppercase tracking-wider", tc.textFaint)}>What will be restored</p>
            <ul className="space-y-2">
              {[
                "Skipped chores restored to schedule",
                "Paused recurring events unpaused",
                "Cancelled events reinstated",
                "Meal plans restored to previous state",
                trip.scope === "solo" ? "Items reassigned back to you" : null,
              ]
                .filter(Boolean)
                .map((item) => (
                  <li key={item} className={cn("text-sm flex items-start gap-2", tc.textMuted)}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />
                    {item}
                  </li>
                ))}
            </ul>
            <p className={cn("text-xs mt-3", tc.textFaint)}>
              The trip expense account is kept with all recorded transactions.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1 border text-white/60 border-white/20"
              onClick={() => onOpenChange(false)}
            >
              Not yet
            </Button>
            <Button
              disabled={complete.isPending}
              className={cn("flex-1 border font-semibold text-emerald-400 bg-emerald-500/15 border-emerald-400/40")}
              onClick={handleComplete}
            >
              {complete.isPending ? "Completing…" : "Back home"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
