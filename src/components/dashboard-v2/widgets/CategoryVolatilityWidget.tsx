"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  onCategoryClick?: (category: string) => void;
};

type VolatilityEntry = {
  category: string;
  color: string;
  cv: number; // coefficient of variation (0-1+)
  mean: number;
  stddev: number;
  amounts: number[];
  label: "Stable" | "Moderate" | "Volatile" | "Erratic";
};

export default function CategoryVolatilityWidget({
  months,
  onCategoryClick,
}: Props) {
  const entries = useMemo<VolatilityEntry[]>(() => {
    if (!months || months.length < 3) return [];

    // Aggregate amounts per category across months
    const catMonths: Record<string, { amounts: number[]; color: string }> = {};

    for (const m of months) {
      for (const cb of m.categoryBreakdown) {
        if (!catMonths[cb.name]) {
          catMonths[cb.name] = { amounts: [], color: cb.color };
        }
        catMonths[cb.name].amounts.push(cb.amount);
      }
      // Ensure categories not present in a month get a 0
      for (const cat of Object.keys(catMonths)) {
        const existing = m.categoryBreakdown.find((cb) => cb.name === cat);
        if (!existing) {
          catMonths[cat].amounts.push(0);
        }
      }
    }

    return Object.entries(catMonths)
      .filter(([, d]) => d.amounts.length >= 3)
      .map(([category, d]) => {
        const n = d.amounts.length;
        const mean = d.amounts.reduce((s, v) => s + v, 0) / n;
        const variance = d.amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
        const stddev = Math.sqrt(variance);
        const cv = mean > 0 ? stddev / mean : 0;

        let label: VolatilityEntry["label"] = "Stable";
        if (cv > 0.8) label = "Erratic";
        else if (cv > 0.5) label = "Volatile";
        else if (cv > 0.25) label = "Moderate";

        return {
          category,
          color: d.color,
          cv,
          mean,
          stddev,
          amounts: d.amounts,
          label,
        };
      })
      .filter((e) => e.mean > 5) // ignore near-zero categories
      .sort((a, b) => b.cv - a.cv);
  }, [months]);

  if (entries.length === 0) {
    return (
      <WidgetCard
        title="Category Volatility"
        subtitle="Spending consistency by category"
      >
        <p className="text-white/30 text-xs text-center py-8">
          Need 3+ months of data
        </p>
      </WidgetCard>
    );
  }

  const labelColor: Record<VolatilityEntry["label"], string> = {
    Stable: "text-emerald-400 bg-emerald-500/15",
    Moderate: "text-amber-400 bg-amber-500/15",
    Volatile: "text-orange-400 bg-orange-500/15",
    Erratic: "text-red-400 bg-red-500/15",
  };

  return (
    <WidgetCard
      title="Category Volatility"
      subtitle={`${entries.filter((e) => e.label === "Stable").length} stable · ${entries.filter((e) => e.label === "Volatile" || e.label === "Erratic").length} volatile`}
      interactive
    >
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
        {entries.slice(0, 12).map((e) => {
          const maxCv = Math.max(...entries.map((x) => x.cv), 1);
          const barW = Math.min((e.cv / maxCv) * 100, 100);

          return (
            <button
              key={e.category}
              onClick={() => onCategoryClick?.(e.category)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
            >
              {/* Color dot */}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: e.color }}
              />

              {/* Category */}
              <span className="text-xs text-white/70 truncate min-w-0 flex-1 max-w-[100px]">
                {e.category}
              </span>

              {/* Bar */}
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    e.label === "Stable" && "bg-emerald-500/50",
                    e.label === "Moderate" && "bg-amber-500/50",
                    e.label === "Volatile" && "bg-orange-500/50",
                    e.label === "Erratic" && "bg-red-500/50",
                  )}
                  style={{ width: `${barW}%` }}
                />
              </div>

              {/* Label badge */}
              <span
                className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                  labelColor[e.label],
                )}
              >
                {e.label}
              </span>

              {/* Mean */}
              <span className="text-[10px] text-white/30 tabular-nums shrink-0 w-14 text-right">
                ~${e.mean.toFixed(0)}/mo
              </span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
