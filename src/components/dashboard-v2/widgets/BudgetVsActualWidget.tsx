"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useBudgetAllocations } from "@/features/budget/hooks";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo } from "react";

type Transaction = {
  amount: number;
  category?: string | null;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  onCategoryClick?: (category: string) => void;
  activeCategories?: string[];
  months?: MonthlyAnalytics[];
};

export default function BudgetVsActualWidget({
  transactions,
  startDate,
  onCategoryClick,
  activeCategories = [],
  months,
}: Props) {
  const budgetMonth = format(new Date(startDate), "yyyy-MM");
  const { data: budgetData } = useBudgetAllocations(budgetMonth);

  const budgetItems = useMemo(() => {
    if (!budgetData?.summary) return [];

    // Sum spending per category
    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      const cat = t.category ?? "Uncategorized";
      spentByCategory[cat] = (spentByCategory[cat] ?? 0) + t.amount;
    }

    // Match against budget allocations
    const allocations = (budgetData.summary as any).allocations;
    if (!Array.isArray(allocations)) return [];

    return allocations
      .filter((a: any) => a.monthly_budget > 0)
      .map((a: any) => {
        const catName = a.category_name ?? a.category_id ?? "Unknown";
        const budget = Number(a.monthly_budget);
        const spent = spentByCategory[catName] ?? 0;
        const pct = budget > 0 ? (spent / budget) * 100 : 0;
        return { category: catName, budget, spent, pct, isBudget: true };
      })
      .sort((a: any, b: any) => b.pct - a.pct);
  }, [budgetData, transactions]);

  // Fallback: vs last month comparison
  const momItems = useMemo(() => {
    if (budgetItems.length > 0 || !months || months.length < 2) return [];
    const curr = months[months.length - 1];
    const prev = months[months.length - 2];

    const prevMap = new Map(prev.categoryBreakdown.map((c) => [c.name, c.amount]));

    return curr.categoryBreakdown
      .filter((c) => c.amount >= 5)
      .map((c) => {
        const prevAmt = prevMap.get(c.name) ?? 0;
        const pct = prevAmt > 0 ? (c.amount / prevAmt) * 100 : c.amount > 0 ? 200 : 100;
        return {
          category: c.name,
          budget: prevAmt,  // "budget" = prev month amount
          spent: c.amount,
          pct,
          isBudget: false,
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [budgetItems, months]);

  const items = budgetItems.length > 0 ? budgetItems : momItems;
  const isMomMode = budgetItems.length === 0 && momItems.length > 0;
  const overCount = items.filter((i) => i.pct > 100).length;
  const hasItems = items.length > 0;

  if (!hasItems) {
    return (
      <WidgetCard
        title="Budget vs Actual"
        subtitle="Set budgets in Budget tab to see comparison"
      >
        <p className="text-white/40 text-xs text-center py-8">
          No budget allocations for this period
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      interactive
      title={isMomMode ? "Spending vs Last Month" : "Budget vs Actual"}
      subtitle={
        isMomMode
          ? "No budgets set — comparing to previous month"
          : overCount > 0
            ? `${overCount} of ${items.length} over budget`
            : `All ${items.length} categories within budget`
      }
      filterActive={activeCategories.length > 0}
    >
      <div className="space-y-2.5">
        {items.slice(0, 8).map((item) => {
          const isOver = item.pct > 100;
          const isWarning = item.pct >= 75 && item.pct <= 100;
          const isActive =
            activeCategories.length === 0 ||
            activeCategories.includes(item.category);

          return (
            <button
              key={item.category}
              onClick={() => onCategoryClick?.(item.category)}
              className={cn(
                "w-full text-left transition-opacity",
                !isActive && "opacity-30",
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-white/80 truncate max-w-[140px]">
                  {item.category}
                </span>
                <span className="text-[10px] tabular-nums shrink-0 ml-2">
                  <span
                    className={cn(
                      "font-medium",
                      isOver
                        ? "text-red-400"
                        : isWarning
                          ? "text-amber-400"
                          : "text-emerald-400",
                    )}
                  >
                    ${item.spent.toFixed(0)}
                  </span>
                  {item.budget > 0 && (
                    <span className="text-white/30">
                      {" "}/ ${item.budget.toFixed(0)}{isMomMode ? " prev" : ""}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    isOver
                      ? "bg-red-500/70"
                      : isWarning
                        ? "bg-amber-500/60"
                        : "bg-emerald-500/60",
                  )}
                  style={{ width: `${Math.min(item.pct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isOver
                      ? "text-red-400"
                      : isWarning
                        ? "text-amber-400"
                        : "text-emerald-400/80",
                  )}
                >
                  {item.pct.toFixed(0)}%
                </span>
                {isOver && (
                  <span className="text-[10px] text-red-400/80">
                    +${(item.spent - item.budget).toFixed(0)} over
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
