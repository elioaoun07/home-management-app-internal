"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/trips";
import { Calendar, Globe, MapPin, Plane } from "lucide-react";
import { TripStatusBadge } from "./TripStatusBadge";

interface TripCardProps {
  trip: Trip;
  onClick?: () => void;
  className?: string;
}

export function TripCard({ trip, onClick, className }: TripCardProps) {
  const tc = useThemeClasses();

  const formatDateRange = () => {
    if (!trip.start_date && !trip.end_date) return null;
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (trip.start_date && trip.end_date) {
      return `${fmt(trip.start_date)} – ${fmt(trip.end_date)}`;
    }
    return trip.start_date ? fmt(trip.start_date) : fmt(trip.end_date!);
  };

  const dateRange = formatDateRange();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all duration-200",
        "bg-white/5 hover:bg-white/8",
        tc.border,
        tc.borderHover,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center", tc.bgSurface)}>
            <Plane className={cn("w-4 h-4", tc.text)} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white/90 truncate">{trip.name}</p>
            {trip.destination_name && (
              <p className={cn("text-xs flex items-center gap-1 mt-0.5", tc.textMuted)}>
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {trip.destination_name}
                {trip.destination_country_code && ` · ${trip.destination_country_code}`}
              </p>
            )}
          </div>
        </div>
        <TripStatusBadge status={trip.status} className="flex-shrink-0" />
      </div>

      {(dateRange || trip.scope === "solo") && (
        <div className={cn("flex items-center gap-4 mt-3 text-xs", tc.textFaint)}>
          {dateRange && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateRange}
            </span>
          )}
          {trip.scope === "solo" && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Solo
            </span>
          )}
          {trip.currency && trip.currency !== "USD" && (
            <span>{trip.currency}</span>
          )}
        </div>
      )}
    </button>
  );
}
