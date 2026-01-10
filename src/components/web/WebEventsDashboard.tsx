"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  differenceInDays,
  endOfDay,
  format,
  isBefore,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FastForward,
  Flame,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

// Get the due/start date from an item
function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;

  return dateStr ? parseISO(dateStr) : null;
}

// Check if item is overdue (considers occurrence actions for recurring items)
function isOverdueWithActions(
  item: ItemWithDetails,
  actions: ItemOccurrenceAction[]
): boolean {
  const date = getItemDate(item);
  if (!date) return false;

  // If item is already marked completed, it's not overdue
  if (item.status === "completed") return false;

  // Check if it's past due
  if (!isBefore(date, new Date())) return false;

  // For recurring items, check if this occurrence was completed/cancelled
  if (item.recurrence_rule?.rrule) {
    const isCompleted = isOccurrenceCompleted(item.id, date, actions);

    // Debug logging for recurring items
    console.log("🔍 Checking if recurring item is overdue:", {
      title: item.title,
      itemId: item.id,
      date: date.toISOString(),
      dateOnly: date.toISOString().split("T")[0],
      isCompleted,
      actionsForThisItem: actions
        .filter((a) => a.item_id === item.id)
        .map((a) => ({
          occurrence_date: a.occurrence_date,
          action_type: a.action_type,
        })),
    });

    // If completed, check if it's from before this week (should be filtered)
    if (isCompleted) {
      const now = new Date();
      const weekStart = new Date(now);
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = (dayOfWeek + 6) % 7; // Convert to Monday-based (0 = Monday)
      weekStart.setDate(now.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      // If completed and from before this week, don't show as overdue (auto-archive)
      if (date < weekStart) {
        return false; // Not overdue - it's auto-archived
      }
    }

    return !isCompleted;
  }

  return true;
}

// Legacy function for backwards compatibility
function isOverdue(item: ItemWithDetails): boolean {
  const date = getItemDate(item);
  if (!date) return false;
  return isBefore(date, new Date()) && item.status !== "completed";
}

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral";
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const isCalm = theme === "calm";

  // Theme-specific color classes
  const colorClasses: Record<
    string,
    {
      bg: string;
      text: string;
      border: string;
      frostBg: string;
      frostText: string;
      frostBorder: string;
      calmBg: string;
      calmText: string;
      calmBorder: string;
    }
  > = {
    green: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      border: "border-green-500/30",
      frostBg: "bg-green-100",
      frostText: "text-green-700",
      frostBorder: "border-green-200",
      calmBg: "bg-emerald-900/30",
      calmText: "text-emerald-400",
      calmBorder: "border-emerald-700/40",
    },
    red: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      border: "border-red-500/30",
      frostBg: "bg-red-100",
      frostText: "text-red-700",
      frostBorder: "border-red-200",
      calmBg: "bg-red-900/30",
      calmText: "text-red-400",
      calmBorder: "border-red-700/40",
    },
    amber: {
      bg: "bg-amber-500/20",
      text: "text-amber-400",
      border: "border-amber-500/30",
      frostBg: "bg-amber-100",
      frostText: "text-amber-700",
      frostBorder: "border-amber-200",
      calmBg: "bg-amber-900/30",
      calmText: "text-amber-400",
      calmBorder: "border-amber-700/40",
    },
    cyan: {
      bg: "bg-cyan-500/20",
      text: "text-cyan-400",
      border: "border-cyan-500/30",
      frostBg: "bg-indigo-100",
      frostText: "text-indigo-700",
      frostBorder: "border-indigo-200",
      calmBg: "bg-stone-700/50",
      calmText: "text-stone-300",
      calmBorder: "border-stone-600/50",
    },
    pink: {
      bg: "bg-pink-500/20",
      text: "text-pink-400",
      border: "border-pink-500/30",
      frostBg: "bg-violet-100",
      frostText: "text-violet-700",
      frostBorder: "border-violet-200",
      calmBg: "bg-stone-700/50",
      calmText: "text-stone-300",
      calmBorder: "border-stone-600/50",
    },
    purple: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      border: "border-purple-500/30",
      frostBg: "bg-purple-100",
      frostText: "text-purple-700",
      frostBorder: "border-purple-200",
      calmBg: "bg-stone-700/50",
      calmText: "text-stone-300",
      calmBorder: "border-stone-600/50",
    },
    orange: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      border: "border-orange-500/30",
      frostBg: "bg-orange-100",
      frostText: "text-orange-700",
      frostBorder: "border-orange-200",
      calmBg: "bg-amber-900/30",
      calmText: "text-amber-400",
      calmBorder: "border-amber-700/40",
    },
  };

  const colorSet = colorClasses[color] || colorClasses.cyan;
  const bg = isCalm
    ? colorSet.calmBg
    : isFrost
      ? colorSet.frostBg
      : colorSet.bg;
  const text = isCalm
    ? colorSet.calmText
    : isFrost
      ? colorSet.frostText
      : colorSet.text;
  const border = isCalm
    ? colorSet.calmBorder
    : isFrost
      ? colorSet.frostBorder
      : colorSet.border;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border backdrop-blur-sm",
        isCalm
          ? "bg-gradient-to-br from-[#292524]/90 to-[#1c1917]/90"
          : isFrost
            ? "bg-white shadow-sm"
            : "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
        border
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-lg", bg)}>
          <Icon className={cn("w-5 h-5", text)} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              trend === "up"
                ? isCalm
                  ? "text-emerald-400"
                  : isFrost
                    ? "text-green-600"
                    : "text-green-400"
                : trend === "down"
                  ? isCalm
                    ? "text-red-400"
                    : isFrost
                      ? "text-red-600"
                      : "text-red-400"
                  : isCalm
                    ? "text-stone-500"
                    : isFrost
                      ? "text-slate-500"
                      : "text-white/40"
            )}
          >
            <TrendingUp
              className={cn("w-3 h-3", trend === "down" && "rotate-180")}
            />
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className={cn("text-2xl font-bold", text)}>{value}</div>
        <div
          className={cn(
            "text-sm mt-0.5",
            isCalm
              ? "text-stone-400"
              : isFrost
                ? "text-slate-600"
                : "text-white/70"
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className={cn(
              "text-xs mt-1",
              isCalm
                ? "text-stone-500"
                : isFrost
                  ? "text-slate-500"
                  : "text-white/40"
            )}
          >
            {subtitle}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Streak Display Component
function StreakDisplay({ streak, label }: { streak: number; label: string }) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const isCalm = theme === "calm";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border",
        isCalm
          ? "bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-700/30"
          : isFrost
            ? "bg-orange-50 border-orange-200"
            : "bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg",
          isCalm
            ? "bg-amber-900/30"
            : isFrost
              ? "bg-orange-100"
              : "bg-orange-500/20"
        )}
      >
        <Flame
          className={cn(
            "w-6 h-6",
            isCalm
              ? "text-amber-400"
              : isFrost
                ? "text-orange-600"
                : "text-orange-400"
          )}
        />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-3xl font-bold",
              isCalm
                ? "text-amber-400"
                : isFrost
                  ? "text-orange-600"
                  : "text-orange-400"
            )}
          >
            {streak}
          </span>
          <span
            className={cn(
              "text-sm",
              isCalm
                ? "text-amber-400/70"
                : isFrost
                  ? "text-orange-500"
                  : "text-orange-400/70"
            )}
          >
            days
          </span>
        </div>
        <div
          className={cn(
            "text-xs",
            isCalm
              ? "text-stone-500"
              : isFrost
                ? "text-slate-500"
                : "text-white/50"
          )}
        >
          {label}
        </div>
      </div>
    </motion.div>
  );
}

// Upcoming Items List
function UpcomingItemsList({
  items,
  title,
  emptyMessage,
  occurrenceActions = [],
}: {
  items: ItemWithDetails[];
  title: string;
  emptyMessage: string;
  occurrenceActions?: ItemOccurrenceAction[];
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const isCalm = theme === "calm";

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "text-center py-8",
          isCalm
            ? "text-stone-500"
            : isFrost
              ? "text-slate-400"
              : "text-white/40"
        )}
      >
        <Calendar
          className={cn(
            "w-8 h-8 mx-auto mb-2",
            isCalm ? "opacity-50" : isFrost ? "opacity-60" : "opacity-50"
          )}
        />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3
        className={cn(
          "text-sm font-medium mb-3",
          isCalm
            ? "text-stone-400"
            : isFrost
              ? "text-slate-600"
              : "text-white/70"
        )}
      >
        {title}
      </h3>
      {items.slice(0, 5).map((item) => {
        const date = getItemDate(item);
        const isItemOverdue = isOverdueWithActions(item, occurrenceActions);

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer",
              isCalm
                ? "bg-stone-800/50 border border-stone-700/50 hover:bg-stone-700/50"
                : isFrost
                  ? "bg-slate-50 border border-slate-200 hover:bg-slate-100"
                  : "bg-white/5 border border-white/10 hover:bg-white/10"
            )}
          >
            {/* Type Icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                item.type === "event"
                  ? isCalm
                    ? "bg-stone-700"
                    : isFrost
                      ? "bg-pink-100"
                      : "bg-pink-500/20"
                  : item.type === "reminder"
                    ? isCalm
                      ? "bg-emerald-900/40"
                      : isFrost
                        ? "bg-indigo-100"
                        : "bg-cyan-500/20"
                    : isCalm
                      ? "bg-stone-700"
                      : isFrost
                        ? "bg-violet-100"
                        : "bg-purple-500/20"
              )}
            >
              {item.type === "event" ? (
                <Calendar
                  className={cn(
                    "w-4 h-4",
                    isCalm
                      ? "text-stone-300"
                      : isFrost
                        ? "text-pink-600"
                        : "text-pink-400"
                  )}
                />
              ) : item.type === "reminder" ? (
                <Clock
                  className={cn(
                    "w-4 h-4",
                    isCalm
                      ? "text-emerald-400"
                      : isFrost
                        ? "text-indigo-600"
                        : "text-cyan-400"
                  )}
                />
              ) : (
                <ListTodo
                  className={cn(
                    "w-4 h-4",
                    isCalm
                      ? "text-stone-300"
                      : isFrost
                        ? "text-violet-600"
                        : "text-purple-400"
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-sm font-medium truncate",
                  isCalm
                    ? "text-stone-200"
                    : isFrost
                      ? "text-slate-900"
                      : "text-white"
                )}
              >
                {item.title}
              </div>
              {date && (
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    isItemOverdue
                      ? "text-red-500"
                      : isCalm
                        ? "text-stone-500"
                        : isFrost
                          ? "text-slate-500"
                          : "text-white/50"
                  )}
                >
                  {isToday(date)
                    ? `Today at ${format(date, "h:mm a")}`
                    : isTomorrow(date)
                      ? `Tomorrow at ${format(date, "h:mm a")}`
                      : format(date, "EEE, MMM d 'at' h:mm a")}
                </div>
              )}
            </div>

            {/* Status */}
            {isItemOverdue && (
              <div
                className={cn(
                  "px-2 py-1 rounded text-xs",
                  isCalm
                    ? "bg-red-900/40 text-red-400"
                    : isFrost
                      ? "bg-red-100 text-red-600"
                      : "bg-red-500/20 text-red-400"
                )}
              >
                Overdue
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export default function WebEventsDashboard() {
  const { theme } = useTheme();
  const themeClasses = useThemeClasses();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const isCalm = theme === "calm";

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(now);
    const last7Days = subDays(today, 7);

    // Filter out archived items
    const activeItems = allItems.filter(
      (i) => i.status !== "archived" && !i.archived_at
    );

    // Items by status
    const completed = activeItems.filter((i) => i.status === "completed");
    const pending = activeItems.filter(
      (i) => i.status === "pending" || i.status === "in_progress"
    );
    // Use isOverdueWithActions to check occurrence completions
    const overdue = pending.filter((i) =>
      isOverdueWithActions(i, occurrenceActions)
    );

    // Items today
    const itemsToday = activeItems.filter((item) => {
      const date = getItemDate(item);
      return date && isToday(date);
    });

    // Count today's completed items (including occurrence completions)
    const completedTodayCount = itemsToday.filter((item) => {
      if (item.status === "completed") return true;
      // Check if occurrence was completed
      const date = getItemDate(item);
      if (date && item.recurrence_rule?.rrule) {
        return isOccurrenceCompleted(item.id, date, occurrenceActions);
      }
      return false;
    });

    // Items upcoming (next 7 days)
    const upcoming = pending
      .filter((item) => {
        const date = getItemDate(item);
        if (!date) return false;
        const daysDiff = differenceInDays(date, now);
        return daysDiff >= 0 && daysDiff <= 7;
      })
      .sort((a, b) => {
        const dateA = getItemDate(a);
        const dateB = getItemDate(b);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });

    // Calculate completion rate for last 7 days
    const last7DaysItems = activeItems.filter((item) => {
      const date = getItemDate(item);
      return date && isBefore(date, todayEnd) && isBefore(last7Days, date);
    });

    // Count completions including occurrence actions
    const last7DaysCompleted = last7DaysItems.filter((item) => {
      if (item.status === "completed") return true;
      const date = getItemDate(item);
      if (date && item.recurrence_rule?.rrule) {
        return isOccurrenceCompleted(item.id, date, occurrenceActions);
      }
      return false;
    }).length;

    const completionRate =
      last7DaysItems.length > 0
        ? Math.round((last7DaysCompleted / last7DaysItems.length) * 100)
        : 0;

    // Calculate streak (consecutive days with all items completed)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const checkDate = subDays(today, i);
      const checkDateStr = format(checkDate, "yyyy-MM-dd");
      const dayItems = activeItems.filter((item) => {
        const date = getItemDate(item);
        return date && format(date, "yyyy-MM-dd") === checkDateStr;
      });

      if (dayItems.length === 0) continue;

      const allCompleted = dayItems.every((item) => {
        if (item.status === "completed") return true;
        const date = getItemDate(item);
        if (date && item.recurrence_rule?.rrule) {
          return isOccurrenceCompleted(item.id, date, occurrenceActions);
        }
        return false;
      });

      if (allCompleted) {
        streak++;
      } else {
        break;
      }
    }

    // Postponed count from occurrence actions
    const postponedCount = occurrenceActions.filter(
      (a) => a.action_type === "postponed"
    ).length;

    return {
      total: activeItems.length,
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
      todayTotal: itemsToday.length,
      todayCompleted: completedTodayCount.length,
      upcoming,
      overdueItems: overdue,
      completionRate,
      streak,
      postponedCount,
    };
  }, [allItems, occurrenceActions]);

  if (isLoading) {
    return (
      <div className={cn("min-h-screen p-6", themeClasses.pageBg)}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-32 rounded-xl animate-pulse",
                  isCalm
                    ? "bg-gradient-to-br from-[#292524] to-[#1c1917]"
                    : "bg-gradient-to-br from-[#1a2942] to-[#0f1d2e]"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen p-6", themeClasses.pageBg)}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className={cn(
                "text-2xl font-bold bg-clip-text text-transparent",
                isCalm
                  ? "bg-gradient-to-r from-stone-300 via-stone-400 to-emerald-400"
                  : isFrost
                    ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"
                    : isPink
                      ? "bg-gradient-to-r from-pink-300 via-pink-400 to-purple-400"
                      : "bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400"
              )}
            >
              Dashboard
            </h1>
            <p
              className={cn(
                "text-sm mt-1",
                isCalm
                  ? "text-stone-500"
                  : isFrost
                    ? "text-slate-500"
                    : "text-white/50"
              )}
            >
              Overview of your events, reminders, and tasks
            </p>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Completed"
            value={stats.completed}
            subtitle={`${stats.completionRate}% completion rate`}
            icon={CheckCircle2}
            color="green"
          />
          <StatsCard
            title="Overdue"
            value={stats.overdue}
            subtitle={stats.overdue > 0 ? "Needs attention" : "All caught up!"}
            icon={AlertTriangle}
            color="red"
          />
          <StatsCard
            title="Postponed"
            value={stats.postponedCount}
            subtitle="This week"
            icon={FastForward}
            color="amber"
          />
          <StatsCard
            title="Today"
            value={`${stats.todayCompleted}/${stats.todayTotal}`}
            subtitle="Tasks for today"
            icon={Calendar}
            color={isPink ? "pink" : "cyan"}
          />
        </div>

        {/* Streak and Progress Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StreakDisplay
            streak={stats.streak}
            label="Current completion streak"
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "lg:col-span-2 p-4 rounded-xl border",
              isCalm
                ? "bg-gradient-to-br from-[#292524]/90 to-[#1c1917]/90 border-stone-700/50"
                : isFrost
                  ? "bg-white border-indigo-200 shadow-sm"
                  : "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80 border-white/10"
            )}
          >
            <h3
              className={cn(
                "text-sm font-medium mb-3",
                isCalm
                  ? "text-stone-400"
                  : isFrost
                    ? "text-slate-600"
                    : "text-white/70"
              )}
            >
              Weekly Progress
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div
                  className={cn(
                    "h-3 rounded-full overflow-hidden",
                    isCalm
                      ? "bg-stone-700"
                      : isFrost
                        ? "bg-slate-200"
                        : "bg-white/10"
                  )}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.completionRate}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      isCalm
                        ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                        : isFrost
                          ? "bg-gradient-to-r from-indigo-500 to-violet-500"
                          : isPink
                            ? "bg-gradient-to-r from-pink-500 to-purple-500"
                            : "bg-gradient-to-r from-cyan-500 to-blue-500"
                    )}
                  />
                </div>
              </div>
              <div
                className={cn(
                  "text-lg font-bold",
                  isCalm
                    ? "text-stone-200"
                    : isFrost
                      ? "text-slate-900"
                      : "text-white"
                )}
              >
                {stats.completionRate}%
              </div>
            </div>
            <p
              className={cn(
                "text-xs mt-2",
                isCalm
                  ? "text-stone-500"
                  : isFrost
                    ? "text-slate-400"
                    : "text-white/40"
              )}
            >
              Based on items from the last 7 days
            </p>
          </motion.div>
        </div>

        {/* Overdue and Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-xl border",
              isCalm
                ? stats.overdue > 0
                  ? "bg-gradient-to-br from-[#292524]/90 to-[#1c1917]/90 border-red-800/40"
                  : "bg-gradient-to-br from-[#292524]/90 to-[#1c1917]/90 border-stone-700/50"
                : isFrost
                  ? stats.overdue > 0
                    ? "bg-red-50 border-red-200 shadow-sm"
                    : "bg-white border-indigo-200 shadow-sm"
                  : cn(
                      "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
                      stats.overdue > 0
                        ? "border-red-500/30"
                        : "border-white/10"
                    )
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "w-5 h-5",
                    stats.overdue > 0
                      ? isCalm
                        ? "text-red-400"
                        : isFrost
                          ? "text-red-500"
                          : "text-red-400"
                      : isCalm
                        ? "text-stone-500"
                        : isFrost
                          ? "text-slate-400"
                          : "text-white/40"
                  )}
                />
                <h3
                  className={cn(
                    "font-medium",
                    isCalm
                      ? "text-stone-200"
                      : isFrost
                        ? "text-slate-900"
                        : "text-white"
                  )}
                >
                  Overdue
                </h3>
              </div>
              {stats.overdue > 0 && (
                <span
                  className={cn(
                    "px-2 py-1 rounded-full text-xs",
                    isCalm
                      ? "bg-red-900/40 text-red-400"
                      : isFrost
                        ? "bg-red-100 text-red-600"
                        : "bg-red-500/20 text-red-400"
                  )}
                >
                  {stats.overdue} items
                </span>
              )}
            </div>
            <UpcomingItemsList
              items={stats.overdueItems}
              title=""
              emptyMessage="No overdue items - great job!"
              occurrenceActions={occurrenceActions}
            />
          </motion.div>

          {/* Upcoming Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "p-4 rounded-xl border",
              isCalm
                ? "bg-gradient-to-br from-[#292524]/90 to-[#1c1917]/90 border-stone-700/50"
                : isFrost
                  ? "bg-white border-indigo-200 shadow-sm"
                  : "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80 border-white/10"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock
                  className={cn(
                    "w-5 h-5",
                    isCalm
                      ? "text-stone-400"
                      : isFrost
                        ? "text-indigo-500"
                        : isPink
                          ? "text-pink-400"
                          : "text-cyan-400"
                  )}
                />
                <h3
                  className={cn(
                    "font-medium",
                    isCalm
                      ? "text-stone-200"
                      : isFrost
                        ? "text-slate-900"
                        : "text-white"
                  )}
                >
                  Upcoming
                </h3>
              </div>
              <span
                className={cn(
                  "px-2 py-1 rounded-full text-xs",
                  isCalm
                    ? "bg-emerald-900/40 text-emerald-400"
                    : isFrost
                      ? "bg-indigo-100 text-indigo-600"
                      : isPink
                        ? "bg-pink-500/20 text-pink-400"
                        : "bg-cyan-500/20 text-cyan-400"
                )}
              >
                Next 7 days
              </span>
            </div>
            <UpcomingItemsList
              items={stats.upcoming}
              title=""
              emptyMessage="Nothing scheduled for the next 7 days"
              occurrenceActions={occurrenceActions}
            />
          </motion.div>
        </div>

        {/* Recent Activity Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "p-4 rounded-xl border",
            isCalm
              ? "bg-gradient-to-br from-[#292524]/90 to-[#1c1917]/90 border-stone-700/50"
              : isFrost
                ? "bg-white border-indigo-200 shadow-sm"
                : "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80 border-white/10"
          )}
        >
          <h3
            className={cn(
              "font-medium mb-4",
              isCalm
                ? "text-stone-200"
                : isFrost
                  ? "text-slate-900"
                  : "text-white"
            )}
          >
            Quick Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isCalm
                    ? "text-stone-200"
                    : isFrost
                      ? "text-slate-900"
                      : "text-white"
                )}
              >
                {stats.total}
              </div>
              <div
                className={cn(
                  "text-xs",
                  isCalm
                    ? "text-stone-500"
                    : isFrost
                      ? "text-slate-500"
                      : "text-white/50"
                )}
              >
                Total Items
              </div>
            </div>
            <div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isCalm
                    ? "text-emerald-400"
                    : isFrost
                      ? "text-green-600"
                      : "text-green-400"
                )}
              >
                {stats.completed}
              </div>
              <div
                className={cn(
                  "text-xs",
                  isCalm
                    ? "text-stone-500"
                    : isFrost
                      ? "text-slate-500"
                      : "text-white/50"
                )}
              >
                Completed
              </div>
            </div>
            <div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isCalm
                    ? "text-amber-400"
                    : isFrost
                      ? "text-amber-600"
                      : "text-amber-400"
                )}
              >
                {stats.pending}
              </div>
              <div
                className={cn(
                  "text-xs",
                  isCalm
                    ? "text-stone-500"
                    : isFrost
                      ? "text-slate-500"
                      : "text-white/50"
                )}
              >
                Pending
              </div>
            </div>
            <div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  isCalm
                    ? "text-red-400"
                    : isFrost
                      ? "text-red-600"
                      : "text-red-400"
                )}
              >
                {stats.overdue}
              </div>
              <div
                className={cn(
                  "text-xs",
                  isCalm
                    ? "text-stone-500"
                    : isFrost
                      ? "text-slate-500"
                      : "text-white/50"
                )}
              >
                Overdue
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
