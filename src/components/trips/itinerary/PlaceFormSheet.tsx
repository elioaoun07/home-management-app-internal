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
  useUpdateTripPlace,
} from "@/features/trips/hooks";
import { tripKeys } from "@/features/trips/queryKeys";
import {
  openTripFile,
  removePlaceAttachment,
  toWebp,
  uploadPlaceAttachment,
} from "@/features/trips/storedFile";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import {
  PLACE_PRIORITY_LABELS,
  PLACE_TYPE_LABELS,
  type TripPlace,
  type TripPlacePriority,
  type TripPlaceType,
} from "@/types/trips";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const TYPE_COLORS: Record<TripPlaceType, string> = {
  hotel: "#8b5cf6",
  activity: "#f59e0b",
  restaurant: "#f43f5e",
  attraction: "#06b6d4",
  transport: "#3b82f6",
  note: "#94a3b8",
  other: "#14b8a6",
};

/** Same three-stop wash as the packing category tiles. */
function wash(hex: string, [a, b, c]: [number, number, number]): string {
  const al = (x: number) => `${hex}${Math.round(x * 255).toString(16).padStart(2, "0")}`;
  return `linear-gradient(to bottom right, ${al(a)} 0%, ${al(b)} 50%, ${al(c)} 100%)`;
}

// Heat scale, low → high. Index doubles as the slider value.
const PRIORITY_SCALE: Array<{ value: TripPlacePriority; color: string }> = [
  { value: "wishlist", color: "#38bdf8" },
  { value: "flexible", color: "#fbbf24" },
  { value: "mandatory", color: "#f97316" },
];

const TYPE_OPTIONS: TripPlaceType[] = ["hotel", "activity", "restaurant", "attraction", "transport", "note", "other"];

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
  const qc = useQueryClient();
  const createPlace = useCreateTripPlace(tripId);
  const updatePlace = useUpdateTripPlace(tripId);
  const deletePlace = useDeleteTripPlace(tripId);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [files, setFiles] = useState<File[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    !!(place && (place.end_time || place.address || place.confirmation_code || place.url || place.description || (place.priority && place.priority !== "flexible"))),
  );

  const isPending = createPlace.isPending || updatePlace.isPending || saving;
  const savedPaths = (place?.attachment_paths ?? []).filter((p) => !removedPaths.includes(p));

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

    setSaving(true);
    try {
      const saved = place
        ? await updatePlace.mutateAsync({ id: place.id, ...payload })
        : await createPlace.mutateAsync(payload);
      const placeId = place?.id ?? saved?.id;

      if (placeId && (files.length || removedPaths.length)) {
        try {
          for (const path of removedPaths) await removePlaceAttachment(tripId, placeId, path);
          for (const f of files) await uploadPlaceAttachment(tripId, placeId, await toWebp(f));
        } catch {
          toast.error("Attachment failed", { icon: ToastIcons.error });
        }
        qc.invalidateQueries({ queryKey: tripKeys.places(tripId) });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const field = cn("h-11 min-w-0 w-full text-base bg-white/5 border text-white placeholder:text-white/30", tc.border);
  const priorityIndex = PRIORITY_SCALE.findIndex((p) => p.value === priority);
  const heat = PRIORITY_SCALE[priorityIndex].color;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("rounded-t-2xl border-t max-h-[92dvh] gap-0 p-0", tc.border, tc.bgPage)}
      >
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="text-white">{place ? "Edit place" : "Add place"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Name</Label>
              <Input className={field} placeholder="Hotel Le Marais" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((t) => {
                const color = TYPE_COLORS[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(active ? "" : t)}
                    className="rounded-full border px-3 py-1.5 text-sm transition-colors"
                    style={{
                      backgroundImage: wash(color, active ? [0.35, 0.15, 0.05] : [0.14, 0.06, 0.02]),
                      borderColor: active ? color : `${color}40`,
                      color: active ? color : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {PLACE_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label className={tc.textMuted}>Date</Label>
                <Input className={field} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label className={tc.textMuted}>Time</Label>
                <Input className={field} type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label className={tc.textMuted}>Cost</Label>
                <Input className={field} type="text" inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isBooked}
                onClick={() => setIsBooked((v) => !v)}
                className="flex h-11 items-center justify-between gap-3 rounded-md border bg-white/5 px-3"
                style={{ borderColor: isBooked ? "#10b98180" : undefined }}
              >
                <span className={cn("text-sm", isBooked ? "text-emerald-400" : tc.textMuted)}>Booked</span>
                <span
                  className="relative h-6 w-11 rounded-full transition-colors"
                  style={{ backgroundColor: isBooked ? "#10b981" : "rgba(255,255,255,0.15)" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: isBooked ? "translateX(20px)" : "translateX(0)" }}
                  />
                </span>
              </button>
            </div>

            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) setFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              {savedPaths.map((path, i) => (
                <div key={path} className={cn("flex h-11 items-center gap-2 rounded-md border bg-white/5 px-3 text-sm", tc.border)}>
                  <Paperclip className={cn("h-4 w-4 flex-shrink-0", tc.text)} />
                  <button type="button" onClick={() => openTripFile(tripId, path)} className="min-w-0 flex-1 truncate text-left text-white">
                    Ticket {i + 1}
                  </button>
                  <button type="button" aria-label="Remove attachment" onClick={() => setRemovedPaths((r) => [...r, path])} className={cn("p-1", tc.textMuted)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className={cn("flex h-11 items-center gap-2 rounded-md border bg-white/5 px-3 text-sm", tc.border)}>
                  <Paperclip className={cn("h-4 w-4 flex-shrink-0", tc.text)} />
                  <span className="min-w-0 flex-1 truncate text-white">{f.name}</span>
                  <button type="button" aria-label="Remove attachment" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className={cn("p-1", tc.textMuted)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed text-sm", tc.border, tc.textMuted)}
              >
                <Paperclip className="h-4 w-4" />
                {savedPaths.length + files.length ? "Add another" : "Ticket / QR"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn("flex items-center gap-1 text-sm", tc.textMuted)}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} />
              More
            </button>

            {moreOpen && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <Label className={tc.textMuted}>End time</Label>
                    <Input className={field} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label className={tc.textMuted}>Confirmation</Label>
                    <Input className={field} placeholder="ABC123" value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={tc.textMuted}>Priority</Label>
                    <span className="text-sm font-medium" style={{ color: heat }}>{PLACE_PRIORITY_LABELS[priority]}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={PRIORITY_SCALE.length - 1}
                    step={1}
                    value={priorityIndex}
                    onChange={(e) => setPriority(PRIORITY_SCALE[Number(e.target.value)].value)}
                    aria-label="Priority"
                    className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-current [&::-moz-range-thumb]:bg-current [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                    style={{
                      background: "linear-gradient(to right, #38bdf8, #fbbf24, #f97316)",
                      // thumb colour follows the heat via currentColor
                      color: heat,
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className={tc.textMuted}>Address</Label>
                  <Input className={field} placeholder="12 Rue de Rivoli, Paris" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className={tc.textMuted}>Link</Label>
                  <Input className={field} type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className={tc.textMuted}>Notes</Label>
                  <textarea
                    className={cn(field, "h-20 resize-none rounded-md px-3 py-2")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              className={cn("h-11 w-full border", tc.bgSurface, tc.text, tc.border)}
            >
              {isPending ? "Saving…" : place ? "Save" : "Add"}
            </Button>
            {place && (
              <Button
                type="button"
                variant="ghost"
                disabled={isPending || deletePlace.isPending}
                onClick={() => deletePlace.mutate(place.id, { onSuccess: () => onOpenChange(false) })}
                className="h-11 w-full text-white/50 hover:text-white/80"
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
