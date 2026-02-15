// src/components/items/SmartAlertPicker.tsx
// Reusable component for selecting alert timing with smart options
// Supports "X days before at HH:MM" style alerts

"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronDown, Clock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Alert preset options
const QUICK_PRESETS = [
  { label: "None", minutes: 0 },
  { label: "At time", minutes: 0, atTime: true },
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
];

// Days options for custom picker
const DAYS_OPTIONS = [
  { label: "Same day", days: 0 },
  { label: "1 day before", days: 1 },
  { label: "2 days before", days: 2 },
  { label: "3 days before", days: 3 },
  { label: "1 week before", days: 7 },
];

export interface SmartAlertValue {
  offsetMinutes: number;
  customTime?: string | null; // HH:MM format
}

interface SmartAlertPickerProps {
  value: SmartAlertValue;
  onChange: (value: SmartAlertValue) => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "compact";
  eventTime?: string; // HH:MM - the time of the event (to show preview)
}

export function SmartAlertPicker({
  value,
  onChange,
  disabled = false,
  className,
  variant = "default",
  eventTime,
}: SmartAlertPickerProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState(1);
  const [customTimeValue, setCustomTimeValue] = useState("09:00");
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if current value is a custom alert (has customTime set)
  const isCustomAlert = Boolean(value.customTime);
  const hasAlert = value.offsetMinutes > 0 || isCustomAlert;

  // Get display text for current value
  const getDisplayText = (): string => {
    if (value.offsetMinutes === 0 && !value.customTime) {
      return "No alert";
    }

    if (value.customTime) {
      const days = Math.floor(value.offsetMinutes / 1440);
      const timeFormatted = formatTime12h(value.customTime);
      if (days === 0) {
        return `Same day at ${timeFormatted}`;
      }
      return `${days} day${days > 1 ? "s" : ""} before at ${timeFormatted}`;
    }

    // Simple offset
    if (value.offsetMinutes < 60) {
      return `${value.offsetMinutes}m before`;
    }
    if (value.offsetMinutes < 1440) {
      const hours = value.offsetMinutes / 60;
      return `${hours}h before`;
    }
    const days = value.offsetMinutes / 1440;
    return `${days} day${days > 1 ? "s" : ""} before`;
  };

  // Format time to 12h format
  function formatTime12h(time: string): string {
    const [hours, minutes] = time.split(":").map(Number);
    const h = hours % 12 || 12;
    const ampm = hours < 12 ? "AM" : "PM";
    return `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  }

  // Handle quick preset selection
  const handlePresetClick = (preset: (typeof QUICK_PRESETS)[0]) => {
    if (preset.label === "None") {
      onChange({ offsetMinutes: 0, customTime: null });
    } else if (preset.atTime) {
      // "At time" means 0 offset without custom time
      onChange({ offsetMinutes: 0, customTime: null });
    } else {
      onChange({ offsetMinutes: preset.minutes, customTime: null });
    }
    setShowCustom(false);
  };

  // Handle custom alert save
  const handleSaveCustom = () => {
    onChange({
      offsetMinutes: customDays * 1440,
      customTime: customTimeValue,
    });
    setShowCustom(false);
  };

  // Close custom panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowCustom(false);
      }
    }
    if (showCustom) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCustom]);

  // Initialize custom picker with current values
  useEffect(() => {
    if (showCustom && isCustomAlert) {
      setCustomDays(Math.floor(value.offsetMinutes / 1440));
      setCustomTimeValue(value.customTime || "09:00");
    }
  }, [showCustom, isCustomAlert, value.offsetMinutes, value.customTime]);

  // Check if a preset is currently selected
  const isPresetSelected = (preset: (typeof QUICK_PRESETS)[0]): boolean => {
    if (isCustomAlert) return false;
    if (preset.atTime) {
      return value.offsetMinutes === 0 && !isCustomAlert;
    }
    return value.offsetMinutes === preset.minutes && !value.customTime;
  };

  if (variant === "compact") {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        {/* Compact trigger button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
            "border",
            disabled && "opacity-50 cursor-not-allowed",
            hasAlert || isCustomAlert
              ? isPink
                ? "bg-pink-500/20 border-pink-500/30 text-pink-300"
                : "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10",
          )}
        >
          <Bell className="w-4 h-4" />
          <span>{getDisplayText()}</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 ml-auto transition-transform",
              showCustom && "rotate-180",
            )}
          />
        </button>

        {/* Dropdown panel */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute top-full left-0 right-0 mt-2 z-50",
                "bg-[#1a1a2e]/95 backdrop-blur-xl border rounded-xl p-3",
                isPink ? "border-pink-500/20" : "border-cyan-500/20",
              )}
            >
              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                      "border",
                      isPresetSelected(preset)
                        ? isPink
                          ? "bg-pink-500/30 border-pink-500/50 text-pink-200"
                          : "bg-cyan-500/30 border-cyan-500/50 text-cyan-200"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom time picker */}
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs text-white/50 mb-2">Custom alert:</p>
                <div className="flex items-center gap-2">
                  <select
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10",
                      "text-white focus:outline-none",
                      isPink
                        ? "focus:border-pink-500/50"
                        : "focus:border-cyan-500/50",
                    )}
                  >
                    {DAYS_OPTIONS.map((opt) => (
                      <option key={opt.days} value={opt.days}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-white/40 text-sm">at</span>
                  <input
                    type="time"
                    value={customTimeValue}
                    onChange={(e) => setCustomTimeValue(e.target.value)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10",
                      "text-white focus:outline-none w-24",
                      isPink
                        ? "focus:border-pink-500/50"
                        : "focus:border-cyan-500/50",
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className={cn(
                    "w-full mt-2 py-1.5 rounded-lg text-sm font-medium transition-all",
                    isPink
                      ? "bg-pink-500/30 hover:bg-pink-500/40 text-pink-200"
                      : "bg-cyan-500/30 hover:bg-cyan-500/40 text-cyan-200",
                  )}
                >
                  Set Custom Alert
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default variant - inline with expandable custom
  return (
    <div ref={containerRef} className={cn("space-y-3", className)}>
      {/* Quick preset buttons */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PRESETS.map((preset) => (
          <motion.button
            key={preset.label}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
            className={cn(
              "px-3 py-2 rounded-xl border text-sm font-medium transition-all",
              disabled && "opacity-50 cursor-not-allowed",
              isPresetSelected(preset)
                ? isPink
                  ? "bg-gradient-to-r from-pink-500/30 to-pink-600/20 border-pink-500/50 text-pink-200 shadow-lg shadow-pink-500/20"
                  : "bg-gradient-to-r from-cyan-500/30 to-cyan-600/20 border-cyan-500/50 text-cyan-200 shadow-lg shadow-cyan-500/20"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:border-white/20",
            )}
          >
            {preset.label}
          </motion.button>
        ))}

        {/* Custom button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCustom(!showCustom)}
          disabled={disabled}
          className={cn(
            "px-3 py-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-1.5",
            disabled && "opacity-50 cursor-not-allowed",
            isCustomAlert || showCustom
              ? isPink
                ? "bg-gradient-to-r from-pink-500/30 to-pink-600/20 border-pink-500/50 text-pink-200 shadow-lg shadow-pink-500/20"
                : "bg-gradient-to-r from-cyan-500/30 to-cyan-600/20 border-cyan-500/50 text-cyan-200 shadow-lg shadow-cyan-500/20"
              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:border-white/20",
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          {isCustomAlert ? getDisplayText() : "Custom"}
        </motion.button>
      </div>

      {/* Expandable custom picker */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "p-4 rounded-xl border",
                "bg-gradient-to-br from-white/5 to-transparent",
                isPink ? "border-pink-500/20" : "border-cyan-500/20",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isPink ? "text-pink-300" : "text-cyan-300",
                  )}
                >
                  Custom Alert Time
                </p>
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Days selector */}
                <div className="flex-1">
                  <label className="text-xs text-white/50 mb-1 block">
                    Days before
                  </label>
                  <select
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl text-sm",
                      "bg-white/5 border border-white/10",
                      "text-white focus:outline-none",
                      isPink
                        ? "focus:border-pink-500/50"
                        : "focus:border-cyan-500/50",
                    )}
                  >
                    {DAYS_OPTIONS.map((opt) => (
                      <option key={opt.days} value={opt.days}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-white/40 pt-5">at</span>

                {/* Time input */}
                <div className="w-28">
                  <label className="text-xs text-white/50 mb-1 block">
                    Time
                  </label>
                  <input
                    type="time"
                    value={customTimeValue}
                    onChange={(e) => setCustomTimeValue(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl text-sm",
                      "bg-white/5 border border-white/10",
                      "text-white focus:outline-none",
                      isPink
                        ? "focus:border-pink-500/50"
                        : "focus:border-cyan-500/50",
                    )}
                  />
                </div>
              </div>

              {/* Preview */}
              {eventTime && (
                <p className="mt-3 text-xs text-white/40">
                  Preview: Alert will fire{" "}
                  {customDays > 0
                    ? `${customDays} day${customDays > 1 ? "s" : ""} before`
                    : "same day"}{" "}
                  at {formatTime12h(customTimeValue)}
                </p>
              )}

              {/* Apply button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveCustom}
                className={cn(
                  "w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  isPink
                    ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:opacity-90"
                    : "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:opacity-90",
                )}
              >
                Apply Custom Alert
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export helper to format alert for display
export function formatAlertDisplay(
  offsetMinutes: number,
  customTime?: string | null,
): string {
  if (offsetMinutes === 0 && !customTime) {
    return "No alert";
  }

  if (customTime) {
    const days = Math.floor(offsetMinutes / 1440);
    const [hours, minutes] = customTime.split(":").map(Number);
    const h = hours % 12 || 12;
    const ampm = hours < 12 ? "AM" : "PM";
    const timeFormatted = `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;

    if (days === 0) {
      return `Same day at ${timeFormatted}`;
    }
    return `${days} day${days > 1 ? "s" : ""} before at ${timeFormatted}`;
  }

  // Simple offset
  if (offsetMinutes < 60) {
    return `${offsetMinutes} min before`;
  }
  if (offsetMinutes < 1440) {
    const hours = offsetMinutes / 60;
    return `${hours} hour${hours > 1 ? "s" : ""} before`;
  }
  const days = offsetMinutes / 1440;
  return `${days} day${days > 1 ? "s" : ""} before`;
}
