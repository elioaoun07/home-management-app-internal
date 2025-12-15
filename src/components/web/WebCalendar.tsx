"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { getBirthdayDisplayName, getBirthdaysForDate } from "@/data/birthdays";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
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
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RRule } from "rrule";

interface WebCalendarProps {
  items: ItemWithDetails[];
  onDateSelect?: (date: Date) => void;
  onItemClick?: (item: ItemWithDetails, event: React.MouseEvent) => void;
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

export function WebCalendar({
  items,
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

  // Get items for a specific date
  const getItemsForDate = (date: Date): ItemWithDetails[] => {
    return items.filter((item) => {
      const dateStr =
        item.type === "reminder" || item.type === "task"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;

      if (!dateStr) return false;

      // Check if the original date matches
      const itemDate = parseISO(dateStr);
      if (isSameDay(itemDate, date)) return true;

      // Check if this date is a recurrence instance
      if (item.recurrence_rule) {
        const recurrenceRule = item.recurrence_rule;
        if (recurrenceRule.rrule) {
          try {
            // Parse the RRULE string and add DTSTART from start_anchor
            const startAnchor = parseISO(recurrenceRule.start_anchor);
            const rruleString = `DTSTART:${startAnchor.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nRRULE:${recurrenceRule.rrule}`;
            const rrule = RRule.fromString(rruleString);

            // Generate occurrences for a reasonable range
            const maxDate = recurrenceRule.end_until
              ? parseISO(recurrenceRule.end_until)
              : new Date(startAnchor.getTime() + 365 * 24 * 60 * 60 * 1000);

            // Get all occurrences in the range
            const occurrences = rrule.between(
              startAnchor,
              maxDate,
              true // inclusive
            );

            // Check if any occurrence matches this date
            return occurrences.some((occurrence) =>
              isSameDay(occurrence, date)
            );
          } catch (error) {
            console.error("Error parsing rrule:", error, recurrenceRule);
            return false;
          }
        }
      }

      return false;
    });
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
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Main Calendar Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with month navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "hover:scale-105 active:scale-95"
              )}
            >
              <ChevronLeft className="w-5 h-5 text-white" />
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
                  "text-2xl font-bold bg-clip-text text-transparent min-w-[200px] text-center",
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
                "p-2 rounded-lg transition-all duration-200",
                "bg-white/5 hover:bg-white/10 border border-white/10",
                "hover:scale-105 active:scale-95"
              )}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToToday}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
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
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  "neo-gradient text-white shadow-lg",
                  "hover:scale-105 active:scale-95"
                )}
              >
                <CalendarPlus className="w-4 h-4" />
                Add Event
              </button>
            )}
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day, idx) => (
            <div
              key={day}
              className={cn(
                "text-center text-sm font-semibold py-3 rounded-lg",
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
            className="grid grid-cols-7 gap-1 flex-1"
          >
            {calendarDays.map((date, index) => {
              const dayItems = getItemsForDate(date);
              const birthdays = showBirthdays ? getBirthdaysForDate(date) : [];
              const isTodayDate = isToday(date);
              const isCurrentMonth = isSameMonth(date, currentMonth);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const hasItems = dayItems.length > 0 || birthdays.length > 0;
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
                    "relative rounded-xl transition-all duration-200 min-h-[120px] p-2 cursor-pointer",
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
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-all",
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
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          "bg-white/10 hover:bg-white/20 transition-colors",
                          "text-white/60 hover:text-white"
                        )}
                      >
                        <CalendarPlus className="w-3 h-3" />
                      </motion.button>
                    )}
                  </div>

                  {/* Event List */}
                  <div className="flex-1 overflow-hidden space-y-0.5">
                    {/* Show birthdays first */}
                    {birthdays.slice(0, 3 - dayItems.length).map((birthday) => (
                      <motion.div
                        key={birthday.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBirthdayClick?.(birthday, date);
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-xs truncate cursor-pointer relative overflow-hidden",
                          "border-l-2 transition-all duration-200",
                          "hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/20",
                          "bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-600/20",
                          "border-l-amber-400 text-amber-200",
                          "ring-1 ring-amber-400/20"
                        )}
                      >
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/10 to-transparent animate-pulse" />
                          <div className="flex items-center gap-1 relative">
                            <Cake className="w-3 h-3 text-amber-300" />
                            <span className="truncate font-semibold">
                              {getBirthdayDisplayName(birthday, date)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Show regular items */}
                    {dayItems.slice(0, 3 - birthdays.length).map((item) => {
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
                            onItemClick?.(item, e);
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-xs truncate cursor-pointer",
                            "border-l-2 transition-all duration-200",
                            "hover:scale-[1.02] hover:shadow-md",
                            colors.bg,
                            colors.border,
                            colors.text
                          )}
                        >
                          <div className="flex items-center gap-1">
                            {time && (
                              <span className="text-[10px] opacity-70">
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

                    {dayItems.length + birthdays.length > 3 && (
                      <div
                        className={cn(
                          "text-xs font-medium px-2",
                          isPink ? "text-pink-400/70" : "text-cyan-400/70"
                        )}
                      >
                        +{dayItems.length + birthdays.length - 3} more
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Selected Date Details Panel - Right side on large screens */}
      <div className="lg:w-80 flex-shrink-0">
        <div
          className={cn(
            "sticky top-4 rounded-2xl backdrop-blur-xl border p-4",
            "h-fit max-h-[calc(100vh-120px)] overflow-y-auto",
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
              selectedDateBirthdays.length > 0 ? (
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
                        onClick={(e) => onItemClick?.(item, e)}
                        className={cn(
                          "p-3 rounded-xl cursor-pointer",
                          "border-l-4 transition-all duration-200",
                          "bg-white/5 hover:bg-white/10",
                          colors.border
                        )}
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
                      </motion.div>
                    );
                  })}
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
