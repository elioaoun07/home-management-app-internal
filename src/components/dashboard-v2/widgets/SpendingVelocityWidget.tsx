"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  currentMonthDays: number; // days elapsed in current period
  totalDaysInPeriod: number; // total days in current period
};

export default function SpendingVelocityWidget({
  months,
  currentMonthDays,
  totalDaysInPeriod,
}: Props) {
  const metrics = useMemo(() => {
    if (!months || months.length === 0) return null;

    const current = months[months.length - 1];
    const previous = months.length >= 2 ? months[months.length - 2] : null;

    const currentDailyAvg =
      currentMonthDays > 0 ? current.expense / currentMonthDays : 0;
    const previousDailyAvg = previous
      ? previous.expense / 30 // approximate previous month days
      : 0;

    const velocityChange =
      previousDailyAvg > 0
        ? ((currentDailyAvg - previousDailyAvg) / previousDailyAvg) * 100
        : 0;

    // Project end-of-month expense at current pace
    const projectedTotal = currentDailyAvg * totalDaysInPeriod;

    // Days until budget exhausted (if we set income as "budget")
    const daysLeft = totalDaysInPeriod - currentMonthDays;
    const remainingBudget = current.income - current.expense;
    const daysUntilExhausted =
      currentDailyAvg > 0 ? remainingBudget / currentDailyAvg : Infinity;

    return {
      currentDailyAvg,
      previousDailyAvg,
      velocityChange,
      projectedTotal,
      actualTotal: current.expense,
      income: current.income,
      daysLeft,
      daysUntilExhausted: Math.max(0, daysUntilExhausted),
      onTrack: projectedTotal <= current.income,
    };
  }, [months, currentMonthDays, totalDaysInPeriod]);

  if (!metrics) {
    return (
      <WidgetCard title="Spending Velocity">
        <p className="text-white/40 text-xs text-center py-8">No data yet</p>
      </WidgetCard>
    );
  }

  const paceColor =
    metrics.velocityChange > 5
      ? "text-amber-400"
      : metrics.velocityChange < -5
        ? "text-emerald-400"
        : "text-white/60";

  return (
    <WidgetCard title="Spending Velocity" subtitle="Current period pace">
      <div className="space-y-3">
        {/* Daily average comparison */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-white/40 mb-0.5">Daily Average</p>
            <p className="text-xl font-bold text-white">
              ${Math.round(metrics.currentDailyAvg).toLocaleString()}
            </p>
          </div>
          {metrics.previousDailyAvg > 0 && (
            <div className="text-right">
              <p className={`text-sm font-medium ${paceColor}`}>
                {metrics.velocityChange > 0 ? "+" : ""}
                {metrics.velocityChange.toFixed(1)}%
              </p>
              <p className="text-[10px] text-white/30">vs last month</p>
            </div>
          )}
        </div>

        {/* Comparison bars */}
        {metrics.previousDailyAvg > 0 && (
          <div className="space-y-1">
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-white/40 w-12">Now</span>
              <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/70 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (metrics.currentDailyAvg / Math.max(metrics.currentDailyAvg, metrics.previousDailyAvg)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-white/40 w-12">Before</span>
              <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/30 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (metrics.previousDailyAvg / Math.max(metrics.currentDailyAvg, metrics.previousDailyAvg)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Projected vs income */}
        <div className="grid grid-cols-2 gap-2">
          <div className="neo-card rounded-lg p-2">
            <p className="text-[10px] text-white/40">Projected Total</p>
            <p
              className={`text-sm font-bold ${metrics.onTrack ? "text-emerald-400" : "text-amber-400"}`}
            >
              ${Math.round(metrics.projectedTotal).toLocaleString()}
            </p>
          </div>
          <div className="neo-card rounded-lg p-2">
            <p className="text-[10px] text-white/40">
              {metrics.daysUntilExhausted === Infinity
                ? "Budget Status"
                : "Budget Lasts"}
            </p>
            <p
              className={`text-sm font-bold ${
                metrics.daysUntilExhausted > metrics.daysLeft
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {metrics.daysUntilExhausted === Infinity
                ? "No income"
                : `${Math.round(metrics.daysUntilExhausted)} days`}
            </p>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
