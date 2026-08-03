"use client";

import { useTripDocuments, useTripPacking, useTripPlaces } from "@/features/trips/hooks";
import { tripCountdown } from "@/features/trips/tripPhase";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn, formatCurrency } from "@/lib/utils";
import type { Trip } from "@/types/trips";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, FileWarning, MapPin, PackageCheck, Wallet } from "lucide-react";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  const tc = useThemeClasses();
  return <div className={cn("rounded-xl border p-4", tc.border, "bg-white/5", className)}>{children}</div>;
}

function CardLabel({ children }: { children: React.ReactNode }) {
  const tc = useThemeClasses();
  return <p className={cn("text-xs font-medium uppercase tracking-wider mb-1.5", tc.textFaint)}>{children}</p>;
}

function CountdownHero({ trip }: { trip: Trip }) {
  const tc = useThemeClasses();
  const countdown = tripCountdown(trip);

  if (countdown.phase === "undated") {
    return (
      <Card>
        <p className={cn("text-sm text-center py-2", tc.textFaint)}>Set start and end dates to see your countdown</p>
      </Card>
    );
  }

  return (
    <Card className="text-center py-6">
      <p className={cn("text-2xl font-semibold", tc.text)}>{countdown.label}</p>
      {countdown.totalDays != null && (
        <p className="text-xs text-white/40 mt-1">
          {countdown.totalDays} day{countdown.totalDays === 1 ? "" : "s"} total
        </p>
      )}
    </Card>
  );
}

function PackingRingCard({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: items = [] } = useTripPacking(tripId);

  if (items.length === 0) return null;

  const packed = items.filter((i) => i.is_packed).length;
  const total = items.length;

  const byCategory = new Map<string, { packed: number; total: number }>();
  for (const item of items) {
    const key = item.category ?? "Other";
    const entry = byCategory.get(key) ?? { packed: 0, total: 0 };
    entry.total += 1;
    if (item.is_packed) entry.packed += 1;
    byCategory.set(key, entry);
  }
  let weakest: { name: string; ratio: number } | null = null;
  for (const [name, { packed: p, total: t }] of byCategory) {
    const ratio = t > 0 ? p / t : 1;
    if (ratio < 1 && (weakest === null || ratio < weakest.ratio)) weakest = { name, ratio };
  }

  return (
    <Card>
      <CardLabel>Packing</CardLabel>
      <div className="flex items-center gap-3">
        <PackageCheck className={cn("w-5 h-5 flex-shrink-0", packed === total ? "text-emerald-400" : tc.text)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{packed}/{total} packed</p>
          {weakest && <p className="text-xs text-white/40 mt-0.5">{weakest.name} needs the most attention</p>}
        </div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1 mt-2">
        <div
          className={cn("h-1 rounded-full transition-all duration-500", packed === total ? "bg-emerald-400" : "bg-cyan-400")}
          style={{ width: `${total > 0 ? (packed / total) * 100 : 0}%` }}
        />
      </div>
    </Card>
  );
}

function ItineraryReadinessCard({ tripId, trip }: { tripId: string; trip: Trip }) {
  const tc = useThemeClasses();
  const { data: places = [] } = useTripPlaces(tripId);

  if (places.length === 0) return null;

  const scheduled = places.filter((p) => p.scheduled_date != null).length;
  const ideas = places.filter((p) => p.scheduled_date == null).length;
  const booked = places.filter((p) => p.is_booked).length;

  const countdown = tripCountdown(trip);
  const inWarningWindow = countdown.phase === "soon" || countdown.phase === "travelling";
  const unbooked = places.filter((p) => p.scheduled_date != null && !p.is_booked && p.priority !== "wishlist");

  return (
    <Card>
      <CardLabel>Itinerary</CardLabel>
      <div className="flex items-center gap-3">
        <MapPin className={cn("w-5 h-5 flex-shrink-0", tc.text)} />
        <p className="text-sm text-white">{scheduled} scheduled · {ideas} ideas · {booked} booked</p>
      </div>
      {inWarningWindow && unbooked.length > 0 && (
        <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20 mt-2.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>{unbooked.length} place{unbooked.length === 1 ? " isn't" : "s aren't"} booked yet</p>
        </div>
      )}
    </Card>
  );
}

function NextUpCard({ tripId }: { tripId: string }) {
  const { data: places = [] } = useTripPlaces(tripId);
  const tc = useThemeClasses();

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const upcoming = places
    .filter((p) => p.scheduled_date != null && p.scheduled_date >= todayKey)
    .sort((a, b) => {
      const dateCmp = a.scheduled_date!.localeCompare(b.scheduled_date!);
      if (dateCmp !== 0) return dateCmp;
      return (a.scheduled_time ?? "99:99").localeCompare(b.scheduled_time ?? "99:99");
    });

  const next = upcoming[0];
  if (!next) return null;

  return (
    <Card>
      <CardLabel>Next up</CardLabel>
      <div className="flex items-center gap-3">
        <Clock className={cn("w-5 h-5 flex-shrink-0", tc.text)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{next.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {format(parseISO(next.scheduled_date!), "EEE, MMM d")}
            {next.scheduled_time && ` · ${next.scheduled_time.slice(0, 5)}`}
          </p>
        </div>
      </div>
    </Card>
  );
}

function DocumentsStripCard({ tripId, trip }: { tripId: string; trip: Trip }) {
  const { data: documents = [] } = useTripDocuments(tripId);

  if (documents.length === 0) return null;

  const expiringBeforeReturn = trip.end_date
    ? documents.filter((d) => d.expires_on && parseISO(d.expires_on) < parseISO(trip.end_date!))
    : [];
  const expiringSoon = documents.filter((d) => {
    if (!d.expires_on) return false;
    if (expiringBeforeReturn.some((e) => e.id === d.id)) return false;
    return differenceInCalendarDays(parseISO(d.expires_on), new Date()) <= 90;
  });

  return (
    <Card>
      <CardLabel>Documents</CardLabel>
      {expiringBeforeReturn.length > 0 ? (
        <div className="flex items-start gap-2 text-red-400 text-sm">
          <FileWarning className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            {expiringBeforeReturn.map((d) => d.title).join(", ")} expire{expiringBeforeReturn.length === 1 ? "s" : ""} before you're back home
          </p>
        </div>
      ) : expiringSoon.length > 0 ? (
        <div className="flex items-start gap-2 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{expiringSoon.length} document{expiringSoon.length === 1 ? "" : "s"} expiring soon</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <p>{documents.length} document{documents.length === 1 ? "" : "s"} on file</p>
        </div>
      )}
    </Card>
  );
}

function PlannedSpendCard({ tripId, trip }: { tripId: string; trip: Trip }) {
  const { data: places = [] } = useTripPlaces(tripId);
  const tc = useThemeClasses();
  const total = places.reduce((sum, p) => sum + (p.cost ?? 0), 0);

  if (total === 0) return null;

  return (
    <Card>
      <CardLabel>Planned spend</CardLabel>
      <div className="flex items-center gap-3">
        <Wallet className={cn("w-5 h-5 flex-shrink-0", tc.text)} />
        <p className="text-sm text-white">{formatCurrency(total, trip.currency)}</p>
      </div>
      <p className="text-xs text-white/30 mt-1">From places — not actuals. Trip spend tracking comes later.</p>
    </Card>
  );
}

export function OverviewTab({ tripId, trip }: { tripId: string; trip: Trip }) {
  const tc = useThemeClasses();

  return (
    <div className="space-y-3">
      <CountdownHero trip={trip} />

      {trip.notes && (
        <Card>
          <CardLabel>Notes</CardLabel>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{trip.notes}</p>
        </Card>
      )}

      <NextUpCard tripId={tripId} />
      <ItineraryReadinessCard tripId={tripId} trip={trip} />
      <PackingRingCard tripId={tripId} />
      <DocumentsStripCard tripId={tripId} trip={trip} />
      <PlannedSpendCard tripId={tripId} trip={trip} />

      {trip.account_id && (
        <Card>
          <CardLabel>Trip account</CardLabel>
          <p className={cn("text-sm", tc.text)}>Linked to expense account</p>
          <p className="text-xs text-white/40 mt-0.5">View in the Accounts tab to track spend</p>
        </Card>
      )}
    </div>
  );
}
