"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { CalendarRange, Check, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

interface DateRangeState {
  from: Date | undefined;
  to: Date | undefined;
}

type DateRangePreset = {
  label: string;
  getValue: () => { start: string; end: string };
};

const presets: DateRangePreset[] = [
  // Today / Yesterday
  {
    label: "Today",
    getValue: () => {
      const today = format(new Date(), "yyyy-MM-dd");
      return { start: today, end: today };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      return { start: yesterday, end: yesterday };
    },
  },
  // This Week / Last Week
  {
    label: "This Week",
    getValue: () => ({
      start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      end: format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last Week",
    getValue: () => {
      const lastWeek = subDays(new Date(), 7);
      return {
        start: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    },
  },
  // This Month / Last Month / Last 3 Months
  {
    label: "This Month",
    getValue: () => ({
      start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last Month",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    },
  },
  {
    label: "Last 3 Months",
    getValue: () => ({
      start: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"),
      end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    }),
  },
  // This Year / Last Year
  {
    label: "This Year",
    getValue: () => ({
      start: format(startOfYear(new Date()), "yyyy-MM-dd"),
      end: format(endOfYear(new Date()), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last Year",
    getValue: () => {
      const lastYear = subYears(new Date(), 1);
      return {
        start: format(startOfYear(lastYear), "yyyy-MM-dd"),
        end: format(endOfYear(lastYear), "yyyy-MM-dd"),
      };
    },
  },
];

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (start: string, end: string) => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [pendingRange, setPendingRange] = React.useState<
    DateRangeState | undefined
  >(undefined);
  const [currentMonth, setCurrentMonth] = React.useState(
    () => new Date(startDate)
  );
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragMode, setDragMode] = React.useState<"start" | "end" | null>(null);

  // Generate calendar days for the current month
  const calendarDays = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Check if a date is in the selected range
  const isInRange = (date: Date) => {
    if (!pendingRange?.from || !pendingRange?.to) return false;
    const start =
      pendingRange.from <= pendingRange.to
        ? pendingRange.from
        : pendingRange.to;
    const end =
      pendingRange.from <= pendingRange.to
        ? pendingRange.to
        : pendingRange.from;
    return isWithinInterval(date, { start, end });
  };

  const isRangeStart = (date: Date) => {
    if (!pendingRange?.from) return false;
    return isSameDay(date, pendingRange.from);
  };

  const isRangeEnd = (date: Date) => {
    if (!pendingRange?.to) return false;
    return isSameDay(date, pendingRange.to);
  };

  const isRangeMiddle = (date: Date) => {
    return isInRange(date) && !isRangeStart(date) && !isRangeEnd(date);
  };

  // Handle mouse/touch events for drag selection
  const handleDayMouseDown = (date: Date) => {
    if (!pendingRange?.from || !pendingRange?.to) {
      // No existing range, start fresh
      setIsDragging(true);
      setDragMode("end");
      setPendingRange({ from: date, to: date });
      return;
    }

    // Check if clicking on start or end date to drag it
    if (isSameDay(date, pendingRange.from)) {
      setIsDragging(true);
      setDragMode("start");
    } else if (isSameDay(date, pendingRange.to)) {
      setIsDragging(true);
      setDragMode("end");
    } else {
      // Clicking elsewhere - start a new selection
      setIsDragging(true);
      setDragMode("end");
      setPendingRange({ from: date, to: date });
    }
  };

  const handleDayMouseEnter = (date: Date) => {
    if (!isDragging || !dragMode || !pendingRange) return;

    if (dragMode === "start") {
      // Dragging start date - keep end fixed
      if (pendingRange.to && date <= pendingRange.to) {
        setPendingRange({ from: date, to: pendingRange.to });
      } else if (pendingRange.to) {
        // If dragged past end, swap them
        setPendingRange({ from: pendingRange.to, to: date });
        setDragMode("end");
      }
    } else if (dragMode === "end") {
      // Dragging end date - keep start fixed
      if (pendingRange.from && date >= pendingRange.from) {
        setPendingRange({ from: pendingRange.from, to: date });
      } else if (pendingRange.from) {
        // If dragged before start, swap them
        setPendingRange({ from: date, to: pendingRange.from });
        setDragMode("start");
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  // Add global mouseup listener
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchend", handleMouseUp);
      return () => {
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [isDragging]);

  // Reset to current applied range when opening
  React.useEffect(() => {
    if (open) {
      const fromDate = new Date(startDate);
      setPendingRange({ from: fromDate, to: new Date(endDate) });
      // Navigate calendar to the start date's month
      setCurrentMonth(fromDate);
    }
  }, [open, startDate, endDate]);

  // Display label for the trigger button
  const displayLabel = React.useMemo(() => {
    const preset = presets.find((p) => {
      const range = p.getValue();
      return range.start === startDate && range.end === endDate;
    });
    if (preset) return preset.label;
    if (startDate === endDate)
      return format(new Date(startDate), "MMM d, yyyy");
    return `${format(new Date(startDate), "MMM d")} - ${format(new Date(endDate), "MMM d, yyyy")}`;
  }, [startDate, endDate]);

  // Check if pending matches a preset
  const isPendingPreset = (preset: DateRangePreset) => {
    if (!pendingRange?.from || !pendingRange?.to) return false;
    const range = preset.getValue();
    return (
      format(pendingRange.from, "yyyy-MM-dd") === range.start &&
      format(pendingRange.to, "yyyy-MM-dd") === range.end
    );
  };

  // Check if we can apply (have both dates and something changed)
  const canApply = pendingRange?.from && pendingRange?.to;
  const hasChanges =
    canApply &&
    pendingRange.from &&
    pendingRange.to &&
    (format(pendingRange.from, "yyyy-MM-dd") !== startDate ||
      format(pendingRange.to, "yyyy-MM-dd") !== endDate);

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = preset.getValue();
    const newFrom = new Date(range.start);
    setPendingRange({ from: newFrom, to: new Date(range.end) });
    // Navigate calendar to the start date's month
    setCurrentMonth(newFrom);
  };

  const handleApply = () => {
    if (pendingRange?.from && pendingRange?.to) {
      onDateRangeChange(
        format(pendingRange.from, "yyyy-MM-dd"),
        format(pendingRange.to, "yyyy-MM-dd")
      );
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-medium gap-2 neo-card border-white/10 bg-slate-900/50 hover:bg-slate-800/50 text-slate-200 h-8 px-3",
            className
          )}
        >
          <CalendarRange className="h-4 w-4 text-cyan-400" />
          <span>{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl"
        align="start"
        sideOffset={8}
      >
        <div className="flex">
          {/* Presets - grouped horizontally */}
          <div className="w-44 border-r border-white/10 p-2 space-y-2">
            {/* Today / Yesterday */}
            <div className="flex gap-1">
              {presets.slice(0, 2).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all text-center",
                    isPendingPreset(preset)
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* This Week / Last Week */}
            <div className="flex gap-1">
              {presets.slice(2, 4).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all text-center",
                    isPendingPreset(preset)
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* This Month / Last Month */}
            <div className="flex gap-1">
              {presets.slice(4, 6).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all text-center",
                    isPendingPreset(preset)
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Last 3 Months (full width) */}
            <div>
              <button
                onClick={() => handlePresetClick(presets[6])}
                className={cn(
                  "w-full px-2 py-1.5 rounded text-xs font-medium transition-all text-center",
                  isPendingPreset(presets[6])
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {presets[6].label}
              </button>
            </div>
            {/* This Year / Last Year */}
            <div className="flex gap-1">
              {presets.slice(7, 9).map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all text-center",
                    isPendingPreset(preset)
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar + Apply */}
          <div className="p-3">
            {/* Custom Navigation Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                className="h-7 w-7 bg-transparent p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-md inline-flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-slate-200">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                className="h-7 w-7 bg-transparent p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-md inline-flex items-center justify-center transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Custom Draggable Calendar */}
            <div
              className="select-none"
              onMouseLeave={() => isDragging && handleMouseUp()}
            >
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    className="h-8 w-8 text-slate-500 font-normal text-[0.7rem] text-center flex items-center justify-center"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isTodayDate = isToday(day);
                  const isStart = isRangeStart(day);
                  const isEnd = isRangeEnd(day);
                  const isMiddle = isRangeMiddle(day);
                  const isSingleDay = isStart && isEnd;

                  return (
                    <div
                      key={index}
                      className={cn(
                        "h-8 w-8 p-0 text-center text-sm flex items-center justify-center transition-colors",
                        !isCurrentMonth &&
                          "text-slate-600 opacity-50 cursor-pointer",
                        isCurrentMonth && "text-slate-300 cursor-pointer",
                        isTodayDate &&
                          !isStart &&
                          !isEnd &&
                          "ring-1 ring-cyan-400/50 text-cyan-400 rounded-md",
                        isMiddle && "bg-cyan-500/20 text-cyan-100",
                        isStart &&
                          !isSingleDay &&
                          "bg-cyan-500 text-white rounded-l-full cursor-grab active:cursor-grabbing",
                        isEnd &&
                          !isSingleDay &&
                          "bg-cyan-500 text-white rounded-r-full cursor-grab active:cursor-grabbing",
                        isSingleDay &&
                          "bg-cyan-500 text-white rounded-full cursor-grab active:cursor-grabbing",
                        !isStart &&
                          !isEnd &&
                          !isMiddle &&
                          isCurrentMonth &&
                          "hover:bg-white/10 rounded-md"
                      )}
                      onMouseDown={() => handleDayMouseDown(day)}
                      onMouseEnter={() => handleDayMouseEnter(day)}
                      onTouchStart={() => handleDayMouseDown(day)}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const element = document.elementFromPoint(
                          touch.clientX,
                          touch.clientY
                        );
                        const dateAttr = element?.getAttribute("data-date");
                        if (dateAttr) {
                          handleDayMouseEnter(new Date(dateAttr));
                        }
                      }}
                      data-date={day.toISOString()}
                    >
                      {format(day, "d")}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {pendingRange?.from && pendingRange?.to
                  ? `${format(pendingRange.from, "MMM d")} → ${format(pendingRange.to, "MMM d")}`
                  : pendingRange?.from
                    ? `${format(pendingRange.from, "MMM d")} → ?`
                    : "Select dates"}
              </span>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!canApply}
                className={cn(
                  "h-7 text-xs gap-1",
                  hasChanges
                    ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                )}
              >
                <Check className="w-3 h-3" />
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
