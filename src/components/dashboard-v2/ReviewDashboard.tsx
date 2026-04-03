"use client";

import {
  applyReviewFilters,
  useReviewFilters,
} from "@/components/dashboard-v2/useReviewFilters";
import { WidgetSkeleton } from "@/components/dashboard-v2/WidgetCard";
import AccountBreakdownWidget from "@/components/dashboard-v2/widgets/AccountBreakdownWidget";
import AnomalyDetectionWidget from "@/components/dashboard-v2/widgets/AnomalyDetectionWidget";
import BudgetForecastWidget from "@/components/dashboard-v2/widgets/BudgetForecastWidget";
import BudgetVsActualWidget from "@/components/dashboard-v2/widgets/BudgetVsActualWidget";
import CashFlowWaterfallWidget from "@/components/dashboard-v2/widgets/CashFlowWaterfallWidget";
import CashFlowWidget from "@/components/dashboard-v2/widgets/CashFlowWidget";
import CategoryComparisonChart from "@/components/dashboard-v2/widgets/CategoryComparisonChart";
import CategoryDonutWidget from "@/components/dashboard-v2/widgets/CategoryDonutWidget";
import CategoryForecastWidget from "@/components/dashboard-v2/widgets/CategoryForecastWidget";
import CategoryInsightWidget from "@/components/dashboard-v2/widgets/CategoryInsightWidget";
import CategoryRankingWidget from "@/components/dashboard-v2/widgets/CategoryRankingWidget";
import CategoryTrendWidget from "@/components/dashboard-v2/widgets/CategoryTrendWidget";
import CategoryVolatilityWidget from "@/components/dashboard-v2/widgets/CategoryVolatilityWidget";
import DayOfWeekWidget from "@/components/dashboard-v2/widgets/DayOfWeekWidget";
import DebtSummaryWidget from "@/components/dashboard-v2/widgets/DebtSummaryWidget";
import ForecastWidget from "@/components/dashboard-v2/widgets/ForecastWidget";
import HealthScoreWidget from "@/components/dashboard-v2/widgets/HealthScoreWidget";
import HouseholdSplitWidget from "@/components/dashboard-v2/widgets/HouseholdSplitWidget";
import IncomeVsExpenseTrendWidget from "@/components/dashboard-v2/widgets/IncomeVsExpenseTrendWidget";
import MonthlyReviewScorecardWidget from "@/components/dashboard-v2/widgets/MonthlyReviewScorecardWidget";
import NeedsWantsSavingsWidget from "@/components/dashboard-v2/widgets/NeedsWantsSavingsWidget";
import NetWorthWidget from "@/components/dashboard-v2/widgets/NetWorthWidget";
import PeriodComparisonWidget from "@/components/dashboard-v2/widgets/PeriodComparisonWidget";
import PeriodSummaryWidget from "@/components/dashboard-v2/widgets/PeriodSummaryWidget";
import PeriodTimelineWidget from "@/components/dashboard-v2/widgets/PeriodTimelineWidget";
import RecurringUpcomingWidget from "@/components/dashboard-v2/widgets/RecurringUpcomingWidget";
import RecurringVsVariableWidget from "@/components/dashboard-v2/widgets/RecurringVsVariableWidget";
import SavingsRateTrendWidget from "@/components/dashboard-v2/widgets/SavingsRateTrendWidget";
import SeasonalComparisonWidget from "@/components/dashboard-v2/widgets/SeasonalComparisonWidget";
import SmartInsightsWidget from "@/components/dashboard-v2/widgets/SmartInsightsWidget";
import SpendingHeatmapWidget from "@/components/dashboard-v2/widgets/SpendingHeatmapWidget";
import SpendingPaceWidget from "@/components/dashboard-v2/widgets/SpendingPaceWidget";
import SpendingVelocityWidget from "@/components/dashboard-v2/widgets/SpendingVelocityWidget";
import TopExpensesWidget from "@/components/dashboard-v2/widgets/TopExpensesWidget";
import TopMoversWidget from "@/components/dashboard-v2/widgets/TopMoversWidget";
import TransactionFrequencyWidget from "@/components/dashboard-v2/widgets/TransactionFrequencyWidget";
import TransactionSizeDistributionWidget from "@/components/dashboard-v2/widgets/TransactionSizeDistributionWidget";
import { useAccounts } from "@/features/accounts/hooks";
import {
  useAnalytics,
  useHealthScore,
} from "@/features/analytics/useAnalytics";
import { useNetWorthSeries } from "@/features/analytics/useNetWorth";
import { useBudgetAllocations } from "@/features/budget/hooks";
import {
  getExpenseTransactions,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import { differenceInDays, format, parseISO } from "date-fns";
import { useCallback, useMemo, useState } from "react";

type ReviewTab = "summary" | "spending" | "trends" | "outlook";
const TABS: ReviewTab[] = ["summary", "spending", "trends", "outlook"];

const TREND_MONTH_OPTIONS = [3, 6, 12, 24] as const;
type TrendMonthOption = (typeof TREND_MONTH_OPTIONS)[number];

type Props = {
  transactions: TransactionWithAccount[];
  startDate: string;
  endDate: string;
  ownershipFilter?: "all" | "mine" | "partner";
  filterCategories?: string[];
  filterAccount?: string;
  filterMinAmount?: number;
  onCategoryClick?: (category: string) => void;
};

export default function ReviewDashboard({
  transactions,
  startDate,
  endDate,
  ownershipFilter = "all",
  filterCategories = [],
  filterAccount,
  filterMinAmount = 0,
  onCategoryClick,
}: Props) {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ReviewTab>(() => {
    try {
      return (sessionStorage.getItem("reviewDashboardTab") as ReviewTab) ?? "summary";
    } catch {
      return "summary";
    }
  });

  const handleTabChange = useCallback((tab: ReviewTab) => {
    setActiveTab(tab);
    try { sessionStorage.setItem("reviewDashboardTab", tab); } catch {}
  }, []);

  // ── Trends month count ─────────────────────────────────────────────────────
  const [trendMonths, setTrendMonths] = useState<TrendMonthOption>(6);

  // ── Cross-filter store ─────────────────────────────────────────────────────
  const filters = useReviewFilters();
  const hasStoreFilters = filters.hasActiveFilters();

  const totalDays = useMemo(
    () => differenceInDays(parseISO(endDate), parseISO(startDate)) + 1,
    [startDate, endDate],
  );

  const monthsToFetch = useMemo(() => {
    const periodMonths = Math.ceil(totalDays / 28);
    return Math.max(periodMonths + 3, 6);
  }, [totalDays]);

  // ── Analytics: period-aware (Summary / Spending / Outlook tabs) ────────────
  const { data: analytics, isLoading } = useAnalytics({
    months: monthsToFetch,
    ownership: ownershipFilter,
  });

  // ── Analytics: trend-scoped (Trends tab — driven by month-count picker) ────
  const { data: analyticsForTrends, isLoading: isTrendsLoading } = useAnalytics({
    months: trendMonths,
    ownership: ownershipFilter,
  });

  const { data: accounts } = useAccounts();

  const budgetMonth = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const { data: budgetAllocations } = useBudgetAllocations(budgetMonth);

  const healthScore = useHealthScore(analytics);
  const netWorthSeries = useNetWorthSeries(analytics?.months, analytics?.accounts);

  // ── Derived transaction sets ────────────────────────────────────────────────
  const expenseTransactions = useMemo(
    () =>
      getExpenseTransactions(transactions, accounts).filter(
        (t: any) => !t.is_debt_return,
      ),
    [transactions, accounts],
  );

  const filteredExpenseTransactions = useMemo(() => {
    let txs = expenseTransactions;
    if (filterCategories.length > 0)
      txs = txs.filter((t) => filterCategories.includes(t.category ?? ""));
    if (filterAccount)
      txs = txs.filter((t) => (t as any).account_name === filterAccount);
    if (filterMinAmount > 0)
      txs = txs.filter((t) => Math.abs(t.amount) >= filterMinAmount);
    if (hasStoreFilters) {
      txs = applyReviewFilters(txs as any, filters) as typeof txs;
    }
    return txs;
  }, [
    expenseTransactions,
    filterCategories,
    filterAccount,
    filterMinAmount,
    hasStoreFilters,
    filters,
  ]);

  const filteredAllTransactions = useMemo(() => {
    if (!hasStoreFilters) return transactions;
    return applyReviewFilters(transactions as any, filters) as typeof transactions;
  }, [transactions, hasStoreFilters, filters]);

  // ── Timing ─────────────────────────────────────────────────────────────────
  const { daysElapsed, totalDaysCount } = useMemo(() => {
    const now = new Date();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const total = Math.max(differenceInDays(end, start) + 1, 1);
    const clamped = now < start ? start : now > end ? end : now;
    const elapsed = Math.max(differenceInDays(clamped, start) + 1, 1);
    return { daysElapsed: Math.min(elapsed, total), totalDaysCount: total };
  }, [startDate, endDate]);

  const currentMonth = analytics?.months[analytics.months.length - 1];

  const periodMonths = useMemo(() => {
    if (!analytics?.months) return undefined;
    const from = startDate.slice(0, 7);
    const to = endDate.slice(0, 7);
    return analytics.months.filter((m) => m.month >= from && m.month <= to);
  }, [analytics?.months, startDate, endDate]);

  // ── Budget data ─────────────────────────────────────────────────────────────
  const budgetData = useMemo(() => {
    if (!budgetAllocations?.summary || !currentMonth) return undefined;
    const categoryBudgets = budgetAllocations.summary.categories
      .filter((a) => a.total_budget > 0)
      .map((a) => ({
        category: a.category_name,
        budget: a.total_budget,
        spent: a.total_spent,
      }));
    return { categoryBudgets };
  }, [budgetAllocations, currentMonth]);

  // ── Category means for anomaly flags in TopExpenses ────────────────────────
  const categoryMeans = useMemo(() => {
    if (!analytics?.months || analytics.months.length < 2) return undefined;
    const totals: Record<string, number[]> = {};
    for (const m of analytics.months.slice(0, -1)) {
      for (const cat of m.categoryBreakdown) {
        if (!totals[cat.name]) totals[cat.name] = [];
        totals[cat.name].push(cat.amount);
      }
    }
    const means: Record<string, number> = {};
    for (const [name, vals] of Object.entries(totals)) {
      means[name] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
    return means;
  }, [analytics?.months]);

  // ── Active category list (toolbar + store combined) ─────────────────────────
  const activeCategoryList = useMemo(
    () => [...filterCategories, ...filters.categories],
    [filterCategories, filters.categories],
  );

  // ── Cross-filter callbacks ──────────────────────────────────────────────────
  const handleCategoryClick = useCallback(
    (cat: string) => {
      onCategoryClick?.(cat);
      filters.toggleCategory(cat);
      filters.setFilterSource("category");
    },
    [onCategoryClick, filters],
  );

  const handleAccountClick = useCallback(
    (acc: string) => {
      filters.toggleAccount(acc);
      filters.setFilterSource("account");
    },
    [filters],
  );

  const handleWeekdayClick = useCallback(
    (day: number) => {
      filters.toggleWeekday(day);
      filters.setFilterSource("weekday");
    },
    [filters],
  );

  const handleDateClick = useCallback(
    (date: string) => {
      filters.setDateSubRange(
        filters.dateSubRange?.start === date
          ? null
          : { start: date, end: date },
      );
      filters.setFilterSource("heatmap");
    },
    [filters],
  );

  const handleMonthClick = useCallback(
    (range: { start: string; end: string }) => {
      filters.setDateSubRange(range);
      filters.setFilterSource("heatmap");
    },
    [filters],
  );

  const handleClassificationClick = useCallback(
    (cls: "need" | "want" | "saving") => {
      filters.toggleClassification(cls);
      filters.setFilterSource("classification");
    },
    [filters],
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading && !analytics) {
    return (
      <div className="space-y-3">
        <WidgetSkeleton height={44} />
        <WidgetSkeleton height={200} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <WidgetSkeleton height={220} />
          <WidgetSkeleton height={220} />
        </div>
        <WidgetSkeleton height={200} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <WidgetSkeleton height={180} />
          <WidgetSkeleton height={180} />
        </div>
      </div>
    );
  }

  const hasToolbarFilter = filterCategories.length > 0 || !!filterAccount || filterMinAmount > 0;
  const hasAnyFilter = hasToolbarFilter || hasStoreFilters;
  const hasCategoryFilter = activeCategoryList.length > 0;

  // ── Filter banner (shared by Summary / Spending / Outlook) ─────────────────
  const filterBanner = hasAnyFilter ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 flex-wrap">
      <span className="text-white/30 uppercase tracking-wider text-[10px]">Filters</span>

      {filterCategories.map((cat) => (
        <button
          key={`tb-${cat}`}
          onClick={() => onCategoryClick?.(cat)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium hover:bg-cyan-500/25 transition-colors"
        >
          {cat}<span className="opacity-50 hover:opacity-90 ml-0.5">×</span>
        </button>
      ))}
      {filterAccount && (
        <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">{filterAccount}</span>
      )}
      {filterMinAmount > 0 && (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">≥${filterMinAmount}</span>
      )}
      {filters.categories.map((cat) => (
        <button
          key={`cf-${cat}`}
          onClick={() => filters.toggleCategory(cat)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium hover:bg-cyan-500/25 transition-colors"
        >
          {cat}<span className="opacity-50 hover:opacity-90 ml-0.5">×</span>
        </button>
      ))}
      {filters.accounts.map((acc) => (
        <button
          key={`cf-${acc}`}
          onClick={() => filters.toggleAccount(acc)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium hover:bg-violet-500/25 transition-colors"
        >
          {acc}<span className="opacity-50 hover:opacity-90 ml-0.5">×</span>
        </button>
      ))}
      {filters.classification.map((cls) => (
        <button
          key={`cf-${cls}`}
          onClick={() => filters.toggleClassification(cls)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400 font-medium hover:bg-pink-500/25 transition-colors"
        >
          {cls}<span className="opacity-50 hover:opacity-90 ml-0.5">×</span>
        </button>
      ))}
      {filters.weekdays.length > 0 && (
        <button
          onClick={() => filters.clearDimension("weekdays")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium hover:bg-amber-500/25 transition-colors"
        >
          {filters.weekdays.length} weekdays<span className="opacity-50 hover:opacity-90 ml-0.5">×</span>
        </button>
      )}
      {filters.dateSubRange && (
        <button
          onClick={() => filters.clearDimension("dateSubRange")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium hover:bg-emerald-500/25 transition-colors"
        >
          {filters.dateSubRange.start === filters.dateSubRange.end
            ? filters.dateSubRange.start
            : `${filters.dateSubRange.start} — ${filters.dateSubRange.end}`}
          <span className="opacity-50 hover:opacity-90 ml-0.5">×</span>
        </button>
      )}
      {hasStoreFilters && (
        <button
          onClick={() => filters.clearAll()}
          className="ml-auto text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider"
        >
          Clear all ×
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* ══════ TAB BAR ══════ */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors capitalize ${
              activeTab === tab
                ? "bg-white/15 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — SUMMARY
          "How did I do in this period?"
          Filters: date range (from WebDashboard) + ownership
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {filterBanner}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HealthScoreWidget
              score={healthScore.score}
              factors={healthScore.factors}
            />
            <MonthlyReviewScorecardWidget
              months={analytics?.months}
              debts={analytics?.debts}
              recurring={analytics?.recurring}
              healthScore={healthScore.score}
            />
          </div>

          {/* Hero KPIs — full width */}
          <PeriodSummaryWidget
            transactions={filteredAllTransactions}
            startDate={startDate}
            endDate={endDate}
            months={analytics?.months}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CashFlowWaterfallWidget
              months={periodMonths ?? analytics?.months}
              needsWantsSavings={analytics?.needsWantsSavings}
            />
            <NeedsWantsSavingsWidget
              data={analytics?.needsWantsSavings}
              totalIncome={currentMonth?.income ?? 0}
            />
          </div>

          {/* AI-generated insights — full width */}
          <SmartInsightsWidget
            months={analytics?.months}
            transactions={filteredExpenseTransactions}
            budgetData={budgetData}
            recurring={analytics?.recurring}
            debts={analytics?.debts}
            daysElapsed={daysElapsed}
            totalDays={totalDaysCount}
            onCategoryClick={handleCategoryClick}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — SPENDING
          "Where did my money go?"
          Filters: date range + category chips + classification toggle
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "spending" && (
        <div className="space-y-4">
          {filterBanner}

          {/* Classification filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Type</span>
            {(["need", "want", "saving"] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => handleClassificationClick(cls)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                  filters.classification.includes(cls)
                    ? "bg-pink-500/20 text-pink-400 ring-1 ring-pink-500/40"
                    : "bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10"
                }`}
              >
                {cls}
              </button>
            ))}
            {filters.classification.length > 0 && (
              <button
                onClick={() => filters.clearDimension("classification")}
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                clear ×
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryDonutWidget
              transactions={filteredExpenseTransactions}
              activeCategories={activeCategoryList}
              onCategoryClick={handleCategoryClick}
            />
            <BudgetVsActualWidget
              transactions={filteredExpenseTransactions}
              startDate={startDate}
              onCategoryClick={handleCategoryClick}
              activeCategories={activeCategoryList}
              months={analytics?.months}
            />
          </div>

          {/* Category comparison bar chart — full width */}
          <CategoryComparisonChart
            months={periodMonths ?? analytics?.months}
            activeCategories={activeCategoryList}
          />

          {/* Category deep-dive — only shown when a category is selected */}
          {hasCategoryFilter && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryInsightWidget
                transactions={filteredExpenseTransactions}
                activeCategories={activeCategoryList}
                onCategoryClick={handleCategoryClick}
              />
              <CategoryTrendWidget
                transactions={expenseTransactions}
                activeCategories={activeCategoryList}
                startDate={startDate}
                endDate={endDate}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DayOfWeekWidget
              transactions={filteredExpenseTransactions}
              activeWeekdays={filters.weekdays}
              onWeekdayClick={handleWeekdayClick}
            />
            <TransactionSizeDistributionWidget transactions={filteredExpenseTransactions} />
          </div>

          {/* Heatmap — full width */}
          <SpendingHeatmapWidget
            transactions={filteredExpenseTransactions}
            startDate={startDate}
            endDate={endDate}
            onDateClick={handleDateClick}
          />

          <TransactionFrequencyWidget
            transactions={filteredExpenseTransactions}
            startDate={startDate}
            endDate={endDate}
          />

          {/* Top expenses — full width */}
          <TopExpensesWidget
            transactions={filteredExpenseTransactions}
            onCategoryClick={handleCategoryClick}
            categoryMeans={categoryMeans}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SpendingVelocityWidget
              months={analytics?.months}
              currentMonthDays={daysElapsed}
              totalDaysInPeriod={totalDaysCount}
            />
            <AccountBreakdownWidget
              transactions={filteredExpenseTransactions}
              onAccountClick={handleAccountClick}
            />
          </div>

          {/* Seasonal patterns — full width */}
          <SeasonalComparisonWidget
            transactions={filteredExpenseTransactions as any}
            onCategoryClick={handleCategoryClick}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — TRENDS
          "Am I improving over time? What's anomalous?"
          Filter: month-count selector (3M / 6M / 12M / 24M)
          — independent from the date range picker in WebDashboard
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "trends" && (
        <div className="space-y-4">
          {/* Month-count selector */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Show last</span>
            <div className="flex gap-1">
              {TREND_MONTH_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setTrendMonths(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    trendMonths === n
                      ? "bg-white/15 text-white"
                      : "bg-white/5 text-white/40 hover:text-white/60"
                  }`}
                >
                  {n}M
                </button>
              ))}
            </div>
            <span className="text-[10px] text-white/20">of history</span>
          </div>

          {isTrendsLoading && !analyticsForTrends ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <WidgetSkeleton height={220} />
                <WidgetSkeleton height={220} />
              </div>
              <WidgetSkeleton height={200} />
              <WidgetSkeleton height={200} />
              <WidgetSkeleton height={200} />
            </div>
          ) : (
            <>
              {/* Period-over-period comparison side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PeriodComparisonWidget months={analyticsForTrends?.months} />
                <TopMoversWidget
                  months={analyticsForTrends?.months}
                  onCategoryClick={handleCategoryClick}
                />
              </div>

              {/* Income vs expense area chart — full width */}
              <IncomeVsExpenseTrendWidget
                months={analyticsForTrends?.months}
                onMonthClick={handleMonthClick}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SavingsRateTrendWidget months={analyticsForTrends?.months} />
                <CategoryRankingWidget
                  months={analyticsForTrends?.months}
                  onCategoryClick={handleCategoryClick}
                  activeCategories={activeCategoryList}
                />
              </div>

              {/* Anomaly detection — full width (needs historical context) */}
              <AnomalyDetectionWidget
                months={analyticsForTrends?.months}
                onCategoryClick={handleCategoryClick}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CategoryVolatilityWidget
                  months={analyticsForTrends?.months}
                  onCategoryClick={handleCategoryClick}
                />
                <ForecastWidget months={analyticsForTrends?.months} />
              </div>

              {/* Category-level forecast — full width */}
              <CategoryForecastWidget months={analyticsForTrends?.months} />
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4 — OUTLOOK
          "What's coming and what's my financial structure?"
          Filter: none (always shows current state / forward-looking)
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "outlook" && (
        <div className="space-y-4">
          {filterBanner}

          {/* Spending pace vs projected — full width */}
          <SpendingPaceWidget
            months={analytics?.months}
            dailyTotals={currentMonth?.dailyTotals}
            startDate={startDate}
            daysElapsed={daysElapsed}
            totalDays={totalDaysCount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BudgetForecastWidget
              months={analytics?.months}
              daysElapsed={daysElapsed}
              totalDays={totalDaysCount}
              currentMonthExpense={currentMonth?.expense ?? 0}
              budgetData={budgetData}
            />
            <RecurringUpcomingWidget onAccountClick={handleAccountClick} />
          </div>

          {netWorthSeries.length > 0 && (
            <NetWorthWidget series={netWorthSeries} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecurringVsVariableWidget
              recurringTotal={analytics?.recurring.totalMonthly ?? 0}
              recurringItems={analytics?.recurring.items}
              currentMonthExpense={currentMonth?.expense ?? 0}
            />
            {analytics?.hasPartner && (
              <HouseholdSplitWidget
                months={analytics?.months}
                hasPartner={analytics?.hasPartner}
              />
            )}
          </div>

          {(analytics?.debts.openCount ?? 0) > 0 && (
            <DebtSummaryWidget
              totalOwed={analytics?.debts.totalOwed ?? 0}
              totalOwedToYou={analytics?.debts.totalOwedToYou ?? 0}
              openCount={analytics?.debts.openCount ?? 0}
            />
          )}

          {/* Income vs expense trend with month click — full width */}
          <IncomeVsExpenseTrendWidget
            months={analytics?.months}
            onMonthClick={handleMonthClick}
          />

          <CashFlowWidget dailyTotals={currentMonth?.dailyTotals} />

          {/* Full period timeline — full width */}
          <PeriodTimelineWidget
            months={analytics?.months}
            transactions={filteredExpenseTransactions}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
