"use client";

import { type ChorePostponeTarget } from "@/features/chores/useChoreActions";
import { useChoreTone } from "@/components/chores/choreUi";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns";
import {
  ArrowLeft,
  CalendarArrowDown,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ChorePostponeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPostpone: (to: ChorePostponeTarget, customDate?: string) => void;
  plannedAt?: string;
  onCloseAutoFocus?: (event: Event) => void;
}

export function ChorePostponeSheet({
  isOpen,
  onClose,
  onPostpone,
  plannedAt,
  onCloseAutoFocus,
}: ChorePostponeSheetProps) {
  const tone = useChoreTone();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState("");
  useEffect(() => {
    if (!isOpen) {
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

  const handleSelect = (to: ChorePostponeTarget) => {
    if (to === "custom") {
      setShowDatePicker(true);
      return;
    }
    onPostpone(to);
    onClose();
  };

  const handleCustomConfirm = () => {
    if (!customDate) return;
    onPostpone("custom", customDate);
    onClose();
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
      sublabel: null,
      Icon: CalendarRange,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        aria-describedby={undefined}
        className={cn(
          "bottom-0 top-auto max-h-[90dvh] max-w-full translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-3xl sm:p-6",
          "motion-reduce:animate-none",
          tone.tc.bgPage,
          tone.border,
        )}
      >
        <div className="flex items-center gap-3">
          {showDatePicker && (
            <button
              type="button"
              onClick={() => setShowDatePicker(false)}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                tone.ghost,
                tone.focus,
              )}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <DialogTitle className={cn("min-w-0 flex-1 text-base", tone.main)}>
            {showDatePicker ? "Pick a date" : "Postpone"}
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                tone.ghost,
                tone.focus,
              )}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </div>

        {showDatePicker ? (
          <div className="space-y-3">
            <input
              type="date"
              aria-label="Date"
              value={customDate}
              min={format(tomorrow, "yyyy-MM-dd")}
              onChange={(event) => setCustomDate(event.target.value)}
              className={cn(
                "h-12 w-full min-w-0 rounded-xl border px-4 text-sm outline-none",
                tone.tc.formControlBg,
                tone.main,
                tone.focus,
                tone.isFrost ? "[color-scheme:light]" : "[color-scheme:dark]",
              )}
            />
            <button
              type="button"
              onClick={handleCustomConfirm}
              disabled={!customDate}
              className={cn(
                "h-12 w-full rounded-xl text-sm font-semibold transition-colors disabled:opacity-40",
                tone.tc.buttonPrimary,
                tone.tc.textButton,
                tone.focus,
              )}
            >
              Move
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
                  "flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  tone.row,
                  tone.tc.bgHover,
                  tone.focus,
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    tone.accentSurface,
                  )}
                >
                  <Icon className={cn("h-4 w-4", tone.accent)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", tone.main)}>
                    {label}
                  </p>
                  {sublabel && (
                    <p className={cn("mt-0.5 text-xs", tone.soft)}>
                      {sublabel}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
