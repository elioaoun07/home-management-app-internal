"use client";

import { type ChorePostponeTarget } from "@/features/chores/useChoreActions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns";
import {
  CalendarArrowDown,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

interface ChorePostponeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPostpone: (to: ChorePostponeTarget, customDate?: string) => void;
  plannedAt?: string;
}

export function ChorePostponeSheet({
  isOpen,
  onClose,
  onPostpone,
  plannedAt,
}: ChorePostponeSheetProps) {
  const tc = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
      setShowDatePicker(false);
      setCustomDate("");
    }
  }, [isOpen]);

  const baseDate = useMemo(() => {
    if (!plannedAt) return new Date();
    try {
      return parseISO(plannedAt);
    } catch {
      return new Date();
    }
  }, [plannedAt]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const handleSelect = (to: ChorePostponeTarget) => {
    if (to === "custom") {
      setShowDatePicker(true);
      return;
    }
    onPostpone(to);
    handleClose();
  };

  const handleCustomConfirm = () => {
    if (!customDate) return;
    onPostpone("custom", customDate);
    handleClose();
  };

  const tomorrow = addDays(baseDate, 1);
  const endOfPlannedWeek = endOfWeek(baseDate, { weekStartsOn: 1 });
  const nextWeek = addWeeks(baseDate, 1);

  const options = [
    {
      id: "tomorrow" as const,
      label: "Tomorrow",
      sublabel: format(tomorrow, "EEE, MMM d"),
      Icon: CalendarArrowDown,
    },
    {
      id: "end_of_week" as const,
      label: "End of week",
      sublabel: format(endOfPlannedWeek, "EEE, MMM d"),
      Icon: CalendarClock,
    },
    {
      id: "next_week" as const,
      label: "Next week",
      sublabel: format(nextWeek, "EEE, MMM d"),
      Icon: CalendarPlus,
    },
    {
      id: "custom" as const,
      label: "Pick a date",
      sublabel: "Choose a calendar day",
      Icon: CalendarRange,
    },
  ];

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity",
          isClosing ? "opacity-0" : "opacity-100",
        )}
        onClick={handleClose}
      />

      <div
        className={cn(
          "relative w-full rounded-t-3xl border-t border-white/10 p-5 pb-8 transition-transform",
          tc.pageBg,
          isClosing ? "translate-y-full" : "translate-y-0",
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/70">
            {showDatePicker ? "Pick a date" : "Postpone chore"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-white/10 p-2 text-white/50 hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showDatePicker ? (
          <div className="space-y-3">
            <input
              type="date"
              value={customDate}
              min={format(tomorrow, "yyyy-MM-dd")}
              onChange={(event) => setCustomDate(event.target.value)}
              className={cn(
                "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white",
                "focus:border-emerald-500/50 focus:outline-none",
              )}
            />
            <button
              type="button"
              onClick={handleCustomConfirm}
              disabled={!customDate}
              className="w-full rounded-xl bg-emerald-500/20 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {options.map(({ id, label, sublabel, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-white/5 px-4 py-3 text-left transition-colors active:scale-[0.98]",
                  tc.surfaceBg,
                  "hover:border-white/10",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80">{label}</p>
                  <p className="text-xs text-white/40">{sublabel}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
