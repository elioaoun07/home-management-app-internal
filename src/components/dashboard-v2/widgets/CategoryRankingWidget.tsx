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
    const sorted = [...rankings].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
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
              "text-[10px] px-1.5 py-0.5 rounded",
              sortBy === "amount"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50",
            )}
          >
            Amount
          </button>
          <button
            onClick={() => setSortBy("change")}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded",
              sortBy === "change"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50",
            )}
          >
            Change
          </button>
        </div>
      }
    >
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_60px_60px_50px] gap-2 text-[9px] text-white/30 uppercase tracking-wider pb-1 border-b border-white/5">
          <span className="w-5">#</span>
          <span>Category</span>
          <span className="text-right">Current</span>
          <span className="text-right">Prev</span>
          <span className="text-right">Change</span>
        </div>

        {rankings.slice(0, 10).map((cat) => {
          const isActive =
            activeCategories.length === 0 ||
            activeCategories.includes(cat.name);
          const isBigMover = biggestMoverNames.has(cat.name);

          return (
            <button
              key={cat.name}
              onClick={() => onCategoryClick?.(cat.name)}
              className={cn(
                "grid grid-cols-[auto_1fr_60px_60px_50px] gap-2 items-center w-full text-left py-1 rounded hover:bg-white/5 transition-all",
                !isActive && "opacity-25",
                isBigMover && "bg-white/3 ring-1 ring-white/8",
              )}
            >
              <span className="w-5 text-center flex items-center gap-0.5">
                <span className="text-[10px] text-white/50 font-bold tabular-nums">
                  {cat.currentRank}
                </span>
                {cat.rankChange > 0 && (
                  <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
                )}
                {cat.rankChange < 0 && (
                  <ArrowDown className="w-2.5 h-2.5 text-red-400" />
                )}
                {cat.rankChange === 0 && (
                  <Minus className="w-2.5 h-2.5 text-white/20" />
                )}
              </span>

              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color || "#64748b" }}
                />
                <span className={cn("text-xs truncate", isBigMover ? "text-white/90 font-medium" : "text-white/70")}>
                  {cat.name}
                </span>
                {isBigMover && (
                  <span className="text-[9px] text-amber-400/70 shrink-0">★</span>
                )}
              </span>

              <span className="text-xs text-white/80 text-right tabular-nums">
                ${cat.currentAmount.toFixed(0)}
              </span>

              <span className="text-[10px] text-white/40 text-right tabular-nums">
                ${cat.previousAmount.toFixed(0)}
              </span>

              <span
                className={cn(
                  "text-[10px] text-right tabular-nums font-medium",
                  cat.changePct > 10
                    ? "text-red-400"
                    : cat.changePct < -10
                      ? "text-emerald-400"
                      : "text-white/40",
                )}
              >
                {cat.changePct > 0 ? "+" : ""}
                {cat.changePct.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
