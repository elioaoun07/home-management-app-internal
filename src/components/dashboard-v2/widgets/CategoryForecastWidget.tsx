"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo, useState } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
};

type CatForecast = {
  name: string;
  color: string;
  avg3m: number;
  lastMonth: number;
  projected: number;
  trend: "up" | "down" | "flat";
  trendPct: number;
};

const PALETTE = [
  "#22d3ee","#a78bfa","#34d399","#f472b6",
  "#fbbf24","#60a5fa","#fb923c","#e879f9",
];

export default function CategoryForecastWidget({ months }: Props) {
  const [showAll, setShowAll] = useState(false);

  const forecasts = useMemo<CatForecast[]>(() => {
    if (!months || months.length < 2) return [];

    // Build per-category monthly data
    const catData = new Map<
      string,
      { amounts: number[]; color: string }
    >();

    for (const m of months) {
      for (const c of m.categoryBreakdown) {
        if (!catData.has(c.name)) {
          catData.set(c.name, { amounts: [], color: c.color });
        }
        catData.get(c.name)!.amounts.push(c.amount);
      }
    }

    const results: CatForecast[] = [];

    catData.forEach(({ amounts, color }, name) => {
      if (amounts.length < 2) return;
      const recent3 = amounts.slice(-3);
      const avg3m = recent3.reduce((s, v) => s + v, 0) / recent3.length;

      // Weighted moving average (more recent = higher weight)
      const weights = recent3.map((_, i) => i + 1);
      const weightSum = weights.reduce((s, w) => s + w, 0);
      const projected = recent3.reduce(
        (s, v, i) => s + v * weights[i],
        0,
      ) / weightSum;

      const lastMonth = amounts[amounts.length - 1];
      const prevMonth = amounts[amounts.length - 2];
      const trendPct =
        prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

      // 3-month slope
      let trend: "up" | "down" | "flat" = "flat";
      if (recent3.length >= 2) {
        const slope = (recent3[recent3.length - 1] - recent3[0]) / recent3.length;
        if (Math.abs(slope) < avg3m * 0.03) trend = "flat";
        else trend = slope > 0 ? "up" : "down";
      }

      results.push({ name, color, avg3m, lastMonth, projected, trend, trendPct });
    });

    // Sort by projected descending (biggest future spenders first)
    return results.sort((a, b) => b.projected - a.projected);
  }, [months]);

  const displayed = showAll ? forecasts : forecasts.slice(0, 6);
  const maxProjected = Math.max(...forecasts.map((f) => f.projected), 1);

  if (!months || months.length < 2) {
    return (
      <WidgetCard title="Category Forecast">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 2 months of data
        </p>
      </WidgetCard>
    );
  }

  if (forecasts.length === 0) {
    return (
      <WidgetCard title="Category Forecast">
        <p className="text-white/40 text-xs text-center py-8">
          No category data available
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Category Forecast"
      subtitle="Next month estimate per category"
      action={
        <span className="text-[10px] text-white/30 px-2 py-0.5 rounded-full neo-card">
          {forecasts.length} categories
        </span>
      }
    >
      {/* Header row */}
      <div className="grid grid-cols-[1fr_56px_52px_36px] gap-2 mb-2 px-0.5">
        <span className="text-[9px] text-white/25 uppercase tracking-wider">Category</span>
        <span className="text-[9px] text-white/25 uppercase tracking-wider text-right">Last Mo</span>
        <span className="text-[9px] text-white/25 uppercase tracking-wider text-right">Forecast</span>
        <span className="text-[9px] text-white/25 uppercase tracking-wider text-right">Trend</span>
      </div>

      <div className="space-y-2.5">
        {displayed.map((cat, idx) => {
          const barWidth = (cat.projected / maxProjected) * 100;
          const trendColor =
            cat.trend === "down" ? "#34d399" : cat.trend === "up" ? "#f87171" : "#94a3b8";
          const trendIcon =
            cat.trend === "down" ? "↓" : cat.trend === "up" ? "↑" : "→";

          return (
            <div key={cat.name} className="group">
              {/* Main row */}
              <div className="grid grid-cols-[1fr_56px_52px_36px] gap-2 items-center mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="flex-shrink-0 w-1.5 h-5 rounded-full"
                    style={{
                      backgroundColor: cat.color,
                      boxShadow: `0 0 6px ${cat.color}60`,
                    }}
                  />
                  <span
                    className="text-[10px] font-medium truncate"
                    style={{ color: cat.color }}
                  >
                    {cat.name}
                  </span>
                </div>

                <BlurredAmount blurIntensity="sm">
                  <span className="text-[10px] text-white/40 text-right block tabular-nums">
                    ${cat.lastMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </BlurredAmount>

                <BlurredAmount blurIntensity="sm">
                  <span
                    className="text-[11px] font-semibold text-right block tabular-nums"
                    style={{ color: cat.color }}
                  >
                    ${cat.projected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </BlurredAmount>

                <div className="flex justify-end">
                  <span
                    className="text-[10px] font-bold px-1 py-0.5 rounded text-right"
                    style={{
                      color: trendColor,
                      backgroundColor: `${trendColor}15`,
                    }}
                  >
                    {trendIcon}
                    {Math.abs(cat.trendPct) > 1
                      ? `${Math.abs(cat.trendPct).toFixed(0)}%`
                      : ""}
                  </span>
                </div>
              </div>

              {/* Progress bar: shows forecast vs max */}
              <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: cat.color,
                    opacity: 0.6,
                    boxShadow: `0 0 6px ${cat.color}40`,
                  }}
                />
              </div>

              {/* 3-month avg below */}
              <p className="text-[8px] text-white/20 mt-0.5 pl-3">
                3-mo avg: ${cat.avg3m.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          );
        })}
      </div>

      {forecasts.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full text-center text-[10px] text-white/30 hover:text-white/60 transition-colors py-1 neo-card rounded-lg"
        >
          {showAll ? "Show less ↑" : `Show ${forecasts.length - 6} more ↓`}
        </button>
      )}

      {/* Confidence note */}
      <p className="text-[9px] text-white/20 text-center mt-2">
        Weighted 3-month projection · not guaranteed
      </p>
    </WidgetCard>
  );
}
