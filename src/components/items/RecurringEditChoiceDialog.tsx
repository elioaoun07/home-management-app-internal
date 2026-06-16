"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import { CalendarRange, Layers, Repeat } from "lucide-react";

export type RecurringEditMode = "this" | "future" | "all";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemWithDetails;
  /** Called with the user's choice. */
  onChoose: (mode: RecurringEditMode) => void;
  /** When true, hides the "This and all future" option (e.g. if not yet supported). */
  hideFuture?: boolean;
}

/**
 * Shared chooser for editing a recurring item.
 * Three modes:
 *   - "this"   → Create an exception for this occurrence only.
 *   - "future" → Split the series at this occurrence; future occurrences get
 *                the new rule.
 *   - "all"    → Update the whole series.
 *
 * Used by both /reminders (WebDayPlanner) and /calendar (WebEvents)
 * so the wording and behaviour match.
 */
export function RecurringEditChoiceDialog({
  open,
  onOpenChange,
  item,
  onChoose,
  hideFuture = false,
}: Props) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  const typeLabel =
    item.type === "event"
      ? "event"
      : item.type === "task"
        ? "task"
        : "reminder";

  const handle = (mode: RecurringEditMode) => {
    // Call onChoose LAST so the parent's state update (which may keep the
    // dialog block mounted) isn't immediately overridden by onOpenChange(false).
    onOpenChange(false);
    onChoose(mode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md neo-card border",
          isPink ? "border-pink-500/30" : "border-cyan-500/30",
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn(
              "flex items-center gap-2 text-xl",
              isPink ? "text-pink-300" : "text-cyan-300",
            )}
          >
            <Repeat className="w-5 h-5" />
            Edit recurring {typeLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-white/70 text-sm">
            This {typeLabel} repeats. What would you like to change?
          </p>

          <button
            type="button"
            onClick={() => handle("this")}
            className="w-full p-3 rounded-xl border text-left transition-all border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
          >
            <div className="flex items-start gap-3">
              <CalendarRange className="w-5 h-5 mt-0.5 text-cyan-400" />
              <div>
                <div className="font-semibold text-white mb-0.5">
                  This occurrence only
                </div>
                <div className="text-xs text-white/60">
                  Changes apply only to this specific date.
                </div>
              </div>
            </div>
          </button>

          {!hideFuture && (
            <button
              type="button"
              onClick={() => handle("future")}
              className="w-full p-3 rounded-xl border text-left transition-all border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
            >
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 mt-0.5 text-amber-400" />
                <div>
                  <div className="font-semibold text-white mb-0.5">
                    This and all future
                  </div>
                  <div className="text-xs text-white/60">
                    Past occurrences keep their current values.
                  </div>
                </div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => handle("all")}
            className="w-full p-3 rounded-xl border text-left transition-all border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
          >
            <div className="flex items-start gap-3">
              <Repeat className="w-5 h-5 mt-0.5 text-pink-400" />
              <div>
                <div className="font-semibold text-white mb-0.5">
                  Whole series
                </div>
                <div className="text-xs text-white/60">
                  Apply to every occurrence (past and future).
                </div>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/20 text-white/70 hover:bg-white/10"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
