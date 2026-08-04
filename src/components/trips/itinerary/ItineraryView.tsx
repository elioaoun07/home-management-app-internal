"use client";

import {
  useDeleteTripPlace,
  useReorderTripPlaces,
  useTrip,
  useTripPlaces,
  useUpdateTripPlace,
} from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn, formatCurrency } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/DropdownMenu";
import {
  PLACE_PRIORITY_COLORS,
  PLACE_PRIORITY_LABELS,
  PLACE_TYPE_LABELS,
  type TripPlace,
} from "@/types/trips";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import {
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  MoreVertical,
  Navigation,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ToastIcons } from "@/lib/toastIcons";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlaceFormSheet } from "./PlaceFormSheet";

const IDEAS_KEY = "__ideas";

function parseLocalDate(d: string): Date {
  return parseISO(d);
}

function formatTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return format(d, "h:mm a");
}

// ── Place row ─────────────────────────────────────────────────────────────

function PlaceRow({
  place,
  tripId,
  tripCurrency,
  dayOptions,
  sortable,
}: {
  place: TripPlace;
  tripId: string;
  tripCurrency: string;
  dayOptions: Array<{ key: string; label: string }>;
  sortable?: boolean;
}) {
  const tc = useThemeClasses();
  const deletePlace = useDeleteTripPlace(tripId);
  const updatePlace = useUpdateTripPlace(tripId);
  const [editOpen, setEditOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: place.id,
    disabled: !sortable,
  });
  const dragStyle: React.CSSProperties = sortable
    ? { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
    : {};

  const timeLabel = place.scheduled_time
    ? place.end_time
      ? `${formatTime(place.scheduled_time)} – ${formatTime(place.end_time)}`
      : formatTime(place.scheduled_time)
    : null;

  const mapsQuery = encodeURIComponent(place.address || place.name);

  const copyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!place.confirmation_code) return;
    navigator.clipboard.writeText(place.confirmation_code);
    toast.success("Confirmation code copied", { icon: ToastIcons.success, duration: 2500 });
  };

  const moveToDay = (dayKey: string) => {
    updatePlace.mutate({ id: place.id, scheduled_date: dayKey === IDEAS_KEY ? null : dayKey });
  };

  return (
    <>
      <div
        ref={sortable ? setNodeRef : undefined}
        style={dragStyle}
        className={cn("rounded-xl border p-3.5 bg-white/5 hover:bg-white/8 transition-colors flex items-start gap-2", tc.border)}
      >
        {sortable && (
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-1 p-1 text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag to reorder"
          >
            <svg viewBox="0 0 10 16" className="w-2.5 h-4" fill="currentColor"><circle cx="2" cy="2" r="1.3" /><circle cx="8" cy="2" r="1.3" /><circle cx="2" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="2" cy="14" r="1.3" /><circle cx="8" cy="14" r="1.3" /></svg>
          </button>
        )}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditOpen(true); } }}
          className="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white truncate">{place.name}</span>
                {place.is_booked && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-white/40">
                {timeLabel && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {timeLabel}
                  </span>
                )}
                {place.place_type && <span>{PLACE_TYPE_LABELS[place.place_type]}</span>}
                {place.cost != null && (
                  <span>{formatCurrency(place.cost, place.currency ?? tripCurrency)}</span>
                )}
                <span className={cn("font-medium", PLACE_PRIORITY_COLORS[place.priority])}>
                  {PLACE_PRIORITY_LABELS[place.priority]}
                </span>
              </div>
              {(place.address || place.confirmation_code || place.url) && (
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {place.address && (
                    <a
                      href={`https://maps.google.com/?q=${mapsQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-cyan-400/80 hover:text-cyan-300"
                    >
                      <Navigation className="w-3 h-3" /> Directions
                    </a>
                  )}
                  {place.confirmation_code && (
                    <button onClick={copyCode} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70">
                      <Copy className="w-3 h-3" /> {place.confirmation_code}
                    </button>
                  )}
                  {place.url && (
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
                    >
                      <ExternalLink className="w-3 h-3" /> Link
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()} className="flex-shrink-0 p-1 text-white/20 hover:text-white/50 transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {dayOptions.map((d) => (
              <DropdownMenuItem key={d.key} onClick={() => moveToDay(d.key)}>
                <MapPin className="w-3.5 h-3.5 mr-2" /> Move to {d.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => deletePlace.mutate(place.id)} className="text-red-400 focus:text-red-400">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <PlaceFormSheet tripId={tripId} open={editOpen} onOpenChange={setEditOpen} place={place} />
    </>
  );
}

// ── Main itinerary view ──────────────────────────────────────────────────

export function ItineraryView({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: trip } = useTrip(tripId);
  const { data: places = [], isLoading } = useTripPlaces(tripId);
  const reorderPlaces = useReorderTripPlaces(tripId);
  const [addOpen, setAddOpen] = useState(false);

  const days = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return [];
    try {
      return eachDayOfInterval({ start: parseLocalDate(trip.start_date), end: parseLocalDate(trip.end_date) });
    } catch {
      return [];
    }
  }, [trip?.start_date, trip?.end_date]);

  const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
  const [selectedDay, setSelectedDay] = useState<string>(dayKeys[0] ?? IDEAS_KEY);
  const activeSelectedDay = dayKeys.includes(selectedDay) || selectedDay === IDEAS_KEY ? selectedDay : (dayKeys[0] ?? IDEAS_KEY);

  const dayOptions = [
    ...days.map((d, i) => ({ key: dayKeys[i], label: `Day ${i + 1} · ${format(d, "MMM d")}` })),
    { key: IDEAS_KEY, label: "Ideas" },
  ];

  const tripCurrency = trip?.currency ?? "USD";
  const tripTotal = places.reduce((sum, p) => sum + (p.cost ?? 0), 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Undated trip: no day strip possible — fall back to a flat date-grouped list.
  if (trip && (!trip.start_date || !trip.end_date)) {
    const byDate = places.reduce<Record<string, TripPlace[]>>((acc, p) => {
      const key = p.scheduled_date ?? "__unscheduled";
      (acc[key] ??= []).push(p);
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
        <p className={cn("text-xs", tc.textFaint)}>Set trip dates to unlock a day-by-day itinerary.</p>
        {isLoading ? (
          <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>
        ) : places.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          Object.entries(byDate)
            .sort(([a], [b]) => (a === "__unscheduled" ? 1 : b === "__unscheduled" ? -1 : a.localeCompare(b)))
            .map(([date, ps]) => (
              <div key={date} className="space-y-2">
                {date !== "__unscheduled" && (
                  <p className={cn("text-xs font-medium", tc.textFaint)}>
                    {format(parseLocalDate(date), "EEEE, MMM d")}
                  </p>
                )}
                {ps.map((p) => (
                  <PlaceRow key={p.id} place={p} tripId={tripId} tripCurrency={tripCurrency} dayOptions={[]} />
                ))}
              </div>
            ))
        )}
        <PlaceFormSheet tripId={tripId} open={addOpen} onOpenChange={setAddOpen} />
      </div>
    );
  }

  const dayItems = places.filter((p) =>
    activeSelectedDay === IDEAS_KEY ? p.scheduled_date == null : p.scheduled_date === activeSelectedDay,
  );
  const anytimeItems = dayItems.filter((p) => !p.scheduled_time).sort((a, b) => a.position - b.position);
  const timedItems = dayItems
    .filter((p) => p.scheduled_time)
    .sort((a, b) => (a.scheduled_time! < b.scheduled_time! ? -1 : a.scheduled_time! > b.scheduled_time! ? 1 : 0));

  const dayCost = dayItems.reduce((sum, p) => sum + (p.cost ?? 0), 0);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = anytimeItems.map((p) => p.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const next = arrayMove(ids, oldIndex, newIndex);
    reorderPlaces.mutate(next.map((id, position) => ({ id, position })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn("text-sm font-medium", tc.textMuted)}>Itinerary</h3>
        <button onClick={() => setAddOpen(true)} className={cn("flex items-center gap-1 text-sm", tc.text)}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Day strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((d, i) => {
          const key = dayKeys[i];
          const count = places.filter((p) => p.scheduled_date === key).length;
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(key)}
              className={cn(
                "flex-shrink-0 text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors",
                activeSelectedDay === key ? cn(tc.bgSurface, tc.text, tc.border) : "text-white/40 border-white/10 hover:text-white/60",
              )}
            >
              Day {i + 1} · {format(d, "EEE d")}
              {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
            </button>
          );
        })}
        <button
          onClick={() => setSelectedDay(IDEAS_KEY)}
          className={cn(
            "flex-shrink-0 text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors",
            activeSelectedDay === IDEAS_KEY ? cn(tc.bgSurface, tc.text, tc.border) : "text-white/40 border-white/10 hover:text-white/60",
          )}
        >
          Ideas
          {places.filter((p) => p.scheduled_date == null).length > 0 && (
            <span className="ml-1 opacity-60">({places.filter((p) => p.scheduled_date == null).length})</span>
          )}
        </button>
      </div>

      {dayItems.length > 0 && dayCost > 0 && (
        <p className={cn("text-xs", tc.textFaint)}>Planned for this day: {formatCurrency(dayCost, tripCurrency)}</p>
      )}

      {/* Day content */}
      {isLoading ? (
        <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>
      ) : dayItems.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="space-y-2">
          {anytimeItems.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={anytimeItems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {anytimeItems.map((p) => (
                    <PlaceRow key={p.id} place={p} tripId={tripId} tripCurrency={tripCurrency} dayOptions={dayOptions} sortable />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {timedItems.map((p) => (
            <PlaceRow key={p.id} place={p} tripId={tripId} tripCurrency={tripCurrency} dayOptions={dayOptions} />
          ))}
        </div>
      )}

      {tripTotal > 0 && (
        <div className={cn("flex items-center justify-between text-xs pt-2 border-t", tc.border, tc.textFaint)}>
          <span>Trip total (planned)</span>
          <span className="font-medium">{formatCurrency(tripTotal, tripCurrency)}</span>
        </div>
      )}

      <PlaceFormSheet
        tripId={tripId}
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={activeSelectedDay === IDEAS_KEY ? null : activeSelectedDay}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const tc = useThemeClasses();
  return (
    <div className={cn("text-center py-8 rounded-xl border border-dashed", tc.border)}>
      <MapPin className={cn("w-8 h-8 mx-auto mb-2", tc.textFaint)} />
      <p className={cn("text-sm", tc.textFaint)}>Nothing here yet</p>
      <button onClick={onAdd} className="text-xs text-white/30 mt-1 hover:text-white/50">Add a place</button>
    </div>
  );
}
