"use client";

import { type UserFilter } from "@/components/activity/FilterBar";
import { ChoreCard } from "@/components/chores/ChoreCard";
import { ChoreCheckInPanel } from "@/components/chores/ChoreCheckInPanel";
import { UpNextEmpty, UpNextHero } from "@/components/chores/UpNextHero";
import { useChoreActions } from "@/features/chores/useChoreActions";
import { useChores, useScheduleRoutine } from "@/features/chores/useChores";
import { type FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { groupByTimeOfDay, timeOfDayConfig } from "@/lib/utils/timeOfDay";
import { format, isToday, isTomorrow, parseISO, subWeeks } from "date-fns";
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  RotateCcw,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

interface ChoresTabContentProps {
  userFilter: UserFilter;
  currentUserId: string | undefined;
  showCompleted: boolean;
}

export default function ChoresTabContent({
  userFilter,
  currentUserId,
  showCompleted,
}: ChoresTabContentProps) {
  const tc = useThemeClasses();
  const [referenceDate] = useState(() => new Date());
  const previousReferenceDate = useMemo(
    () => subWeeks(referenceDate, 1),
    [referenceDate],
  );

  const scheduleRoutine = useScheduleRoutine();

  const { scheduled, unscheduled, completed, periodLabel } =
    useChores(referenceDate);
  const { scheduled: previousScheduled } = useChores(previousReferenceDate);

  // ── Ownership filter ────────────────────────────────────────────────────────
  const filterByUser = useCallback(
    (entries: FlexibleRoutineItem[]) => {
      if (userFilter === "all" || !currentUserId) return entries;
      if (userFilter === "mine")
        return entries.filter((e) => e.responsible_user_id === currentUserId);
      // partner = any item NOT assigned to the current user
      return entries.filter(
        (e) => e.responsible_user_id && e.responsible_user_id !== currentUserId,
      );
    },
    [userFilter, currentUserId],
  );

  const visibleScheduled = useMemo(
    () => filterByUser(scheduled),
    [scheduled, filterByUser],
  );
  const visibleUnscheduled = useMemo(
    () => filterByUser(unscheduled),
    [unscheduled, filterByUser],
  );
  const visibleCompleted = useMemo(
    () => (showCompleted ? filterByUser(completed) : []),
    [completed, showCompleted, filterByUser],
  );

  // ── Today entries ───────────────────────────────────────────────────────────
  const todayEntries = useMemo(
    () =>
      visibleScheduled.filter(
        (e) =>
          e.flexibleSchedule?.scheduled_for_date &&
          isToday(parseISO(e.flexibleSchedule.scheduled_for_date)),
      ),
    [visibleScheduled],
  );

  // ── Later this week (non-today scheduled) ───────────────────────────────────
  const laterEntries = useMemo(
    () =>
      visibleScheduled.filter(
        (e) =>
          !e.flexibleSchedule?.scheduled_for_date ||
          !isToday(parseISO(e.flexibleSchedule.scheduled_for_date)),
      ),
    [visibleScheduled],
  );

  // ── Hero = first today entry; rest go into time-of-day groups ───────────────
  const heroEntry = todayEntries[0] ?? null;
  const remainToday = useMemo(() => todayEntries.slice(1), [todayEntries]);

  // ── Time-of-day groups for remaining today ─────────────────────────────────
  const todayGroups = useMemo(() => {
    const getEntryDate = (e: FlexibleRoutineItem) => {
      const dueAt = e.reminder_details?.due_at;
      return dueAt
        ? parseISO(dueAt)
        : new Date(new Date().setHours(0, 0, 0, 0));
    };
    return groupByTimeOfDay(remainToday, getEntryDate);
  }, [remainToday]);

  const allDayOnly =
    todayGroups.length === 1 && todayGroups[0].period === "all-day";

  // ── Day groups for "Later" ──────────────────────────────────────────────────
  const laterByDay = useMemo(() => {
    const map = new Map<
      string,
      { label: string; entries: FlexibleRoutineItem[] }
    >();
    for (const e of laterEntries) {
      const dateStr = e.flexibleSchedule?.scheduled_for_date;
      if (!dateStr) {
        const key = "future";
        if (!map.has(key)) map.set(key, { label: "This week", entries: [] });
        map.get(key)!.entries.push(e);
        continue;
      }
      const d = parseISO(dateStr);
      let label: string;
      if (isTomorrow(d)) {
        label = "Tomorrow";
      } else {
        label = format(d, "EEEE, MMM d");
      }
      if (!map.has(dateStr)) map.set(dateStr, { label, entries: [] });
      map.get(dateStr)!.entries.push(e);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [laterEntries]);

  const handleDoToday = (entry: FlexibleRoutineItem) => {
    scheduleRoutine.mutate({
      itemId: entry.id,
      periodStartDate: entry.periodStart,
      scheduledForDate: format(new Date(), "yyyy-MM-dd"),
      occurrenceIndex: entry.scheduledOccurrences?.length ?? 0,
    });
  };

  const totalDone = completed.length;
  const totalPending = unscheduled.length + scheduled.length;

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-7">
      {/* Period summary */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {periodLabel}
        </span>
        <div className="flex items-center gap-2">
          {totalDone > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              {totalDone} done
            </span>
          )}
          {totalPending > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs font-medium">
              {totalPending} pending
            </span>
          )}
        </div>
      </div>

      <ChoreCheckInPanel entries={previousScheduled} />

      {/* Up Next hero */}
      {heroEntry ? (
        <UpNextHero entry={heroEntry} currentUserId={currentUserId} />
      ) : (
        <UpNextEmpty />
      )}

      {/* Remaining today grouped by time of day */}
      {remainToday.length > 0 && (
        <section className="space-y-2">
          {allDayOnly ? (
            <>
              <SectionHeader
                icon={<ClipboardList className="w-3.5 h-3.5" />}
                label="Today"
              />
              {todayGroups[0].items.map((e) => (
                <ChoreCard
                  key={`${e.id}-${e.flexibleSchedule?.id}`}
                  entry={e}
                  currentUserId={currentUserId}
                />
              ))}
            </>
          ) : (
            todayGroups.map(({ period, items }) => {
              const cfg = timeOfDayConfig[period];
              const Icon = cfg.icon;
              return (
                <div key={period} className="space-y-2">
                  <SectionHeader
                    icon={<Icon className={cn("w-3.5 h-3.5", cfg.color)} />}
                    label={`${cfg.label} · ${items.length}`}
                  />
                  {items.map((e) => (
                    <ChoreCard
                      key={`${e.id}-${e.flexibleSchedule?.id}`}
                      entry={e}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Later this week — grouped by day */}
      {laterByDay.map(({ key, label, entries }) => (
        <section key={key} className="space-y-2">
          <SectionHeader
            icon={<CalendarCheck className="w-3.5 h-3.5" />}
            label={label}
          />
          {entries.map((e) => (
            <ChoreCard
              key={`${e.id}-${e.flexibleSchedule?.id}`}
              entry={e}
              currentUserId={currentUserId}
            />
          ))}
        </section>
      ))}

      {/* Not yet scheduled */}
      {visibleUnscheduled.length > 0 && (
        <section className="space-y-2">
          <SectionHeader
            icon={<CalendarPlus className="w-3.5 h-3.5" />}
            label="Not scheduled yet"
          />
          {visibleUnscheduled.map((entry) => (
            <div
              key={`${entry.id}-unscheduled`}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10",
                tc.surfaceBg,
              )}
            >
              <p
                className={cn("text-sm font-medium truncate", tc.headerText)}
              >
                {entry.title}
              </p>
              <button
                type="button"
                onClick={() => handleDoToday(entry)}
                disabled={scheduleRoutine.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors active:scale-95 flex-shrink-0 disabled:opacity-50"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Do today
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Done this period */}
      {showCompleted && (
        <section className="space-y-2">
          <SectionHeader
            icon={
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />
            }
            label={`Done this period${visibleCompleted.length > 0 ? ` · ${visibleCompleted.length}` : ""}`}
          />
          {visibleCompleted.length === 0 ? (
            <p className="px-1 text-xs text-white/30">
              Nothing completed this period yet
            </p>
          ) : (
            <div className="space-y-2">
              {visibleCompleted.map((entry) => (
                <CompletedChoreRow key={`${entry.id}-done`} entry={entry} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {visibleScheduled.length === 0 &&
        visibleUnscheduled.length === 0 &&
        visibleCompleted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400/40" />
            <p className={cn("text-sm font-medium", tc.headerText)}>
              {userFilter === "all"
                ? "No chores this week"
                : userFilter === "mine"
                  ? "Nothing assigned to you"
                  : "Nothing assigned to partner"}
            </p>
            <p className="text-xs text-white/30">
              Mark catalogue items as chores to see them here
            </p>
          </div>
        )}
    </div>
  );
}

function CompletedChoreRow({ entry }: { entry: FlexibleRoutineItem }) {
  const tc = useThemeClasses();
  const choreActions = useChoreActions(entry);
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 opacity-60 hover:opacity-80 transition-opacity cursor-pointer group",
        tc.surfaceBg,
      )}
      role="button"
      tabIndex={0}
      onClick={() => choreActions.reopen()}
      onKeyDown={(e) => e.key === "Enter" && choreActions.reopen()}
      title="Tap to reopen"
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <p
        className={cn(
          "text-sm truncate line-through flex-1",
          tc.headerTextMuted,
        )}
      >
        {entry.title}
      </p>
      <RotateCcw className="w-3.5 h-3.5 text-white/30 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function SectionHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
      {icon}
      {label}
    </h3>
  );
}
