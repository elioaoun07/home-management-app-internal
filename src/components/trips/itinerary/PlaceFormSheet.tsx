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
import {
  useCreateTripPlace,
  useUpdateTripPlace,
} from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import {
  PLACE_PRIORITY_LABELS,
  PLACE_TYPE_LABELS,
  type TripPlace,
  type TripPlacePriority,
  type TripPlaceType,
} from "@/types/trips";
import { useState } from "react";

const PRIORITY_OPTIONS: TripPlacePriority[] = ["mandatory", "flexible", "wishlist"];
const TYPE_OPTIONS: Array<TripPlaceType | ""> = ["", "hotel", "activity", "restaurant", "attraction", "transport", "note", "other"];

interface PlaceFormSheetProps {
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  place?: TripPlace;
  /** Pre-fills the scheduled date when adding a place from a specific day tab. */
  defaultDate?: string | null;
}

export function PlaceFormSheet({ tripId, open, onOpenChange, place, defaultDate }: PlaceFormSheetProps) {
  const tc = useThemeClasses();
  const createPlace = useCreateTripPlace(tripId);
  const updatePlace = useUpdateTripPlace(tripId);

  const [name, setName] = useState(place?.name ?? "");
  const [type, setType] = useState<TripPlaceType | "">(place?.place_type ?? "");
  const [url, setUrl] = useState(place?.url ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const [cost, setCost] = useState(place?.cost?.toString() ?? "");
  const [priority, setPriority] = useState<TripPlacePriority>(place?.priority ?? "flexible");
  const [scheduledDate, setScheduledDate] = useState(place?.scheduled_date ?? defaultDate ?? "");
  const [scheduledTime, setScheduledTime] = useState(place?.scheduled_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(place?.end_time?.slice(0, 5) ?? "");
  const [confirmationCode, setConfirmationCode] = useState(place?.confirmation_code ?? "");
  const [address, setAddress] = useState(place?.address ?? "");
  const [isBooked, setIsBooked] = useState(place?.is_booked ?? false);

  const isPending = createPlace.isPending || updatePlace.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      place_type: type || null,
      url: url.trim() || null,
      description: description.trim() || null,
      cost: cost ? parseFloat(cost) : null,
      priority,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      end_time: endTime || null,
      confirmation_code: confirmationCode.trim() || null,
      address: address.trim() || null,
      is_booked: isBooked,
    };

    if (place) {
      await updatePlace.mutateAsync({ id: place.id, ...payload });
    } else {
      await createPlace.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const inputClass = cn("bg-white/5 border text-white placeholder:text-white/30", tc.border);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage, "max-h-[90vh] overflow-y-auto")}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">{place ? "Edit place" : "Add place"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pb-8">
          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Name *</Label>
            <Input className={inputClass} placeholder="Hotel Le Marais" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Type</Label>
              <select
                className={cn(inputClass, "w-full rounded-md px-3 py-2 text-sm")}
                value={type}
                onChange={(e) => setType(e.target.value as TripPlaceType | "")}
              >
                <option value="">None</option>
                {TYPE_OPTIONS.filter(Boolean).map((t) => (
                  <option key={t} value={t}>{PLACE_TYPE_LABELS[t as TripPlaceType]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Priority</Label>
              <select
                className={cn(inputClass, "w-full rounded-md px-3 py-2 text-sm")}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TripPlacePriority)}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PLACE_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Date</Label>
              <Input className={inputClass} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Start time</Label>
              <Input className={inputClass} type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>End time</Label>
              <Input className={inputClass} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Address</Label>
            <Input className={inputClass} placeholder="12 Rue de Rivoli, Paris" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Cost</Label>
              <Input className={inputClass} type="text" inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Confirmation code</Label>
              <Input className={inputClass} placeholder="ABC123" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Link</Label>
            <Input className={inputClass} type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Description</Label>
            <textarea
              className={cn(inputClass, "w-full rounded-md px-3 py-2 text-sm resize-none h-16")}
              placeholder="Notes about this place…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isBooked}
              onChange={(e) => setIsBooked(e.target.checked)}
              className="rounded"
            />
            <span className={cn("text-sm", tc.textMuted)}>Already booked</span>
          </label>

          <Button type="submit" disabled={!name.trim() || isPending} className={cn("w-full", tc.bgSurface, tc.text, "border", tc.border)}>
            {isPending ? "Saving…" : place ? "Save changes" : "Add place"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
