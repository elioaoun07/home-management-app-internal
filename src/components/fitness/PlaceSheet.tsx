"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shared/Sheet";
import { usePlaceSlot } from "@/features/fitness/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { localWeekStart, type SlotView } from "@/lib/fitness/progress";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, PrimaryButton } from "./fitnessUi";

/** Optional day/time placement inside this week. Same slot row the planner uses. */
export function PlaceSheet({ slot, onClose, onStart, readOnly }: { slot: SlotView | null; onClose: () => void; onStart: (s: SlotView) => void; readOnly?: boolean }) {
  const pal = useFitnessPalette();
  const tc = useThemeClasses();
  const place = usePlaceSlot();
  const week = localWeekStart();
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("");
  useEffect(() => {
    setDate(slot?.placement?.date ?? null);
    setTime(slot?.placement?.time?.slice(0, 5) ?? "");
  }, [slot]);
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(week), i), "yyyy-MM-dd"));
  const save = (d: string | null) => {
    if (!slot || readOnly) return;
    place.mutate({ slotId: slot.slot.id, week, date: d, time: d && time ? time : null }, { onSuccess: onClose });
  };

  return (
    <Sheet open={!!slot} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className={cn("rounded-t-3xl border-t", tc.bgPage, pal.line)}>
        <SheetHeader>
          <SheetTitle className={pal.ink}>{slot?.title}</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <button
              key={d}
              disabled={d < today}
              onClick={() => setDate(d)}
              className={cn("h-14 rounded-xl border flex flex-col items-center justify-center text-xs disabled:opacity-30", pal.line, date === d ? pal.ink : pal.mute)}
              style={date === d ? { borderColor: pal.a, background: `${pal.a}1f` } : undefined}
              aria-pressed={date === d}
            >
              <span>{format(parseISO(d), "EEEEE")}</span>
              <span className="font-semibold tabular-nums">{format(parseISO(d), "d")}</span>
            </button>
          ))}
        </div>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Time"
          className={cn("mt-3 w-full h-12 rounded-xl border px-3 bg-transparent outline-none", pal.line, pal.ink)}
        />
        <div className="flex gap-2 mt-4">
          {slot?.placement && <GhostButton className="h-12" onClick={() => save(null)}>Clear</GhostButton>}
          {slot && slot.status === "open" && <GhostButton className="h-12" onClick={() => { onClose(); onStart(slot); }}>Start</GhostButton>}
          <PrimaryButton className="flex-1" disabled={!date || place.isPending} onClick={() => save(date)}>Place</PrimaryButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
