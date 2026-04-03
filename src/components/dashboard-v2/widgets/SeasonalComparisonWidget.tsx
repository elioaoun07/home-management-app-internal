"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import {
  getCurrentSeasonComparison,
  getSeasonalAnalysis,
} from "@/lib/utils/comparisonAnalytics";
import { useMemo } from "react";

type SimpleTransaction = {
  id: string;
  date: string;
  amount: number;
  category?: string | null;
};

type Props = {
  transactions: SimpleTransaction[];
  onCategoryClick?: (category: string) => void;
};

const SEASON_ICONS: Record<string, string> = {
  winter: "❄️",
  spring: "🌸",
  summer: "☀️",
  fall: "🍂",
};

const SEASON_COLORS: Record<string, string> = {
  winter: "text-blue-400",
  spring: "text-emerald-400",
  summer: "text-amber-400",
  fall: "text-orange-400",
};

export default function SeasonalComparisonWidget({
  transactions,
  onCategoryClick,
}: Props) {
  const { seasonal, comparison } = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { seasonal: null, comparison: null };
    }
    return {
      seasonal: getSeasonalAnalysis(transactions),
      comparison: getCurrentSeasonComparison(transactions),
    };
  }, [transactions]);

  if (!seasonal || !comparison) {
    return (
      <WidgetCard title="Seasonal Patterns" subtitle="Spend by season">
        <p className="text-white/30 text-xs text-center py-8">
          Need transaction history for analysis
        </p>
      </WidgetCard>
    );
  }

  // Find max for bar scaling
  const maxAvg = Math.max(...seasonal.map((s) => s.avgPerMonth), 1);

  return (
    <WidgetCard
      title="Seasonal Patterns"
      subtitle={`Current: ${SEASON_ICONS[comparison.season]} ${comparison.season} — ${comparison.trend === "up" ? "↑" : comparison.trend === "down" ? "↓" : "→"} ${Math.abs(comparison.changePercent).toFixed(0)}% vs last year`}
    >
      <div className="space-y-3">
        {/* Season bars */}
        <div className="space-y-2">
          {seasonal.map((s) => {
            const pct = (s.avgPerMonth / maxAvg) * 100;
            const isCurrent = s.season === comparison.season;

            return (
              <div key={s.season}>
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={cn(
                      "text-xs font-medium flex items-center gap-1.5",
                      isCurrent ? SEASON_COLORS[s.season] : "text-white/50",
                    )}
                  >
                    <span>{SEASON_ICONS[s.season]}</span>
                    <span className="capitalize">{s.season}</span>
                    {isCurrent && (
                      <span className="text-[8px] uppercase tracking-wider opacity-60">
                        now
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-white/40 tabular-nums">
                    ${s.avgPerMonth.toFixed(0)}/mo · {s.transactionCount} txs
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isCurrent
                        ? "bg-gradient-to-r from-cyan-500/60 to-cyan-400/80"
                        : "bg-white/10",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Current vs last year comparison */}
        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
            {comparison.season} This Year vs Last Year
          </p>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-xs text-white/50">This year</span>
              <p className="text-sm font-bold text-white tabular-nums">
                ${comparison.currentTotal.toFixed(0)}
              </p>
            </div>
            <span className="text-white/20">→</span>
            <div>
              <span className="text-xs text-white/50">Last year</span>
              <p className="text-sm font-bold text-white/60 tabular-nums">
                ${comparison.previousTotal.toFixed(0)}
              </p>
            </div>
            <div className="ml-auto">
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  comparison.trend === "down"
                    ? "text-emerald-400"
                    : comparison.trend === "up"
                      ? "text-red-400"
                      : "text-white/40",
                )}
              >
                {comparison.change > 0 ? "+" : ""}$
                {comparison.change.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Top categories this season */}
        {seasonal
          .filter((s) => s.season === comparison.season)
          .map((s) => (
            <div key={s.season}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Top Categories This {s.season}
              </p>
              <div className="flex flex-wrap gap-1">
                {s.topCategories.slice(0, 5).map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => onCategoryClick?.(cat.category)}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
                  >
                    {cat.category} · ${cat.amount.toFixed(0)}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </WidgetCard>
  );
}
