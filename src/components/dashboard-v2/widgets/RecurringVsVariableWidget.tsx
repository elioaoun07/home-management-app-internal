"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { RecurringItem } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";

type Props = {
  recurringTotal: number;
  recurringItems: RecurringItem[] | undefined;
  currentMonthExpense: number;
};

export default function RecurringVsVariableWidget({
  recurringTotal,
  recurringItems,
  currentMonthExpense,
}: Props) {
  const metrics = useMemo(() => {
    if (currentMonthExpense === 0 && recurringTotal === 0) return null;

    const variable = Math.max(0, currentMonthExpense - recurringTotal);
    const total = recurringTotal + variable;
    const recurringPct = total > 0 ? (recurringTotal / total) * 100 : 0;
    const variablePct = total > 0 ? (variable / total) * 100 : 0;

    return { variable, total, recurringPct, variablePct };
  }, [recurringTotal, currentMonthExpense]);

  if (!metrics || !recurringItems) {
    return (
      <WidgetCard title="Fixed vs Variable">
        <p className="text-white/40 text-xs text-center py-8">
          No recurring payments set up
        </p>
      </WidgetCard>
    );
  }

  const topItems = recurringItems.slice(0, 5);

  return (
    <WidgetCard title="Fixed vs Variable" subtitle="Monthly cost structure">
      <div className="space-y-3">
        {/* Donut-like horizontal bar */}
        <div>
          <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
            <div
              className="h-full bg-indigo-500 transition-all duration-700"
              style={{ width: `${metrics.recurringPct}%` }}
            />
            <div
              className="h-full bg-amber-500/70 transition-all duration-700"
              style={{ width: `${metrics.variablePct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] text-white/50">
                Fixed ${Math.round(recurringTotal).toLocaleString()} (
                {metrics.recurringPct.toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500/70" />
              <span className="text-[10px] text-white/50">
                Variable ${Math.round(metrics.variable).toLocaleString()} (
                {metrics.variablePct.toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Top recurring items */}
        {topItems.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              Top Recurring
            </p>
            {topItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-1"
              >
                <span className="text-xs text-white/60 truncate max-w-[180px]">
                  {item.name}
                </span>
                <span className="text-xs text-white/70 font-medium tabular-nums">
                  ${item.amount.toLocaleString()}
                  <span className="text-white/30 text-[10px] ml-1">
                    /{item.recurrenceType.slice(0, 2)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
