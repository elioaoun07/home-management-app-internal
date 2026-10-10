"use client";

// ERA Artifacts — everything ERA itself created, updated or deleted, one day at
// a time, grouped by app module. Labels and links come from the one entity
// registry (src/lib/era/artifacts.ts); each group takes its module's ERA hue.
// Days with nothing are skipped (‹ ›) or greyed out (calendar). Undo/Redo is
// derived from each row's live state (useEraArtifacts), so it persists.

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shared/Sheet";
import { Calendar } from "@/components/ui/calendar";
import {
  type EraArtifactRow,
  dateOfDayKey,
  reversalButton,
  reversalOf,
  useArtifactReversal,
  useEraArtifactDays,
  useEraArtifactsForDay,
  useEraRowStatus,
} from "@/features/era/widgets/useEraArtifacts";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  ERA_ARTIFACT_MODULES,
  ERA_ARTIFACT_MODULE_KEYS,
  type EraArtifactModule,
  eraArtifactLabel,
  eraArtifactModule,
} from "@/lib/era/artifacts";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function rowLabel(item: EraArtifactRow): string {
  const label = eraArtifactLabel(item.entity_type);
  return item.action === "created" ? label : `${label} · ${item.action}`;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  const d = dateOfDayKey(key);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === formatDate(yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

const surface = (hue: number) => ({
  background: `hsla(${hue}, 18%, 7%, 0.82)`,
  border: `1px solid hsla(${hue}, 55%, 45%, 0.22)`,
});

export function ArtifactsView() {
  const router = useRouter();
  const tc = useThemeClasses();
  const todayKey = formatDate(new Date());
  const [picked, setPicked] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dayKey = picked ?? todayKey;

  const { data: days = [] } = useEraArtifactDays();
  const { data: rows = [], isLoading } = useEraArtifactsForDay(dayKey);
  const { data: statuses } = useEraRowStatus(rows);
  const reversal = useArtifactReversal();

  // `days` is newest-first: the previous day with artifacts is the first one
  // older than this day, the next is the last one newer.
  const prevDay = days.find((d) => d < dayKey) ?? null;
  const nextDay = [...days].reverse().find((d) => d > dayKey) ?? null;
  const daySet = useMemo(() => new Set(days), [days]);

  const groups = useMemo(() => {
    const byModule = new Map<EraArtifactModule, EraArtifactRow[]>();
    for (const row of rows) {
      const m = eraArtifactModule(row.entity_type);
      byModule.set(m, [...(byModule.get(m) ?? []), row]);
    }
    return ERA_ARTIFACT_MODULE_KEYS.filter((m) => byModule.has(m)).map((m) => ({
      key: m,
      ...ERA_ARTIFACT_MODULES[m],
      rows: byModule.get(m) as EraArtifactRow[],
    }));
  }, [rows]);

  const navBtn = "flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/70 disabled:opacity-25";

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      <button type="button" onClick={() => router.push("/activity-log")} className="min-h-11 self-start text-sm text-cyan-400">
        Household activity →
      </button>

      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous day" disabled={!prevDay} onClick={() => prevDay && setPicked(prevDay)} className={navBtn}>
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="min-h-11 flex-1 rounded-xl px-3 text-center text-base font-medium text-white/85"
          style={surface(190)}
        >
          {dayLabel(dayKey, todayKey)}
        </button>
        <button type="button" aria-label="Next day" disabled={!nextDay} onClick={() => nextDay && setPicked(nextDay)} className={navBtn}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      {!isLoading && rows.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-sm text-white/50" style={surface(190)}>
          Nothing
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} className="overflow-hidden rounded-2xl" style={surface(group.hue)}>
          <header
            className="flex items-center justify-between px-4 py-2 text-xs font-medium uppercase tracking-wide"
            style={{ background: `hsla(${group.hue}, 60%, 40%, 0.12)`, color: `hsl(${group.hue}, 72%, 68%)` }}
          >
            <span>{group.label}</span>
            <span>{group.rows.length}</span>
          </header>
          <ul>
            {group.rows.map((item) => {
              const rev = reversalOf(item);
              const button = reversalButton(rev, rev ? statuses?.[rev.id] : undefined);
              const pending = reversal.isPending && reversal.variables?.reversal.id === rev?.id;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 border-t px-2 first:border-t-0"
                  style={{ borderColor: `hsla(${group.hue}, 55%, 45%, 0.12)` }}
                >
                  <button
                    type="button"
                    onClick={() => router.push(item.route)}
                    className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2 text-left transition-opacity hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/85">{item.title}</p>
                      <p className="text-xs text-white/40">{rowLabel(item)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-white/40">{timeOf(item.created_at)}</span>
                  </button>
                  {button && rev && (
                    <button
                      type="button"
                      disabled={reversal.isPending}
                      onClick={() => reversal.mutate({ reversal: rev, op: button.op, label: button.label })}
                      className={cn("min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium disabled:opacity-40", pending && "animate-pulse")}
                      style={{ color: `hsl(${group.hue}, 72%, 68%)`, border: `1px solid hsla(${group.hue}, 55%, 45%, 0.35)` }}
                    >
                      {button.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Sheet open={calendarOpen} onOpenChange={setCalendarOpen}>
        <SheetContent side="bottom" className={cn("items-center", tc.bgPage)}>
          <SheetHeader>
            <SheetTitle className="sr-only">Pick a day</SheetTitle>
          </SheetHeader>
          <Calendar
            mode="single"
            selected={dateOfDayKey(dayKey)}
            defaultMonth={dateOfDayKey(dayKey)}
            onSelect={(d) => {
              if (!d) return;
              setPicked(formatDate(d));
              setCalendarOpen(false);
            }}
            disabled={(d) => !daySet.has(formatDate(d))}
            modifiers={{ has: (d) => daySet.has(formatDate(d)) }}
            modifiersClassNames={{ has: "font-semibold text-white" }}
            startMonth={days.length ? dateOfDayKey(days[days.length - 1]) : undefined}
            endMonth={new Date()}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
