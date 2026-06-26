"use client";

import { WidgetSkeleton } from "@/components/dashboard-v2/WidgetCard";
import CategoriesV2TabContent from "@/components/dashboard-v2/widgets/CategoriesV2TabContent";
import InsightTabContent from "@/components/dashboard-v2/widgets/InsightTabContent";
import MonthlyDistributionTabContent from "@/components/dashboard-v2/widgets/MonthlyDistributionTabContent";
import CategoryDetailView from "@/components/dashboard/CategoryDetailView";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import { useAccounts } from "@/features/accounts/hooks";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { useBudgetAllocations } from "@/features/budget/hooks";
import { useRecurringPayments } from "@/features/recurring/useRecurringPayments";
import type { RecurringHint } from "@/lib/utils/anomalyDetection";
import { formatDate } from "@/lib/utils/date";
import {
  getExpenseTransactions,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import { format, subMonths } from "date-fns";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type V3Tab = "monthly" | "categories" | "insight";
const TABS: { id: V3Tab; label: string }[] = [
  { id: "insight", label: "Insight" },
  { id: "monthly", label: "Monthly" },
  { id: "categories", label: "Categories" },
];

type Props = {
  transactions: TransactionWithAccount[];
  startDate: string;
  endDate: string;
  ownershipFilter?: "all" | "mine" | "partner";
  currentUserId?: string;
  onDateRangeChange?: (start: string, end: string) => void;
  filtersOpen?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReviewV3Dashboard({
  transactions,
  ownershipFilter = "all",
  currentUserId,
  onDateRangeChange,
  filtersOpen,
}: Props) {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<V3Tab>(() => {
    try {
      return (sessionStorage.getItem("reviewV3Tab") as V3Tab) ?? "insight";
    } catch {
      return "insight";
    }
  });

  // All three tabs work on a 12-month window (buckets / pie history)
  const setTwelveMonthRange = useCallback(() => {
    if (!onDateRangeChange) return;
    const now = new Date();
    const twelveMonthsAgo = format(subMonths(now, 11), "yyyy-MM-01");
    onDateRangeChange(twelveMonthsAgo, formatDate(now));
  }, [onDateRangeChange]);

  const handleTabChange = useCallback(
    (tab: V3Tab) => {
      setActiveTab(tab);
      try {
        sessionStorage.setItem("reviewV3Tab", tab);
      } catch {}
      setTwelveMonthRange();
    },
    [setTwelveMonthRange],
  );

  // Set 12-month range on mount
  useEffect(() => {
    setTwelveMonthRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: analytics, isLoading } = useAnalytics({
    months: 12,
    ownership: ownershipFilter,
  });
  const { data: accounts } = useAccounts();

  const budgetMonth = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const { data: budgetAllocations } = useBudgetAllocations(budgetMonth);

  // Registered recurring payments — handed to the outlier detector so a
  // user-confirmed recurring charge is never surfaced as an anomaly.
  const { data: recurringPayments } = useRecurringPayments();
  const recurringHints = useMemo<RecurringHint[]>(
    () =>
      (recurringPayments ?? []).map((r) => ({
        category: r.category?.name ?? null,
        name: r.name,
        amount: r.amount,
      })),
    [recurringPayments],
  );

  const expenseTransactions = useMemo(
    () =>
      getExpenseTransactions(transactions, accounts).filter(
        (t) => !t.is_debt_return,
      ),
    [transactions, accounts],
  );

  // ── Category detail modal (Categories tab drill-down) ─────────────────────
  const [categoryDetailName, setCategoryDetailName] = useState<string | null>(
    null,
  );
  const [categoryDetailMonth, setCategoryDetailMonth] = useState<string | null>(
    null,
  );
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const handleCategoryDetailClick = useCallback(
    (cat: string, zoomedMonth?: string | null) => {
      setCategoryDetailName(cat);
      setCategoryDetailMonth(zoomedMonth ?? null);
    },
    [],
  );

  const closeCategoryDetail = useCallback(() => {
    setCategoryDetailName(null);
    setCategoryDetailMonth(null);
    setSelectedTransaction(null);
  }, []);

  const categoryDetailData = useMemo(() => {
    if (!categoryDetailName) return null;
    let txs = expenseTransactions.filter(
      (t) => t.category === categoryDetailName,
    );
    if (categoryDetailMonth) {
      if (categoryDetailMonth.includes("-Q")) {
        const [yr, qStr] = categoryDetailMonth.split("-Q");
        const q = parseInt(qStr, 10);
        const startM = (q - 1) * 3 + 1;
        const endM = q * 3;
        txs = txs.filter((t) => {
          const m = parseInt(t.date.slice(5, 7), 10);
          return t.date.startsWith(yr) && m >= startM && m <= endM;
        });
      } else {
        txs = txs.filter((t) => t.date.startsWith(categoryDetailMonth));
      }
    }
    const totalAmount = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categoryColor = txs.find((t) => t.category_color);
    return {
      transactions: txs,
      totalAmount,
      categoryColor: categoryColor?.category_color as string | undefined,
    };
  }, [categoryDetailName, categoryDetailMonth, expenseTransactions]);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading && !analytics) {
    return (
      <div className="space-y-3">
        <WidgetSkeleton height={44} />
        <WidgetSkeleton height={320} />
        <WidgetSkeleton height={200} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ══════ TAB BAR ══════ */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════ INSIGHT ══════ */}
      {activeTab === "insight" && (
        <InsightTabContent
          expenseTransactions={expenseTransactions}
          analyticsMonths={analytics?.months}
          budgetSummary={budgetAllocations?.summary}
          recurringHints={recurringHints}
        />
      )}

      {/* ══════ MONTHLY ══════ */}
      {activeTab === "monthly" && (
        <MonthlyDistributionTabContent
          analyticsMonths={analytics?.months}
          transactions={transactions}
          accounts={accounts}
          balanceAccounts={analytics?.accounts}
          currentUserId={currentUserId}
          hasPartner={analytics?.hasPartner}
        />
      )}

      {/* ══════ CATEGORIES ══════ */}
      {activeTab === "categories" && (
        <CategoriesV2TabContent
          transactions={expenseTransactions as any}
          filtersOpen={filtersOpen}
          onCategoryDetailClick={handleCategoryDetailClick}
        />
      )}

      <div className="h-4" />

      {/* ══════ Category Detail Modal ══════ */}
      {categoryDetailName && categoryDetailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeCategoryDetail}
          />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-[var(--theme-bg)] shadow-2xl [contain:paint]">
            <button
              onClick={closeCategoryDetail}
              className="absolute top-3 right-3 z-40 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <CategoryDetailView
              category={categoryDetailName}
              categoryColor={categoryDetailData.categoryColor}
              transactions={categoryDetailData.transactions as any}
              totalAmount={categoryDetailData.totalAmount}
              ownershipFilter={ownershipFilter as any}
              onBack={closeCategoryDetail}
              onTransactionClick={setSelectedTransaction}
            />
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
      )}
    </div>
  );
}
