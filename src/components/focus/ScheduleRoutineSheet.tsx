"use client";

/**
 * ScheduleRoutineSheet - Bottom drawer for scheduling flexible routines
 * Shows calendar picker, optional time picker, and task details
 */

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  type FlexibleRoutineItem,
  getPeriodBoundaries,
  useScheduleRoutine,
} from "@/features/items/useFlexibleRoutines";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { FLEXIBLE_PERIOD_LABELS } from "@/types/items";
import { format, isWithinInterval } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  ListTodo,
  Repeat,
  Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface ScheduleRoutineSheetProps {
  item: FlexibleRoutineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

export function ScheduleRoutineSheet({
  item,
  open,
  onOpenChange,
  onScheduled,
}: ScheduleRoutineSheetProps) {
  const themeClasses = useThemeClasses();
  const scheduleRoutine = useScheduleRoutine();

  // State
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate period boundaries
  const periodBoundaries = useMemo(() => {
    if (!item?.recurrence_rule?.flexible_period) return null;
    return getPeriodBoundaries(
      new Date(),
      item.recurrence_rule.flexible_period,
    );
  }, [item?.recurrence_rule?.flexible_period]);

  // Reset state when drawer opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && item?.flexibleSchedule) {
        // Pre-fill with existing schedule
        setSelectedDate(new Date(item.flexibleSchedule.scheduled_for_date));
        setSelectedTime(item.flexibleSchedule.scheduled_for_time || "");
      } else if (newOpen) {
        // Reset for new schedule
        setSelectedDate(undefined);
        setSelectedTime("");
      }
      onOpenChange(newOpen);
    },
    [item, onOpenChange],
  );

  // Handle schedule submission
  const handleSchedule = useCallback(async () => {
    if (!item || !selectedDate || !periodBoundaries) return;

    setIsSubmitting(true);

    try {
      const periodStartStr = format(periodBoundaries.start, "yyyy-MM-dd");
      const scheduledDateStr = format(selectedDate, "yyyy-MM-dd");

      // Store the action for undo
      const previousSchedule = item.flexibleSchedule;

      await scheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate: periodStartStr,
        scheduledForDate: scheduledDateStr,
        scheduledForTime: selectedTime || null,
      });

      const formattedDate = format(selectedDate, "EEE, MMM d");
      const timeLabel = selectedTime ? ` at ${selectedTime}` : "";

      toast.success(`Scheduled for ${formattedDate}${timeLabel}`, {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (previousSchedule) {
              // Restore previous schedule
              await scheduleRoutine.mutateAsync({
                itemId: item.id,
                periodStartDate: previousSchedule.period_start_date,
                scheduledForDate: previousSchedule.scheduled_for_date,
                scheduledForTime: previousSchedule.scheduled_for_time || null,
              });
            } else {
              // Delete the schedule we just created
              // Note: We'd need to add an unschedule mutation for this
              // For now, just show a message
              toast.info("Schedule will reset on refresh");
            }
          },
        },
      });

      onOpenChange(false);
      onScheduled?.();
    } catch (error) {
      console.error("Failed to schedule routine:", error);
      toast.error("Failed to schedule. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    item,
    selectedDate,
    selectedTime,
    periodBoundaries,
    scheduleRoutine,
    onOpenChange,
    onScheduled,
  ]);

  // Disable dates outside the period
  const isDateDisabled = useCallback(
    (date: Date) => {
      if (!periodBoundaries) return true;
      return !isWithinInterval(date, {
        start: periodBoundaries.start,
        end: periodBoundaries.end,
      });
    },
    [periodBoundaries],
  );

  if (!item) return null;

  const period = item.recurrence_rule?.flexible_period || "weekly";
  const periodLabel = FLEXIBLE_PERIOD_LABELS[period];

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="bg-bg-base border-white/10">
        {/* Handle */}
        <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-white/20" />

        <DrawerHeader className="pb-2">
          <DrawerTitle
            className={cn("text-lg font-semibold", themeClasses.headerText)}
          >
            Schedule {item.title}
          </DrawerTitle>
          <p className={cn("text-sm", themeClasses.textMuted)}>
            Pick a day within this {periodLabel.toLowerCase()}
          </p>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Task Info Card */}
          <div
            className={cn(
              "rounded-xl p-4",
              "bg-bg-card-custom/30 border border-white/10",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={cn("font-medium", themeClasses.headerText)}>
                  {item.title}
                </h4>
                {item.description && (
                  <p
                    className={cn(
                      "text-sm line-clamp-2 mt-0.5",
                      themeClasses.textMuted,
                    )}
                  >
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {/* Period badge */}
                  <div
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                      "bg-white/5 border border-white/10",
                      themeClasses.textFaint,
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <Repeat className="w-3 h-3" />
                      {periodLabel}
                    </div>
                  </div>

                  {/* Subtask count */}
                  {item.subtaskProgress && item.subtaskProgress.total > 0 && (
                    <div
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        themeClasses.textMuted,
                      )}
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>{item.subtaskProgress.total} subtasks</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Period Info */}
          {periodBoundaries && (
            <div
              className={cn(
                "flex items-center justify-center gap-2 py-2 px-4 rounded-lg",
                "bg-[var(--primary)]/10 border border-[var(--primary)]/20",
              )}
            >
              <CalendarClock className={cn("w-4 h-4", themeClasses.text)} />
              <span className={cn("text-sm", themeClasses.text)}>
                {format(periodBoundaries.start, "MMM d")} –{" "}
                {format(periodBoundaries.end, "MMM d")}
              </span>
            </div>
          )}

          {/* Calendar */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={isDateDisabled}
              className={cn(
                "rounded-xl border border-white/10",
                "bg-bg-card-custom/30",
              )}
              classNames={{
                day_selected:
                  "bg-[var(--primary)] text-white hover:bg-[var(--primary)] hover:text-white",
                day_today: "border border-[var(--primary)]/50",
              }}
            />
          </div>

          {/* Time Input (Optional) */}
          <div className="space-y-2">
            <Label className={cn("text-sm", themeClasses.textMuted)}>
              Time (optional)
            </Label>
            <div className="relative">
              <Clock
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  themeClasses.textFaint,
                )}
              />
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                placeholder="Any time"
                className={cn(
                  "pl-10",
                  "bg-bg-card-custom/30 border-white/10",
                  themeClasses.text,
                )}
              />
            </div>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              Leave empty to schedule for any time that day
            </p>
          </div>

          {/* AI Suggestion (Future Enhancement) */}
          <motion.button
            type="button"
            disabled
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl",
              "bg-white/5 border border-white/10",
              "opacity-50 cursor-not-allowed",
              themeClasses.textMuted,
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">AI Suggestion (Coming Soon)</span>
          </motion.button>
        </div>

        <DrawerFooter className="pt-2">
          <div className="flex gap-3">
            <DrawerClose asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1",
                  "bg-white/5 border-white/10 hover:bg-white/10",
                  themeClasses.text,
                )}
              >
                Cancel
              </Button>
            </DrawerClose>
            <Button
              onClick={handleSchedule}
              disabled={!selectedDate || isSubmitting}
              className={cn(
                "flex-1",
                "bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white",
              )}
            >
              {isSubmitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {selectedDate
                    ? `Schedule for ${format(selectedDate, "EEE, MMM d")}`
                    : "Select a date"}
                </>
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default ScheduleRoutineSheet;
