"use client";

import { ChoreCard } from "@/components/chores/ChoreCard";
import {
  useScheduleRoutine,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { format, isToday, parseISO } from "date-fns";
import { CalendarPlus, CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import { useMemo } from "react";

interface ChoreGroupListProps {
  scheduled: FlexibleRoutineItem[];
  unscheduled: FlexibleRoutineItem[];
  completed: FlexibleRoutineItem[];
  periodStart: Date;
  currentUserId?: string;
  onTransferPartner?: (item: FlexibleRoutineItem) => void;
}

export function ChoreGroupList({
  scheduled,
  unscheduled,
  completed,
  periodStart,
  currentUserId,
  onTransferPartner,
}: ChoreGroupListProps) {
  const tc = useThemeClasses();
  const scheduleRoutine = useScheduleRoutine();

  const today = useMemo(() => new Date(), []);
  const { todayScheduled, thisWeekScheduled } = useMemo(() => ({
    todayScheduled: scheduled.filter(
      (e) =>
        e.flexibleSchedule?.scheduled_for_date &&
        isToday(parseISO(e.flexibleSchedule.scheduled_for_date)),
    ),
    thisWeekScheduled: scheduled.filter(
      (e) =>
        !e.flexibleSchedule?.scheduled_for_date ||
        !isToday(parseISO(e.flexibleSchedule.scheduled_for_date)),
    ),
  }), [scheduled]);

  const handleDoToday = (entry: FlexibleRoutineItem) => {
    scheduleRoutine.mutate({
      itemId: entry.id,
      periodStartDate: entry.periodStart,
      scheduledForDate: format(today, "yyyy-MM-dd"),
      occurrenceIndex: entry.scheduledOccurrences?.length ?? 0,
    });
  };

  const isEmpty =
    unscheduled.length === 0 &&
    scheduled.length === 0 &&
    completed.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Sparkles className="w-10 h-10 text-emerald-400/60" />
        <p className={cn("text-sm font-medium", tc.headerText)}>
          All clear for this period
        </p>
        <p className="text-xs text-white/40">
          Mark catalogue items as chores to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Not scheduled yet */}
      {unscheduled.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            <CalendarPlus className="w-3.5 h-3.5" />
            Not scheduled yet
          </h3>
          <div className="space-y-2">
            {unscheduled.map((entry) => (
              <div
                key={`${entry.id}-unscheduled`}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10",
                  tc.surfaceBg,
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl leading-none">✨</span>
                  <p className={cn("text-sm font-medium truncate", tc.headerText)}>
                    {entry.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDoToday(entry)}
                  disabled={scheduleRoutine.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors active:scale-95 flex-shrink-0 disabled:opacity-50"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Do it today
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today */}
      {todayScheduled.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            <ClipboardList className="w-3.5 h-3.5" />
            Today
          </h3>
          <div className="space-y-2">
            {todayScheduled.map((entry) => (
              <ChoreCard
                key={`${entry.id}-${entry.flexibleSchedule?.id}`}
                entry={entry}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </section>
      )}

      {/* This week */}
      {thisWeekScheduled.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            <ClipboardList className="w-3.5 h-3.5" />
            This week
          </h3>
          <div className="space-y-2">
            {thisWeekScheduled.map((entry) => (
              <ChoreCard
                key={`${entry.id}-${entry.flexibleSchedule?.id}`}
                entry={entry}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Done this period */}
      {completed.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/60" />
            Done this period
          </h3>
          <div className="space-y-2 opacity-60">
            {completed.map((entry) => (
              <div
                key={`${entry.id}-done`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20",
                  tc.surfaceBg,
                )}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className={cn("text-sm truncate line-through", tc.headerTextMuted)}>
                  {entry.title}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
