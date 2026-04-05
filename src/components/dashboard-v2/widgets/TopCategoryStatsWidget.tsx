"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import {
  groupExpensesByCategory,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import type { Account } from "@/types/domain";
import { Hash, TrendingUp } from "lucide-react";
import { useMemo } from "react";

type Props = {
  transactions: TransactionWithAccount[];
  accounts: Account[] | undefined;
  activeCategories?: string[];
  onCategoryClick?: (category: string) => void;
};

export default function TopCategoryStatsWidget({
  transactions,
  accounts,
  activeCategories = [],
  onCategoryClick,
}: Props) {
  const grouped = useMemo(
    () => groupExpensesByCategory(transactions, accounts),
    [transactions, accounts],
  );

  const topByAmount = useMemo(
    () =>
      Object.entries(grouped)
        .sort(([, a], [, b]) => b.amount - a.amount)
        .slice(0, 5),
    [grouped],
  );

  const topByCount = useMemo(
    () =>
      Object.entries(grouped)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5),
    [grouped],
  );

  const maxAmount = topByAmount[0]?.[1]?.amount ?? 1;
  const maxCount = topByCount[0]?.[1]?.count ?? 1;

  if (topByAmount.length === 0) return null;

  return (
    <WidgetCard title="Top Categories" interactive>
      <div className="grid grid-cols-2 gap-4">
        {/* By Amount */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              By Spend
            </span>
          </div>
          <div className="space-y-2">
            {topByAmount.map(([cat, data], i) => {
              const isActive = activeCategories.includes(cat);
              const pct = (data.amount / maxAmount) * 100;
              return (
                <button
                  key={cat}
                  onClick={() => onCategoryClick?.(cat)}
                  className={cn(
                    "w-full text-left group/item",
                    isActive && "ring-1 ring-cyan-500/30 rounded-lg",
                  )}
                >
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-white/20 w-3 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-white/80 truncate group-hover/item:text-white transition-colors">
                        {cat}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-white/60 tabular-nums shrink-0 ml-2">
                      $
                      {data.amount.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  <div className="mx-2 mb-1">
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-500/40 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* By Count */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Hash className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              By Count
            </span>
          </div>
          <div className="space-y-2">
            {topByCount.map(([cat, data], i) => {
              const isActive = activeCategories.includes(cat);
              const pct = (data.count / maxCount) * 100;
              return (
                <button
                  key={cat}
                  onClick={() => onCategoryClick?.(cat)}
                  className={cn(
                    "w-full text-left group/item",
                    isActive && "ring-1 ring-cyan-500/30 rounded-lg",
                  )}
                >
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-white/20 w-3 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-white/80 truncate group-hover/item:text-white transition-colors">
                        {cat}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-white/60 tabular-nums shrink-0 ml-2">
                      {data.count}×
                    </span>
                  </div>
                  <div className="mx-2 mb-1">
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500/40 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
