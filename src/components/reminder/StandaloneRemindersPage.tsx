/**
 * Standalone Reminders Page
 * A simplified view showing today's tasks and upcoming items
 * For use as a standalone PWA app without bottom navigation
 */
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
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ListTodo,
  Plus,
  Target,
} from "lucide-react";
import Link from "next/link";
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

// Section types
type Section = "overdue" | "today" | "upcoming";

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
  recurrenceRule: { rrule: string },
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
  actions: ItemOccurrenceAction[],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const rruleString = buildFullRRuleString(
          itemDate,
          item.recurrence_rule,
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
      actions,
    );
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) =>
          r.item.id === p.item.id &&
          isSameDay(r.occurrenceDate, p.occurrenceDate),
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
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
  );
}

// ============================================
// COMPONENT
// ============================================
export default function StandaloneRemindersPage() {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const itemActions = useItemActionsWithToast();
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  // Filter active items
  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        !item.archived_at,
    );
  }, [allItems]);

  // Process items into occurrences
  const { overdueItems, todayItems, upcomingItems, stats } = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const weekFromNow = addDays(today, 7);
    const pastStart = addDays(today, -30);

    // Expand all items for different date ranges
    const overdueOccs = expandRecurringItems(
      activeItems,
      pastStart,
      today,
      occurrenceActions,
    ).filter((occ) => isBefore(occ.occurrenceDate, today) && !occ.isCompleted);

    const todayOccs = expandRecurringItems(
      activeItems,
      today,
      tomorrow,
      occurrenceActions,
    );

    const upcomingOccs = expandRecurringItems(
      activeItems,
      tomorrow,
      weekFromNow,
      occurrenceActions,
    );

    return {
      overdueItems: overdueOccs,
      todayItems: todayOccs,
      upcomingItems: upcomingOccs,
      stats: {
        overdue: overdueOccs.length,
        today: todayOccs.length,
        todayCompleted: todayOccs.filter((t) => t.isCompleted).length,
        upcoming: upcomingOccs.length,
      },
    };
  }, [activeItems, occurrenceActions]);

  // Handle item completion toggle
  const handleToggleComplete = useCallback(
    (occ: ExpandedOccurrence) => {
      if (occ.isCompleted) {
        itemActions.handleUncomplete(
          occ.item,
          occ.occurrenceDate.toISOString(),
        );
      } else {
        itemActions.handleComplete(occ.item, occ.occurrenceDate.toISOString());
      }
    },
    [itemActions],
  );

  // Get item time string
  const getItemTime = (item: ItemWithDetails): string | null => {
    if (item.type === "reminder" || item.type === "task") {
      const dueAt = item.reminder_details?.due_at;
      if (dueAt) {
        const date = parseISO(dueAt);
        // Check if it has a time component (not midnight)
        if (date.getHours() !== 0 || date.getMinutes() !== 0) {
          return format(date, "h:mm a");
        }
      }
    } else if (item.type === "event") {
      const startAt = item.event_details?.start_at;
      if (startAt) {
        return format(parseISO(startAt), "h:mm a");
      }
    }
    return null;
  };

  // Render a single item
  const renderItem = (occ: ExpandedOccurrence, showDate = false) => {
    const Icon = typeIcons[occ.item.type];
    const timeStr = getItemTime(occ.item);

    return (
      <div
        key={`${occ.item.id}-${occ.occurrenceDate.getTime()}`}
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl transition-all",
          "bg-white/5 hover:bg-white/10 active:scale-[0.98]",
          occ.isCompleted && "opacity-50",
        )}
      >
        {/* Completion checkbox */}
        <button
          type="button"
          onClick={() => handleToggleComplete(occ)}
          className={cn(
            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
            occ.isCompleted
              ? isPink
                ? "bg-pink-500 border-pink-500"
                : "bg-cyan-500 border-cyan-500"
              : "border-white/30 hover:border-white/50",
          )}
        >
          {occ.isCompleted && <Check className="w-4 h-4 text-white" />}
        </button>

        {/* Icon */}
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            occ.item.type === "event" && "bg-pink-500/20 text-pink-400",
            occ.item.type === "reminder" && "bg-cyan-500/20 text-cyan-400",
            occ.item.type === "task" && "bg-purple-500/20 text-purple-400",
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-medium truncate",
              occ.isCompleted ? "text-white/40 line-through" : "text-white",
            )}
          >
            {occ.item.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-white/40">
            {showDate && (
              <span>{format(occ.occurrenceDate, "EEE, MMM d")}</span>
            )}
            {timeStr && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
            )}
            {occ.isPostponed && (
              <span className="text-amber-400">Postponed</span>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-white/20" />
      </div>
    );
  };

  // Render a section header
  const renderSectionHeader = (
    title: string,
    count: number,
    section: Section,
    color: string,
  ) => (
    <button
      type="button"
      onClick={() =>
        setSelectedSection(selectedSection === section ? null : section)
      }
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-xl transition-all",
        "bg-white/5 hover:bg-white/10",
        selectedSection === section && "ring-1 ring-white/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            color,
          )}
        >
          {section === "overdue" && <AlertCircle className="w-4 h-4" />}
          {section === "today" && <Target className="w-4 h-4" />}
          {section === "upcoming" && <Calendar className="w-4 h-4" />}
        </div>
        <span className="font-medium text-white">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            section === "overdue" && count > 0
              ? "bg-red-500/20 text-red-400"
              : "bg-white/10 text-white/60",
          )}
        >
          {count}
        </span>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-white/40 transition-transform",
            selectedSection === section && "rotate-90",
          )}
        />
      </div>
    </button>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    );
  }

  // Get next incomplete task for focus card
  const nextTask = todayItems.find((t) => !t.isCompleted);

  return (
    <div className="min-h-full p-4 pb-8 space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
          <div className="text-xs text-white/40">Overdue</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {stats.todayCompleted}/{stats.today}
          </div>
          <div className="text-xs text-white/40">Today</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              isPink ? "text-pink-400" : "text-cyan-400",
            )}
          >
            {stats.upcoming}
          </div>
          <div className="text-xs text-white/40">Upcoming</div>
        </div>
      </div>

      {/* Focus Card - Next Item */}
      {nextTask && (
        <div
          className={cn(
            "p-6 rounded-2xl text-center",
            isPink
              ? "bg-pink-500/10 border border-pink-500/20"
              : "bg-cyan-500/10 border border-cyan-500/20",
          )}
        >
          <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
            Up Next
          </p>
          <h2 className="text-xl font-bold text-white mb-1">
            {nextTask.item.title}
          </h2>
          {getItemTime(nextTask.item) && (
            <p className="text-white/60">{getItemTime(nextTask.item)}</p>
          )}
          <button
            type="button"
            onClick={() => handleToggleComplete(nextTask)}
            className={cn(
              "mt-4 px-6 py-2 rounded-xl font-medium transition-all",
              isPink
                ? "bg-pink-500 hover:bg-pink-600 text-white"
                : "bg-cyan-500 hover:bg-cyan-600 text-white",
            )}
          >
            Mark Complete
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {/* Overdue */}
        {stats.overdue > 0 && (
          <div className="space-y-2">
            {renderSectionHeader(
              "Overdue",
              stats.overdue,
              "overdue",
              "bg-red-500/20 text-red-400",
            )}
            {selectedSection === "overdue" && (
              <div className="space-y-2 pl-2">
                {overdueItems.map((occ) => renderItem(occ, true))}
              </div>
            )}
          </div>
        )}

        {/* Today */}
        <div className="space-y-2">
          {renderSectionHeader(
            "Today",
            stats.today,
            "today",
            "bg-amber-500/20 text-amber-400",
          )}
          {selectedSection === "today" && (
            <div className="space-y-2 pl-2">
              {todayItems.length > 0 ? (
                todayItems.map((occ) => renderItem(occ))
              ) : (
                <p className="text-white/40 text-sm p-3">
                  No tasks scheduled for today
                </p>
              )}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="space-y-2">
          {renderSectionHeader(
            "This Week",
            stats.upcoming,
            "upcoming",
            isPink
              ? "bg-pink-500/20 text-pink-400"
              : "bg-cyan-500/20 text-cyan-400",
          )}
          {selectedSection === "upcoming" && (
            <div className="space-y-2 pl-2">
              {upcomingItems.length > 0 ? (
                upcomingItems.map((occ) => renderItem(occ, true))
              ) : (
                <p className="text-white/40 text-sm p-3">
                  No upcoming tasks this week
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add New Reminder FAB */}
      <Link
        href="/expense"
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg",
          isPink
            ? "bg-pink-500 hover:bg-pink-600 shadow-pink-500/30"
            : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30",
        )}
      >
        <Plus className="w-6 h-6 text-white" />
      </Link>
    </div>
  );
}
