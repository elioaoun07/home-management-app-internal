"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useTrips } from "@/features/trips/hooks";
import { TripCard } from "./TripCard";
import { TripFormSheet } from "./TripFormSheet";
import { Plane, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TripStatus } from "@/types/trips";

const STATUS_ORDER: TripStatus[] = ["active", "upcoming", "draft", "completed", "archived"];

export function TripsView() {
  const tc = useThemeClasses();
  const router = useRouter();
  const { data: trips = [], isLoading } = useTrips();
  const [newOpen, setNewOpen] = useState(false);

  const sorted = [...trips].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const active = sorted.filter((t) => t.status === "active");
  const upcoming = sorted.filter((t) => t.status === "upcoming" || t.status === "draft");
  const past = sorted.filter((t) => t.status === "completed" || t.status === "archived");

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className={cn("px-4 pt-14 pb-3 flex items-center justify-between border-b", tc.border)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center", tc.bgSurface)}>
            <Plane className={cn("w-4 h-4", tc.text)} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Trips</h1>
            <p className={cn("text-xs", tc.textFaint)}>{trips.length} trip{trips.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className={cn("flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border", tc.text, tc.bgSurface, tc.border)}
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {isLoading ? (
          <p className={cn("text-sm text-center py-8", tc.textFaint)}>Loading trips…</p>
        ) : trips.length === 0 ? (
          <div className={cn("text-center py-12 rounded-xl border border-dashed", tc.border)}>
            <Plane className={cn("w-10 h-10 mx-auto mb-3", tc.textFaint)} />
            <p className={cn("font-medium", tc.textMuted)}>No trips yet</p>
            <p className="text-xs text-white/30 mt-1 mb-4">Plan your first trip</p>
            <button
              onClick={() => setNewOpen(true)}
              className={cn("text-sm px-4 py-2 rounded-lg border", tc.text, tc.bgSurface, tc.border)}
            >
              Create trip
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section className="space-y-2">
                <p className={cn("text-xs font-medium uppercase tracking-wider", tc.textFaint)}>Active</p>
                {active.map((t) => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
              </section>
            )}
            {upcoming.length > 0 && (
              <section className="space-y-2">
                <p className={cn("text-xs font-medium uppercase tracking-wider", tc.textFaint)}>Upcoming & Drafts</p>
                {upcoming.map((t) => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-2">
                <p className={cn("text-xs font-medium uppercase tracking-wider", tc.textFaint)}>Past</p>
                {past.map((t) => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
              </section>
            )}
          </>
        )}
      </div>

      <TripFormSheet open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
