"use client";

import type { UserFilter } from "@/components/activity/FilterBar";
import { useTheme } from "@/contexts/ThemeContext";
import { type ItemOccurrenceAction } from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buildFullRRuleString, getOccurrencesInRange } from "@/lib/utils/date";
import type { ItemWithDetails } from "@/types/items";
import { useQuery } from "@tanstack/react-query";
import { parseISO, startOfDay, subDays } from "date-fns";
import { useMemo } from "react";
import { RRule } from "rrule";

// ─── Icons ────────────────────────────────────────────────────────────────────
const TrendUpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const TrendDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
    <polyline points="16 17 22 17 22 11" />
  </svg>
);

const FlameIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const BarChartIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeToLocalDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
}

/** Count how many occurrences were expected in a date range for all items */
function countExpectedOccurrences(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
): number {
  let count = 0;
  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const occs = getOccurrencesInRange(
          item.recurrence_rule,
          itemDate,
          startDate,
          endDate,
        );
        count += occs.length;
      } catch {
        // skip broken rules
      }
    } else if (itemDate >= startDate && itemDate <= endDate) {
      count += 1;
    }
  }
  return count;
}

// ─── Extended actions query (90 days for insights) ────────────────────────────
function useExtendedOccurrenceActions() {
  return useQuery({
    queryKey: ["items", "actions", "extended-90d"],
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .select("*")
        .gte("occurrence_date", ninetyDaysAgo.toISOString())
        .order("occurrence_date", { ascending: false });

      if (error) throw error;
      return data as ItemOccurrenceAction[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Mini bar chart (pure CSS) ────────────────────────────────────────────────
function MiniBarChart({
  data,
  accentColor,
  labels,
}: {
  data: number[];
  accentColor: string;
  labels?: string[];
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className={cn(
              "w-full rounded-t-sm min-h-[2px] transition-all",
              accentColor,
            )}
            style={{ height: `${(val / max) * 100}%` }}
          />
          {labels && (
            <span className="text-[9px] text-white/30">{labels[i]}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
type TypeFilter = "all" | "reminder" | "task" | "event";
type RecurringFilter = "all" | "recurring" | "one-time";

interface RemindersInsightsPageProps {
  userFilter: UserFilter;
  currentUserId?: string;
  typeFilter?: TypeFilter;
  recurringFilter?: RecurringFilter;
}

export default function RemindersInsightsPage({
  userFilter,
  currentUserId,
  typeFilter = "all",
  recurringFilter = "all",
}: RemindersInsightsPageProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const accent = isPink ? "pink" : "cyan";
  const accentBg = isPink ? "bg-pink-500" : "bg-cyan-500";
  const accentBgMuted = isPink ? "bg-pink-500/20" : "bg-cyan-500/20";
  const accentText = isPink ? "text-pink-400" : "text-cyan-400";

  const { data: allItems = [], isLoading: itemsLoading } = useItems();
  const { data: actions = [], isLoading: actionsLoading } =
    useExtendedOccurrenceActions();

  const isLoading = itemsLoading || actionsLoading;

  // Filter items by ownership
  const filteredItems = useMemo(() => {
    if (!currentUserId || userFilter === "all") return allItems;
    return allItems.filter((item) => {
      const isOwnedByMe =
        item.user_id === currentUserId ||
        item.responsible_user_id === currentUserId;
      return userFilter === "mine" ? isOwnedByMe : !isOwnedByMe;
    });
  }, [allItems, currentUserId, userFilter]);

  // Filter active items + apply type/recurring filters
  const activeItems = useMemo(
    () =>
      filteredItems.filter((item) => {
        if (
          item.status === "archived" ||
          item.status === "cancelled" ||
          item.archived_at
        )
          return false;
        if (typeFilter !== "all" && item.type !== typeFilter) return false;
        if (recurringFilter === "recurring" && !item.recurrence_rule?.rrule)
          return false;
        if (recurringFilter === "one-time" && item.recurrence_rule?.rrule)
          return false;
        return true;
      }),
    [filteredItems, typeFilter, recurringFilter],
  );

  // Filter actions by ownership if needed
  const filteredActions = useMemo(() => {
    if (userFilter === "all" || !currentUserId) return actions;
    const itemIds = new Set(filteredItems.map((i) => i.id));
    return actions.filter((a) => itemIds.has(a.item_id));
  }, [actions, filteredItems, userFilter, currentUserId]);

  // ── Compute insights ────────────────────────────────────────────
  const insights = useMemo(() => {
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);
    const fourteenDaysAgo = subDays(today, 14);
    const thirtyDaysAgo = subDays(today, 30);

    // Completion & action counts
    const completedActions = filteredActions.filter(
      (a) => a.action_type === "completed",
    );
    const postponedActions = filteredActions.filter(
      (a) => a.action_type === "postponed",
    );

    // -- Completion Rate (last 30 days) --
    const completed30d = completedActions.filter(
      (a) => new Date(a.created_at) >= thirtyDaysAgo,
    ).length;
    const expected30d = countExpectedOccurrences(
      activeItems,
      thirtyDaysAgo,
      today,
    );
    const completionRate =
      expected30d > 0 ? Math.round((completed30d / expected30d) * 100) : 0;

    // -- Weekly trend (last 4 weeks) --
    const weeklyData: number[] = [];
    const weeklyLabels: string[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = subDays(today, (w + 1) * 7);
      const weekEnd = subDays(today, w * 7);
      const count = completedActions.filter((a) => {
        const d = new Date(a.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeklyData.push(count);
      weeklyLabels.push(`W${4 - w}`);
    }

    // -- This week vs last week --
    const thisWeekCompleted = completedActions.filter(
      (a) => new Date(a.created_at) >= sevenDaysAgo,
    ).length;
    const lastWeekCompleted = completedActions.filter((a) => {
      const d = new Date(a.created_at);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;
    const weeklyTrend =
      lastWeekCompleted > 0
        ? Math.round(
            ((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100,
          )
        : thisWeekCompleted > 0
          ? 100
          : 0;

    // -- Streak (consecutive days with at least 1 completion, counting back from today) --
    let streak = 0;
    let checkDate = today;
    for (let d = 0; d < 90; d++) {
      const dayStr = normalizeToLocalDateString(checkDate);
      const hasCompletion = completedActions.some((a) => {
        const actionDateStr = normalizeToLocalDateString(
          new Date(a.created_at),
        );
        return actionDateStr === dayStr;
      });
      if (hasCompletion) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else if (d === 0) {
        // Today hasn't had one yet, that's ok, check from yesterday
        checkDate = subDays(checkDate, 1);
        continue;
      } else {
        break;
      }
    }

    // -- Time distribution (hour of day completions) --
    const hourBuckets = Array(24).fill(0) as number[];
    for (const a of completedActions) {
      const hour = new Date(a.created_at).getHours();
      hourBuckets[hour]++;
    }
    // Collapse into 6 periods: Night (0-3), Early (4-7), Morning (8-11), Afternoon (12-15), Evening (16-19), Late (20-23)
    const periods = [
      { label: "Night", range: [0, 3], icon: "🌙" },
      { label: "Early", range: [4, 7], icon: "🌅" },
      { label: "Morning", range: [8, 11], icon: "☀️" },
      { label: "Afternoon", range: [12, 15], icon: "🌤" },
      { label: "Evening", range: [16, 19], icon: "🌇" },
      { label: "Late", range: [20, 23], icon: "🌙" },
    ] as const;
    const periodData = periods.map((p) => {
      let sum = 0;
      for (let h = p.range[0]; h <= p.range[1]; h++) sum += hourBuckets[h];
      return { ...p, count: sum };
    });
    const peakPeriod = periodData.reduce(
      (max, p) => (p.count > max.count ? p : max),
      periodData[0],
    );

    // -- Category breakdown (from item categories array) --
    const catCounts = new Map<string, number>();
    for (const a of completedActions) {
      const item = allItems.find((i) => i.id === a.item_id);
      if (item?.categories?.length) {
        for (const cat of item.categories) {
          catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
        }
      } else {
        catCounts.set(
          "Uncategorized",
          (catCounts.get("Uncategorized") || 0) + 1,
        );
      }
    }
    const categoryBreakdown = Array.from(catCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const maxCatCount = Math.max(...categoryBreakdown.map((c) => c.count), 1);

    // -- Overdue trend (compare overdue counts: last 2 weeks vs prior 2 weeks) --
    const overdueNow = activeItems.filter((item) => {
      const d = getItemDate(item);
      return d && d < today && item.status !== "completed";
    }).length;
    const postponed7d = postponedActions.filter(
      (a) => new Date(a.created_at) >= sevenDaysAgo,
    ).length;
    const postponed14d = postponedActions.filter((a) => {
      const d = new Date(a.created_at);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;
    const overdueTrend =
      postponed14d > 0
        ? Math.round(((postponed7d - postponed14d) / postponed14d) * 100)
        : 0;

    // -- Type breakdown --
    const typeCounts = { reminder: 0, task: 0, event: 0 };
    for (const a of completedActions) {
      const item = allItems.find((i) => i.id === a.item_id);
      if (item?.type && item.type in typeCounts) {
        typeCounts[item.type as keyof typeof typeCounts]++;
      }
    }

    return {
      completionRate,
      completed30d,
      expected30d,
      weeklyData,
      weeklyLabels,
      thisWeekCompleted,
      weeklyTrend,
      streak,
      peakPeriod,
      periodData,
      categoryBreakdown,
      maxCatCount,
      overdueNow,
      postponed7d,
      overdueTrend,
      typeCounts,
      totalCompleted: completedActions.length,
      totalPostponed: postponedActions.length,
    };
  }, [filteredActions, activeItems, allItems]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white/5 animate-pulse h-24"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 pb-8 space-y-3">
      {/* ── Top Stats Row ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Completion Rate */}
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <div
            className={cn(
              "text-2xl font-bold",
              insights.completionRate >= 70
                ? "text-emerald-400"
                : insights.completionRate >= 40
                  ? "text-amber-400"
                  : "text-red-400",
            )}
          >
            {insights.completionRate}%
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">Completion</div>
        </div>

        {/* Streak */}
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <div className="flex items-center justify-center gap-1">
            <FlameIcon
              className={cn(
                "w-5 h-5",
                insights.streak > 0 ? "text-orange-400" : "text-white/20",
              )}
            />
            <span
              className={cn(
                "text-2xl font-bold",
                insights.streak > 0 ? "text-orange-400" : "text-white/30",
              )}
            >
              {insights.streak}
            </span>
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">Day Streak</div>
        </div>

        {/* This Week */}
        <div className="p-3 rounded-xl bg-white/5 text-center">
          <div className={cn("text-2xl font-bold", accentText)}>
            {insights.thisWeekCompleted}
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">This Week</div>
        </div>
      </div>

      {/* ── Weekly Trend Card ── */}
      <div className="p-4 rounded-xl bg-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChartIcon className={cn("w-4 h-4", accentText)} />
            <span className="text-sm font-medium text-white">Weekly Trend</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {insights.weeklyTrend >= 0 ? (
              <TrendUpIcon className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendDownIcon className="w-3.5 h-3.5 text-red-400" />
            )}
            <span
              className={
                insights.weeklyTrend >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {insights.weeklyTrend > 0 ? "+" : ""}
              {insights.weeklyTrend}%
            </span>
          </div>
        </div>
        <MiniBarChart
          data={insights.weeklyData}
          accentColor={accentBg}
          labels={insights.weeklyLabels}
        />
      </div>

      {/* ── Peak Productivity ── */}
      <div className="p-4 rounded-xl bg-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <ClockIcon className={cn("w-4 h-4", accentText)} />
          <span className="text-sm font-medium text-white">
            Peak Productivity
          </span>
        </div>
        <div className="flex items-end gap-0.5 h-12">
          {insights.periodData.map((p, i) => {
            const max = Math.max(...insights.periodData.map((x) => x.count), 1);
            const isPeak = p.label === insights.peakPeriod.label;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5"
              >
                <div
                  className={cn(
                    "w-full rounded-t-sm min-h-[2px] transition-all",
                    isPeak ? accentBg : "bg-white/20",
                  )}
                  style={{ height: `${(p.count / max) * 100}%` }}
                />
                <span
                  className={cn(
                    "text-[8px]",
                    isPeak ? accentText : "text-white/30",
                  )}
                >
                  {p.icon}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-white/40 text-center">
          You&apos;re most productive in the{" "}
          <span className={cn("font-medium", accentText)}>
            {insights.peakPeriod.label.toLowerCase()}
          </span>{" "}
          ({insights.peakPeriod.count} completions)
        </p>
      </div>

      {/* ── Type Breakdown ── */}
      <div className="p-4 rounded-xl bg-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className={cn("w-4 h-4", accentText)} />
          <span className="text-sm font-medium text-white">By Type</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Reminders",
              count: insights.typeCounts.reminder,
              color: "text-violet-400",
              bg: "bg-violet-500",
            },
            {
              label: "Tasks",
              count: insights.typeCounts.task,
              color: "text-purple-400",
              bg: "bg-purple-500",
            },
            {
              label: "Events",
              count: insights.typeCounts.event,
              color: "text-pink-400",
              bg: "bg-pink-500",
            },
          ].map((t) => {
            const total = Math.max(insights.totalCompleted, 1);
            const pct = Math.round((t.count / total) * 100);
            return (
              <div key={t.label} className="text-center space-y-1">
                <div className={cn("text-lg font-bold", t.color)}>
                  {t.count}
                </div>
                <div className="w-full h-1 rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full", t.bg)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-white/40">{t.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Category Breakdown ── */}
      {insights.categoryBreakdown.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 space-y-3">
          <span className="text-sm font-medium text-white">Top Categories</span>
          <div className="space-y-2">
            {insights.categoryBreakdown.map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 capitalize">{cat.name}</span>
                  <span className="text-white/40">{cat.count}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full", accentBg)}
                    style={{
                      width: `${(cat.count / insights.maxCatCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Overdue & Postponed ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-white/5 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertIcon className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-white/50">Overdue</span>
          </div>
          <div className="text-2xl font-bold text-red-400">
            {insights.overdueNow}
          </div>
          <div className="text-[10px] text-white/30">items right now</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5 space-y-1">
          <div className="flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-white/50">Postponed</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {insights.postponed7d}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {insights.overdueTrend <= 0 ? (
              <span className="text-emerald-400">
                {insights.overdueTrend < 0
                  ? `${insights.overdueTrend}%`
                  : "Stable"}{" "}
                vs last week
              </span>
            ) : (
              <span className="text-red-400">
                +{insights.overdueTrend}% vs last week
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary ── */}
      <div
        className={cn(
          "p-4 rounded-2xl border",
          isPink
            ? "bg-pink-500/5 border-pink-500/20"
            : "bg-cyan-500/5 border-cyan-500/20",
        )}
      >
        <p className="text-xs text-white/50 uppercase tracking-widest mb-2">
          90-day Summary
        </p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className={cn("text-xl font-bold", accentText)}>
              {insights.totalCompleted}
            </div>
            <div className="text-[10px] text-white/40">Completed</div>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-400">
              {insights.totalPostponed}
            </div>
            <div className="text-[10px] text-white/40">Postponed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
