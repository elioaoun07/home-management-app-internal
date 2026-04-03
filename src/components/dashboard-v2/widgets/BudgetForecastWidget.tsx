"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import { generateForecast } from "@/lib/utils/forecast";
import { useMemo } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  daysElapsed: number;
  totalDays: number;
  currentMonthExpense: number;
  budgetData?: {
    categoryBudgets: { category: string; budget: number; spent: number }[];
  };
};

export default function BudgetForecastWidget({
  months,
  daysElapsed,
  totalDays,
  currentMonthExpense,
  budgetData,
}: Props) {
  const forecast = useMemo(() => {
    if (!months || months.length < 2 || daysElapsed < 3) return null;

    // Project month-end spending from current pace
    const dailyRate = currentMonthExpense / daysElapsed;
    const projected = dailyRate * totalDays;
    const remaining = totalDays - daysElapsed;
    const remainingBudget = projected - currentMonthExpense;

    // Get previous month for comparison
    const prevExpense = months[months.length - 2]?.expense ?? 0;
    const vsPrev =
      prevExpense > 0 ? ((projected - prevExpense) / prevExpense) * 100 : 0;

    // Per-category projections (top overspenders)
    const categoryForecasts =
      budgetData?.categoryBudgets
        .filter((b) => b.budget > 0 && b.spent > 0)
        .map((b) => {
          const catRate = b.spent / daysElapsed;
          const catProjected = catRate * totalDays;
          const overUnder = catProjected - b.budget;
          const pct = (catProjected / b.budget) * 100;
          return {
            category: b.category,
            budget: b.budget,
            projected: catProjected,
            overUnder,
            pct,
          };
        })
        .filter((c) => c.pct > 80) // only show categories at risk
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5) ?? [];

    // 3-month forecast
    const monthlyForecast = generateForecast(
      months.map((m) => ({ month: m.month, value: m.expense })),
      3,
    );

    return {
      dailyRate,
      projected,
      remaining,
      remainingBudget,
      vsPrev,
      categoryForecasts,
      monthlyForecast,
    };
  }, [months, daysElapsed, totalDays, currentMonthExpense, budgetData]);

  if (!forecast) {
    return (
      <WidgetCard title="Budget Forecast" subtitle="Projected month-end spend">
        <p className="text-white/40 text-xs text-center py-8">
          Need more data (3+ days + 2+ months)
        </p>
      </WidgetCard>
    );
  }

  const isTrendingOver = forecast.vsPrev > 5;

  return (
    <WidgetCard
      title="Budget Forecast"
      subtitle={`${totalDays - daysElapsed} days remaining in period`}
    >
      <div className="space-y-3">
        {/* Projected month end */}
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Projected Month End
            </span>
            <span
              className={cn(
                "text-[10px] font-medium",
                isTrendingOver ? "text-red-400" : "text-emerald-400",
              )}
            >
              {forecast.vsPrev > 0 ? "+" : ""}
              {forecast.vsPrev.toFixed(0)}% vs last month
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-white tabular-nums">
              ${forecast.projected.toFixed(0)}
            </span>
            <span className="text-[10px] text-white/30">
              at ${forecast.dailyRate.toFixed(0)}/day pace
            </span>
          </div>
        </div>

        {/* Category at-risk */}
        {forecast.categoryForecasts.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
              Categories at Risk
            </p>
            <div className="space-y-1.5">
              {forecast.categoryForecasts.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-white/60 truncate max-w-[120px]">
                    {cat.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 tabular-nums">
                      ~${cat.projected.toFixed(0)} / ${cat.budget.toFixed(0)}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium tabular-nums",
                        cat.pct > 100 ? "text-red-400" : "text-amber-400",
                      )}
                    >
                      {cat.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3-month outlook */}
        {forecast.monthlyForecast.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">
              3-Month Outlook
            </p>
            <div className="flex gap-2">
              {forecast.monthlyForecast.map((f) => (
                <div
                  key={f.month}
                  className="flex-1 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center"
                >
                  <p className="text-[9px] text-white/30">
                    {new Date(f.month + "-01").toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </p>
                  <p className="text-xs text-white/70 font-medium tabular-nums mt-0.5">
                    ~${f.predicted.toFixed(0)}
                  </p>
                  <p className="text-[8px] text-white/20">
                    ${f.lower.toFixed(0)}–${f.upper.toFixed(0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
