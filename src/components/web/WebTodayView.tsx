"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemType, ItemWithDetails } from "@/types/items";
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Moon,
  Sun,
  Sunrise,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { RRule } from "rrule";

// ============================================
// TYPES
// ============================================
interface ExpandedOccurrence {
  item: ItemWithDetails;
  occurrenceDate: Date;
  isCompleted: boolean;
  isPostponed?: boolean;
  originalDate?: Date;
}

// Type icons
const typeIcons: Record<ItemType, typeof Calendar> = {
  reminder: Bell,
  event: Calendar,
  task: ListTodo,
};

// Type label colors
const typeStyles: Record<ItemType, { dot: string; label: string }> = {
  reminder: { dot: "bg-cyan-400", label: "text-cyan-400" },
  event: { dot: "bg-pink-400", label: "text-pink-400" },
  task: { dot: "bg-purple-400", label: "text-purple-400" },
};

// ============================================
// HELPERS
// ============================================
function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
}

function buildFullRRuleString(
  startDate: Date,
  recurrenceRule: { rrule: string }
): string {
  const dtstart = `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}`;
  const rrule = recurrenceRule.rrule.startsWith("RRULE:")
    ? recurrenceRule.rrule
    : `RRULE:${recurrenceRule.rrule}`;
  return `${dtstart}\n${rrule}`;
}

function expandRecurringItems(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
  actions: ItemOccurrenceAction[]
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const rruleString = buildFullRRuleString(
          itemDate,
          item.recurrence_rule
        );
        const rule = RRule.fromString(rruleString);
        const occurrences = rule.between(startDate, endDate, true);

        for (const occ of occurrences) {
          const isCompleted = isOccurrenceCompleted(item.id, occ, actions);
          result.push({
            item,
            occurrenceDate: occ,
            isCompleted,
          });
        }
      } catch (error) {
        console.error("Error parsing RRULE:", error);
      }
    } else if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
      const isCompleted =
        item.status === "completed" ||
        isOccurrenceCompleted(item.id, itemDate, actions);
      result.push({
        item,
        occurrenceDate: itemDate,
        isCompleted,
      });
    }
  }

  // Add postponed occurrences
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayPostponed = getPostponedOccurrencesForDate(
      items,
      currentDate,
      actions
    );
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) =>
          r.item.id === p.item.id &&
          isSameDay(r.occurrenceDate, p.occurrenceDate)
      );
      if (!alreadyExists) {
        result.push({
          item: p.item,
          occurrenceDate: p.occurrenceDate,
          isCompleted: false,
          isPostponed: true,
          originalDate: p.originalDate,
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  return result.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime()
  );
}

// ============================================
// MAIN TODAY VIEW - Calm Morning Briefing
// ============================================
export default function WebTodayView() {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const itemActions = useItemActionsWithToast();
  const [showOverdue, setShowOverdue] = useState(false);

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  const today = startOfDay(new Date());
  const currentHour = new Date().getHours();

  // Get greeting based on time
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
        ? "Good afternoon"
        : "Good evening";

  // Filter active items
  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        !item.archived_at
    );
  }, [allItems]);

  // Get today's tasks and overdue (separate)
  const { todayTasks, overdueTasks } = useMemo(() => {
    const todayEnd = addDays(today, 1);
    const todayOccs = expandRecurringItems(
      activeItems,
      today,
      todayEnd,
      occurrenceActions
    );

    const pastStart = addDays(today, -30);
    const allPastOccs = expandRecurringItems(
      activeItems,
      pastStart,
      today,
      occurrenceActions
    );
    const overdueOccs = allPastOccs.filter(
      (occ) => isBefore(occ.occurrenceDate, today) && !occ.isCompleted
    );

    return {
      todayTasks: todayOccs.filter((o) => !o.isCompleted),
      overdueTasks: overdueOccs,
    };
  }, [activeItems, occurrenceActions, today]);

  // Group today's tasks by time of day
  const groupedTasks = useMemo(() => {
    const morning: ExpandedOccurrence[] = [];
    const afternoon: ExpandedOccurrence[] = [];
    const evening: ExpandedOccurrence[] = [];

    for (const task of todayTasks) {
      const hour = task.occurrenceDate.getHours();
      if (hour < 12) morning.push(task);
      else if (hour < 17) afternoon.push(task);
      else evening.push(task);
    }

    return { morning, afternoon, evening };
  }, [todayTasks]);

  // Actions
  const handleComplete = useCallback(
    (occurrence: ExpandedOccurrence) => {
      itemActions.handleComplete(
        occurrence.item,
        occurrence.occurrenceDate.toISOString()
      );
    },
    [itemActions]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full" />
      </div>
    );
  }

  // Render a simple task item
  const renderTask = (occ: ExpandedOccurrence, idx: number) => {
    const { item, occurrenceDate } = occ;
    const Icon = typeIcons[item.type];
    const style = typeStyles[item.type];

    return (
      <div
        key={`${item.id}-${idx}`}
        className={cn(
          "flex items-center gap-4 py-3 border-b last:border-b-0",
          isFrost ? "border-slate-100" : "border-white/5"
        )}
      >
        {/* Time */}
        <div
          className={cn(
            "w-16 text-right",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <span className="text-sm font-medium">
            {format(occurrenceDate, "h:mm a")}
          </span>
        </div>

        {/* Color bar */}
        <div className={cn("w-1 h-10 rounded-full", style.dot)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "font-medium",
              isFrost ? "text-slate-700" : "text-white"
            )}
          >
            {item.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Icon className={cn("w-3 h-3", style.label)} />
            <span className={cn("text-xs capitalize", style.label)}>
              {item.type}
            </span>
          </div>
        </div>

        {/* Complete button */}
        <button
          type="button"
          onClick={() => handleComplete(occ)}
          className={cn(
            "p-2 rounded-full transition-colors",
            isFrost
              ? "hover:bg-green-100 text-slate-300 hover:text-green-600"
              : "hover:bg-green-500/20 text-white/20 hover:text-green-400"
          )}
        >
          <CheckCircle2 className="w-6 h-6" />
        </button>
      </div>
    );
  };

  // Render a time group
  const renderTimeGroup = (
    icon: React.ReactNode,
    label: string,
    tasks: ExpandedOccurrence[]
  ) => {
    if (tasks.length === 0) return null;

    return (
      <div className="mb-4">
        <div
          className={cn(
            "flex items-center gap-2 mb-2",
            isFrost ? "text-slate-500" : "text-white/50"
          )}
        >
          {icon}
          <span className="text-sm font-medium uppercase tracking-wide">
            {label}
          </span>
          <span
            className={cn(
              "text-xs",
              isFrost ? "text-slate-300" : "text-white/20"
            )}
          >
            ({tasks.length})
          </span>
        </div>
        <div
          className={cn(
            "rounded-xl overflow-hidden",
            isFrost ? "bg-white shadow-sm" : "bg-white/5"
          )}
        >
          <div className="px-4">
            {tasks.map((task, idx) => renderTask(task, idx))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Calm Greeting */}
      <div
        className={cn(
          "px-6 py-5 flex-shrink-0",
          isFrost
            ? "bg-gradient-to-r from-indigo-50 to-purple-50"
            : isPink
              ? "bg-gradient-to-r from-pink-500/10 to-purple-500/10"
              : "bg-gradient-to-r from-cyan-500/10 to-blue-500/10"
        )}
      >
        <h1
          className={cn(
            "text-2xl font-bold",
            isFrost ? "text-slate-800" : "text-white"
          )}
        >
          {greeting}
        </h1>
        <p
          className={cn(
            "text-sm mt-1",
            isFrost ? "text-slate-500" : "text-white/60"
          )}
        >
          {format(today, "EEEE, MMMM d, yyyy")}
          {todayTasks.length > 0 && (
            <span
              className={cn(
                "ml-2",
                isFrost
                  ? "text-indigo-600"
                  : isPink
                    ? "text-pink-400"
                    : "text-cyan-400"
              )}
            >
              • {todayTasks.length} {todayTasks.length === 1 ? "item" : "items"}{" "}
              planned
            </span>
          )}
        </p>
      </div>

      {/* Overdue Banner (collapsible) */}
      {overdueTasks.length > 0 && (
        <div
          className={cn(
            "mx-4 mt-4 rounded-xl overflow-hidden",
            isFrost
              ? "bg-amber-50 border border-amber-200"
              : "bg-amber-500/10 border border-amber-500/20"
          )}
        >
          <button
            type="button"
            onClick={() => setShowOverdue(!showOverdue)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-left",
              isFrost ? "text-amber-700" : "text-amber-400"
            )}
          >
            <span className="text-sm font-medium">
              {overdueTasks.length} overdue{" "}
              {overdueTasks.length === 1 ? "item" : "items"}
            </span>
            {showOverdue ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showOverdue && (
            <div
              className={cn(
                "border-t max-h-40 overflow-y-auto",
                isFrost ? "border-amber-200" : "border-amber-500/20"
              )}
            >
              {overdueTasks.map((occ, idx) => (
                <div
                  key={`overdue-${occ.item.id}-${idx}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0",
                    isFrost
                      ? "text-amber-800 border-amber-100"
                      : "text-amber-300 border-amber-500/10"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs w-12 flex-shrink-0",
                      isFrost ? "text-amber-600" : "text-amber-400"
                    )}
                  >
                    {format(occ.occurrenceDate, "MMM d")}
                  </span>
                  <span className="flex-1 text-sm">{occ.item.title}</span>
                  <button
                    type="button"
                    onClick={() => handleComplete(occ)}
                    className={cn(
                      "p-1.5 rounded-lg flex-shrink-0",
                      isFrost ? "hover:bg-amber-100" : "hover:bg-amber-500/20"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's Schedule */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {todayTasks.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center h-full rounded-2xl py-12",
              isFrost ? "bg-green-50" : "bg-green-500/5"
            )}
          >
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <p
              className={cn(
                "text-lg font-medium",
                isFrost ? "text-slate-600" : "text-white/70"
              )}
            >
              Your day is clear
            </p>
            <p
              className={cn(
                "text-sm mt-1",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              No events or tasks scheduled for today
            </p>
          </div>
        ) : (
          <>
            {renderTimeGroup(
              <Sunrise className="w-4 h-4" />,
              "Morning",
              groupedTasks.morning
            )}
            {renderTimeGroup(
              <Sun className="w-4 h-4" />,
              "Afternoon",
              groupedTasks.afternoon
            )}
            {renderTimeGroup(
              <Moon className="w-4 h-4" />,
              "Evening",
              groupedTasks.evening
            )}
          </>
        )}
      </div>
    </div>
  );
}
