"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  useFlexibleRoutines,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { useBriefingTTS } from "@/hooks/useBriefingTTS";
import { cn } from "@/lib/utils";
import {
  adjustOccurrenceToWallClock,
  getOccurrencesInRange,
} from "@/lib/utils/date";
import type { ItemType, ItemWithDetails } from "@/types/items";
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  AlertCircle,
  Bell,
  Calendar,
  ListTodo,
  Loader2,
  Moon,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

interface ExpandedOccurrence {
  item: ItemWithDetails;
  occurrenceDate: Date;
  isCompleted: boolean;
  isPostponed?: boolean;
  originalDate?: Date;
}

interface BriefingBullet {
  text: string;
  sub?: string;
  type?: "now" | "next" | "warn" | "default";
}

const typeIcons: Record<ItemType, typeof Calendar> = {
  reminder: Bell,
  event: Calendar,
  task: ListTodo,
};

function getGreeting(hour: number): { icon: ReactNode; text: string } {
  if (hour < 5)
    return {
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      text: "Working late?",
    };
  if (hour < 12)
    return {
      icon: <Sun className="w-4 h-4 text-yellow-400" />,
      text: "Good morning",
    };
  if (hour < 17)
    return {
      icon: <Sun className="w-4 h-4 text-orange-400" />,
      text: "Good afternoon",
    };
  if (hour < 21)
    return {
      icon: <Moon className="w-4 h-4 text-purple-400" />,
      text: "Good evening",
    };
  return {
    icon: <Moon className="w-4 h-4 text-indigo-400" />,
    text: "Winding down",
  };
}

function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
}

function expandRecurringItems(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
  actions: ItemOccurrenceAction[],
  scheduledFlexible: FlexibleRoutineItem[] = [],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    // Flexible items are placed via item_flexible_schedules — handled below
    if (item.recurrence_rule?.is_flexible) continue;

    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const occurrences = getOccurrencesInRange(
          item.recurrence_rule,
          itemDate,
          startDate,
          endDate,
        );
        for (const occ of occurrences) {
          const adjusted = adjustOccurrenceToWallClock(occ, itemDate);
          const isCompleted = isOccurrenceCompleted(item.id, occ, actions);
          result.push({ item, occurrenceDate: adjusted, isCompleted });
        }
      } catch (error) {
        console.error("Error parsing RRULE:", error);
      }
    } else if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
      const isCompleted =
        item.status === "completed" ||
        isOccurrenceCompleted(item.id, itemDate, actions);
      result.push({ item, occurrenceDate: itemDate, isCompleted });
    }
  }

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayPostponed = getPostponedOccurrencesForDate(
      items,
      currentDate,
      actions,
    );
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) =>
          r.item.id === p.item.id &&
          isSameDay(r.occurrenceDate, p.occurrenceDate),
      );
      if (!alreadyExists) {
        result.push({
          item: p.item,
          occurrenceDate: p.occurrenceDate,
          isCompleted: false,
          isPostponed: true,
          originalDate: p.originalDate,
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  // Inject scheduled flexible routines (source of truth: item_flexible_schedules)
  for (const si of scheduledFlexible) {
    const sched = si.flexibleSchedule;
    if (!sched?.scheduled_for_date) continue;
    let schedDate: Date;
    try {
      schedDate = parseISO(sched.scheduled_for_date);
    } catch {
      continue;
    }
    if (!isWithinInterval(schedDate, { start: startDate, end: endDate }))
      continue;

    const [hh, mm] = (sched.scheduled_for_time ?? "09:00")
      .split(":")
      .map((n) => parseInt(n, 10));
    const occurrenceDate = new Date(schedDate);
    occurrenceDate.setHours(hh || 9, mm || 0, 0, 0);

    const isCompleted = si.isCompletedForCurrentPeriod;
    if (
      result.some(
        (r) =>
          r.item.id === si.id && isSameDay(r.occurrenceDate, occurrenceDate),
      )
    ) {
      continue;
    }
    result.push({ item: si, occurrenceDate, isCompleted });
  }

  return result.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
  );
}

export default function WebTodayView() {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const tts = useBriefingTTS();

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  const today = startOfDay(new Date());

  const activeItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          item.status !== "archived" &&
          item.status !== "cancelled" &&
          !item.archived_at,
      ),
    [allItems],
  );

  const { data: flexibleRoutines } = useFlexibleRoutines(
    activeItems,
    occurrenceActions,
    today,
  );
  const scheduledFlexible = flexibleRoutines?.scheduled ?? [];

  const { todayTasks, overdueTasks } = useMemo(() => {
    const todayEnd = addDays(today, 1);

    const todayOccs = expandRecurringItems(
      activeItems,
      today,
      todayEnd,
      occurrenceActions,
      scheduledFlexible,
    )
      .filter((o) => !o.isCompleted)
      .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());

    const pastStart = addDays(today, -30);
    const allPastOccs = expandRecurringItems(
      activeItems,
      pastStart,
      todayEnd,
      occurrenceActions,
      scheduledFlexible,
    );
    const overdueOccs = allPastOccs.filter(
      (occ) => isBefore(occ.occurrenceDate, currentTime) && !occ.isCompleted,
    );

    return { todayTasks: todayOccs, overdueTasks: overdueOccs };
  }, [activeItems, occurrenceActions, today, currentTime, scheduledFlexible]);

  const currentHour = currentTime.getHours();
  const greeting = useMemo(() => getGreeting(currentHour), [currentHour]);

  const { nowTask, nextTask } = useMemo(() => {
    let nowTask: ExpandedOccurrence | null = null;
    let nextTask: ExpandedOccurrence | null = null;

    for (let i = 0; i < todayTasks.length; i++) {
      const task = todayTasks[i];
      const taskTime = task.occurrenceDate.getTime();
      const nowTime = currentTime.getTime();

      if (taskTime <= nowTime && taskTime >= nowTime - 30 * 60 * 1000) {
        nowTask = task;
        nextTask = todayTasks[i + 1] || null;
        break;
      }
      if (taskTime > nowTime) {
        if (i === 0) {
          nextTask = task;
        } else {
          nowTask = todayTasks[i - 1];
          nextTask = task;
        }
        break;
      }
    }

    if (!nowTask && !nextTask && todayTasks.length > 0) {
      nowTask = todayTasks[todayTasks.length - 1];
    }

    return { nowTask, nextTask };
  }, [todayTasks, currentTime]);

  // Visual bullet points — one per today item, with time and NOW/NEXT markers
  const briefingBullets = useMemo((): BriefingBullet[] => {
    const bullets: BriefingBullet[] = [];

    if (todayTasks.length === 0) {
      bullets.push({ text: "Your schedule is clear today" });
    } else {
      for (const occ of todayTasks) {
        const isNow =
          nowTask?.item.id === occ.item.id &&
          nowTask?.occurrenceDate.getTime() === occ.occurrenceDate.getTime();
        const isNext =
          !isNow &&
          nextTask?.item.id === occ.item.id &&
          nextTask?.occurrenceDate.getTime() === occ.occurrenceDate.getTime();

        let sub = format(occ.occurrenceDate, "h:mm a");
        let type: BriefingBullet["type"] = "default";

        if (isNow) {
          sub = `${format(occ.occurrenceDate, "h:mm a")} · Now`;
          type = "now";
        } else if (isNext) {
          const timeUntil = Math.round(
            (occ.occurrenceDate.getTime() - currentTime.getTime()) /
              (1000 * 60),
          );
          sub =
            timeUntil <= 60
              ? `${format(occ.occurrenceDate, "h:mm a")} · in ${timeUntil} min`
              : format(occ.occurrenceDate, "h:mm a");
          type = "next";
        }

        bullets.push({ text: occ.item.title, sub, type });
      }
    }

    if (overdueTasks.length > 0) {
      bullets.push({
        text: `${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "item" : "items"} need attention`,
        type: "warn",
      });
    }

    return bullets;
  }, [todayTasks, currentTime, nowTask, nextTask, overdueTasks]);

  // Natural prose narrative for TTS — reads every today item by name and time
  const narrative = useMemo(() => {
    const timeStr = format(currentTime, "h:mm a");
    const dateStr = format(today, "EEEE, MMMM do");
    const total = todayTasks.length;

    let text = `It's ${timeStr} on ${dateStr}. `;

    if (total === 0) {
      text += "Your schedule is clear today. Enjoy your free time.";
    } else {
      text += `You have ${total} ${total === 1 ? "item" : "items"} today. `;
      todayTasks.forEach((occ, idx) => {
        const t = format(occ.occurrenceDate, "h:mm a");
        const isLast = idx === total - 1;
        text += `${occ.item.title} at ${t}${isLast ? "." : ", "}`;
      });
    }

    if (overdueTasks.length > 0) {
      text += ` You also have ${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "item" : "items"} that need attention.`;
    }

    return text;
  }, [currentTime, today, todayTasks, overdueTasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isFrost ? "bg-indigo-400" : isPink ? "bg-pink-400" : "bg-cyan-400",
          )}
        />
      </div>
    );
  }

  const bulletDot: Record<NonNullable<BriefingBullet["type"]>, string> = {
    now: "bg-emerald-400",
    next: "bg-blue-400",
    warn: "bg-amber-400",
    default: isFrost ? "bg-slate-300" : "bg-white/20",
  };

  const bulletSub: Record<NonNullable<BriefingBullet["type"]>, string> = {
    now: isFrost ? "text-emerald-600" : "text-emerald-400",
    next: isFrost ? "text-blue-600" : "text-blue-400",
    warn: isFrost ? "text-amber-600" : "text-amber-400",
    default: isFrost ? "text-slate-400" : "text-white/40",
  };

  // Kanban periods
  const periods = [
    {
      label: "Morning",
      sub: "before noon",
      icon: <Sun className="w-3.5 h-3.5" />,
      items: todayTasks.filter((t) => t.occurrenceDate.getHours() < 12),
      accentBorder: isFrost ? "border-t-amber-400" : "border-t-amber-500/70",
      headerText: isFrost ? "text-amber-600" : "text-amber-400",
      headerBg: isFrost ? "bg-amber-50/80" : "bg-amber-500/5",
      countBadge: isFrost
        ? "bg-amber-100 text-amber-700"
        : "bg-amber-500/20 text-amber-300",
    },
    {
      label: "Afternoon",
      sub: "noon – 5 PM",
      icon: <Sun className="w-3.5 h-3.5" />,
      items: todayTasks.filter((t) => {
        const h = t.occurrenceDate.getHours();
        return h >= 12 && h < 17;
      }),
      accentBorder: isFrost ? "border-t-sky-400" : "border-t-sky-500/70",
      headerText: isFrost ? "text-sky-600" : "text-sky-400",
      headerBg: isFrost ? "bg-sky-50/80" : "bg-sky-500/5",
      countBadge: isFrost
        ? "bg-sky-100 text-sky-700"
        : "bg-sky-500/20 text-sky-300",
    },
    {
      label: "Evening",
      sub: "after 5 PM",
      icon: <Moon className="w-3.5 h-3.5" />,
      items: todayTasks.filter((t) => t.occurrenceDate.getHours() >= 17),
      accentBorder: isFrost ? "border-t-indigo-400" : "border-t-indigo-500/70",
      headerText: isFrost ? "text-indigo-600" : "text-indigo-400",
      headerBg: isFrost ? "bg-indigo-50/80" : "bg-indigo-500/5",
      countBadge: isFrost
        ? "bg-indigo-100 text-indigo-700"
        : "bg-indigo-500/20 text-indigo-300",
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact header */}
      <div
        className={cn(
          "flex-shrink-0 px-4 py-2 flex items-center justify-between",
          isFrost
            ? "border-b border-slate-100"
            : "border-b border-white/[0.04]",
        )}
      >
        <p
          className={cn(
            "text-xs font-medium",
            isFrost ? "text-slate-500" : "text-white/50",
          )}
        >
          {format(today, "EEEE, MMMM d")}
        </p>
        {overdueTasks.length > 0 && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
              isFrost
                ? "bg-amber-50 text-amber-600"
                : "bg-amber-500/10 text-amber-400",
            )}
          >
            <AlertCircle className="w-3 h-3" />
            {overdueTasks.length} overdue
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Live clock + greeting */}
        <div>
          <p
            className={cn(
              "text-4xl font-light tabular-nums tracking-tight",
              isFrost ? "text-slate-800" : "text-white",
            )}
          >
            {format(currentTime, "h:mm")}
            <span
              className={cn(
                "text-xl ml-1.5",
                isFrost ? "text-slate-400" : "text-white/40",
              )}
            >
              {format(currentTime, "a")}
            </span>
          </p>
          <p
            className={cn(
              "flex items-center gap-1.5 text-sm mt-1",
              isFrost ? "text-slate-500" : "text-white/50",
            )}
          >
            {greeting.icon}
            {greeting.text}
          </p>
        </div>

        {/* Personal Briefing — bullet points, TTS reads natural prose */}
        <div
          className={cn(
            "rounded-2xl p-5",
            isFrost
              ? "bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-slate-100"
              : "bg-gradient-to-br from-white/[0.03] to-cyan-500/[0.03] border border-white/[0.06]",
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isFrost
                    ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
                    : isPink
                      ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white"
                      : "bg-gradient-to-br from-cyan-500 to-blue-500 text-white",
                )}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <span
                className={cn(
                  "text-sm font-semibold",
                  isFrost ? "text-slate-700" : "text-white/90",
                )}
              >
                Your Briefing
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                tts.isPlaying || tts.isLoading
                  ? tts.stop()
                  : tts.play(narrative)
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tts.isPlaying || tts.isLoading
                  ? isFrost
                    ? "bg-indigo-100 text-indigo-600"
                    : isPink
                      ? "bg-pink-500/20 text-pink-400"
                      : "bg-cyan-500/20 text-cyan-400"
                  : isFrost
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]",
              )}
            >
              {tts.isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : tts.isPlaying ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>

          <ul className="space-y-3">
            {briefingBullets.map((bullet, idx) => {
              const type = bullet.type ?? "default";
              return (
                <li key={idx} className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0",
                      bulletDot[type],
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium leading-snug",
                        isFrost ? "text-slate-700" : "text-white/90",
                      )}
                    >
                      {bullet.text}
                    </p>
                    {bullet.sub && (
                      <p className={cn("text-xs mt-0.5", bulletSub[type])}>
                        {bullet.sub}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Today's Kanban — grouped by time of day */}
        {todayTasks.length > 0 && (
          <div>
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-wider mb-3",
                isFrost ? "text-slate-400" : "text-white/30",
              )}
            >
              Today
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {periods.map(
                ({
                  label,
                  sub,
                  icon,
                  items,
                  accentBorder,
                  headerText,
                  headerBg,
                  countBadge,
                }) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-xl overflow-hidden border-t-2",
                      accentBorder,
                      isFrost
                        ? "bg-slate-50/60 border border-slate-100"
                        : "bg-white/[0.02] border border-white/[0.05]",
                    )}
                  >
                    {/* Column header */}
                    <div
                      className={cn(
                        "px-3 py-2.5 flex items-center justify-between",
                        headerBg,
                        isFrost
                          ? "border-b border-slate-100"
                          : "border-b border-white/[0.05]",
                      )}
                    >
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-semibold",
                            headerText,
                          )}
                        >
                          {icon}
                          {label}
                        </div>
                        <p
                          className={cn(
                            "text-[10px] mt-0.5",
                            isFrost ? "text-slate-400" : "text-white/30",
                          )}
                        >
                          {sub}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
                          items.length > 0
                            ? countBadge
                            : isFrost
                              ? "bg-slate-100 text-slate-400"
                              : "bg-white/5 text-white/20",
                        )}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="p-2 space-y-2 min-h-[72px]">
                      {items.length === 0 ? (
                        <p
                          className={cn(
                            "text-[11px] text-center py-5",
                            isFrost ? "text-slate-300" : "text-white/15",
                          )}
                        >
                          Clear
                        </p>
                      ) : (
                        items.map((occ, idx) => {
                          const { item, occurrenceDate } = occ;
                          const Icon = typeIcons[item.type];
                          const isPast = isBefore(occurrenceDate, currentTime);
                          const isNow =
                            nowTask?.item.id === item.id &&
                            nowTask?.occurrenceDate.getTime() ===
                              occurrenceDate.getTime();
                          const isNext =
                            !isNow &&
                            nextTask?.item.id === item.id &&
                            nextTask?.occurrenceDate.getTime() ===
                              occurrenceDate.getTime();

                          return (
                            <div
                              key={`${item.id}-${idx}`}
                              className={cn(
                                "rounded-lg p-2.5 border transition-opacity",
                                isFrost
                                  ? "bg-white border-slate-200 shadow-sm"
                                  : "bg-white/[0.04] border-white/[0.08]",
                                isPast && !isNow && "opacity-35",
                              )}
                            >
                              {/* Card top row: time + badges + icon */}
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <span
                                  className={cn(
                                    "text-[10px] font-medium tabular-nums",
                                    isFrost
                                      ? "text-slate-400"
                                      : "text-white/50",
                                  )}
                                >
                                  {format(occurrenceDate, "h:mm a")}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isNow && (
                                    <span
                                      className={cn(
                                        "text-[9px] font-bold px-1 py-0.5 rounded-full",
                                        isFrost
                                          ? "bg-emerald-100 text-emerald-600"
                                          : "bg-emerald-500/20 text-emerald-400",
                                      )}
                                    >
                                      NOW
                                    </span>
                                  )}
                                  {isNext && (
                                    <span
                                      className={cn(
                                        "text-[9px] font-bold px-1 py-0.5 rounded-full",
                                        isFrost
                                          ? "bg-blue-100 text-blue-600"
                                          : "bg-blue-500/20 text-blue-400",
                                      )}
                                    >
                                      NEXT
                                    </span>
                                  )}
                                  <div
                                    className={cn(
                                      "w-5 h-5 rounded flex items-center justify-center",
                                      item.type === "event" &&
                                        (isFrost
                                          ? "bg-pink-50 text-pink-400"
                                          : "bg-pink-500/10 text-pink-400"),
                                      item.type === "reminder" &&
                                        (isFrost
                                          ? "bg-cyan-50 text-cyan-400"
                                          : "bg-cyan-500/10 text-cyan-400"),
                                      item.type === "task" &&
                                        (isFrost
                                          ? "bg-purple-50 text-purple-400"
                                          : "bg-purple-500/10 text-purple-400"),
                                    )}
                                  >
                                    <Icon className="w-3 h-3" />
                                  </div>
                                </div>
                              </div>

                              {/* Card title */}
                              <p
                                className={cn(
                                  "text-xs font-medium leading-snug line-clamp-2",
                                  isFrost ? "text-slate-700" : "text-white/90",
                                )}
                              >
                                {item.title}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {todayTasks.length === 0 && (
          <div
            className={cn(
              "text-center py-12 rounded-xl",
              isFrost
                ? "bg-white border border-slate-100"
                : "bg-white/[0.02] border border-white/[0.06]",
            )}
          >
            <div
              className={cn(
                "w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center",
                isFrost
                  ? "bg-slate-100 text-slate-300"
                  : "bg-white/5 text-white/15",
              )}
            >
              <Calendar className="w-7 h-7" />
            </div>
            <p
              className={cn(
                "text-sm font-medium",
                isFrost ? "text-slate-500" : "text-white/50",
              )}
            >
              Nothing scheduled today
            </p>
            <p
              className={cn(
                "text-xs mt-1",
                isFrost ? "text-slate-400" : "text-white/30",
              )}
            >
              Enjoy your free time
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
