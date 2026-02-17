"use client";

/**
 * FlexibleRoutinesPool - Shows unscheduled flexible tasks for the current period
 * Appears at the top of Focus page when there are tasks to schedule
 */

import { type FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { FLEXIBLE_PERIOD_LABELS } from "@/types/items";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  ListTodo,
  Repeat,
} from "lucide-react";
import { useState } from "react";

interface FlexibleRoutinesPoolProps {
  unscheduled: FlexibleRoutineItem[];
  scheduled: FlexibleRoutineItem[];
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  onSchedule: (item: FlexibleRoutineItem) => void;
  onViewItem: (item: FlexibleRoutineItem) => void;
  className?: string;
}

export function FlexibleRoutinesPool({
  unscheduled,
  scheduled,
  periodLabel,
  periodStart,
  periodEnd,
  onSchedule,
  onViewItem,
  className,
}: FlexibleRoutinesPoolProps) {
  const themeClasses = useThemeClasses();
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't render if no flexible routines
  if (unscheduled.length === 0 && scheduled.length === 0) {
    return null;
  }

  const totalTasks = unscheduled.length + scheduled.length;
  const scheduledCount = scheduled.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent",
        "border border-amber-500/20",
        className,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4",
          "hover:bg-amber-500/5 transition-colors",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className={cn("font-semibold", themeClasses.headerText)}>
              Schedule {periodLabel}
            </h3>
            <p className={cn("text-xs", themeClasses.textMuted)}>
              {unscheduled.length > 0
                ? `${unscheduled.length} task${unscheduled.length > 1 ? "s" : ""} to schedule`
                : "All tasks scheduled!"}
              {scheduled.length > 0 && ` · ${scheduled.length} scheduled`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(scheduledCount / totalTasks) * 100}%` }}
                className="h-full bg-amber-400 rounded-full"
              />
            </div>
            <span className={cn("text-xs", themeClasses.textFaint)}>
              {scheduledCount}/{totalTasks}
            </span>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className={cn("w-5 h-5", themeClasses.textMuted)} />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Unscheduled tasks */}
              {unscheduled.map((item) => (
                <FlexibleTaskCard
                  key={item.id}
                  item={item}
                  onSchedule={() => onSchedule(item)}
                  onView={() => onViewItem(item)}
                  themeClasses={themeClasses}
                  status="unscheduled"
                />
              ))}

              {/* Scheduled tasks */}
              {scheduled.map((item) => (
                <FlexibleTaskCard
                  key={item.id}
                  item={item}
                  onSchedule={() => onSchedule(item)}
                  onView={() => onViewItem(item)}
                  themeClasses={themeClasses}
                  status="scheduled"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// FLEXIBLE TASK CARD
// ============================================

interface FlexibleTaskCardProps {
  item: FlexibleRoutineItem;
  onSchedule: () => void;
  onView: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
  status: "unscheduled" | "scheduled" | "completed";
}

function FlexibleTaskCard({
  item,
  onSchedule,
  onView,
  themeClasses,
  status,
}: FlexibleTaskCardProps) {
  const periodLabel = item.recurrence_rule?.flexible_period
    ? FLEXIBLE_PERIOD_LABELS[item.recurrence_rule.flexible_period]
    : "Weekly";

  const scheduledDate = item.flexibleSchedule?.scheduled_for_date;
  const scheduledTime = item.flexibleSchedule?.scheduled_for_time;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl overflow-hidden transition-all",
        status === "unscheduled"
          ? "bg-bg-card-custom/50 border border-amber-500/30"
          : "bg-bg-card-custom/30 border border-white/10",
      )}
    >
      <div className="p-4 cursor-pointer" onClick={onView}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                status === "unscheduled"
                  ? "bg-amber-500/20"
                  : "bg-emerald-500/20",
              )}
            >
              {status === "unscheduled" ? (
                <ClipboardList className="w-4 h-4 text-amber-400" />
              ) : (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
            </div>

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
          </div>

          {/* Scheduled date badge */}
          {status === "scheduled" && scheduledDate && (
            <div className="flex items-center gap-1 text-emerald-400 text-xs">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(scheduledDate), "EEE, MMM d")}</span>
              {scheduledTime && (
                <>
                  <Clock className="w-3 h-3 ml-1" />
                  <span>{scheduledTime}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <h4 className={cn("font-medium mb-1", themeClasses.headerText)}>
          {item.title}
        </h4>

        {/* Subtask progress */}
        {item.subtaskProgress && item.subtaskProgress.total > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <ListTodo className={cn("w-3.5 h-3.5", themeClasses.textFaint)} />
            <span className={cn("text-xs", themeClasses.textMuted)}>
              {item.subtaskProgress.completed}/{item.subtaskProgress.total}{" "}
              subtasks
            </span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{
                  width: `${(item.subtaskProgress.completed / item.subtaskProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSchedule();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              status === "unscheduled"
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                : "bg-white/5 hover:bg-white/10 text-white/70",
            )}
          >
            <CalendarClock className="w-4 h-4" />
            <span>{status === "unscheduled" ? "Schedule" : "Reschedule"}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "px-3 py-2.5 rounded-lg",
              "bg-white/5 hover:bg-white/10",
              themeClasses.textMuted,
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default FlexibleRoutinesPool;
