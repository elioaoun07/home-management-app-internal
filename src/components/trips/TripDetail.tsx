"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useTrip } from "@/features/trips/hooks";
import { TripStatusBadge } from "./TripStatusBadge";
import { TripPlacesList } from "./TripPlacesList";
import { TripPackingList } from "./TripPackingList";
import { TripActivateSheet } from "./TripActivateSheet";
import { TripCompleteSheet } from "./TripCompleteSheet";
import { TripFormSheet } from "./TripFormSheet";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Pencil, Plane, Users } from "lucide-react";
import { useState } from "react";

type Tab = "overview" | "places" | "packing";

export function TripDetail({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: trip, isLoading } = useTrip(tripId);
  const [tab, setTab] = useState<Tab>("overview");
  const [activateOpen, setActivateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return <div className={cn("p-6 text-center text-sm", tc.textFaint)}>Loading…</div>;
  }
  if (!trip) {
    return <div className={cn("p-6 text-center text-sm", tc.textFaint)}>Trip not found</div>;
  }

  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "places", label: "Places" },
    { id: "packing", label: "Packing" },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className={cn("px-4 pt-4 pb-3 border-b", tc.border)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", tc.bgSurface)}>
              <Plane className={cn("w-5 h-5", tc.text)} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white truncate">{trip.name}</h1>
              <TripStatusBadge status={trip.status} />
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className={cn("p-2 rounded-lg", tc.bgHover, tc.textMuted)}>
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {/* Meta row */}
        <div className={cn("flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs", tc.textFaint)}>
          {trip.destination_name && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {trip.destination_name}
              {trip.destination_country_code && ` (${trip.destination_country_code})`}
            </span>
          )}
          {trip.start_date && trip.end_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmt(trip.start_date)} → {fmt(trip.end_date)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {trip.scope === "household" ? "Household" : "Solo"}
          </span>
        </div>

        {/* Action button */}
        {(trip.status === "draft" || trip.status === "upcoming") && (
          <Button
            onClick={() => setActivateOpen(true)}
            className={cn("w-full mt-3 border font-semibold", tc.bgSurface, tc.text, tc.border)}
          >
            Activate trip
          </Button>
        )}
        {trip.status === "active" && (
          <Button
            onClick={() => setCompleteOpen(true)}
            className="w-full mt-3 border font-semibold text-emerald-400 bg-emerald-500/15 border-emerald-400/40"
          >
            I'm back home
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className={cn("flex border-b", tc.border)}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id
                ? cn("border-current", tc.text)
                : cn("border-transparent text-white/40 hover:text-white/60"),
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {tab === "overview" && (
          <div className="space-y-4">
            {trip.notes && (
              <div className={cn("rounded-xl border p-4", tc.border, "bg-white/5")}>
                <p className={cn("text-xs font-medium uppercase tracking-wider mb-2", tc.textFaint)}>Notes</p>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{trip.notes}</p>
              </div>
            )}
            {trip.account_id && (
              <div className={cn("rounded-xl border p-4", tc.border, "bg-white/5")}>
                <p className={cn("text-xs font-medium uppercase tracking-wider mb-1", tc.textFaint)}>Trip account</p>
                <p className={cn("text-sm", tc.text)}>Linked to expense account</p>
                <p className="text-xs text-white/40 mt-0.5">View in the Accounts tab to track spend</p>
              </div>
            )}
            {!trip.notes && !trip.account_id && (
              <p className={cn("text-sm text-center py-8", tc.textFaint)}>
                {trip.status === "draft" ? "Set dates and activate to begin" : "Trip overview"}
              </p>
            )}
          </div>
        )}
        {tab === "places" && <TripPlacesList tripId={tripId} />}
        {tab === "packing" && <TripPackingList tripId={tripId} />}
      </div>

      {/* Sheets */}
      {editOpen && <TripFormSheet open={editOpen} onOpenChange={setEditOpen} trip={trip} />}
      {activateOpen && <TripActivateSheet open={activateOpen} onOpenChange={setActivateOpen} trip={trip} />}
      {completeOpen && <TripCompleteSheet open={completeOpen} onOpenChange={setCompleteOpen} trip={trip} />}
    </div>
  );
}
