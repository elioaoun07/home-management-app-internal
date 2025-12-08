"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  differenceInMinutes,
  format,
  getHours,
  getMinutes,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
} from "date-fns";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

interface ScheduleViewProps {
  items: ItemWithDetails[];
}

type DayRange = 1 | 3 | 7;

export function ScheduleView({ items }: ScheduleViewProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [dayRange, setDayRange] = useState<DayRange>(1);

  // Generate array of days to display
  const daysToShow = useMemo(() => {
    const today = startOfDay(new Date());
    const days = [];
    for (let i = 0; i < dayRange; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, [dayRange]);

  // Get items for the selected day range
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const dateStr =
        item.type === "reminder"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;

      if (!dateStr) return false;

      const itemDate = parseISO(dateStr);
      return daysToShow.some((day) => isSameDay(itemDate, day));
    });
  }, [items, daysToShow]);

  // Group items by day
  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, ItemWithDetails[]>();

    daysToShow.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped.set(dayKey, []);
    });

    filteredItems.forEach((item) => {
      const dateStr =
        item.type === "reminder"
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

    // Sort items within each day
    grouped.forEach((dayItems) => {
      dayItems.sort((a, b) => {
        const dateA =
          a.type === "reminder"
            ? a.reminder_details?.due_at
            : a.event_details?.start_at;
        const dateB =
          b.type === "reminder"
            ? b.reminder_details?.due_at
            : b.event_details?.start_at;
        if (!dateA || !dateB) return 0;
        return parseISO(dateA).getTime() - parseISO(dateB).getTime();
      });
    });

    return grouped;
  }, [filteredItems, daysToShow]);

  // Calculate the time range to display (2 hours before first event, 2 hours after last)
  const { startHour, endHour, timeSlots, currentTimePosition } = useMemo(() => {
    const now = new Date();
    const currentHour = getHours(now);
    const currentMinute = getMinutes(now);

    if (filteredItems.length === 0) {
      // Default: show 2 hours before and after current time
      const start = Math.max(0, currentHour - 2);
      const end = Math.min(24, currentHour + 3);
      const slots = [];
      for (let h = start; h <= end; h++) {
        slots.push(h);
      }
      // Current time position as percentage
      const position =
        ((currentHour - start + currentMinute / 60) / (end - start)) * 100;
      return {
        startHour: start,
        endHour: end,
        timeSlots: slots,
        currentTimePosition: position,
      };
    }

    // Find earliest and latest events across all days
    let earliest = 24;
    let latest = 0;

    filteredItems.forEach((item) => {
      const dateStr =
        item.type === "reminder"
          ? item.reminder_details?.due_at
          : item.event_details?.start_at;
      const endStr = item.event_details?.end_at;

      if (dateStr) {
        const startTime = parseISO(dateStr);
        const hour = getHours(startTime);
        earliest = Math.min(earliest, hour);

        if (endStr) {
          const endTime = parseISO(endStr);
          latest = Math.max(latest, getHours(endTime) + 1);
        } else {
          latest = Math.max(latest, hour + 1);
        }
      }
    });

    // Add 2 hour padding
    const start = Math.max(0, earliest - 2);
    const end = Math.min(24, latest + 2);

    const slots = [];
    for (let h = start; h <= end; h++) {
      slots.push(h);
    }

    // Current time position
    const position =
      ((currentHour - start + currentMinute / 60) / (end - start)) * 100;

    return {
      startHour: start,
      endHour: end,
      timeSlots: slots,
      currentTimePosition: Math.max(0, Math.min(100, position)),
    };
  }, [filteredItems]);

  // Calculate position and height for each event
  const getEventStyle = (item: ItemWithDetails) => {
    const dateStr =
      item.type === "reminder"
        ? item.reminder_details?.due_at
        : item.event_details?.start_at;
    const endStr = item.event_details?.end_at;

    if (!dateStr) return { top: "0%", height: "40px" };

    const startTime = parseISO(dateStr);
    const startMinutes =
      (getHours(startTime) - startHour) * 60 + getMinutes(startTime);
    const totalMinutes = (endHour - startHour) * 60;

    let durationMinutes = 60; // Default 1 hour
    if (endStr) {
      const endTime = parseISO(endStr);
      durationMinutes = differenceInMinutes(endTime, startTime);
    }

    const top = (startMinutes / totalMinutes) * 100;
    const height = Math.max((durationMinutes / totalMinutes) * 100, 5); // Min 5%

    return {
      top: `${top}%`,
      height: `${height}%`,
      minHeight: "40px",
    };
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <div className="flex flex-col h-full p-3 pb-32 overflow-hidden">
      {/* Header with Day Range Selector */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2
            className={cn(
              "text-lg font-bold",
              isPink ? "text-pink-300" : "text-cyan-300"
            )}
          >
            {dayRange === 1
              ? format(new Date(), "EEEE")
              : `${format(daysToShow[0], "MMM d")} - ${format(daysToShow[daysToShow.length - 1], "MMM d")}`}
          </h2>
          <p className="text-xs text-white/50">
            {format(new Date(), "MMMM d, yyyy")}
          </p>
        </div>
        <div
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium",
            isPink
              ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
          )}
        >
          {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Day Range Selector */}
      <div className="flex gap-1.5 mb-3 flex-shrink-0">
        {([1, 3, 7] as DayRange[]).map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => setDayRange(range)}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all",
              dayRange === range
                ? isPink
                  ? "bg-pink-500/20 text-pink-400 border border-pink-400/40"
                  : "bg-cyan-500/20 text-cyan-400 border border-cyan-400/40"
                : "bg-white/5 text-white/50 border border-transparent hover:text-white/80"
            )}
          >
            {range} day{range > 1 ? "s" : ""}
          </button>
        ))}
      </div>

      {/* Timeline Container */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex h-full min-h-[400px]">
          {/* Time Labels */}
          <div className="w-14 flex-shrink-0 relative">
            {timeSlots.map((hour, idx) => (
              <div
                key={hour}
                className="absolute left-0 right-0 text-right pr-2"
                style={{
                  top: `${(idx / (timeSlots.length - 1)) * 100}%`,
                  transform: "translateY(-50%)",
                }}
              >
                <span className="text-[10px] font-medium text-white/40">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="flex-1 flex gap-0.5 border-l border-white/10">
            {daysToShow.map((day, dayIndex) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDay.get(dayKey) || [];
              const isDayToday = isToday(day);

              return (
                <div
                  key={dayKey}
                  className="flex-1 relative border-r border-white/5 last:border-r-0"
                >
                  {/* Day header (for multi-day view) */}
                  {dayRange > 1 && (
                    <div
                      className={cn(
                        "sticky top-0 z-30 text-center py-1 border-b border-white/10",
                        isDayToday
                          ? isPink
                            ? "bg-pink-500/10 border-pink-500/20"
                            : "bg-cyan-500/10 border-cyan-500/20"
                          : "bg-bg-dark/95"
                      )}
                    >
                      <p
                        className={cn(
                          "text-[10px] font-medium",
                          isDayToday
                            ? isPink
                              ? "text-pink-400"
                              : "text-cyan-400"
                            : "text-white/60"
                        )}
                      >
                        {format(day, "EEE")}
                      </p>
                      <p
                        className={cn(
                          "text-xs font-bold",
                          isDayToday
                            ? isPink
                              ? "text-pink-300"
                              : "text-cyan-300"
                            : "text-white/80"
                        )}
                      >
                        {format(day, "d")}
                      </p>
                    </div>
                  )}

                  {/* Hour lines */}
                  {timeSlots.map((hour, idx) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{
                        top: `${(idx / (timeSlots.length - 1)) * 100}%`,
                      }}
                    />
                  ))}

                  {/* Current time indicator (only for today) */}
                  {isDayToday &&
                    currentTimePosition >= 0 &&
                    currentTimePosition <= 100 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute left-0 right-0 z-20 flex items-center"
                        style={{ top: `${currentTimePosition}%` }}
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full -ml-1 shadow-lg",
                            isPink
                              ? "bg-pink-500 shadow-pink-500/50"
                              : "bg-cyan-500 shadow-cyan-500/50"
                          )}
                        />
                        <div
                          className={cn(
                            "flex-1 h-0.5",
                            isPink ? "bg-pink-500/60" : "bg-cyan-500/60"
                          )}
                        />
                      </motion.div>
                    )}

                  {/* Events for this day */}
                  <div className="absolute inset-0 px-1">
                    {dayItems.map((item, idx) => {
                      const style = getEventStyle(item);
                      const isReminder = item.type === "reminder";
                      const isEvent = item.type === "event";
                      const dateStr =
                        item.type === "reminder"
                          ? item.reminder_details?.due_at
                          : item.event_details?.start_at;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: dayIndex * 0.1 + idx * 0.05 }}
                          className={cn(
                            "absolute left-1 right-1 rounded-lg p-1.5 overflow-hidden",
                            "border backdrop-blur-sm cursor-pointer",
                            "transition-all hover:scale-105 hover:z-10",
                            dayRange === 1 ? "p-2" : "p-1",
                            isReminder
                              ? "bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border-cyan-500/30"
                              : isEvent
                                ? isPink
                                  ? "bg-gradient-to-r from-pink-500/20 to-pink-500/10 border-pink-500/30"
                                  : "bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border-cyan-500/30"
                                : "bg-gradient-to-r from-purple-500/20 to-purple-500/10 border-purple-500/30"
                          )}
                          style={style}
                        >
                          <div className="flex items-start gap-1.5 h-full">
                            {/* Time indicator */}
                            <div
                              className={cn(
                                "w-1 rounded-full self-stretch flex-shrink-0",
                                isReminder
                                  ? "bg-cyan-400"
                                  : isEvent
                                    ? isPink
                                      ? "bg-pink-400"
                                      : "bg-cyan-400"
                                    : "bg-purple-400"
                              )}
                            />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p
                                className={cn(
                                  "font-semibold text-white truncate",
                                  dayRange === 1 ? "text-xs" : "text-[10px]"
                                )}
                              >
                                {item.title}
                              </p>
                              {dayRange === 1 && dateStr && (
                                <p className="text-[10px] text-white/50 mt-0.5">
                                  {format(parseISO(dateStr), "h:mm a")}
                                  {item.event_details?.end_at &&
                                    ` - ${format(parseISO(item.event_details.end_at), "h:mm a")}`}
                                </p>
                              )}
                              {dayRange === 1 &&
                                item.event_details?.location_text && (
                                  <p className="text-[10px] text-white/40 truncate mt-0.5">
                                    📍 {item.event_details.location_text}
                                  </p>
                                )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Empty state for day */}
                  {dayItems.length === 0 && dayRange === 1 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center",
                            isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                          )}
                        >
                          <span className="text-2xl">📅</span>
                        </div>
                        <p className="text-sm text-white/50">No events today</p>
                        <p className="text-xs text-white/30 mt-1">
                          Your schedule is clear
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {filteredItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-3 border-t border-white/10 flex-shrink-0"
        >
          <div className="flex justify-around text-center">
            <div>
              <p
                className={cn(
                  "text-lg font-bold",
                  isPink ? "text-pink-400" : "text-cyan-400"
                )}
              >
                {filteredItems.filter((i) => i.type === "reminder").length}
              </p>
              <p className="text-[10px] text-white/40">Reminders</p>
            </div>
            <div
              className={cn(
                "w-px",
                isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
              )}
            />
            <div>
              <p
                className={cn(
                  "text-lg font-bold",
                  isPink ? "text-pink-400" : "text-cyan-400"
                )}
              >
                {filteredItems.filter((i) => i.type === "event").length}
              </p>
              <p className="text-[10px] text-white/40">Events</p>
            </div>
            <div
              className={cn(
                "w-px",
                isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
              )}
            />
            <div>
              <p
                className={cn(
                  "text-lg font-bold",
                  isPink ? "text-pink-400" : "text-cyan-400"
                )}
              >
                {filteredItems.filter((i) => i.status === "completed").length}
              </p>
              <p className="text-[10px] text-white/40">Done</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
