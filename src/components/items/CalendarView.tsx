"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

interface CalendarViewProps {
  items: ItemWithDetails[];
}

export function CalendarView({ items }: CalendarViewProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [direction, setDirection] = useState(0);

  // Generate calendar days (starting Monday)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Start from Monday
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = addDays(monthEnd, 6 - getDay(monthEnd));

    const days: Date[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    return days;
  }, [currentMonth]);

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    return items.filter((item) => {
      const dateStr =
        item.type === "reminder"
          ? item.reminder_details?.due_at
          : item.type === "event"
            ? item.event_details?.start_at
            : null;

      if (!dateStr) return false;

      return isSameDay(parseISO(dateStr), date);
    });
  };

  const goToPreviousMonth = () => {
    setDirection(-1);
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setDirection(1);
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setDirection(today > currentMonth ? 1 : -1);
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const selectedDateItems = selectedDate ? getItemsForDate(selectedDate) : [];

  // Animation variants
  const monthVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            "absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-15",
            isPink ? "bg-pink-500" : "bg-cyan-500"
          )}
        />
        <div
          className={cn(
            "absolute top-1/3 -left-20 w-64 h-64 rounded-full blur-3xl opacity-10",
            isPink ? "bg-purple-500" : "bg-blue-500"
          )}
        />
      </div>

      <div className="relative z-10 flex flex-col h-full p-3 pb-32 overflow-y-auto">
        {/* Premium Month Navigation Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-4 flex-shrink-0"
        >
          {/* Glassmorphism Header */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl backdrop-blur-xl border",
              isPink
                ? "bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-pink-500/10 border-pink-500/10"
                : "bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-cyan-500/10 border-cyan-500/10"
            )}
          />
          <div className="relative flex items-center justify-between p-3">
            <motion.button
              type="button"
              onClick={goToPreviousMonth}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-3 rounded-xl backdrop-blur-md transition-all duration-300",
                "bg-white/5 hover:bg-white/15 border border-white/10",
                "shadow-lg shadow-black/20"
              )}
            >
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </motion.button>

            <div className="flex flex-col items-center gap-1">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.h2
                  key={format(currentMonth, "MMMM-yyyy")}
                  custom={direction}
                  variants={monthVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className={cn(
                    "text-xl font-bold bg-clip-text text-transparent",
                    isPink
                      ? "bg-gradient-to-r from-pink-300 via-pink-400 to-purple-400"
                      : "bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400"
                  )}
                >
                  {format(currentMonth, "MMMM yyyy")}
                </motion.h2>
              </AnimatePresence>
              <motion.button
                type="button"
                onClick={goToToday}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300",
                  "backdrop-blur-md border",
                  isPink
                    ? "bg-pink-500/20 text-pink-300 border-pink-400/30 hover:bg-pink-500/30 hover:border-pink-400/50"
                    : "bg-cyan-500/20 text-cyan-300 border-cyan-400/30 hover:bg-cyan-500/30 hover:border-cyan-400/50"
                )}
              >
                ✨ Today
              </motion.button>
            </div>

            <motion.button
              type="button"
              onClick={goToNextMonth}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-3 rounded-xl backdrop-blur-md transition-all duration-300",
                "bg-white/5 hover:bg-white/15 border border-white/10",
                "shadow-lg shadow-black/20"
              )}
            >
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </motion.button>
          </div>
        </motion.div>
        {/* Elegant Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2 flex-shrink-0">
          {weekDays.map((day, idx) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "text-center text-[11px] font-bold py-1.5 rounded-lg",
                idx >= 5
                  ? isPink
                    ? "text-pink-400/80"
                    : "text-cyan-400/80"
                  : "text-white/50"
              )}
            >
              {day}
            </motion.div>
          ))}
        </div>
        {/* Premium Calendar Grid */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={format(currentMonth, "MMMM-yyyy")}
            custom={direction}
            variants={monthVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="grid grid-cols-7 gap-1 flex-shrink-0"
          >
            {calendarDays.map((date, index) => {
              const dayItems = getItemsForDate(date);
              const isToday = isSameDay(date, new Date());
              const isCurrentMonth =
                date.getMonth() === currentMonth.getMonth();
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const hasItems = dayItems.length > 0;
              const isWeekendDay = isWeekend(date);

              return (
                <motion.button
                  key={`${date.toISOString()}-${index}`}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.01 }}
                  whileHover={{ scale: 1.08, zIndex: 10 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "relative rounded-xl transition-all duration-300 min-h-[56px] p-1.5",
                    "flex flex-col items-center justify-start",
                    "backdrop-blur-sm border overflow-hidden group",
                    // Base styles
                    isCurrentMonth
                      ? "bg-white/[0.03]"
                      : "bg-white/[0.01] opacity-40",
                    // Border styles
                    isToday
                      ? isPink
                        ? "border-pink-400/60 shadow-lg shadow-pink-500/20"
                        : "border-cyan-400/60 shadow-lg shadow-cyan-500/20"
                      : isSelected
                        ? isPink
                          ? "border-pink-400/40"
                          : "border-cyan-400/40"
                        : "border-white/[0.06] hover:border-white/20",
                    // Weekend highlight
                    isWeekendDay && isCurrentMonth && !isToday && !isSelected
                      ? "bg-white/[0.05]"
                      : ""
                  )}
                >
                  {/* Today indicator ring */}
                  {isToday && (
                    <motion.div
                      layoutId="today-ring"
                      className={cn(
                        "absolute inset-0 rounded-xl",
                        isPink
                          ? "bg-gradient-to-br from-pink-500/20 via-transparent to-purple-500/20"
                          : "bg-gradient-to-br from-cyan-500/20 via-transparent to-blue-500/20"
                      )}
                    />
                  )}

                  {/* Selected indicator */}
                  {isSelected && !isToday && (
                    <motion.div
                      layoutId="selected-bg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "absolute inset-0 rounded-xl",
                        isPink ? "bg-pink-500/10" : "bg-cyan-500/10"
                      )}
                    />
                  )}

                  {/* Hover glow effect */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      isPink
                        ? "bg-gradient-to-br from-pink-500/10 to-transparent"
                        : "bg-gradient-to-br from-cyan-500/10 to-transparent"
                    )}
                  />

                  {/* Date Number */}
                  <div
                    className={cn(
                      "relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                      isToday
                        ? isPink
                          ? "bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/40"
                          : "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/40"
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
                  </div>

                  {/* Event Indicators */}
                  {hasItems && (
                    <div className="relative z-10 flex items-center justify-center gap-0.5 mt-1 w-full">
                      {dayItems.slice(0, 3).map((item, i) => {
                        const isReminder = item.type === "reminder";
                        const isEvent = item.type === "event";

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              isReminder
                                ? "bg-cyan-400 shadow-sm shadow-cyan-400/50"
                                : isEvent
                                  ? "bg-pink-400 shadow-sm shadow-pink-400/50"
                                  : "bg-purple-400 shadow-sm shadow-purple-400/50"
                            )}
                          />
                        );
                      })}
                      {dayItems.length > 3 && (
                        <span
                          className={cn(
                            "text-[8px] font-bold ml-0.5",
                            isPink ? "text-pink-400" : "text-cyan-400"
                          )}
                        >
                          +{dayItems.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
        {/* Selected Date Details Panel */}
        <AnimatePresence>
          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-3 overflow-hidden flex-shrink-0"
            >
              <div
                className={cn(
                  "rounded-xl backdrop-blur-xl border p-3",
                  isPink
                    ? "bg-gradient-to-br from-pink-500/15 via-purple-500/5 to-transparent border-pink-500/20"
                    : "bg-gradient-to-br from-cyan-500/15 via-blue-500/5 to-transparent border-cyan-500/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className={cn(
                      "font-bold",
                      isPink ? "text-pink-300" : "text-cyan-300"
                    )}
                  >
                    {format(selectedDate, "EEEE, MMM d")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-white/60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {selectedDateItems.length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {selectedDateItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg",
                          "bg-white/5 hover:bg-white/10 transition-colors"
                        )}
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            item.type === "reminder"
                              ? "bg-cyan-400"
                              : item.type === "event"
                                ? "bg-pink-400"
                                : "bg-purple-400"
                          )}
                        />
                        <span className="text-sm text-white/80 truncate">
                          {item.title}
                        </span>
                        <span className="text-xs text-white/40 ml-auto">
                          {item.type === "reminder" &&
                            item.reminder_details?.due_at &&
                            format(
                              parseISO(item.reminder_details.due_at),
                              "h:mm a"
                            )}
                          {item.type === "event" &&
                            item.event_details?.start_at &&
                            format(
                              parseISO(item.event_details.start_at),
                              "h:mm a"
                            )}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/40 text-center py-2">
                    No items scheduled
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
