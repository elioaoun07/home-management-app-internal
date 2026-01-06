"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { getBirthdayDisplayName, getBirthdaysForDate } from "@/data/birthdays";
import {
  getCompletedOccurrencesForDate,
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { type SubtaskCompletion } from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  formatDistanceToNow,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cake,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FastForward,
  MapPin,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RRule } from "rrule";
import { ItemSubtasksList } from "./ItemSubtasks";

interface WebCalendarProps {
  items: ItemWithDetails[];
  occurrenceActions?: ItemOccurrenceAction[];
  subtaskCompletions?: SubtaskCompletion[];
  onDateSelect?: (date: Date) => void;
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

// Priority badge colors
const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-gray-500/20", text: "text-gray-300" },
  normal: { bg: "bg-cyan-500/20", text: "text-cyan-300" },
  high: { bg: "bg-orange-500/20", text: "text-orange-300" },
  urgent: { bg: "bg-red-500/20", text: "text-red-300" },
};

// Item type colors
const typeColors: Record<string, { bg: string; border: string; text: string }> =
  {
    reminder: {
      bg: "bg-cyan-500/20",
      border: "border-l-cyan-400",
      text: "text-cyan-300",
    },
    event: {
      bg: "bg-pink-500/20",
      border: "border-l-pink-400",
      text: "text-pink-300",
    },
    task: {
      bg: "bg-purple-500/20",
      border: "border-l-purple-400",
      text: "text-purple-300",
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

export function WebCalendar({
  items,
  occurrenceActions = [],
  subtaskCompletions = [],
  onDateSelect,
  onItemClick,
  onAddEvent,
  onBirthdayClick,
  selectedDate: externalSelectedDate,
  showBirthdays = true,
}: WebCalendarProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | null>(
    new Date()
  );
  const [showCompleted, setShowCompleted] = useState(true);

  /**
   * Get the actual occurrence datetime for an item on a specific date
   * For recurring items, this finds the RRule occurrence that falls on that date
   */
  const getOccurrenceDateTimeForItem = (
    item: ItemWithDetails,
    calendarDate: Date
  ): Date => {
    const dateStr =
      item.type === "reminder" || item.type === "task"
        ? item.reminder_details?.due_at
        : item.type === "event"
          ? item.event_details?.start_at
          : null;

    if (!dateStr) return calendarDate;

    const itemDate = parseISO(dateStr);

    // For recurring items, find the specific occurrence on this date
    if (item.recurrence_rule?.rrule) {
      try {
        // Use start_anchor if available, otherwise fall back to item date
        const startAnchor = item.recurrence_rule.start_anchor
          ? parseISO(item.recurrence_rule.start_anchor)
          : itemDate;
        const rruleString = buildFullRRuleString(
          startAnchor,
          item.recurrence_rule
        );
        const rrule = RRule.fromString(rruleString);

        // Get occurrences for this specific day
        const dayStart = new Date(calendarDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(calendarDate);
        dayEnd.setHours(23, 59, 59, 999);

        const occurrences = rrule.between(dayStart, dayEnd, true);
        if (occurrences.length > 0) {
          // Return the first occurrence on this day with the correct time
          return occurrences[0];
        }
      } catch (error) {
        console.error("Error getting occurrence datetime:", error);
      }
    }

    // For non-recurring or if RRule fails, use the calendar date with the item's time
    const result = new Date(calendarDate);
    result.setHours(
      itemDate.getHours(),
      itemDate.getMinutes(),
      itemDate.getSeconds(),
      0
    );
    return result;
  };
  const [direction, setDirection] = useState(0);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const selectedDate = externalSelectedDate ?? internalSelectedDate;

  // Generate calendar days (starting Monday)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Start from Monday
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    // Ensure we always show 6 weeks for consistent calendar height
    const endDate = addDays(startDate, 41); // 6 weeks = 42 days

    const days: Date[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    return days;
  }, [currentMonth]);

  // Get items for a specific date (accounting for occurrence actions)
  const getItemsForDate = (date: Date): ItemWithDetails[] => {
    const result: ItemWithDetails[] = [];

    for (const item of items) {
      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;

      if (!dateStr) continue;

      const itemDate = parseISO(dateStr);

      // Check if this is a recurring item
      if (item.recurrence_rule?.rrule) {
        try {
          // Use start_anchor if available, otherwise fall back to item date
          const startAnchor = item.recurrence_rule.start_anchor
            ? parseISO(item.recurrence_rule.start_anchor)
            : itemDate;
          const rruleString = buildFullRRuleString(
            startAnchor,
            item.recurrence_rule
          );
          const rrule = RRule.fromString(rruleString);

          const maxDate = item.recurrence_rule.end_until
            ? parseISO(item.recurrence_rule.end_until)
            : new Date(startAnchor.getTime() + 365 * 24 * 60 * 60 * 1000);

          const occurrences = rrule.between(startAnchor, maxDate, true);

          // Check if any occurrence matches this date AND is not completed/postponed
          for (const occurrence of occurrences) {
            if (isSameDay(occurrence, date)) {
              // Check if this occurrence has been handled (completed, cancelled, or postponed)
              const isHandled = isOccurrenceCompleted(
                item.id,
                occurrence,
                occurrenceActions
              );
              if (!isHandled) {
                result.push(item);
                break; // Only add once per item per day
              }
            }
          }
        } catch (error) {
          console.error("Error parsing rrule:", error, item.recurrence_rule);
        }
      } else {
        // Non-recurring item
        if (isSameDay(itemDate, date)) {
          const isHandled = isOccurrenceCompleted(
            item.id,
            itemDate,
            occurrenceActions
          );
          if (!isHandled) {
            result.push(item);
          }
        }
      }
    }

    // NOTE: We no longer add postponed items here - they are shown in a separate
    // "Postponed to this day" section via getPostponedItemsForDate

    return result;
  };

  // Get completed items for a specific date
  const getCompletedItemsForDate = (date: Date) => {
    return getCompletedOccurrencesForDate(items, date, occurrenceActions);
  };

  // Get postponed items for a specific date (items postponed TO this date)
  const getPostponedItemsForDate = (date: Date) => {
    return getPostponedOccurrencesForDate(items, date, occurrenceActions);
  };

  const goToPreviousMonth = () => {
    setDirection(-1);
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setDirection(1);
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setDirection(today > currentMonth ? 1 : -1);
    setCurrentMonth(today);
    setInternalSelectedDate(today);
    onDateSelect?.(today);
  };

  const handleDateClick = (date: Date) => {
    setInternalSelectedDate(date);
    onDateSelect?.(date);
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const selectedDateItems = selectedDate ? getItemsForDate(selectedDate) : [];
  const selectedDateCompletedItems =
    selectedDate && showCompleted ? getCompletedItemsForDate(selectedDate) : [];
  const selectedDatePostponedItems = selectedDate
    ? getPostponedItemsForDate(selectedDate)
    : [];
  const selectedDateBirthdays =
    selectedDate && showBirthdays ? getBirthdaysForDate(selectedDate) : [];

  // Animation variants
  const monthVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -50 : 50,
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 h-full">
      {/* Main Calendar Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with month navigation - Compact for tablet */}
        <div className="flex items-center justify-between mb-1 lg:mb-4">
          <div className="flex items-center gap-1 lg:gap-3">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className={cn(
                "p-1 lg:p-2 rounded-lg transition-all duration-200",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "hover:scale-105 active:scale-95"
              )}
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.h2
                key={format(currentMonth, "MMMM-yyyy")}
                custom={direction}
                variants={monthVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "text-base lg:text-xl font-bold bg-clip-text text-transparent min-w-[120px] lg:min-w-[180px] text-center",
                  isPink
                    ? "bg-gradient-to-r from-pink-300 via-pink-400 to-purple-400"
                    : "bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400"
                )}
              >
                {format(currentMonth, "MMMM yyyy")}
              </motion.h2>
            </AnimatePresence>

            <button
              type="button"
              onClick={goToNextMonth}
              className={cn(
                "p-1 lg:p-2 rounded-lg transition-all duration-200",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "hover:scale-105 active:scale-95"
              )}
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex items-center gap-1 lg:gap-2">
            {/* Show/Hide Completed Toggle */}
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className={cn(
                "p-1 lg:p-2 rounded-lg transition-all duration-200",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                showCompleted ? "text-green-400" : "text-white/40"
              )}
              title={showCompleted ? "Hide completed" : "Show completed"}
            >
              {showCompleted ? (
                <Eye className="w-3 h-3 lg:w-4 lg:h-4" />
              ) : (
                <EyeOff className="w-3 h-3 lg:w-4 lg:h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={goToToday}
              className={cn(
                "px-2 py-1 lg:px-3 lg:py-2 rounded-lg text-[10px] lg:text-sm font-medium transition-all duration-200",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "hover:scale-105 active:scale-95",
                isPink ? "text-pink-300" : "text-cyan-300"
              )}
            >
              Today
            </button>

            {onAddEvent && (
              <button
                type="button"
                onClick={() => onAddEvent(selectedDate || new Date())}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 lg:px-3 lg:py-2 rounded-lg text-[10px] lg:text-sm font-medium transition-all duration-200",
                  "neo-gradient text-white shadow-lg",
                  "hover:scale-105 active:scale-95"
                )}
              >
                <CalendarPlus className="w-3 h-3 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">Add Event</span>
              </button>
            )}
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-0.5 lg:gap-1">
          {weekDays.map((day, idx) => (
            <div
              key={day}
              className={cn(
                "text-center text-[9px] lg:text-xs font-semibold py-1 lg:py-2 rounded-lg",
                idx >= 5
                  ? isPink
                    ? "text-pink-400/80"
                    : "text-cyan-400/80"
                  : "text-white/60"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={format(currentMonth, "MMMM-yyyy")}
            custom={direction}
            variants={monthVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="grid grid-cols-7 gap-0.5 lg:gap-1 flex-1"
          >
            {calendarDays.map((date, index) => {
              const dayItems = getItemsForDate(date);
              const completedItems = showCompleted
                ? getCompletedItemsForDate(date)
                : [];
              const postponedItems = getPostponedItemsForDate(date);
              const birthdays = showBirthdays ? getBirthdaysForDate(date) : [];
              const isTodayDate = isToday(date);
              const isCurrentMonth = isSameMonth(date, currentMonth);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const hasItems =
                dayItems.length > 0 ||
                birthdays.length > 0 ||
                completedItems.length > 0 ||
                postponedItems.length > 0;
              const isWeekendDay = isWeekend(date);
              const isHovered = hoveredDate && isSameDay(date, hoveredDate);

              return (
                <motion.div
                  key={`${date.toISOString()}-${index}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.005 }}
                  onMouseEnter={() => setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                  onClick={() => handleDateClick(date)}
                  className={cn(
                    "relative rounded-md lg:rounded-xl transition-all duration-200 min-h-[56px] lg:min-h-[100px] p-0.5 lg:p-2 cursor-pointer",
                    "flex flex-col border overflow-hidden group",
                    // Base styles
                    isCurrentMonth
                      ? "bg-white/[0.03]"
                      : "bg-white/[0.01] opacity-50",
                    // Border styles
                    isTodayDate
                      ? isPink
                        ? "border-pink-400/60 ring-2 ring-pink-400/30"
                        : "border-cyan-400/60 ring-2 ring-cyan-400/30"
                      : isSelected
                        ? isPink
                          ? "border-pink-400/40 bg-pink-500/10"
                          : "border-cyan-400/40 bg-cyan-500/10"
                        : isHovered
                          ? "border-white/20 bg-white/[0.05]"
                          : "border-white/[0.06]",
                    // Weekend highlight
                    isWeekendDay &&
                      isCurrentMonth &&
                      !isTodayDate &&
                      !isSelected &&
                      "bg-white/[0.02]"
                  )}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "w-4 h-4 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-[9px] lg:text-xs font-medium transition-all",
                        isTodayDate
                          ? isPink
                            ? "bg-gradient-to-br from-pink-500 to-pink-600 text-white"
                            : "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white"
                          : isSelected
                            ? isPink
                              ? "bg-pink-500/30 text-pink-300"
                              : "bg-cyan-500/30 text-cyan-300"
                            : isCurrentMonth
                              ? isWeekendDay
                                ? isPink
                                  ? "text-pink-300/80"
                                  : "text-cyan-300/80"
                                : "text-white/90"
                              : "text-white/30"
                      )}
                    >
                      {format(date, "d")}
                    </span>

                    {/* Add button on hover */}
                    {isHovered && onAddEvent && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddEvent(date);
                        }}
                        className={cn(
                          "w-4 h-4 lg:w-6 lg:h-6 rounded-full flex items-center justify-center",
                          "bg-white/10 hover:bg-white/20 transition-colors",
                          "text-white/60 hover:text-white"
                        )}
                      >
                        <CalendarPlus className="w-2 h-2 lg:w-3 lg:h-3" />
                      </motion.button>
                    )}
                  </div>

                  {/* Event List */}
                  <div className="flex-1 overflow-hidden">
                    {/* Show birthdays first - limit to 2 on tablet */}
                    {birthdays.slice(0, 2).map((birthday) => (
                      <motion.div
                        key={birthday.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBirthdayClick?.(birthday, date);
                        }}
                        className={cn(
                          "px-0.5 lg:px-1.5 py-px lg:py-0.5 rounded text-[8px] lg:text-[10px] truncate cursor-pointer",
                          "border-l lg:border-l-2 transition-all duration-200",
                          "bg-amber-500/20 border-l-amber-400 text-amber-200"
                        )}
                      >
                        <div className="flex items-center gap-0.5">
                          <Cake className="w-2 h-2 lg:w-3 lg:h-3 text-amber-300 flex-shrink-0" />
                          <span className="truncate font-medium">
                            {getBirthdayDisplayName(birthday, date)}
                          </span>
                        </div>
                      </motion.div>
                    ))}

                    {/* Show regular items - limit to 2 on tablet */}
                    {dayItems
                      .slice(0, 2 - Math.min(birthdays.length, 1))
                      .map((item) => {
                        const colors = typeColors[item.type] || typeColors.task;
                        const time =
                          item.type === "event"
                            ? item.event_details?.start_at
                            : item.reminder_details?.due_at;

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Pass the actual occurrence datetime, not just the calendar date
                              const occurrenceDateTime =
                                getOccurrenceDateTimeForItem(item, date);
                              onItemClick?.(item, e, occurrenceDateTime);
                            }}
                            className={cn(
                              "px-0.5 lg:px-1.5 py-px lg:py-0.5 rounded text-[8px] lg:text-[10px] truncate cursor-pointer",
                              "border-l lg:border-l-2 transition-all duration-200",
                              colors.bg,
                              colors.border,
                              colors.text
                            )}
                          >
                            <div className="flex items-center gap-0.5">
                              {time && (
                                <span className="text-[7px] lg:text-[9px] opacity-70 flex-shrink-0">
                                  {format(parseISO(time), "HH:mm")}
                                </span>
                              )}
                              <span className="truncate font-medium">
                                {item.title}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}

                    {/* Show completed items with green styling */}
                    {completedItems
                      .slice(
                        0,
                        Math.max(
                          0,
                          2 - dayItems.length - Math.min(birthdays.length, 1)
                        )
                      )
                      .map((completed) => {
                        const item = completed.item;
                        const time =
                          item.type === "event"
                            ? item.event_details?.start_at
                            : item.reminder_details?.due_at;

                        return (
                          <motion.div
                            key={`completed-${item.id}`}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemClick?.(item, e, completed.occurrenceDate);
                            }}
                            className={cn(
                              "px-0.5 lg:px-1.5 py-px lg:py-0.5 rounded text-[8px] lg:text-[10px] truncate cursor-pointer",
                              "border lg:border-2 transition-all duration-200 opacity-60",
                              "bg-green-500/10 border-green-500/50 text-green-300/70"
                            )}
                          >
                            <div className="flex items-center gap-0.5">
                              {time && (
                                <span className="text-[7px] lg:text-[9px] opacity-70 flex-shrink-0">
                                  {format(parseISO(time), "HH:mm")}
                                </span>
                              )}
                              <span className="truncate font-medium line-through">
                                {item.title}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}

                    {/* Show postponed items with amber styling */}
                    {postponedItems
                      .slice(
                        0,
                        Math.max(
                          0,
                          2 -
                            dayItems.length -
                            completedItems.length -
                            Math.min(birthdays.length, 1)
                        )
                      )
                      .map((postponed) => {
                        const item = postponed.item;
                        const time =
                          item.type === "event"
                            ? item.event_details?.start_at
                            : item.reminder_details?.due_at;

                        return (
                          <motion.div
                            key={`postponed-${item.id}`}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemClick?.(item, e, postponed.occurrenceDate);
                            }}
                            className={cn(
                              "px-0.5 lg:px-1.5 py-px lg:py-0.5 rounded text-[8px] lg:text-[10px] truncate cursor-pointer",
                              "border lg:border-2 transition-all duration-200 opacity-70",
                              "bg-amber-500/10 border-amber-500/50 text-amber-300/80"
                            )}
                          >
                            <div className="flex items-center gap-0.5">
                              <FastForward className="w-2 h-2 lg:w-2.5 lg:h-2.5 flex-shrink-0" />
                              <span className="truncate font-medium">
                                {item.title}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}

                    {dayItems.length +
                      birthdays.length +
                      completedItems.length +
                      postponedItems.length >
                      2 && (
                      <div
                        className={cn(
                          "text-[7px] lg:text-[10px] font-medium px-0.5",
                          isPink ? "text-pink-400/70" : "text-cyan-400/70"
                        )}
                      >
                        +
                        {dayItems.length +
                          birthdays.length +
                          completedItems.length +
                          postponedItems.length -
                          2}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Selected Date Details Panel - Right side on large screens, hidden on tablet */}
      <div className="hidden lg:block lg:w-72 flex-shrink-0">
        <div
          className={cn(
            "sticky top-2 rounded-xl backdrop-blur-xl border p-3",
            "h-fit max-h-[calc(100vh-100px)] overflow-y-auto",
            isPink
              ? "bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent border-pink-500/20"
              : "bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent border-cyan-500/20"
          )}
        >
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3
                    className={cn(
                      "text-lg font-bold",
                      isPink ? "text-pink-300" : "text-cyan-300"
                    )}
                  >
                    {format(selectedDate, "EEEE")}
                  </h3>
                  <p className="text-sm text-white/60">
                    {format(selectedDate, "MMMM d, yyyy")}
                  </p>
                </div>
                {onAddEvent && (
                  <button
                    type="button"
                    onClick={() => onAddEvent(selectedDate)}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      "bg-white/10 hover:bg-white/20",
                      "text-white/60 hover:text-white"
                    )}
                  >
                    <CalendarPlus className="w-5 h-5" />
                  </button>
                )}
              </div>

              {selectedDateItems.length > 0 ||
              selectedDateBirthdays.length > 0 ||
              selectedDateCompletedItems.length > 0 ||
              selectedDatePostponedItems.length > 0 ? (
                <div className="space-y-2">
                  {/* Show birthdays first */}
                  {selectedDateBirthdays.map((birthday) => (
                    <motion.div
                      key={birthday.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBirthdayClick?.(birthday, selectedDate);
                      }}
                      className={cn(
                        "p-3 rounded-xl cursor-pointer relative overflow-hidden",
                        "border-l-4 border-l-amber-400 transition-all duration-200",
                        "bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20",
                        "hover:from-amber-500/30 hover:via-yellow-500/25 hover:to-amber-600/30",
                        "hover:shadow-lg hover:shadow-amber-500/20",
                        "ring-1 ring-amber-400/30"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/10 to-transparent animate-pulse" />
                      <div className="flex items-start justify-between gap-2 relative">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Cake className="w-4 h-4 text-amber-300" />
                            <h4 className="font-semibold text-amber-200 truncate">
                              {getBirthdayDisplayName(birthday, selectedDate)}
                            </h4>
                          </div>
                          {birthday.category && (
                            <p className="text-sm text-amber-300/70 mt-1 capitalize">
                              {birthday.category}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs bg-amber-500/30 text-amber-200 font-medium border border-amber-400/30">
                          Birthday
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {/* Show regular items */}
                  {selectedDateItems.map((item) => {
                    const colors = typeColors[item.type] || typeColors.task;
                    const priorityColor =
                      priorityColors[item.priority] || priorityColors.normal;
                    const time =
                      item.type === "event"
                        ? item.event_details?.start_at
                        : item.reminder_details?.due_at;
                    const endTime =
                      item.type === "event" ? item.event_details?.end_at : null;
                    const location =
                      item.type === "event"
                        ? item.event_details?.location_text
                        : null;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-3 rounded-xl",
                          "border-l-4 transition-all duration-200",
                          "bg-white/5 hover:bg-white/10",
                          colors.border
                        )}
                      >
                        <div
                          onClick={(e) => {
                            // Pass the actual occurrence datetime
                            const occurrenceDateTime = selectedDate
                              ? getOccurrenceDateTimeForItem(item, selectedDate)
                              : undefined;
                            onItemClick?.(item, e, occurrenceDateTime);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white truncate">
                                {item.title}
                              </h4>

                              {time && (
                                <div className="flex items-center gap-1 mt-1 text-sm text-white/60">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {format(parseISO(time), "h:mm a")}
                                    {endTime &&
                                      ` - ${format(parseISO(endTime), "h:mm a")}`}
                                  </span>
                                </div>
                              )}

                              {location && (
                                <div className="flex items-center gap-1 mt-1 text-sm text-white/60">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{location}</span>
                                </div>
                              )}

                              {item.description && (
                                <p className="text-sm text-white/50 mt-2 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs capitalize",
                                  colors.bg,
                                  colors.text
                                )}
                              >
                                {item.type}
                              </span>
                              {item.priority !== "normal" && (
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs capitalize",
                                    priorityColor.bg,
                                    priorityColor.text
                                  )}
                                >
                                  {item.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Subtasks Section */}
                        <div className="mt-3 pt-2 border-t border-white/10">
                          <ItemSubtasksList
                            itemId={item.id}
                            subtasks={item.subtasks || []}
                            isRecurring={!!item.recurrence_rule}
                            occurrenceDate={
                              selectedDate
                                ? getOccurrenceDateTimeForItem(
                                    item,
                                    selectedDate
                                  ) || selectedDate
                                : new Date()
                            }
                            subtaskCompletions={subtaskCompletions}
                          />
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Postponed Items Section */}
                  {selectedDatePostponedItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <FastForward className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-medium text-amber-400">
                          Postponed to this day
                        </h4>
                        <span className="text-xs text-amber-400/60">
                          ({selectedDatePostponedItems.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {selectedDatePostponedItems.map((postponed) => {
                          const item = postponed.item;
                          const colors =
                            typeColors[item.type] || typeColors.task;
                          const time =
                            item.type === "event"
                              ? item.event_details?.start_at
                              : item.reminder_details?.due_at;

                          return (
                            <motion.div
                              key={`postponed-${item.id}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={(e) => {
                                onItemClick?.(
                                  item,
                                  e,
                                  postponed.occurrenceDate
                                );
                              }}
                              className={cn(
                                "p-3 rounded-xl cursor-pointer",
                                "border-2 border-amber-500/30 transition-all duration-200",
                                "bg-amber-500/10 hover:bg-amber-500/15"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FastForward className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <h4 className="font-medium text-amber-300 truncate">
                                      {item.title}
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1 text-sm text-amber-300/60 ml-6">
                                    <span>
                                      from{" "}
                                      {format(postponed.originalDate, "MMM d")}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs capitalize",
                                    "bg-amber-500/20 text-amber-300"
                                  )}
                                >
                                  {item.type}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Completed Items Section */}
                  {selectedDateCompletedItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-medium text-green-400">
                          Completed
                        </h4>
                        <span className="text-xs text-green-400/60">
                          ({selectedDateCompletedItems.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {selectedDateCompletedItems.map((completed) => {
                          const item = completed.item;
                          const colors =
                            typeColors[item.type] || typeColors.task;
                          const time =
                            item.type === "event"
                              ? item.event_details?.start_at
                              : item.reminder_details?.due_at;

                          return (
                            <motion.div
                              key={`completed-${item.id}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={(e) => {
                                onItemClick?.(
                                  item,
                                  e,
                                  completed.occurrenceDate
                                );
                              }}
                              className={cn(
                                "p-3 rounded-xl cursor-pointer",
                                "border-2 border-green-500/30 transition-all duration-200",
                                "bg-green-500/10 hover:bg-green-500/15 opacity-70"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    <h4 className="font-medium text-green-300 truncate line-through">
                                      {item.title}
                                    </h4>
                                  </div>
                                  <div className="flex flex-col gap-0.5 mt-1 ml-6">
                                    {time && (
                                      <div className="flex items-center gap-1 text-sm text-green-300/60">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                          {format(parseISO(time), "h:mm a")}
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-xs text-green-400/50">
                                      Completed{" "}
                                      {formatDistanceToNow(
                                        completed.completedAt,
                                        { addSuffix: true }
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs capitalize",
                                    "bg-green-500/20 text-green-300"
                                  )}
                                >
                                  {item.type}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarPlus className="w-12 h-12 mx-auto mb-3 text-white/20" />
                  <p className="text-sm text-white/40">No events scheduled</p>
                  {onAddEvent && (
                    <button
                      type="button"
                      onClick={() => onAddEvent(selectedDate)}
                      className={cn(
                        "mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                      )}
                    >
                      Add an event
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-white/40">
                Select a date to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
