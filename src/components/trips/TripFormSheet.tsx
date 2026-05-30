"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateTrip, useUpdateTrip } from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Trip, TripScope } from "@/types/trips";
import { useState } from "react";

interface TripFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip;
}

export function TripFormSheet({ open, onOpenChange, trip }: TripFormSheetProps) {
  const tc = useThemeClasses();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();

  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination_name ?? "");
  const [countryCode, setCountryCode] = useState(trip?.destination_country_code ?? "");
  const [currency, setCurrency] = useState(trip?.currency ?? "USD");
  const [scope, setScope] = useState<TripScope>(trip?.scope ?? "household");
  const [startDate, setStartDate] = useState(trip?.start_date ?? "");
  const [endDate, setEndDate] = useState(trip?.end_date ?? "");
  const [notes, setNotes] = useState(trip?.notes ?? "");

  const isEditing = !!trip;
  const isPending = createTrip.isPending || updateTrip.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      destination_name: destination.trim() || null,
      destination_country_code: countryCode.trim().toUpperCase() || null,
      currency: currency.trim() || "USD",
      scope,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes.trim() || null,
    };

    if (isEditing) {
      await updateTrip.mutateAsync({ id: trip.id, ...payload });
    } else {
      await createTrip.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const inputClass = cn(
    "bg-white/5 border text-white placeholder:text-white/30",
    tc.border,
    "focus:ring-1",
    tc.borderActive,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage, "max-h-[90vh] overflow-y-auto")}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">{isEditing ? "Edit Trip" : "New Trip"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-8">
          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Trip name *</Label>
            <Input
              className={inputClass}
              placeholder="Paris Summer 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Destination</Label>
              <Input
                className={inputClass}
                placeholder="Paris"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Country code</Label>
              <Input
                className={inputClass}
                placeholder="FR"
                maxLength={4}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Start date</Label>
              <Input
                className={inputClass}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>End date</Label>
              <Input
                className={inputClass}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Who's travelling?</Label>
            <div className="flex gap-2">
              {(["household", "solo"] as TripScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    scope === s
                      ? cn("text-white", tc.bgSurface, tc.borderActive)
                      : cn("text-white/40 bg-white/5", tc.border),
                  )}
                >
                  {s === "household" ? "Household" : "Just me"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Currency</Label>
            <Input
              className={inputClass}
              placeholder="USD"
              maxLength={10}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Notes</Label>
            <textarea
              className={cn(inputClass, "w-full rounded-md px-3 py-2 text-sm resize-none h-20")}
              placeholder="Anything to note about this trip…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || isPending}
            className={cn("w-full", tc.bgSurface, tc.text, "border", tc.border)}
          >
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Create trip"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
