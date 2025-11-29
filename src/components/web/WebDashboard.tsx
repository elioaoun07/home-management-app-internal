"use client";

import CategoryDetailView from "@/components/dashboard/CategoryDetailView";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { useDeleteTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import {
  differenceInDays,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  DollarSign,
  Filter,
  Flame,
  Heart,
  Pencil,
  Receipt,
  RefreshCw,
  Shield,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  inserted_at: string;
  account_name?: string;
  category_icon?: string;
  category_color?: string;
  subcategory_color?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  currentUserId?: string;
  onDateRangeChange?: (start: string, end: string) => void;
};

type OwnershipFilter = "all" | "mine" | "partner";
type SortField = "recent" | "date" | "amount" | "category";
type SortOrder = "asc" | "desc";

const getDayName = (dayIndex: number) => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[dayIndex];
};

const WebDashboard = memo(function WebDashboard({
  transactions,
  startDate,
  endDate,
  currentUserId,
  onDateRangeChange,
}: Props) {
  const { theme: currentUserTheme } = useTheme();
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteTransaction();

  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("recent");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<string | null>(null);
  const [hoveredTransaction, setHoveredTransaction] = useState<string | null>(
    null
  );

  const hasPendingTransactions = useMemo(
    () => transactions.some((t) => (t as any)._isPending),
    [transactions]
  );

  const categories = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => t.category).filter(Boolean))
    );
  }, [transactions]);

  const accounts = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => t.account_name).filter(Boolean))
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    if (ownershipFilter === "mine")
      filtered = filtered.filter((t) => t.is_owner === true);
    else if (ownershipFilter === "partner")
      filtered = filtered.filter((t) => t.is_owner === false);
    if (filterCategory)
      filtered = filtered.filter((t) => t.category === filterCategory);
    if (filterAccount)
      filtered = filtered.filter((t) => t.account_name === filterAccount);

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === "recent")
        comparison =
          new Date(a.inserted_at).getTime() - new Date(b.inserted_at).getTime();
      else if (sortField === "date")
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === "amount") comparison = a.amount - b.amount;
      else if (sortField === "category")
        comparison = (a.category || "").localeCompare(b.category || "");
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return filtered;
  }, [
    transactions,
    ownershipFilter,
    filterCategory,
    filterAccount,
    sortField,
    sortOrder,
  ]);

  // ==================== ADVANCED ANALYTICS ====================

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const defaultColor = themeClasses.defaultAccentColor;
    const byCategory = filteredTransactions.reduce(
      (acc, t) => {
        const cat = t.category || "Uncategorized";
        acc[cat] = {
          amount: (acc[cat]?.amount || 0) + t.amount,
          color: t.category_color || defaultColor,
          count: (acc[cat]?.count || 0) + 1,
        };
        return acc;
      },
      {} as Record<string, { amount: number; color: string; count: number }>
    );

    const topCategory = Object.entries(byCategory).sort(
      (a, b) => b[1].amount - a[1].amount
    )[0];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.max(1, differenceInDays(end, start) + 1);
    const dailyAvg = total / daysDiff;

    return {
      total,
      count: filteredTransactions.length,
      dailyAvg,
      daysDiff,
      topCategory: topCategory
        ? {
            name: topCategory[0],
            amount: topCategory[1].amount,
            color: topCategory[1].color,
          }
        : null,
      byCategory,
    };
  }, [
    filteredTransactions,
    startDate,
    endDate,
    themeClasses.defaultAccentColor,
  ]);

  // SPENDING VELOCITY & BURN RATE
  const spendingVelocity = useMemo(() => {
    const today = new Date();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysElapsed = Math.max(1, differenceInDays(today, start) + 1);
    const totalDays = differenceInDays(end, start) + 1;
    const daysRemaining = Math.max(0, differenceInDays(end, today));

    const dailyBurnRate = stats.total / daysElapsed;
    const projectedTotal = dailyBurnRate * totalDays;

    const last7Days = filteredTransactions.filter((t) => {
      const date = parseISO(t.date);
      return (
        differenceInDays(today, date) <= 7 && differenceInDays(today, date) >= 0
      );
    });
    const prev7Days = filteredTransactions.filter((t) => {
      const date = parseISO(t.date);
      return (
        differenceInDays(today, date) > 7 && differenceInDays(today, date) <= 14
      );
    });

    const last7Total = last7Days.reduce((sum, t) => sum + t.amount, 0);
    const prev7Total = prev7Days.reduce((sum, t) => sum + t.amount, 0);
    const weekOverWeekChange =
      prev7Total > 0 ? ((last7Total - prev7Total) / prev7Total) * 100 : 0;

    return {
      dailyBurnRate,
      projectedTotal,
      daysRemaining,
      daysElapsed,
      last7Total,
      prev7Total,
      weekOverWeekChange,
    };
  }, [filteredTransactions, stats.total, startDate, endDate]);

  // FINANCIAL HEALTH SCORE
  const healthScore = useMemo(() => {
    let score = 100;
    const factors: {
      name: string;
      impact: number;
      status: "good" | "warning" | "bad";
    }[] = [];

    const dailyAmounts: Record<string, number> = {};
    filteredTransactions.forEach((t) => {
      dailyAmounts[t.date] = (dailyAmounts[t.date] || 0) + t.amount;
    });
    const dailyValues = Object.values(dailyAmounts);
    if (dailyValues.length > 1) {
      const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
      const variance =
        dailyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        dailyValues.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      const consistencyPenalty = Math.min(20, cv * 15);
      score -= consistencyPenalty;
      factors.push({
        name: "Consistency",
        impact: -Math.round(consistencyPenalty),
        status:
          consistencyPenalty < 5
            ? "good"
            : consistencyPenalty < 12
              ? "warning"
              : "bad",
      });
    }

    const categoryShares = Object.values(stats.byCategory).map(
      (c) => c.amount / stats.total
    );
    const maxShare = Math.max(...categoryShares, 0);
    if (maxShare > 0.5) {
      const concentrationPenalty = (maxShare - 0.5) * 30;
      score -= concentrationPenalty;
      factors.push({
        name: "Diversification",
        impact: -Math.round(concentrationPenalty),
        status:
          concentrationPenalty < 5
            ? "good"
            : concentrationPenalty < 10
              ? "warning"
              : "bad",
      });
    }

    if (spendingVelocity.weekOverWeekChange > 20) {
      const trendPenalty = Math.min(
        15,
        (spendingVelocity.weekOverWeekChange - 20) * 0.5
      );
      score -= trendPenalty;
      factors.push({
        name: "Weekly Trend",
        impact: -Math.round(trendPenalty),
        status: trendPenalty < 5 ? "warning" : "bad",
      });
    } else if (spendingVelocity.weekOverWeekChange < -10) {
      score += 5;
      factors.push({ name: "Weekly Trend", impact: 5, status: "good" });
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      factors,
      grade: score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
      gradeColor:
        score >= 80
          ? "text-emerald-400"
          : score >= 60
            ? "text-amber-400"
            : score >= 40
              ? "text-orange-400"
              : "text-red-400",
    };
  }, [filteredTransactions, stats, spendingVelocity.weekOverWeekChange]);

  // DAY OF WEEK PATTERN
  const dayOfWeekPattern = useMemo(() => {
    const byDay: Record<number, { total: number; count: number }> = {
      0: { total: 0, count: 0 },
      1: { total: 0, count: 0 },
      2: { total: 0, count: 0 },
      3: { total: 0, count: 0 },
      4: { total: 0, count: 0 },
      5: { total: 0, count: 0 },
      6: { total: 0, count: 0 },
    };
    filteredTransactions.forEach((t) => {
      const day = getDay(parseISO(t.date));
      byDay[day].total += t.amount;
      byDay[day].count += 1;
    });
    const maxTotal = Math.max(...Object.values(byDay).map((d) => d.total), 1);
    const peakDay = Object.entries(byDay).sort(
      (a, b) => b[1].total - a[1].total
    )[0];
    const lowDay = Object.entries(byDay).sort(
      (a, b) => a[1].total - b[1].total
    )[0];
    return {
      byDay,
      maxTotal,
      peakDay: { day: Number(peakDay[0]), ...peakDay[1] },
      lowDay: { day: Number(lowDay[0]), ...lowDay[1] },
    };
  }, [filteredTransactions]);

  // ANOMALIES
  const anomalies = useMemo(() => {
    const avgAmount = stats.total / Math.max(1, stats.count);
    const stdDev = Math.sqrt(
      filteredTransactions.reduce(
        (sum, t) => sum + Math.pow(t.amount - avgAmount, 2),
        0
      ) / Math.max(1, stats.count)
    );
    const threshold = avgAmount + stdDev * 2;
    const unusualTransactions = filteredTransactions
      .filter((t) => t.amount > threshold)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return { unusualTransactions, threshold, avgAmount };
  }, [filteredTransactions, stats]);

  // CATEGORY TRENDS
  const categoryTrends = useMemo(() => {
    const today = new Date();
    const midPoint = new Date(
      today.getTime() -
        (differenceInDays(today, parseISO(startDate)) / 2) * 24 * 60 * 60 * 1000
    );
    const firstHalf: Record<string, number> = {};
    const secondHalf: Record<string, number> = {};
    filteredTransactions.forEach((t) => {
      const date = parseISO(t.date);
      const cat = t.category || "Uncategorized";
      if (date < midPoint) firstHalf[cat] = (firstHalf[cat] || 0) + t.amount;
      else secondHalf[cat] = (secondHalf[cat] || 0) + t.amount;
    });
    const trends = Object.keys(stats.byCategory).map((cat) => {
      const first = firstHalf[cat] || 0;
      const second = secondHalf[cat] || 0;
      const change =
        first > 0 ? ((second - first) / first) * 100 : second > 0 ? 100 : 0;
      return {
        category: cat,
        change,
        firstHalf: first,
        secondHalf: second,
        color: stats.byCategory[cat]?.color || "#888",
      };
    });
    const growing = trends
      .filter((t) => t.change > 10)
      .sort((a, b) => b.change - a.change);
    const shrinking = trends
      .filter((t) => t.change < -10)
      .sort((a, b) => a.change - b.change);
    return { growing, shrinking };
  }, [filteredTransactions, stats.byCategory, startDate]);

  // SMART INSIGHTS
  const insights = useMemo(() => {
    const items: {
      icon: any;
      text: string;
      type: "info" | "warning" | "success" | "tip";
    }[] = [];
    items.push({
      icon: CalendarDays,
      text: `Peak spending on ${getDayName(dayOfWeekPattern.peakDay.day)}s ($${dayOfWeekPattern.peakDay.total.toFixed(0)})`,
      type: "info",
    });
    if (Math.abs(spendingVelocity.weekOverWeekChange) > 15) {
      items.push({
        icon:
          spendingVelocity.weekOverWeekChange > 0 ? TrendingUp : TrendingDown,
        text: `${spendingVelocity.weekOverWeekChange > 0 ? "Up" : "Down"} ${Math.abs(spendingVelocity.weekOverWeekChange).toFixed(0)}% vs last week`,
        type: spendingVelocity.weekOverWeekChange > 15 ? "warning" : "success",
      });
    }
    if (spendingVelocity.projectedTotal > stats.total * 1.2) {
      items.push({
        icon: Target,
        text: `On track for $${spendingVelocity.projectedTotal.toFixed(0)} this period`,
        type: "warning",
      });
    }
    if (stats.topCategory && stats.topCategory.amount / stats.total > 0.4) {
      items.push({
        icon: Receipt,
        text: `${stats.topCategory.name} = ${((stats.topCategory.amount / stats.total) * 100).toFixed(0)}% of spending`,
        type: "tip",
      });
    }
    if (categoryTrends.growing.length > 0) {
      items.push({
        icon: Flame,
        text: `${categoryTrends.growing[0].category} up ${categoryTrends.growing[0].change.toFixed(0)}%`,
        type: "warning",
      });
    }
    return items.slice(0, 5);
  }, [dayOfWeekPattern, spendingVelocity, stats, categoryTrends]);

  // ==================== END ANALYTICS ====================

  const hasActiveFilters =
    filterCategory || filterAccount || ownershipFilter !== "all";

  const clearFilters = () => {
    setFilterCategory("");
    setFilterAccount("");
    setOwnershipFilter("all");
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({ queryKey: ["account-balance"] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("Transaction deleted"),
      onError: () => toast.error("Failed to delete transaction"),
    });
  };

  const handleCategoryClick = (categoryName: string) =>
    setCategoryDetail(categoryName);

  if (categoryDetail) {
    const categoryTxs = transactions.filter(
      (t) => t.category === categoryDetail
    );
    const totalAmount = categoryTxs.reduce((sum, t) => sum + t.amount, 0);
    const categoryColor = categoryTxs.find(
      (t) => t.category_color
    )?.category_color;
    return (
      <div className={`min-h-full ${themeClasses.pageBg}`}>
        <CategoryDetailView
          category={categoryDetail}
          categoryColor={categoryColor}
          transactions={categoryTxs}
          totalAmount={totalAmount}
          onBack={() => setCategoryDetail(null)}
          onTransactionClick={setSelectedTransaction}
        />
        {selectedTransaction && (
          <TransactionDetailModal
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
            onSave={() => setSelectedTransaction(null)}
            onDelete={() => setSelectedTransaction(null)}
            currentUserId={currentUserId}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-full ${themeClasses.pageBg}`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-20 ${themeClasses.headerGradient} backdrop-blur-xl border-b border-white/5`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-2 border-b border-white/5">
            <div className="flex items-center gap-1 p-1 rounded-xl neo-card">
              {[
                { id: "mine" as const, icon: User, label: "Me" },
                { id: "all" as const, icon: Users, label: "Both" },
                { id: "partner" as const, icon: Heart, label: "Partner" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setOwnershipFilter(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    ownershipFilter === item.id
                      ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                      : "text-slate-400 hover:text-slate-300 hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-1.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || hasPendingTransactions}
              className={cn(
                "p-1.5 rounded-lg neo-card transition-all",
                isRefreshing && "animate-spin"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", themeClasses.text)} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                showFilters || hasActiveFilters
                  ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                  : `neo-card ${themeClasses.text} hover:bg-white/5`
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
          </div>
          {showFilters && (
            <div className="px-4 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200 border-t border-white/5">
              <div className="pt-3 flex flex-wrap gap-2">
                {[
                  {
                    label: "Today",
                    getValue: () => {
                      const today = format(new Date(), "yyyy-MM-dd");
                      return { start: today, end: today };
                    },
                  },
                  {
                    label: "This Week",
                    getValue: () => ({
                      start: format(
                        startOfWeek(new Date(), { weekStartsOn: 1 }),
                        "yyyy-MM-dd"
                      ),
                      end: format(
                        endOfWeek(new Date(), { weekStartsOn: 1 }),
                        "yyyy-MM-dd"
                      ),
                    }),
                  },
                  {
                    label: "This Month",
                    getValue: () => ({
                      start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
                      end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "Last 7 Days",
                    getValue: () => ({
                      start: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                      end: format(new Date(), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "Last 30 Days",
                    getValue: () => ({
                      start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
                      end: format(new Date(), "yyyy-MM-dd"),
                    }),
                  },
                ].map((preset) => {
                  const range = preset.getValue();
                  return (
                    <button
                      key={preset.label}
                      onClick={() =>
                        onDateRangeChange?.(range.start, range.end)
                      }
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                        startDate === range.start && endDate === range.end
                          ? "neo-gradient text-white"
                          : `neo-card ${themeClasses.text} hover:bg-white/5`
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={`px-2 py-1.5 rounded-lg ${themeClasses.bgSurface} neo-border text-white text-xs flex-1`}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat || "unknown"} value={cat || ""}>
                      {cat}
                    </option>
                  ))}
                </select>
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className={`px-2 py-1.5 rounded-lg ${themeClasses.bgSurface} neo-border text-white text-xs flex-1`}
                >
                  <option value="">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc || "unknown"} value={acc || ""}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Row 1: Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="neo-card p-4 bg-gradient-to-br from-emerald-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-300/70">Total Spent</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ${stats.total.toFixed(0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="neo-card p-4 bg-gradient-to-br from-orange-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/20">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-orange-300/70">Daily Burn</p>
                <p className="text-2xl font-bold text-orange-400">
                  ${spendingVelocity.dailyBurnRate.toFixed(0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="neo-card p-4 bg-gradient-to-br from-violet-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/20">
                {spendingVelocity.weekOverWeekChange >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-violet-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-violet-300/70">vs Last Week</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    spendingVelocity.weekOverWeekChange > 10
                      ? "text-red-400"
                      : spendingVelocity.weekOverWeekChange < -10
                        ? "text-emerald-400"
                        : "text-violet-400"
                  )}
                >
                  {spendingVelocity.weekOverWeekChange >= 0 ? "+" : ""}
                  {spendingVelocity.weekOverWeekChange.toFixed(0)}%
                </p>
              </div>
            </div>
          </Card>
          <Card className="neo-card p-4 bg-gradient-to-br from-sky-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/20">
                <Shield className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-sky-300/70">Health Score</p>
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn("text-2xl font-bold", healthScore.gradeColor)}
                  >
                    {healthScore.score}
                  </p>
                  <span
                    className={cn(
                      "text-lg font-semibold",
                      healthScore.gradeColor
                    )}
                  >
                    {healthScore.grade}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Insights Bar */}
        {insights.length > 0 && (
          <div className="mb-4 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl neo-card min-w-fit",
                  insight.type === "warning" && "border border-amber-500/30",
                  insight.type === "success" && "border border-emerald-500/30",
                  insight.type === "tip" && "border border-violet-500/30"
                )}
              >
                <insight.icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    insight.type === "warning" && "text-amber-400",
                    insight.type === "success" && "text-emerald-400",
                    insight.type === "tip" && "text-violet-400",
                    insight.type === "info" && themeClasses.text
                  )}
                />
                <span className="text-xs text-slate-300 whitespace-nowrap">
                  {insight.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Row 2: Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Categories */}
          <Card className="neo-card p-4 lg:col-span-1">
            <h3
              className={`text-sm font-semibold mb-3 ${themeClasses.headerText}`}
            >
              Spending by Category
            </h3>
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1].amount - a[1].amount)
                .slice(0, 8)
                .map(([cat, data]) => {
                  const percentage = (data.amount / stats.total) * 100;
                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategoryClick(cat)}
                      className="w-full group hover:-translate-y-0.5 transition-transform duration-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: data.color }}
                        >
                          {cat}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          ${data.amount.toFixed(0)}
                        </span>
                      </div>
                      <div
                        className={`h-1.5 ${themeClasses.surfaceBgMuted} rounded-full overflow-hidden`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: data.color,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>

          {/* Day of Week */}
          <Card className="neo-card p-4">
            <h3
              className={`text-sm font-semibold mb-3 ${themeClasses.headerText}`}
            >
              Spending by Day
            </h3>
            <div className="grid grid-cols-7 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const data = dayOfWeekPattern.byDay[day];
                const intensity = data.total / dayOfWeekPattern.maxTotal;
                const isPeak = day === dayOfWeekPattern.peakDay.day;
                return (
                  <div key={day} className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 mb-1">
                      {getDayName(day)}
                    </span>
                    <div
                      className={cn(
                        "w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium",
                        isPeak && "ring-2 ring-amber-400/50"
                      )}
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.5})`,
                        color: intensity > 0.5 ? "white" : "rgb(148, 163, 184)",
                      }}
                    >
                      ${data.total.toFixed(0)}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      {data.count}tx
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-white/5 flex justify-between text-xs">
              <span className="text-slate-400">
                Peak:{" "}
                <span className="text-amber-400 font-medium">
                  {getDayName(dayOfWeekPattern.peakDay.day)}
                </span>
              </span>
              <span className="text-slate-400">
                Low:{" "}
                <span className="text-emerald-400 font-medium">
                  {getDayName(dayOfWeekPattern.lowDay.day)}
                </span>
              </span>
            </div>
          </Card>

          {/* Category Trends */}
          <Card className="neo-card p-4">
            <h3
              className={`text-sm font-semibold mb-3 ${themeClasses.headerText}`}
            >
              Category Trends
            </h3>
            <div className="space-y-3">
              {categoryTrends.growing.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-red-400 font-medium">
                      Growing
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {categoryTrends.growing.slice(0, 3).map((t) => (
                      <div
                        key={t.category}
                        className="flex items-center justify-between"
                      >
                        <span
                          className="text-xs truncate"
                          style={{ color: t.color }}
                        >
                          {t.category}
                        </span>
                        <span className="text-xs text-red-400 font-medium">
                          +{t.change.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {categoryTrends.shrinking.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">
                      Shrinking
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {categoryTrends.shrinking.slice(0, 3).map((t) => (
                      <div
                        key={t.category}
                        className="flex items-center justify-between"
                      >
                        <span
                          className="text-xs truncate"
                          style={{ color: t.color }}
                        >
                          {t.category}
                        </span>
                        <span className="text-xs text-emerald-400 font-medium">
                          {t.change.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {categoryTrends.growing.length === 0 &&
                categoryTrends.shrinking.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No significant trends
                  </p>
                )}
            </div>
          </Card>
        </div>

        {/* Row 3: Projection & Anomalies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card className="neo-card p-4">
            <h3
              className={`text-sm font-semibold mb-3 ${themeClasses.headerText}`}
            >
              Spending Projection
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Current Total</span>
                <span className="text-lg font-bold text-emerald-400">
                  ${stats.total.toFixed(0)}
                </span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (stats.total / spendingVelocity.projectedTotal) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Projected Total</span>
                <span className="text-lg font-bold text-amber-400">
                  ${spendingVelocity.projectedTotal.toFixed(0)}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Days Elapsed</p>
                  <p className="text-sm font-semibold text-slate-300">
                    {spendingVelocity.daysElapsed}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Days Left</p>
                  <p className="text-sm font-semibold text-slate-300">
                    {spendingVelocity.daysRemaining}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="neo-card p-4">
            <h3
              className={`text-sm font-semibold mb-3 flex items-center gap-2 ${themeClasses.headerText}`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Unusual Transactions
            </h3>
            {anomalies.unusualTransactions.length > 0 ? (
              <div className="space-y-2">
                {anomalies.unusualTransactions.slice(0, 4).map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTransaction(tx)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg transition-all",
                      themeClasses.bgSurface,
                      themeClasses.bgHover
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span
                        className="text-xs truncate max-w-[120px]"
                        style={{ color: tx.category_color || "#e2e8f0" }}
                      >
                        {tx.category || "Uncategorized"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {format(parseISO(tx.date), "MMM d")}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-amber-400">
                      ${tx.amount.toFixed(0)}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-slate-500 mt-2">
                  Above ${anomalies.threshold.toFixed(0)} threshold
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">
                No unusual transactions 🎉
              </p>
            )}
          </Card>
        </div>

        {/* Transactions */}
        <Card
          className={`neo-card p-4 bg-gradient-to-br ${themeClasses.cardGradient}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${themeClasses.headerText}`}>
              Recent Transactions
            </h3>
            <span className="text-xs text-slate-400">
              {filteredTransactions.length} total
            </span>
          </div>
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredTransactions.slice(0, 20).map((tx) => {
              const isPartnerTx = tx.is_owner === false;
              const iconColor = isPartnerTx
                ? themeClasses.isPink
                  ? "text-cyan-400"
                  : "text-pink-400"
                : themeClasses.textFaint;
              const isHovered = hoveredTransaction === tx.id;
              return (
                <div
                  key={tx.id}
                  className={cn(
                    "relative flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer",
                    themeClasses.bgSurface,
                    themeClasses.bgHover,
                    "hover:shadow-lg group"
                  )}
                  onMouseEnter={() => setHoveredTransaction(tx.id)}
                  onMouseLeave={() => setHoveredTransaction(null)}
                  onClick={() => setSelectedTransaction(tx)}
                >
                  {(() => {
                    const Icon = getCategoryIcon(tx.category || undefined);
                    return (
                      <div
                        className="p-1.5 rounded-lg"
                        style={{
                          backgroundColor:
                            `${tx.category_color}20` || "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: tx.category_color || "#e2e8f0" }}
                    >
                      {tx.category || "Uncategorized"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {format(parseISO(tx.date), "MMM d")}
                      {tx.description && ` • ${tx.description}`}
                    </p>
                  </div>
                  {isHovered && (
                    <div className="flex items-center gap-1 mr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTransaction(tx);
                        }}
                        className="p-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(tx.id);
                        }}
                        className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className={cn("text-sm font-bold", themeClasses.text)}>
                    ${tx.amount.toFixed(2)}
                  </p>
                </div>
              );
            })}
            {filteredTransactions.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📭</div>
                <p className={themeClasses.textMuted}>No transactions found</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onSave={() => setSelectedTransaction(null)}
          onDelete={() => setSelectedTransaction(null)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
});

export default WebDashboard;
