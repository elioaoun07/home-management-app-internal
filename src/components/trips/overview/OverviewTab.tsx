"use client";

import { useTripDocuments, useTripPacking, useTripPlaces, useTripSpend } from "@/features/trips/hooks";
import { tripCountdown } from "@/features/trips/tripPhase";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn, formatCurrency } from "@/lib/utils";
import type { Trip } from "@/types/trips";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, FileWarning, MapPin, PackageCheck, Wallet } from "lucide-react";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  const tc = useThemeClasses();
  return <div className={cn("rounded-xl border p-4", tc.border, "bg-white/5", className)}>{children}</div>;
}

function CardLabel({ children }: { children: React.ReactNode }) {
  const tc = useThemeClasses();
  return <p className={cn("text-xs font-medium uppercase tracking-wider mb-1.5", tc.textFaint)}>{children}</p>;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function CountdownHero({ trip }: { trip: Trip }) {
  const tc = useThemeClasses();
  const initial = tripCountdown(trip);
  const ticking = initial.phase === "planning" || initial.phase === "soon";
  const now = useNow(ticking);
  const countdown = tripCountdown(trip, new Date(now));

  if (countdown.phase === "undated") {
    return (
      <Card>
        <p className={cn("text-sm text-center py-2", tc.textFaint)}>Set start and end dates to see your countdown</p>
      </Card>
    );
  }

  if (countdown.phase !== "planning" && countdown.phase !== "soon") {
    return (
      <Card className="text-center py-6">
        <p className={cn("text-2xl font-semibold", tc.text)}>{countdown.label}</p>
      </Card>
    );
  }

  const ms = Math.max(0, new Date(trip.start_date + "T00:00:00").getTime() - now);
  const units = [
    { label: "Days", value: Math.floor(ms / 86_400_000) },
    { label: "Hrs", value: Math.floor(ms / 3_600_000) % 24 },
    { label: "Min", value: Math.floor(ms / 60_000) % 60 },
    { label: "Sec", value: Math.floor(ms / 1000) % 60 },
  ];

  return (
    <Card className="py-5">
      <div className="grid grid-cols-4 gap-2">
        {units.map((u) => (
          <div key={u.label} className="rounded-lg bg-white/5 py-3 text-center">
            <p className={cn("text-3xl font-semibold tabular-nums leading-none", tc.text)}>
              {String(u.value).padStart(2, "0")}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1.5">{u.label}</p>
          </div>
        ))}
      </div>
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
    const key = item.packing_category?.name ?? "Other";
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

  const [next, after] = upcoming;
  if (!next) return null;

  const when = (p: typeof next) => {
    const days = differenceInCalendarDays(parseISO(p.scheduled_date!), new Date());
    const rel = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    return { rel, date: format(parseISO(p.scheduled_date!), "EEE, MMM d"), time: p.scheduled_time?.slice(0, 5) ?? null };
  };
  const n = when(next);
  const a = after ? when(after) : null;

  return (
    <Card className="relative overflow-hidden p-0">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-400/10 to-transparent pointer-events-none" />
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <CardLabel>Up next</CardLabel>
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 -mt-1.5", tc.text)}>{n.rel}</span>
        </div>
        <p className="text-2xl font-semibold text-white leading-tight break-words">{next.name}</p>
        <div className="flex items-center gap-2 mt-2">
          <Clock className={cn("w-4 h-4 flex-shrink-0", tc.text)} />
          <p className="text-sm text-white/60">
            {n.date}
            {n.time && <span className={cn("ml-2 font-semibold tabular-nums", tc.text)}>{n.time}</span>}
          </p>
        </div>
      </div>
      {a && after && (
        <div className="relative border-t border-white/10 bg-white/[0.03] px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/35">After</p>
            <p className="text-sm text-white/70 truncate mt-0.5">{after.name}</p>
          </div>
          <p className="text-xs text-white/40 text-right flex-shrink-0">
            {a.rel}
            <span className="block tabular-nums">{a.time ?? a.date}</span>
          </p>
        </div>
      )}
    </Card>
  );
}

function DocumentsStripCard({ tripId, trip }: { tripId: string; trip: Trip }) {
  const { data: documents = [] } = useTripDocuments(tripId);

  const expiringBeforeReturn = trip.end_date
    ? documents.filter((d) => d.expires_on && parseISO(d.expires_on) < parseISO(trip.end_date!))
    : [];
  const expiringSoon = documents.filter((d) => {
    if (!d.expires_on) return false;
    if (expiringBeforeReturn.some((e) => e.id === d.id)) return false;
    return differenceInCalendarDays(parseISO(d.expires_on), new Date()) <= 90;
  });

  if (expiringBeforeReturn.length === 0 && expiringSoon.length === 0) return null;

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
      ) : (
        <div className="flex items-start gap-2 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{expiringSoon.length} document{expiringSoon.length === 1 ? "" : "s"} expiring soon</p>
        </div>
      )}
    </Card>
  );
}

function TotalExpensesCard({ tripId, trip }: { tripId: string; trip: Trip }) {
  const { data, isError } = useTripSpend(tripId);
  const tc = useThemeClasses();
  const [open, setOpen] = useState(false);

  const totals = data?.totals ?? [];
  if (isError) {
    return (
      <Card>
        <CardLabel>Total expenses</CardLabel>
        <p className="text-sm text-white/40">Unavailable</p>
      </Card>
    );
  }
  if (!data) return null;
  if (totals.length === 0) {
    if (!trip.account_id) return null;
    totals.push({ currency: trip.currency ?? "USD", total: 0, count: 0 });
  }

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <CardLabel>Total expenses</CardLabel>
        <div className="space-y-1.5">
          {totals.map((t) => (
            <div key={t.currency} className="flex items-center gap-3">
              <Wallet className={cn("w-5 h-5 flex-shrink-0", tc.text)} />
              <p className="text-sm text-white">{formatCurrency(t.total, t.currency)}</p>
              <p className="text-xs text-white/40">{t.count}</p>
            </div>
          ))}
        </div>
      </button>
      {open && (
        <ul className="mt-3 pt-3 border-t border-white/10 space-y-2">
          {data!.transactions.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-white truncate">{tx.description || tx.account_name}</p>
                <p className="text-xs text-white/40">
                  {format(parseISO(tx.date), "MMM d")} · {tx.account_name}
                </p>
              </div>
              <p className="text-white flex-shrink-0">{formatCurrency(tx.amount, tx.currency)}</p>
            </li>
          ))}
        </ul>
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
    </Card>
  );
}

export function OverviewTab({ tripId, trip }: { tripId: string; trip: Trip }) {
  return (
    <div className="space-y-3">
      <CountdownHero trip={trip} />
      <NextUpCard tripId={tripId} />
      <ItineraryReadinessCard tripId={tripId} trip={trip} />
      <PackingRingCard tripId={tripId} />
      <DocumentsStripCard tripId={tripId} trip={trip} />
      <TotalExpensesCard tripId={tripId} trip={trip} />
      <PlannedSpendCard tripId={tripId} trip={trip} />
    </div>
  );
}
