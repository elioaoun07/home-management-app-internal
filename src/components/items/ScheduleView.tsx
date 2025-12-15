"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
} from "@/features/items/useItemActions";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

interface ScheduleViewProps {
  items: ItemWithDetails[];
}

type DayRange = 1 | 3 | 7;

// Priority sphere styles
const prioritySphereStyles = {
  low: {
    background:
      "radial-gradient(circle at 30% 30%, #9ca3af, #4b5563 60%, #374151)",
    shadow: "0 2px 6px rgba(156,163,175,0.3)",
  },
  normal: {
    background:
      "radial-gradient(circle at 30% 30%, #67e8f9, #22d3ee 40%, #0891b2)",
    shadow: "0 2px 6px rgba(34,211,238,0.4)",
  },
  high: {
    background:
      "radial-gradient(circle at 30% 30%, #fdba74, #fb923c 40%, #ea580c)",
    shadow: "0 2px 6px rgba(251,146,60,0.4)",
  },
  urgent: {
    background:
      "radial-gradient(circle at 30% 30%, #fca5a5, #f87171 40%, #dc2626)",
    shadow: "0 2px 6px rgba(248,113,113,0.5)",
  },
};

export function ScheduleView({ items }: ScheduleViewProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [dayRange, setDayRange] = useState<DayRange>(7);
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  // Generate array of days to display
  const daysToShow = useMemo(() => {
    const today = startOfDay(new Date());
    const days = [];
    for (let i = 0; i < dayRange; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, [dayRange]);

  // Get items for the selected day range (exclude archived and check occurrence actions)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Skip archived items
      if (item.status === "archived") return false;

      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;

      if (!dateStr) return false;

      const itemDate = parseISO(dateStr);

      // Check if item is in the day range
      const isInRange = daysToShow.some((day) => isSameDay(itemDate, day));
      if (!isInRange) return false;

      // For recurring items, check if this occurrence was completed/cancelled
      const isRecurring = !!item.recurrence_rule?.rrule;
      if (
        isRecurring &&
        isOccurrenceCompleted(item.id, itemDate, occurrenceActions)
      ) {
        return false;
      }

      // For non-recurring completed items, don't show
      if (item.status === "completed") return false;

      return true;
    });
  }, [items, daysToShow, occurrenceActions]);

  // Group items by day
  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, ItemWithDetails[]>();

    daysToShow.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped.set(dayKey, []);
    });

    filteredItems.forEach((item) => {
      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.event_details?.start_at;

      if (dateStr) {
        const itemDate = parseISO(dateStr);
        const dayKey = format(itemDate, "yyyy-MM-dd");
        const dayItems = grouped.get(dayKey);
        if (dayItems) {
          dayItems.push(item);
        }
      }
    });

    // Sort items within each day by time
    grouped.forEach((dayItems) => {
      dayItems.sort((a, b) => {
        const dateA =
          a.type === "reminder" || a.type === "task"
            ? a.reminder_details?.due_at
            : a.event_details?.start_at;
        const dateB =
          b.type === "reminder" || b.type === "task"
            ? b.reminder_details?.due_at
            : b.event_details?.start_at;
        if (!dateA || !dateB) return 0;
        return parseISO(dateA).getTime() - parseISO(dateB).getTime();
      });
    });

    return grouped;
  }, [filteredItems, daysToShow]);

  // Get day label
  const getDayLabel = (day: Date) => {
    if (isToday(day)) return "Today";
    if (isTomorrow(day)) return "Tomorrow";
    return format(day, "EEEE");
  };

  return (
    <div className="flex flex-col h-full pb-32 overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div>
          <h2
            className={cn(
              "text-sm font-semibold",
              isPink ? "text-pink-300" : "text-cyan-300"
            )}
          >
            {dayRange === 1 ? "Today" : dayRange === 3 ? "3 Days" : "This Week"}
          </h2>
          <p className="text-[10px] text-white/40">
            {filteredItems.length}{" "}
            {filteredItems.length === 1 ? "item" : "items"}
          </p>
        </div>
        {/* Day range selector */}
        <div className="flex bg-white/5 rounded-lg p-0.5">
          {([1, 3, 7] as DayRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDayRange(range)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                dayRange === range
                  ? isPink
                    ? "bg-pink-500/30 text-pink-300"
                    : "bg-cyan-500/30 text-cyan-300"
                  : "text-white/40 hover:text-white/60"
              )}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {/* Days List - Vertical scrolling card-based layout */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {daysToShow.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay.get(dayKey) || [];
          const isDayToday = isToday(day);

          return (
            <div key={dayKey}>
              {/* Day Header */}
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex flex-col items-center justify-center text-center",
                    isDayToday
                      ? isPink
                        ? "bg-pink-500/20 border border-pink-500/30"
                        : "bg-cyan-500/20 border border-cyan-500/30"
                      : "bg-white/5"
                  )}
                >
                  <span
                    className={cn(
                      "text-[9px] font-medium uppercase leading-none",
                      isDayToday
                        ? isPink
                          ? "text-pink-400"
                          : "text-cyan-400"
                        : "text-white/40"
                    )}
                  >
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold leading-none mt-0.5",
                      isDayToday
                        ? isPink
                          ? "text-pink-300"
                          : "text-cyan-300"
                        : "text-white/70"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="flex-1">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isDayToday
                        ? isPink
                          ? "text-pink-300"
                          : "text-cyan-300"
                        : "text-white/60"
                    )}
                  >
                    {getDayLabel(day)}
                  </span>
                  {dayItems.length > 0 && (
                    <span className="text-[10px] text-white/30 ml-2">
                      • {dayItems.length}{" "}
                      {dayItems.length === 1 ? "item" : "items"}
                    </span>
                  )}
                </div>
              </div>

              {/* Items for this day */}
              {dayItems.length > 0 ? (
                <div className="space-y-1.5 ml-11">
                  <AnimatePresence>
                    {dayItems.map((item, idx) => {
                      const isReminder = item.type === "reminder";
                      const isEvent = item.type === "event";
                      const isTask = item.type === "task";
                      const dateStr =
                        isReminder || isTask
                          ? item.reminder_details?.due_at
                          : item.event_details?.start_at;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ delay: idx * 0.03 }}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl cursor-pointer",
                            "bg-white/5 hover:bg-white/10 transition-all",
                            "border-l-[3px]",
                            isReminder
                              ? "border-l-cyan-400"
                              : isEvent
                                ? isPink
                                  ? "border-l-pink-400"
                                  : "border-l-emerald-400"
                                : "border-l-purple-400"
                          )}
                        >
                          {/* Time */}
                          <span className="text-[11px] text-white/40 w-14 flex-shrink-0 font-medium">
                            {dateStr ? format(parseISO(dateStr), "h:mm a") : ""}
                          </span>

                          {/* Title & Location */}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white truncate font-medium block">
                              {item.title}
                            </span>
                            {isEvent && item.event_details?.location_text && (
                              <span className="text-[10px] text-white/30 truncate block mt-0.5">
                                📍 {item.event_details.location_text}
                              </span>
                            )}
                          </div>

                          {/* Priority sphere (high/urgent only) */}
                          {(item.priority === "high" ||
                            item.priority === "urgent") && (
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{
                                background:
                                  prioritySphereStyles[item.priority]
                                    .background,
                                boxShadow:
                                  prioritySphereStyles[item.priority].shadow,
                              }}
                            />
                          )}

                          {/* Type indicator */}
                          <span className="text-[10px]">
                            {isReminder ? "🔔" : isEvent ? "📅" : "✓"}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="ml-11 py-1.5">
                  <span className="text-[10px] text-white/20 italic">
                    No scheduled items
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state if no items at all */}
        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                isPink ? "bg-pink-500/10" : "bg-cyan-500/10"
              )}
            >
              <span className="text-3xl">📅</span>
            </div>
            <p className="text-sm text-white/50 font-medium">All clear!</p>
            <p className="text-[11px] text-white/30 mt-1">
              No items scheduled for{" "}
              {dayRange === 1 ? "today" : `the next ${dayRange} days`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
