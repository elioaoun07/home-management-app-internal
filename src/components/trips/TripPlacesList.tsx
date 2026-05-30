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
  useDeleteTripPlace,
  useTripPlaces,
  useUpdateTripPlace,
} from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import {
  PLACE_PRIORITY_COLORS,
  PLACE_PRIORITY_LABELS,
  PLACE_TYPE_LABELS,
  type TripPlace,
  type TripPlacePriority,
  type TripPlaceType,
} from "@/types/trips";
import {
  CheckCircle,
  ExternalLink,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

const PRIORITY_OPTIONS: TripPlacePriority[] = ["mandatory", "flexible", "wishlist"];
const TYPE_OPTIONS: Array<TripPlaceType | ""> = ["", "hotel", "activity", "restaurant", "attraction", "transport", "note", "other"];

function AddPlaceSheet({
  tripId,
  open,
  onOpenChange,
  place,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  place?: TripPlace;
}) {
  const tc = useThemeClasses();
  const createPlace = useCreateTripPlace(tripId);
  const updatePlace = useUpdateTripPlace(tripId);

  const [name, setName] = useState(place?.name ?? "");
  const [type, setType] = useState<TripPlaceType | "">(place?.place_type ?? "");
  const [url, setUrl] = useState(place?.url ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const [cost, setCost] = useState(place?.cost?.toString() ?? "");
  const [priority, setPriority] = useState<TripPlacePriority>(place?.priority ?? "flexible");
  const [scheduledDate, setScheduledDate] = useState(place?.scheduled_date ?? "");
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

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Link</Label>
            <Input className={inputClass} type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Cost</Label>
              <Input className={inputClass} type="text" inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Scheduled date</Label>
              <Input className={inputClass} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
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

function PlaceRow({ place, tripId }: { place: TripPlace; tripId: string }) {
  const tc = useThemeClasses();
  const deletePlace = useDeleteTripPlace(tripId);
  const updatePlace = useUpdateTripPlace(tripId);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setEditOpen(true)}
        className={cn("w-full text-left rounded-xl border p-3.5 bg-white/5 hover:bg-white/8 transition-colors", tc.border)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{place.name}</span>
              {place.is_booked && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
              {place.url && <ExternalLink className="w-3 h-3 text-white/30 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {place.place_type && (
                <span className="text-xs text-white/40">{PLACE_TYPE_LABELS[place.place_type]}</span>
              )}
              {place.scheduled_date && (
                <span className={cn("text-xs", tc.textFaint)}>
                  {new Date(place.scheduled_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              {place.cost != null && (
                <span className="text-xs text-white/50">${place.cost}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn("text-xs font-medium", PLACE_PRIORITY_COLORS[place.priority])}>
              {PLACE_PRIORITY_LABELS[place.priority]}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); deletePlace.mutate(place.id); }}
              className="p-1 text-white/20 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </button>
      <AddPlaceSheet tripId={tripId} open={editOpen} onOpenChange={setEditOpen} place={place} />
    </>
  );
}

export function TripPlacesList({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: places = [], isLoading } = useTripPlaces(tripId);
  const [addOpen, setAddOpen] = useState(false);

  const byDate = places.reduce<Record<string, TripPlace[]>>((acc, p) => {
    const key = p.scheduled_date ?? "__unscheduled";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn("text-sm font-medium", tc.textMuted)}>Places & Activities</h3>
        <button onClick={() => setAddOpen(true)} className={cn("flex items-center gap-1 text-sm", tc.text)}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {isLoading ? (
        <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>
      ) : places.length === 0 ? (
        <div className={cn("text-center py-8 rounded-xl border border-dashed", tc.border)}>
          <MapPin className={cn("w-8 h-8 mx-auto mb-2", tc.textFaint)} />
          <p className={cn("text-sm", tc.textFaint)}>No places yet</p>
          <p className="text-xs text-white/30 mt-1">Add hotels, activities, restaurants…</p>
        </div>
      ) : (
        Object.entries(byDate)
          .sort(([a], [b]) => (a === "__unscheduled" ? 1 : b === "__unscheduled" ? -1 : a.localeCompare(b)))
          .map(([date, ps]) => (
            <div key={date} className="space-y-2">
              {date !== "__unscheduled" && (
                <p className={cn("text-xs font-medium", tc.textFaint)}>
                  {new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </p>
              )}
              {ps.map((p) => <PlaceRow key={p.id} place={p} tripId={tripId} />)}
            </div>
          ))
      )}

      <AddPlaceSheet tripId={tripId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
