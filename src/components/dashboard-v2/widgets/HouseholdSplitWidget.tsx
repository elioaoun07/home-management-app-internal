"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  hasPartner: boolean;
};

export default function HouseholdSplitWidget({ months, hasPartner }: Props) {
  const metrics = useMemo(() => {
    if (!months || months.length === 0 || !hasPartner) return null;

    const current = months[months.length - 1];
    const total = current.myExpense + current.partnerExpense;
    if (total === 0) return null;

    const myPct = (current.myExpense / total) * 100;
    const partnerPct = (current.partnerExpense / total) * 100;

    // Aggregate across all months
    const allMyExpense = months.reduce((s, m) => s + m.myExpense, 0);
    const allPartnerExpense = months.reduce((s, m) => s + m.partnerExpense, 0);
    const allTotal = allMyExpense + allPartnerExpense;

    return {
      myExpense: current.myExpense,
      partnerExpense: current.partnerExpense,
      myPct,
      partnerPct,
      total,
      // Overall average
      avgMyPct: allTotal > 0 ? (allMyExpense / allTotal) * 100 : 50,
      avgPartnerPct: allTotal > 0 ? (allPartnerExpense / allTotal) * 100 : 50,
    };
  }, [months, hasPartner]);

  if (!hasPartner) return null;

  if (!metrics) {
    return (
      <WidgetCard title="Household Split">
        <p className="text-white/40 text-xs text-center py-8">
          No shared expenses yet
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Household Split" subtitle="Who spent what this month">
      <div className="space-y-3">
        {/* Stacked bar */}
        <div>
          <div className="flex h-5 rounded-full overflow-hidden bg-white/5">
            <div
              className="h-full bg-pink-500/80 transition-all duration-700 flex items-center justify-center"
              style={{ width: `${metrics.myPct}%` }}
            >
              {metrics.myPct > 15 && (
                <span className="text-[10px] text-white font-medium">
                  {metrics.myPct.toFixed(0)}%
                </span>
              )}
            </div>
            <div
              className="h-full bg-cyan-500/80 transition-all duration-700 flex items-center justify-center"
              style={{ width: `${metrics.partnerPct}%` }}
            >
              {metrics.partnerPct > 15 && (
                <span className="text-[10px] text-white font-medium">
                  {metrics.partnerPct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-[10px] text-white/50">You</span>
            </div>
            <p className="text-sm font-bold text-white">
              ${Math.round(metrics.myExpense).toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-cyan-500" />
              <span className="text-[10px] text-white/50">Partner</span>
            </div>
            <p className="text-sm font-bold text-white">
              ${Math.round(metrics.partnerExpense).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Average trend */}
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/40">
            Overall average: You {metrics.avgMyPct.toFixed(0)}% / Partner{" "}
            {metrics.avgPartnerPct.toFixed(0)}%
          </p>
        </div>
      </div>
    </WidgetCard>
  );
}
