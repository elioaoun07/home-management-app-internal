"use client";

import { WidgetSkeleton } from "@/components/dashboard-v2/WidgetCard";
import CashFlowWidget from "@/components/dashboard-v2/widgets/CashFlowWidget";
import CategoryComparisonChart from "@/components/dashboard-v2/widgets/CategoryComparisonChart";
import DebtSummaryWidget from "@/components/dashboard-v2/widgets/DebtSummaryWidget";
import ForecastWidget from "@/components/dashboard-v2/widgets/ForecastWidget";
import HealthScoreWidget from "@/components/dashboard-v2/widgets/HealthScoreWidget";
import HouseholdSplitWidget from "@/components/dashboard-v2/widgets/HouseholdSplitWidget";
import NeedsWantsSavingsWidget from "@/components/dashboard-v2/widgets/NeedsWantsSavingsWidget";
import NetWorthWidget from "@/components/dashboard-v2/widgets/NetWorthWidget";
import RecurringVsVariableWidget from "@/components/dashboard-v2/widgets/RecurringVsVariableWidget";
import SpendingVelocityWidget from "@/components/dashboard-v2/widgets/SpendingVelocityWidget";
import TopExpensesWidget from "@/components/dashboard-v2/widgets/TopExpensesWidget";
import TrendChart from "@/components/dashboard-v2/widgets/TrendChart";
import { useAccounts } from "@/features/accounts/hooks";
import {
  useAnalytics,
  useHealthScore,
} from "@/features/analytics/useAnalytics";
import { useNetWorthSeries } from "@/features/analytics/useNetWorth";
import { getExpenseTransactions } from "@/lib/utils/incomeExpense";
import { useMemo } from "react";

type Props = {
  ownershipFilter: "all" | "mine" | "partner";
  accountTypeFilter: "expense" | "income" | "all";
  startDate: string;
  endDate: string;
  transactions: any[]; // for TopExpenses (already filtered by parent)
};

export default function AnalyticsDashboard({
  ownershipFilter,
  accountTypeFilter,
  startDate,
  endDate,
  transactions,
}: Props) {
  // Number of months to request (derive from date range)
  const monthsToFetch = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1;
    return Math.max(diff, 6); // minimum 6 months for good analytics
  }, [startDate, endDate]);

  const { data: analytics, isLoading } = useAnalytics({
    months: monthsToFetch,
    ownership: ownershipFilter,
  });

  const { data: accounts } = useAccounts();

  const healthScore = useHealthScore(analytics);
  const netWorthSeries = useNetWorthSeries(
    analytics?.months,
    analytics?.accounts,
  );

  // Current month metrics
  const currentMonth = analytics?.months[analytics.months.length - 1];
  const currentMonthDailyTotals = currentMonth?.dailyTotals;

  // Days elapsed and total in current period
  const { daysElapsed, totalDays } = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    const total = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const elapsed = Math.ceil(
      (Math.min(now.getTime(), end.getTime()) - start.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return { daysElapsed: Math.max(1, elapsed), totalDays: Math.max(1, total) };
  }, [startDate, endDate]);

  // Expense transactions for TopExpenses widget — only from expense-type accounts
  const expenseTransactions = useMemo(() => {
    const expenseOnly = getExpenseTransactions(transactions, accounts);
    return expenseOnly.filter((t: any) => !t.is_debt_return);
  }, [transactions, accounts]);

  if (isLoading && !analytics) {
    return (
      <div className="space-y-3">
        <WidgetSkeleton height={220} />
        <WidgetSkeleton height={220} />
        <WidgetSkeleton height={200} />
        <WidgetSkeleton height={180} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Financial Health Score — the headline metric */}
      <HealthScoreWidget
        score={healthScore.score}
        factors={healthScore.factors}
      />

      {/* Income / Expense / Savings Trend */}
      <TrendChart months={analytics?.months} />

      {/* Spending by Category */}
      <CategoryComparisonChart months={analytics?.months} />

      {/* Forecasting */}
      <ForecastWidget months={analytics?.months} />

      {/* 50/30/20 Budget Rule */}
      <NeedsWantsSavingsWidget
        data={analytics?.needsWantsSavings}
        totalIncome={currentMonth?.income ?? 0}
      />

      {/* Spending Velocity & Burn Rate */}
      <SpendingVelocityWidget
        months={analytics?.months}
        currentMonthDays={daysElapsed}
        totalDaysInPeriod={totalDays}
      />

      {/* Cash Flow Timeline */}
      <CashFlowWidget dailyTotals={currentMonthDailyTotals} />

      {/* Fixed vs Variable Costs */}
      <RecurringVsVariableWidget
        recurringTotal={analytics?.recurring.totalMonthly ?? 0}
        recurringItems={analytics?.recurring.items}
        currentMonthExpense={currentMonth?.expense ?? 0}
      />

      {/* Net Worth Trend */}
      <NetWorthWidget series={netWorthSeries} />

      {/* Top Expenses */}
      <TopExpensesWidget transactions={expenseTransactions} />

      {/* Household Partner Split (only if partner linked) */}
      {analytics?.hasPartner && (
        <HouseholdSplitWidget
          months={analytics?.months}
          hasPartner={analytics?.hasPartner ?? false}
        />
      )}

      {/* Debt Summary */}
      <DebtSummaryWidget
        totalOwed={analytics?.debts.totalOwed ?? 0}
        totalOwedToYou={analytics?.debts.totalOwedToYou ?? 0}
        openCount={analytics?.debts.openCount ?? 0}
      />

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
