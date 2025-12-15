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

  const colorClasses: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    green: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      border: "border-green-500/30",
    },
    red: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      border: "border-red-500/30",
    },
    amber: {
      bg: "bg-amber-500/20",
      text: "text-amber-400",
      border: "border-amber-500/30",
    },
    cyan: {
      bg: "bg-cyan-500/20",
      text: "text-cyan-400",
      border: "border-cyan-500/30",
    },
    pink: {
      bg: "bg-pink-500/20",
      text: "text-pink-400",
      border: "border-pink-500/30",
    },
    purple: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      border: "border-purple-500/30",
    },
    orange: {
      bg: "bg-orange-500/20",
      text: "text-orange-400",
      border: "border-orange-500/30",
    },
  };

  const { bg, text, border } = colorClasses[color] || colorClasses.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border backdrop-blur-sm",
        "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
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
                ? "text-green-400"
                : trend === "down"
                  ? "text-red-400"
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
        <div className="text-sm text-white/70 mt-0.5">{title}</div>
        {subtitle && (
          <div className="text-xs text-white/40 mt-1">{subtitle}</div>
        )}
      </div>
    </motion.div>
  );
}

// Streak Display Component
function StreakDisplay({ streak, label }: { streak: number; label: string }) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border",
        "bg-gradient-to-br from-orange-500/10 to-red-500/10",
        "border-orange-500/30"
      )}
    >
      <div className="p-2 rounded-lg bg-orange-500/20">
        <Flame className="w-6 h-6 text-orange-400" />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-orange-400">{streak}</span>
          <span className="text-sm text-orange-400/70">days</span>
        </div>
        <div className="text-xs text-white/50">{label}</div>
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

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-white/70 mb-3">{title}</h3>
      {items.slice(0, 5).map((item) => {
        const date = getItemDate(item);
        const isItemOverdue = isOverdueWithActions(item, occurrenceActions);

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg",
              "bg-white/5 border border-white/10",
              "hover:bg-white/10 transition-colors cursor-pointer"
            )}
          >
            {/* Type Icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                item.type === "event"
                  ? "bg-pink-500/20"
                  : item.type === "reminder"
                    ? "bg-cyan-500/20"
                    : "bg-purple-500/20"
              )}
            >
              {item.type === "event" ? (
                <Calendar className="w-4 h-4 text-pink-400" />
              ) : item.type === "reminder" ? (
                <Clock className="w-4 h-4 text-cyan-400" />
              ) : (
                <ListTodo className="w-4 h-4 text-purple-400" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {item.title}
              </div>
              {date && (
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    isItemOverdue ? "text-red-400" : "text-white/50"
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
              <div className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
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

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(now);
    const last7Days = subDays(today, 7);

    // Filter out archived items
    const activeItems = allItems.filter((i) => i.status !== "archived");

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
                  "bg-gradient-to-br from-[#1a2942] to-[#0f1d2e]"
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
                isPink
                  ? "bg-gradient-to-r from-pink-300 via-pink-400 to-purple-400"
                  : "bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400"
              )}
            >
              Dashboard
            </h1>
            <p className="text-sm text-white/50 mt-1">
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
              "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
              "border-white/10"
            )}
          >
            <h3 className="text-sm font-medium text-white/70 mb-3">
              Weekly Progress
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.completionRate}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      isPink
                        ? "bg-gradient-to-r from-pink-500 to-purple-500"
                        : "bg-gradient-to-r from-cyan-500 to-blue-500"
                    )}
                  />
                </div>
              </div>
              <div className="text-lg font-bold text-white">
                {stats.completionRate}%
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">
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
              "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
              stats.overdue > 0 ? "border-red-500/30" : "border-white/10"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "w-5 h-5",
                    stats.overdue > 0 ? "text-red-400" : "text-white/40"
                  )}
                />
                <h3 className="font-medium text-white">Overdue</h3>
              </div>
              {stats.overdue > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
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
              "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
              "border-white/10"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock
                  className={cn(
                    "w-5 h-5",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
                <h3 className="font-medium text-white">Upcoming</h3>
              </div>
              <span
                className={cn(
                  "px-2 py-1 rounded-full text-xs",
                  isPink
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
            "bg-gradient-to-br from-[#1a2942]/80 to-[#0f1d2e]/80",
            "border-white/10"
          )}
        >
          <h3 className="font-medium text-white mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-white/50">Total Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {stats.completed}
              </div>
              <div className="text-xs text-white/50">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">
                {stats.pending}
              </div>
              <div className="text-xs text-white/50">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">
                {stats.overdue}
              </div>
              <div className="text-xs text-white/50">Overdue</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
