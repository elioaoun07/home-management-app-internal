"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

// Icons
const RepeatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Types
type FrequencyType = "daily" | "weekly" | "monthly" | "yearly";
type MonthlyMode = "day-of-month" | "day-of-week" | "last-day";

interface WeekDay {
  value: string; // RRULE day code
  label: string;
  shortLabel: string;
}

const WEEKDAYS: WeekDay[] = [
  { value: "MO", label: "Monday", shortLabel: "Mon" },
  { value: "TU", label: "Tuesday", shortLabel: "Tue" },
  { value: "WE", label: "Wednesday", shortLabel: "Wed" },
  { value: "TH", label: "Thursday", shortLabel: "Thu" },
  { value: "FR", label: "Friday", shortLabel: "Fri" },
  { value: "SA", label: "Saturday", shortLabel: "Sat" },
  { value: "SU", label: "Sunday", shortLabel: "Sun" },
];

const WEEK_POSITIONS = [
  { value: "1", label: "First" },
  { value: "2", label: "Second" },
  { value: "3", label: "Third" },
  { value: "4", label: "Fourth" },
  { value: "-1", label: "Last" },
];

interface CustomRecurrencePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string; // Current RRULE string
  onChange: (rrule: string) => void;
  /** Reference date for determining default day-of-month */
  referenceDate?: Date;
}

/**
 * Parse an RRULE string to extract its components
 */
function parseRRule(rrule: string): {
  freq: FrequencyType;
  interval: number;
  byDay: string[];
  byMonthDay: number[];
  bySetPos: number | null;
} {
  const result = {
    freq: "monthly" as FrequencyType,
    interval: 1,
    byDay: [] as string[],
    byMonthDay: [] as number[],
    bySetPos: null as number | null,
  };

  if (!rrule) return result;

  // Remove RRULE: prefix if present
  const cleanRrule = rrule.replace(/^RRULE:/, "");
  const parts = cleanRrule.split(";");

  for (const part of parts) {
    const [key, value] = part.split("=");
    switch (key) {
      case "FREQ":
        result.freq = value.toLowerCase() as FrequencyType;
        break;
      case "INTERVAL":
        result.interval = parseInt(value, 10) || 1;
        break;
      case "BYDAY":
        result.byDay = value.split(",");
        break;
      case "BYMONTHDAY":
        result.byMonthDay = value.split(",").map((v) => parseInt(v, 10));
        break;
      case "BYSETPOS":
        result.bySetPos = parseInt(value, 10);
        break;
    }
  }

  return result;
}

/**
 * Build an RRULE string from components
 */
function buildRRule(params: {
  freq: FrequencyType;
  interval: number;
  byDay?: string[];
  byMonthDay?: number[];
  bySetPos?: number | null;
}): string {
  const parts: string[] = [`FREQ=${params.freq.toUpperCase()}`];

  if (params.interval > 1) {
    parts.push(`INTERVAL=${params.interval}`);
  }

  if (params.byDay && params.byDay.length > 0) {
    // For monthly with position, prepend position to day (e.g., "1SA" for first Saturday)
    if (params.freq === "monthly" && params.bySetPos) {
      parts.push(`BYDAY=${params.bySetPos}${params.byDay[0]}`);
    } else {
      parts.push(`BYDAY=${params.byDay.join(",")}`);
    }
  }

  if (params.byMonthDay && params.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${params.byMonthDay.join(",")}`);
  }

  return parts.join(";");
}

/**
 * Get human-readable description of the recurrence rule
 */
export function describeRRule(rrule: string): string {
  if (!rrule) return "Never";

  const parsed = parseRRule(rrule);
  const intervalText =
    parsed.interval > 1 ? `Every ${parsed.interval} ` : "Every ";

  switch (parsed.freq) {
    case "daily":
      return parsed.interval === 1 ? "Daily" : `Every ${parsed.interval} days`;
    case "weekly":
      if (parsed.byDay.length > 0) {
        const days = parsed.byDay
          .map((d) => WEEKDAYS.find((w) => w.value === d)?.shortLabel || d)
          .join(", ");
        return parsed.interval === 1
          ? `Weekly on ${days}`
          : `Every ${parsed.interval} weeks on ${days}`;
      }
      return parsed.interval === 1
        ? "Weekly"
        : `Every ${parsed.interval} weeks`;
    case "monthly":
      if (parsed.byMonthDay.length > 0) {
        if (parsed.byMonthDay[0] === -1) {
          return parsed.interval === 1
            ? "Monthly on the last day"
            : `Every ${parsed.interval} months on the last day`;
        }
        const day = parsed.byMonthDay[0];
        const suffix = getOrdinalSuffix(day);
        return parsed.interval === 1
          ? `Monthly on the ${day}${suffix}`
          : `Every ${parsed.interval} months on the ${day}${suffix}`;
      }
      if (parsed.byDay.length > 0) {
        // Check if day includes position (e.g., "1SA", "-1FR")
        const dayCode = parsed.byDay[0];
        const posMatch = dayCode.match(/^(-?\d+)([A-Z]{2})$/);
        if (posMatch) {
          const pos = parseInt(posMatch[1], 10);
          const day = posMatch[2];
          const dayName = WEEKDAYS.find((w) => w.value === day)?.label || day;
          const posName =
            WEEK_POSITIONS.find((p) => p.value === pos.toString())?.label ||
            pos.toString();
          return parsed.interval === 1
            ? `Monthly on the ${posName.toLowerCase()} ${dayName}`
            : `Every ${parsed.interval} months on the ${posName.toLowerCase()} ${dayName}`;
        }
      }
      return parsed.interval === 1
        ? "Monthly"
        : `Every ${parsed.interval} months`;
    case "yearly":
      return parsed.interval === 1
        ? "Yearly"
        : `Every ${parsed.interval} years`;
    default:
      return "Custom";
  }
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function CustomRecurrencePicker({
  open,
  onOpenChange,
  value,
  onChange,
  referenceDate,
}: CustomRecurrencePickerProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  // Parse initial value
  const parsed = parseRRule(value);

  // Local state
  const [frequency, setFrequency] = useState<FrequencyType>(parsed.freq);
  const [interval, setInterval] = useState(parsed.interval);
  const [selectedDays, setSelectedDays] = useState<string[]>(parsed.byDay);
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>(() => {
    if (parsed.byMonthDay.includes(-1)) return "last-day";
    if (parsed.byMonthDay.length > 0) return "day-of-month";
    if (parsed.byDay.length > 0) return "day-of-week";
    return "day-of-month";
  });
  const [dayOfMonth, setDayOfMonth] = useState(() => {
    if (parsed.byMonthDay.length > 0 && parsed.byMonthDay[0] !== -1) {
      return parsed.byMonthDay[0];
    }
    return referenceDate?.getDate() || 1;
  });
  const [weekPosition, setWeekPosition] = useState(() => {
    if (parsed.byDay.length > 0) {
      const posMatch = parsed.byDay[0].match(/^(-?\d+)/);
      if (posMatch) return posMatch[1];
    }
    return "1";
  });
  const [monthlyWeekday, setMonthlyWeekday] = useState(() => {
    if (parsed.byDay.length > 0) {
      const dayMatch = parsed.byDay[0].match(/([A-Z]{2})$/);
      if (dayMatch) return dayMatch[1];
    }
    // Default to day of week from reference date
    if (referenceDate) {
      const dayIndex = referenceDate.getDay();
      // getDay returns 0=Sun, 1=Mon, etc. Convert to RRULE format
      const rruleDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      return rruleDays[dayIndex];
    }
    return "MO";
  });

  // Reset state when opening with new value
  useEffect(() => {
    if (open) {
      const p = parseRRule(value);
      setFrequency(p.freq);
      setInterval(p.interval);
      setSelectedDays(
        p.byDay.map((d) => {
          // Strip position from day codes for weekly view
          const match = d.match(/([A-Z]{2})$/);
          return match ? match[1] : d;
        }),
      );
      if (p.byMonthDay.includes(-1)) {
        setMonthlyMode("last-day");
      } else if (p.byMonthDay.length > 0) {
        setMonthlyMode("day-of-month");
        setDayOfMonth(p.byMonthDay[0]);
      } else if (p.byDay.length > 0) {
        setMonthlyMode("day-of-week");
        const dayCode = p.byDay[0];
        const posMatch = dayCode.match(/^(-?\d+)/);
        const dayMatch = dayCode.match(/([A-Z]{2})$/);
        if (posMatch) setWeekPosition(posMatch[1]);
        if (dayMatch) setMonthlyWeekday(dayMatch[1]);
      }
    }
  }, [open, value]);

  const handleSave = () => {
    let rrule: string;

    switch (frequency) {
      case "daily":
        rrule = buildRRule({ freq: "daily", interval });
        break;
      case "weekly":
        rrule = buildRRule({
          freq: "weekly",
          interval,
          byDay: selectedDays.length > 0 ? selectedDays : undefined,
        });
        break;
      case "monthly":
        if (monthlyMode === "last-day") {
          rrule = buildRRule({ freq: "monthly", interval, byMonthDay: [-1] });
        } else if (monthlyMode === "day-of-month") {
          rrule = buildRRule({
            freq: "monthly",
            interval,
            byMonthDay: [dayOfMonth],
          });
        } else {
          rrule = buildRRule({
            freq: "monthly",
            interval,
            byDay: [monthlyWeekday],
            bySetPos: parseInt(weekPosition, 10),
          });
        }
        break;
      case "yearly":
        rrule = buildRRule({ freq: "yearly", interval });
        break;
      default:
        rrule = "";
    }

    onChange(rrule);
    onOpenChange(false);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const themeColor = isPink ? "pink" : "cyan";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "bg-gray-900/95 backdrop-blur-xl border-t",
          isPink ? "border-pink-500/30" : "border-cyan-500/30",
        )}
      >
        <DrawerHeader>
          <DrawerTitle
            className={cn(
              "flex items-center gap-2",
              isPink ? "text-pink-400" : "text-cyan-400",
            )}
          >
            <RepeatIcon className="w-5 h-5" />
            Custom Repeat
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Frequency Selection */}
          <div className="space-y-2">
            <Label className="text-sm text-white/70">Frequency</Label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly" },
                ] as { value: FrequencyType; label: string }[]
              ).map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => setFrequency(freq.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm transition-all",
                    frequency === freq.value
                      ? isPink
                        ? "bg-pink-500/30 text-pink-300 border border-pink-400/50"
                        : "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                      : "bg-white/10 text-white/60 border border-transparent",
                  )}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interval */}
          <div className="space-y-2">
            <Label className="text-sm text-white/70">Every</Label>
            <div className="flex items-center gap-3">
              <Input
                type="text"
                inputMode="numeric"
                min={1}
                max={99}
                value={interval}
                onChange={(e) =>
                  setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className={cn(
                  "w-20 bg-white/10 border-white/20 text-white text-center",
                  isPink
                    ? "focus:border-pink-400/50"
                    : "focus:border-cyan-400/50",
                )}
              />
              <span className="text-white/60">
                {frequency === "daily" && (interval === 1 ? "day" : "days")}
                {frequency === "weekly" && (interval === 1 ? "week" : "weeks")}
                {frequency === "monthly" &&
                  (interval === 1 ? "month" : "months")}
                {frequency === "yearly" && (interval === 1 ? "year" : "years")}
              </span>
            </div>
          </div>

          {/* Weekly: Day Selection */}
          <AnimatePresence mode="wait">
            {frequency === "weekly" && (
              <motion.div
                key="weekly-options"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label className="text-sm text-white/70">On these days</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "w-11 h-11 rounded-full text-xs font-medium transition-all flex items-center justify-center",
                        selectedDays.includes(day.value)
                          ? isPink
                            ? "bg-pink-500/40 text-pink-200 border-2 border-pink-400"
                            : "bg-cyan-500/40 text-cyan-200 border-2 border-cyan-400"
                          : "bg-white/10 text-white/50 border border-transparent",
                      )}
                    >
                      {day.shortLabel}
                    </button>
                  ))}
                </div>
                {selectedDays.length === 0 && (
                  <p className="text-xs text-white/40">
                    No days selected — will repeat on the original day
                  </p>
                )}
              </motion.div>
            )}

            {/* Monthly: Mode Selection */}
            {frequency === "monthly" && (
              <motion.div
                key="monthly-options"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-sm text-white/70">Repeat on</Label>
                  <div className="flex flex-col gap-2">
                    {/* Day of Month Option */}
                    <button
                      type="button"
                      onClick={() => setMonthlyMode("day-of-month")}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                        monthlyMode === "day-of-month"
                          ? isPink
                            ? "bg-pink-500/20 border border-pink-400/50"
                            : "bg-cyan-500/20 border border-cyan-400/50"
                          : "bg-white/5 border border-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          monthlyMode === "day-of-month"
                            ? isPink
                              ? "border-pink-400 bg-pink-500/30"
                              : "border-cyan-400 bg-cyan-500/30"
                            : "border-white/30",
                        )}
                      >
                        {monthlyMode === "day-of-month" && (
                          <CheckIcon
                            className={cn(
                              "w-3 h-3",
                              isPink ? "text-pink-300" : "text-cyan-300",
                            )}
                          />
                        )}
                      </div>
                      <span className="text-white/80">
                        Day{" "}
                        <span
                          className={isPink ? "text-pink-300" : "text-cyan-300"}
                        >
                          {dayOfMonth}
                        </span>{" "}
                        of each month
                      </span>
                    </button>

                    {/* Day of Week Option */}
                    <button
                      type="button"
                      onClick={() => setMonthlyMode("day-of-week")}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                        monthlyMode === "day-of-week"
                          ? isPink
                            ? "bg-pink-500/20 border border-pink-400/50"
                            : "bg-cyan-500/20 border border-cyan-400/50"
                          : "bg-white/5 border border-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          monthlyMode === "day-of-week"
                            ? isPink
                              ? "border-pink-400 bg-pink-500/30"
                              : "border-cyan-400 bg-cyan-500/30"
                            : "border-white/30",
                        )}
                      >
                        {monthlyMode === "day-of-week" && (
                          <CheckIcon
                            className={cn(
                              "w-3 h-3",
                              isPink ? "text-pink-300" : "text-cyan-300",
                            )}
                          />
                        )}
                      </div>
                      <span className="text-white/80">
                        The{" "}
                        <span
                          className={isPink ? "text-pink-300" : "text-cyan-300"}
                        >
                          {WEEK_POSITIONS.find((p) => p.value === weekPosition)
                            ?.label || "first"}
                        </span>{" "}
                        <span
                          className={isPink ? "text-pink-300" : "text-cyan-300"}
                        >
                          {WEEKDAYS.find((d) => d.value === monthlyWeekday)
                            ?.label || "Monday"}
                        </span>
                      </span>
                    </button>

                    {/* Last Day Option */}
                    <button
                      type="button"
                      onClick={() => setMonthlyMode("last-day")}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                        monthlyMode === "last-day"
                          ? isPink
                            ? "bg-pink-500/20 border border-pink-400/50"
                            : "bg-cyan-500/20 border border-cyan-400/50"
                          : "bg-white/5 border border-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                          monthlyMode === "last-day"
                            ? isPink
                              ? "border-pink-400 bg-pink-500/30"
                              : "border-cyan-400 bg-cyan-500/30"
                            : "border-white/30",
                        )}
                      >
                        {monthlyMode === "last-day" && (
                          <CheckIcon
                            className={cn(
                              "w-3 h-3",
                              isPink ? "text-pink-300" : "text-cyan-300",
                            )}
                          />
                        )}
                      </div>
                      <span className="text-white/80">
                        Last day of month{" "}
                        <span className="text-white/40 text-xs">
                          (28, 29, 30, or 31)
                        </span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* Day of Month Picker */}
                {monthlyMode === "day-of-month" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <Label className="text-sm text-white/60">
                      Day of month
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={dayOfMonth}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v >= 1 && v <= 31) setDayOfMonth(v);
                          else if (e.target.value === "") setDayOfMonth(1);
                        }}
                        className={cn(
                          "w-20 text-center bg-white/10 border",
                          isPink
                            ? "border-pink-500/30 focus:border-pink-400"
                            : "border-cyan-500/30 focus:border-cyan-400",
                        )}
                        min={1}
                        max={31}
                      />
                      <span className="text-sm text-white/40">(1–31)</span>
                    </div>
                    <p className="text-xs text-white/40">
                      If a month has fewer days, it will repeat on the last day
                    </p>
                  </motion.div>
                )}

                {/* Day of Week Picker */}
                {monthlyMode === "day-of-week" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Position Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm text-white/60">
                        Which week
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_POSITIONS.map((pos) => (
                          <button
                            key={pos.value}
                            type="button"
                            onClick={() => setWeekPosition(pos.value)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-sm transition-all",
                              weekPosition === pos.value
                                ? isPink
                                  ? "bg-pink-500/30 text-pink-300 border border-pink-400/50"
                                  : "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                                : "bg-white/10 text-white/60 border border-transparent",
                            )}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Weekday Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm text-white/60">
                        Which day of the week
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setMonthlyWeekday(day.value)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-sm transition-all",
                              monthlyWeekday === day.value
                                ? isPink
                                  ? "bg-pink-500/30 text-pink-300 border border-pink-400/50"
                                  : "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                                : "bg-white/10 text-white/60 border border-transparent",
                            )}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preview */}
          <div
            className={cn(
              "p-3 rounded-lg border",
              isPink
                ? "bg-pink-500/10 border-pink-500/30"
                : "bg-cyan-500/10 border-cyan-500/30",
            )}
          >
            <p className="text-xs text-white/50 mb-1">Preview</p>
            <p
              className={cn(
                "text-sm",
                isPink ? "text-pink-300" : "text-cyan-300",
              )}
            >
              {describeRRule(
                buildRRule({
                  freq: frequency,
                  interval,
                  byDay:
                    frequency === "weekly"
                      ? selectedDays.length > 0
                        ? selectedDays
                        : undefined
                      : frequency === "monthly" && monthlyMode === "day-of-week"
                        ? [monthlyWeekday]
                        : undefined,
                  byMonthDay:
                    frequency === "monthly"
                      ? monthlyMode === "last-day"
                        ? [-1]
                        : monthlyMode === "day-of-month"
                          ? [dayOfMonth]
                          : undefined
                      : undefined,
                  bySetPos:
                    frequency === "monthly" && monthlyMode === "day-of-week"
                      ? parseInt(weekPosition, 10)
                      : undefined,
                }),
              )}
            </p>
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <DrawerClose asChild>
            <Button variant="ghost" className="flex-1 text-white/70">
              Cancel
            </Button>
          </DrawerClose>
          <Button
            onClick={handleSave}
            className={cn(
              "flex-1",
              isPink
                ? "bg-pink-500 hover:bg-pink-600"
                : "bg-cyan-500 hover:bg-cyan-600",
            )}
          >
            Apply
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
