"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  onCategoryClick?: (category: string) => void;
  activeCategories?: string[];
};

type RankedCategory = {
  name: string;
  currentAmount: number;
  previousAmount: number;
  change: number;
  changePct: number;
  currentRank: number;
  previousRank: number;
  rankChange: number;
  color: string;
};

export default function CategoryRankingWidget({
  months,
  onCategoryClick,
  activeCategories = [],
}: Props) {
  const [sortBy, setSortBy] = useState<"amount" | "change">("amount");

  const rankings = useMemo(() => {
    if (!months || months.length < 2) return [];

    const curr = months[months.length - 1];
    const prev = months[months.length - 2];

    // Build previous month ranking
    const prevSorted = [...prev.categoryBreakdown].sort(
      (a, b) => b.amount - a.amount,
    );
    const prevRankMap = new Map(prevSorted.map((c, i) => [c.name, i + 1]));
    const prevAmountMap = new Map(
      prev.categoryBreakdown.map((c) => [c.name, c.amount]),
    );

    // Build current month ranking
    const currSorted = [...curr.categoryBreakdown].sort(
      (a, b) => b.amount - a.amount,
    );

    const result: RankedCategory[] = currSorted.map((cat, index) => {
      const prevAmt = prevAmountMap.get(cat.name) ?? 0;
      const prevRank = prevRankMap.get(cat.name) ?? currSorted.length + 1;
      const change = cat.amount - prevAmt;
      const changePct =
        prevAmt > 0 ? (change / prevAmt) * 100 : cat.amount > 0 ? 100 : 0;

      return {
        name: cat.name,
        currentAmount: cat.amount,
        previousAmount: prevAmt,
        change,
        changePct,
        currentRank: index + 1,
        previousRank: prevRank,
        rankChange: prevRank - (index + 1), // positive = moved up
        color: cat.color,
      };
    });

    if (sortBy === "change") {
      result.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    }

    return result;
  }, [months, sortBy]);

  // Top 2 biggest absolute movers (by $ change)
  const biggestMoverNames = useMemo(() => {
    if (rankings.length === 0) return new Set<string>();
    const sorted = [...rankings].sort(
      (a, b) => Math.abs(b.change) - Math.abs(a.change),
    );
    return new Set(sorted.slice(0, 2).map((r) => r.name));
  }, [rankings]);

  if (rankings.length === 0) {
    return (
      <WidgetCard title="Category Rankings">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 2 months
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      interactive
      title="Category Rankings"
      subtitle="vs previous month"
      filterActive={activeCategories.length > 0}
      action={
        <div className="flex gap-1">
          <button
            onClick={() => setSortBy("amount")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md transition-colors",
              sortBy === "amount"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50",
            )}
          >
            By Amount
          </button>
          <button
            onClick={() => setSortBy("change")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-md transition-colors",
              sortBy === "change"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50",
            )}
          >
            By Change
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {rankings.slice(0, 10).map((cat) => {
          const isActive =
            activeCategories.length === 0 ||
            activeCategories.includes(cat.name);
          const isBigMover = biggestMoverNames.has(cat.name);
          const maxAmount = rankings[0]?.currentAmount || 1;
          const barWidth = (cat.currentAmount / maxAmount) * 100;

          return (
            <button
              key={cat.name}
              onClick={() => onCategoryClick?.(cat.name)}
              className={cn(
                "w-full text-left rounded-lg p-2.5 transition-all hover:bg-white/5",
                !isActive && "opacity-25",
                isBigMover && "bg-white/[0.03] ring-1 ring-white/[0.08]",
              )}
            >
              {/* Top row: rank + name + amount */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-1 shrink-0 w-8">
                  <span className="text-sm font-bold text-white/50 tabular-nums">
                    {cat.currentRank}
                  </span>
                  {cat.rankChange > 0 && (
                    <ArrowUp className="w-3 h-3 text-emerald-400" />
                  )}
                  {cat.rankChange < 0 && (
                    <ArrowDown className="w-3 h-3 text-red-400" />
                  )}
                  {cat.rankChange === 0 && (
                    <Minus className="w-3 h-3 text-white/15" />
                  )}
                </div>

                <span
                  className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                  style={{
                    backgroundColor: cat.color || "#64748b",
                    boxShadow: `0 0 6px ${cat.color || "#64748b"}40`,
                  }}
                />

                <span
                  className={cn(
                    "text-sm truncate min-w-0 flex-1",
                    isBigMover
                      ? "text-white font-semibold"
                      : "text-white/80 font-medium",
                  )}
                >
                  {cat.name}
                </span>

                {isBigMover && (
                  <span className="text-[10px] text-amber-400 shrink-0">★</span>
                )}

                <span className="text-sm font-bold text-white/90 tabular-nums shrink-0">
                  $
                  {cat.currentAmount.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>

              {/* Bar + change info */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: cat.color || "#64748b",
                      opacity: 0.6,
                    }}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-white/35 tabular-nums">
                    was $
                    {cat.previousAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
                      cat.changePct > 10
                        ? "text-red-400 bg-red-500/10"
                        : cat.changePct < -10
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-white/40 bg-white/5",
                    )}
                  >
                    {cat.changePct > 0 ? "+" : ""}
                    {cat.changePct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
