"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { getBirthdayDisplayName, getBirthdaysForDate } from "@/data/birthdays";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { type SubtaskCompletion } from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Cake,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RRule } from "rrule";

interface WebWeekViewProps {
  items: ItemWithDetails[];
  occurrenceActions?: ItemOccurrenceAction[];
  subtaskCompletions?: SubtaskCompletion[];
  onItemClick?: (
    item: ItemWithDetails,
    event: React.MouseEvent,
    occurrenceDate?: Date
  ) => void;
  onAddEvent?: (date: Date) => void;
  onBirthdayClick?: (
    birthday: { name: string; category?: string },
    date: Date
  ) => void;
  selectedDate?: Date | null;
  showBirthdays?: boolean;
}

// Item type colors with gradients for more visual appeal
const typeColors: Record<
  string,
  {
    bg: string;
    gradient: string;
    border: string;
    text: string;
    icon: typeof Calendar;
  }
> = {
  reminder: {
    bg: "bg-gradient-to-br from-cyan-500/90 to-blue-600/90",
    gradient: "from-cyan-400 to-blue-500",
    border: "border-l-cyan-400",
    text: "text-white",
    icon: Bell,
  },
  event: {
    bg: "bg-gradient-to-br from-pink-500/90 to-purple-600/90",
    gradient: "from-pink-400 to-purple-500",
    border: "border-l-pink-400",
    text: "text-white",
    icon: Calendar,
  },
  task: {
    bg: "bg-gradient-to-br from-purple-500/90 to-indigo-600/90",
    gradient: "from-purple-400 to-indigo-500",
    border: "border-l-purple-400",
    text: "text-white",
    icon: ListTodo,
  },
};

// Build a full RRULE string including COUNT and UNTIL from recurrence_rule
function buildFullRRuleString(
  dtstart: Date,
  recurrenceRule: {
    rrule: string;
    count?: number | null;
    end_until?: string | null;
  }
): string {
  let rrulePart = recurrenceRule.rrule;

  // Add COUNT if specified
  if (recurrenceRule.count && !rrulePart.includes("COUNT=")) {
    rrulePart += `;COUNT=${recurrenceRule.count}`;
  }

  // Add UNTIL if specified (and no COUNT)
  if (
    recurrenceRule.end_until &&
    !recurrenceRule.count &&
    !rrulePart.includes("UNTIL=")
  ) {
    const untilDate = parseISO(recurrenceRule.end_until);
    const untilStr =
      untilDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    rrulePart += `;UNTIL=${untilStr}`;
  }

  return `DTSTART:${dtstart.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nRRULE:${rrulePart}`;
}

export function WebWeekView({
  items,
  occurrenceActions = [],
  subtaskCompletions = [],
  onItemClick,
  onAddEvent,
  onBirthdayClick,
  selectedDate,
  showBirthdays = true,
}: WebWeekViewProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [currentWeek, setCurrentWeek] = useState(selectedDate || new Date());
  const [direction, setDirection] = useState(0);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Hours to display (6 AM to 12 AM) - 18 time slots showing ranges
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  /**
   * Get the actual occurrence datetime for an item on a specific date
   */
  const getOccurrenceDateTimeForItem = (
    item: ItemWithDetails,
    calendarDate: Date
  ): Date => {
    const dateStr =
      item.event_details?.start_at || item.reminder_details?.due_at;

    if (!dateStr) return calendarDate;

    const itemDate = parseISO(dateStr);

    // For recurring items, find the specific occurrence on this date
    if (item.recurrence_rule?.rrule) {
      try {
        const rruleString = buildFullRRuleString(
          itemDate,
          item.recurrence_rule
        );
        const rule = RRule.fromString(rruleString);

        const dayStart = new Date(calendarDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(calendarDate);
        dayEnd.setHours(23, 59, 59, 999);

        const occurrences = rule.between(dayStart, dayEnd, true);
        if (occurrences.length > 0) {
          return occurrences[0];
        }
      } catch (error) {
        console.error("Error getting occurrence datetime:", error);
      }
    }

    // For non-recurring, use the calendar date with the item's time
    const result = new Date(calendarDate);
    result.setHours(
      itemDate.getHours(),
      itemDate.getMinutes(),
      itemDate.getSeconds(),
      0
    );
    return result;
  };

  // Expand recurring items (accounting for occurrence actions)
  const getItemsForDate = useMemo(() => {
    return (date: Date): ItemWithDetails[] => {
      const itemsOnDate: ItemWithDetails[] = [];

      for (const item of items) {
        const itemDate =
          item.event_details?.start_at || item.reminder_details?.due_at;
        if (!itemDate) continue;

        const parsedDate = parseISO(itemDate);

        if (item.recurrence_rule?.rrule) {
          try {
            const rruleString = buildFullRRuleString(
              parsedDate,
              item.recurrence_rule
            );
            const rule = RRule.fromString(rruleString);

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const occurrences = rule.between(startOfDay, endOfDay, true);
            for (const occ of occurrences) {
              // Check if this occurrence has been handled
              const isHandled = isOccurrenceCompleted(
                item.id,
                occ,
                occurrenceActions
              );
              if (!isHandled) {
                itemsOnDate.push(item);
                break; // Only add once per item per day
              }
            }
          } catch (error) {
            console.error("Error parsing RRULE:", error);
          }
        } else if (isSameDay(parsedDate, date)) {
          // Check if non-recurring item has been handled
          const isHandled = isOccurrenceCompleted(
            item.id,
            parsedDate,
            occurrenceActions
          );
          if (!isHandled) {
            itemsOnDate.push(item);
          }
        }
      }

      // Add postponed items that are scheduled for this date
      const postponedForDate = getPostponedOccurrencesForDate(
        items,
        date,
        occurrenceActions
      );
      for (const p of postponedForDate) {
        if (!itemsOnDate.some((i) => i.id === p.item.id)) {
          itemsOnDate.push(p.item);
        }
      }

      return itemsOnDate;
    };
  }, [items, occurrenceActions]);

  // Calculate position and height for an item
  const getItemStyle = (item: ItemWithDetails) => {
    const startTime =
      item.event_details?.start_at || item.reminder_details?.due_at;
    const endTime = item.event_details?.end_at;

    if (!startTime) return null;

    const startDate = parseISO(startTime);
    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();

    // Calculate top position (in pixels from 6 AM) - 72px per hour
    const top = ((startHour - 6) * 60 + startMinute) * (72 / 60);

    // Calculate height based on duration
    let height = 72; // Default 1 hour for tasks/reminders without end time
    if (endTime) {
      const endDate = parseISO(endTime);
      let durationMinutes = differenceInMinutes(endDate, startDate);

      // If duration is negative, the end time is on the next day
      // Calculate duration from start to midnight of the same day
      if (durationMinutes < 0) {
        const midnight = new Date(startDate);
        midnight.setHours(24, 0, 0, 0); // Next day midnight
        durationMinutes = differenceInMinutes(midnight, startDate);
      }

      // Ensure minimum 30 minutes display (36px), then scale proportionally
      height = Math.max((durationMinutes / 60) * 72, 36);
    }

    return { top, height };
  };

  const previousWeek = () => {
    setDirection(-1);
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const nextWeek = () => {
    setDirection(1);
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const goToToday = () => {
    setDirection(0);
    setCurrentWeek(new Date());
  };

  // Get current time position for "now" line
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const nowPosition = ((currentHour - 6) * 60 + currentMinute) * (72 / 60);
  const showNowLine = currentHour >= 6 && currentHour < 23;

  // Format time range like "6 - 7 AM"
  const formatTimeRange = (hour: number) => {
    const startPeriod = hour < 12 ? "AM" : "PM";
    const endHour = hour + 1;
    const endPeriod = endHour < 12 ? "AM" : "PM";
    const displayStart = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const displayEnd =
      endHour > 12 ? endHour - 12 : endHour === 0 ? 12 : endHour;

    if (startPeriod === endPeriod) {
      return `${displayStart} - ${displayEnd} ${endPeriod}`;
    }
    return `${displayStart} ${startPeriod} - ${displayEnd} ${endPeriod}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.03]" />
      <div
        className={cn(
          "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse",
          isPink ? "bg-pink-500" : "bg-cyan-500"
        )}
      />
      <div
        className={cn(
          "absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse",
          isPink ? "bg-purple-500" : "bg-blue-500"
        )}
        style={{ animationDelay: "1s" }}
      />

      <div className="relative backdrop-blur-xl border border-white/10 rounded-3xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.5 }}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                  isPink
                    ? "bg-gradient-to-br from-pink-500 to-purple-600"
                    : "bg-gradient-to-br from-cyan-500 to-blue-600"
                )}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {format(weekStart, "MMMM d")} –{" "}
                  {format(weekDays[6], "d, yyyy")}
                </h2>
                <p className="text-sm text-white/50">Your Weekly Schedule</p>
              </div>
            </div>

            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)",
              }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={goToToday}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                isPink
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500",
                "text-white"
              )}
            >
              ✨ Today
            </motion.button>
          </div>

          <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1.5 border border-white/10">
            <motion.button
              whileHover={{
                scale: 1.1,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={previousWeek}
              className="p-2.5 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </motion.button>
            <div className="w-px h-6 bg-white/10" />
            <motion.button
              whileHover={{
                scale: 1.1,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={nextWeek}
              className="p-2.5 rounded-xl transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>

        {/* Week Grid */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          <div className="min-w-[1000px]">
            {/* Day Headers */}
            <AnimatePresence mode="wait">
              <motion.div
                key={weekStart.toISOString()}
                initial={{ opacity: 0, x: direction * 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -50 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-8 mb-4 gap-2"
              >
                <div className="p-2" /> {/* Time column spacer */}
                {weekDays.map((day, index) => {
                  const dayItems = getItemsForDate(day);
                  const birthdays = showBirthdays
                    ? getBirthdaysForDate(day)
                    : [];
                  const hasEvents = dayItems.some(
                    (item) => item.type === "event"
                  );
                  const hasReminders = dayItems.some(
                    (item) => item.type === "reminder"
                  );
                  const hasTasks = dayItems.some(
                    (item) => item.type === "task"
                  );
                  const hasBirthdays = birthdays.length > 0;
                  const totalItems = dayItems.length + birthdays.length;

                  return (
                    <motion.div
                      key={day.toISOString()}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: index * 0.04,
                        type: "spring",
                        stiffness: 300,
                      }}
                      className={cn(
                        "relative p-4 text-center rounded-2xl transition-all overflow-hidden",
                        isToday(day)
                          ? isPink
                            ? "bg-gradient-to-br from-pink-500/40 to-purple-600/40 border-2 border-pink-400/60 shadow-lg shadow-pink-500/20"
                            : "bg-gradient-to-br from-cyan-500/40 to-blue-600/40 border-2 border-cyan-400/60 shadow-lg shadow-cyan-500/20"
                          : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      {/* Item count badge */}
                      {totalItems > 0 && (
                        <div className="absolute top-1.5 right-1.5">
                          <div
                            className={cn(
                              "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                              isPink
                                ? "bg-pink-500 text-white"
                                : "bg-cyan-500 text-white"
                            )}
                          >
                            {totalItems}
                          </div>
                        </div>
                      )}

                      {/* Shimmer effect for today */}
                      {isToday(day) && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                      )}
                      <div
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-widest",
                          isToday(day)
                            ? isPink
                              ? "text-pink-200"
                              : "text-cyan-200"
                            : "text-white/40"
                        )}
                      >
                        {format(day, "EEE")}
                      </div>
                      <div
                        className={cn(
                          "text-3xl font-black mt-1",
                          isToday(day)
                            ? isPink
                              ? "text-pink-300"
                              : "text-cyan-300"
                            : "text-white"
                        )}
                      >
                        {format(day, "d")}
                      </div>

                      {/* Event type indicators (colored dots) */}
                      {totalItems > 0 && !isToday(day) && (
                        <div className="flex items-center justify-center gap-1 mt-1.5">
                          {hasEvents && (
                            <div
                              className="w-2 h-2 rounded-full bg-pink-400"
                              title="Events"
                            />
                          )}
                          {hasReminders && (
                            <div
                              className="w-2 h-2 rounded-full bg-cyan-400"
                              title="Reminders"
                            />
                          )}
                          {hasTasks && (
                            <div
                              className="w-2 h-2 rounded-full bg-purple-400"
                              title="Tasks"
                            />
                          )}
                          {hasBirthdays && (
                            <div
                              className="w-2 h-2 rounded-full bg-amber-400"
                              title="Birthdays"
                            />
                          )}
                        </div>
                      )}

                      {isToday(day) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={cn(
                            "absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold",
                            isPink
                              ? "bg-pink-500 text-white"
                              : "bg-cyan-500 text-white"
                          )}
                        >
                          TODAY
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* All Day Events Section */}
            <div className="grid grid-cols-8 gap-2 mb-4">
              <div className="flex items-center justify-end pr-3">
                <div
                  className={cn(
                    "text-[11px] font-semibold px-2 py-1 rounded-lg",
                    isPink
                      ? "text-pink-300/80 bg-pink-500/10"
                      : "text-cyan-300/80 bg-cyan-500/10"
                  )}
                >
                  ALL DAY
                </div>
              </div>
              {weekDays.map((day) => {
                const dayItems = getItemsForDate(day);
                const birthdays = showBirthdays ? getBirthdaysForDate(day) : [];
                const allDayEvents = dayItems.filter(
                  (item) => item.event_details?.all_day
                );
                const hasAllDayItems =
                  birthdays.length > 0 || allDayEvents.length > 0;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[40px] rounded-xl border transition-all",
                      isToday(day)
                        ? "bg-white/[0.05] border-white/20"
                        : "bg-white/[0.02] border-white/10",
                      hasAllDayItems && "p-1"
                    )}
                  >
                    <div className="space-y-1">
                      {/* Birthdays */}
                      {birthdays.map((birthday) => (
                        <motion.div
                          key={birthday.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBirthdayClick?.(birthday, day);
                          }}
                          className={cn(
                            "px-2 py-1 rounded-lg cursor-pointer overflow-hidden relative",
                            "bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-600/25",
                            "border-l-4 border-l-amber-400 ring-1 ring-amber-400/30",
                            "hover:shadow-lg hover:shadow-amber-500/20"
                          )}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/10 to-transparent animate-pulse" />
                          <div className="flex items-center gap-1.5 relative">
                            <Cake className="w-3 h-3 text-amber-300 flex-shrink-0" />
                            <span className="text-xs font-semibold text-amber-200 truncate">
                              {getBirthdayDisplayName(birthday, day)}
                            </span>
                          </div>
                        </motion.div>
                      ))}

                      {/* All Day Events */}
                      {allDayEvents.map((item) => {
                        const colors = typeColors[item.type];
                        const TypeIcon = colors.icon;

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const occurrenceDateTime =
                                getOccurrenceDateTimeForItem(item, day);
                              onItemClick?.(item, e, occurrenceDateTime);
                            }}
                            className={cn(
                              "px-2 py-1 rounded-lg cursor-pointer overflow-hidden",
                              colors.bg,
                              "border-l-4",
                              colors.border,
                              "ring-1 ring-white/20 hover:shadow-lg"
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="p-0.5 rounded bg-white/20">
                                <TypeIcon className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-xs font-semibold text-white truncate">
                                {item.title}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div
              className="relative bg-gradient-to-b from-white/[0.03] to-transparent rounded-2xl border border-white/10 overflow-hidden"
              style={{ height: `${18 * 72}px` }} // 18 hours * 72px
            >
              {/* Hour Rows */}
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="absolute w-full grid grid-cols-8"
                  style={{ top: `${index * 72}px`, height: "72px" }}
                >
                  {/* Time Label */}
                  <div className="flex items-start justify-end pr-3 pt-2">
                    <div
                      className={cn(
                        "text-[11px] font-semibold px-2 py-1 rounded-lg",
                        isPink
                          ? "text-pink-300/80 bg-pink-500/10"
                          : "text-cyan-300/80 bg-cyan-500/10"
                      )}
                    >
                      {formatTimeRange(hour)}
                    </div>
                  </div>

                  {/* Day Columns */}
                  {weekDays.map((day) => (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className={cn(
                        "border-l border-t border-white/[0.06] relative group transition-colors cursor-pointer",
                        isToday(day) && "bg-white/[0.02]"
                      )}
                      onClick={() => {
                        if (onAddEvent) {
                          // Create a date at the specific hour on the clicked day
                          const clickedDate = new Date(day);
                          clickedDate.setHours(hour, 0, 0, 0);
                          onAddEvent(clickedDate);
                        }
                      }}
                    >
                      {/* Hover effect */}
                      <motion.div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: isPink
                            ? "linear-gradient(135deg, rgba(236,72,153,0.1), rgba(147,51,234,0.1))"
                            : "linear-gradient(135deg, rgba(34,211,238,0.1), rgba(59,130,246,0.1))",
                        }}
                      />
                      {/* Half-hour line */}
                      <div className="absolute left-0 right-0 top-1/2 border-t border-white/[0.03] border-dashed" />
                    </div>
                  ))}
                </div>
              ))}

              {/* Current Time Line */}
              {showNowLine && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  className="absolute left-0 right-0 z-20 pointer-events-none origin-left"
                  style={{ top: `${nowPosition}px` }}
                >
                  <div className="grid grid-cols-8">
                    <div className="flex items-center justify-end pr-2">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black shadow-lg",
                          isPink
                            ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                            : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                        )}
                      >
                        {format(now, "h:mm a")}
                      </motion.div>
                    </div>
                    <div className="col-span-7 flex items-center">
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className={cn(
                          "w-3 h-3 rounded-full shadow-lg",
                          isPink
                            ? "bg-pink-500 shadow-pink-500/50"
                            : "bg-cyan-500 shadow-cyan-500/50"
                        )}
                      />
                      <div
                        className={cn(
                          "flex-1 h-[3px] rounded-full",
                          isPink
                            ? "bg-gradient-to-r from-pink-500 via-purple-500/50 to-transparent"
                            : "bg-gradient-to-r from-cyan-500 via-blue-500/50 to-transparent"
                        )}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Items Overlay - Only timed events */}
              <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
                <div className="grid grid-cols-8 h-full">
                  <div /> {/* Time column spacer */}
                  {weekDays.map((day) => {
                    const dayItems = getItemsForDate(day);
                    // Filter out all-day events - they're shown in the all-day section above
                    const timedItems = dayItems.filter(
                      (item) => !item.event_details?.all_day
                    );

                    return (
                      <div
                        key={day.toISOString()}
                        className="relative border-l border-white/[0.06]"
                      >
                        <AnimatePresence>
                          {/* Render only timed items */}
                          {timedItems.map((item, itemIndex) => {
                            const style = getItemStyle(item);
                            if (!style) return null;

                            const colors = typeColors[item.type];
                            const TypeIcon = colors.icon;
                            const startTime =
                              item.event_details?.start_at ||
                              item.reminder_details?.due_at;
                            const endTime = item.event_details?.end_at;

                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                  delay: itemIndex * 0.05,
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 25,
                                }}
                                whileHover={{
                                  scale: 1.03,
                                  zIndex: 50,
                                  boxShadow:
                                    "0 20px 40px -10px rgba(0,0,0,0.5)",
                                }}
                                className={cn(
                                  "absolute left-1 right-1 rounded-xl border-l-4 cursor-pointer pointer-events-auto overflow-hidden",
                                  colors.bg,
                                  colors.border,
                                  "shadow-xl backdrop-blur-sm"
                                )}
                                style={{
                                  top: `${style.top}px`,
                                  height: `${style.height}px`,
                                }}
                                onClick={(e) => {
                                  const occurrenceDateTime =
                                    getOccurrenceDateTimeForItem(item, day);
                                  onItemClick?.(item, e, occurrenceDateTime);
                                }}
                              >
                                {/* Shine effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />

                                <div className="relative p-2.5 h-full flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-lg bg-white/20">
                                      <TypeIcon className="w-3 h-3 text-white" />
                                    </div>
                                    <span
                                      className={cn(
                                        "text-sm font-bold truncate",
                                        colors.text
                                      )}
                                    >
                                      {item.title}
                                    </span>
                                  </div>

                                  {startTime && style.height >= 50 && (
                                    <div className="flex items-center gap-1.5 text-[11px] text-white/90 mt-1.5">
                                      <Clock className="w-3 h-3" />
                                      <span className="font-medium">
                                        {format(parseISO(startTime), "h:mm a")}
                                        {endTime && (
                                          <>
                                            {" → "}
                                            {format(
                                              parseISO(endTime),
                                              "h:mm a"
                                            )}
                                          </>
                                        )}
                                      </span>
                                    </div>
                                  )}

                                  {item.event_details?.location_text &&
                                    style.height > 70 && (
                                      <div className="flex items-center gap-1.5 text-[11px] text-white/80 mt-1 truncate">
                                        <MapPin className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate font-medium">
                                          {item.event_details.location_text}
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
