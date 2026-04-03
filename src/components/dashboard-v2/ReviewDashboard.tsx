"use client";

import CategoryDonutWidget from "@/components/dashboard-v2/widgets/CategoryDonutWidget";
import CategoryForecastWidget from "@/components/dashboard-v2/widgets/CategoryForecastWidget";
import CategoryComparisonChart from "@/components/dashboard-v2/widgets/CategoryComparisonChart";
import PeriodSummaryWidget from "@/components/dashboard-v2/widgets/PeriodSummaryWidget";
import PeriodTimelineWidget from "@/components/dashboard-v2/widgets/PeriodTimelineWidget";
import RecurringVsVariableWidget from "@/components/dashboard-v2/widgets/RecurringVsVariableWidget";
import HouseholdSplitWidget from "@/components/dashboard-v2/widgets/HouseholdSplitWidget";
import TopExpensesWidget from "@/components/dashboard-v2/widgets/TopExpensesWidget";
import NeedsWantsSavingsWidget from "@/components/dashboard-v2/widgets/NeedsWantsSavingsWidget";
import SpendingVelocityWidget from "@/components/dashboard-v2/widgets/SpendingVelocityWidget";
import DebtSummaryWidget from "@/components/dashboard-v2/widgets/DebtSummaryWidget";
import { WidgetSkeleton } from "@/components/dashboard-v2/WidgetCard";
import { useAccounts } from "@/features/accounts/hooks";
import {
  useAnalytics,
} from "@/features/analytics/useAnalytics";
import {
  getExpenseTransactions,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import { differenceInDays, parseISO } from "date-fns";
import { useMemo } from "react";

type Props = {
  transactions: TransactionWithAccount[];
  startDate: string;
  endDate: string;
  ownershipFilter?: "all" | "mine" | "partner";
};

export default function ReviewDashboard({
  transactions,
  startDate,
  endDate,
  ownershipFilter = "all",
}: Props) {
  const totalDays = useMemo(
    () => differenceInDays(parseISO(endDate), parseISO(startDate)) + 1,
    [startDate, endDate],
  );

  // Fetch enough months to cover the period + 6 for forecasting
  const monthsToFetch = useMemo(() => {
    const periodMonths = Math.ceil(totalDays / 28);
    return Math.max(periodMonths + 3, 6);
  }, [totalDays]);

  const { data: analytics, isLoading } = useAnalytics({
    months: monthsToFetch,
    ownership: ownershipFilter,
  });

  const { data: accounts } = useAccounts();

  // Expense-only transactions for category / top expense widgets
  const expenseTransactions = useMemo(
    () =>
      getExpenseTransactions(transactions, accounts).filter(
        (t: any) => !t.is_debt_return,
      ),
    [transactions, accounts],
  );

  // Days elapsed for velocity widget
  const { daysElapsed, totalDaysCount } = useMemo(() => {
    const now = new Date();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const total = Math.max(differenceInDays(end, start) + 1, 1);
    const clamped = now < start ? start : now > end ? end : now;
    const elapsed = Math.max(differenceInDays(clamped, start) + 1, 1);
    return { daysElapsed: Math.min(elapsed, total), totalDaysCount: total };
  }, [startDate, endDate]);

  // Current month from analytics (last in list)
  const currentMonth = analytics?.months[analytics.months.length - 1];

  // Months within the selected period for timeline
  const periodMonths = useMemo(() => {
    if (!analytics?.months) return undefined;
    const from = startDate.slice(0, 7);
    const to = endDate.slice(0, 7);
    return analytics.months.filter((m) => m.month >= from && m.month <= to);
  }, [analytics?.months, startDate, endDate]);

  if (isLoading && !analytics) {
    return (
      <div className="space-y-3">
        <WidgetSkeleton height={200} />
        <WidgetSkeleton height={220} />
        <WidgetSkeleton height={200} />
        <WidgetSkeleton height={180} />
        <WidgetSkeleton height={180} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Hero KPIs — full width ────────────────────────────────────────── */}
      <PeriodSummaryWidget
        transactions={transactions}
        startDate={startDate}
        endDate={endDate}
      />

      {/* ── 2-col grid for medium widgets ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 2. Where the money went: Category Donut ─────────────────────── */}
        <CategoryDonutWidget transactions={expenseTransactions} />

        {/* ── 4. Spending Velocity / Burn Rate ────────────────────────────── */}
        <SpendingVelocityWidget
          months={analytics?.months}
          currentMonthDays={daysElapsed}
          totalDaysInPeriod={totalDaysCount}
        />
      </div>

      {/* ── 3. Period timeline — full width ─────────────────────────────────── */}
      <PeriodTimelineWidget
        months={analytics?.months}
        transactions={expenseTransactions}
        startDate={startDate}
        endDate={endDate}
      />

      {/* ── 2-col grid for forecast + comparison ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 5. Category Forecast ────────────────────────────────────────── */}
        <CategoryForecastWidget months={analytics?.months} />

        {/* ── 7. Needs / Wants / Savings breakdown ────────────────────────── */}
        <NeedsWantsSavingsWidget
          data={analytics?.needsWantsSavings}
          totalIncome={currentMonth?.income ?? 0}
        />
      </div>

      {/* ── 6. Category comparison — full width ─────────────────────────────── */}
      <CategoryComparisonChart months={periodMonths ?? analytics?.months} />

      {/* ── 2-col grid for cost breakdown + household split ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 8. Fixed vs Variable costs ──────────────────────────────────── */}
        <RecurringVsVariableWidget
          recurringTotal={analytics?.recurring.totalMonthly ?? 0}
          recurringItems={analytics?.recurring.items}
          currentMonthExpense={currentMonth?.expense ?? 0}
        />

        {/* ── 9. Household split (only if partner linked) ──────────────────── */}
        {analytics?.hasPartner ? (
          <HouseholdSplitWidget
            months={analytics?.months}
            hasPartner={analytics?.hasPartner ?? false}
          />
        ) : (
          /* ── 11. Debt snapshot (fills the slot if no partner) ────────────── */
          (analytics?.debts.openCount ?? 0) > 0 && (
            <DebtSummaryWidget
              totalOwed={analytics?.debts.totalOwed ?? 0}
              totalOwedToYou={analytics?.debts.totalOwedToYou ?? 0}
              openCount={analytics?.debts.openCount ?? 0}
            />
          )
        )}
      </div>

      {/* ── 10. Top Transactions — full width ───────────────────────────────── */}
      <TopExpensesWidget transactions={expenseTransactions} />

      {/* ── 11. Debt snapshot (when partner is present) ─────────────────────── */}
      {analytics?.hasPartner && (analytics?.debts.openCount ?? 0) > 0 && (
        <DebtSummaryWidget
          totalOwed={analytics?.debts.totalOwed ?? 0}
          totalOwedToYou={analytics?.debts.totalOwedToYou ?? 0}
          openCount={analytics?.debts.openCount ?? 0}
        />
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
