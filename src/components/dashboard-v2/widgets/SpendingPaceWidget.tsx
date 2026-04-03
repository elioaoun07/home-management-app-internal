"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { DailyTotal, MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  dailyTotals: DailyTotal[] | undefined;
  startDate: string;
  daysElapsed: number;
  totalDays: number;
};

function fmtAmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function SpendingPaceWidget({ months, dailyTotals, startDate, daysElapsed, totalDays }: Props) {
  const { chartData, referenceTotal, currentCumulative, aheadOrBehind, referenceLabel } = useMemo(() => {
    if (!dailyTotals || dailyTotals.length === 0) {
      return { chartData: [], referenceTotal: 0, currentCumulative: 0, aheadOrBehind: 0, referenceLabel: "" };
    }

    // Use previous month's expense as reference pace
    let referenceTotal = 0;
    let referenceLabel = "prev month";
    if (months && months.length >= 2) {
      const prev = months[months.length - 2];
      referenceTotal = prev.expense;
      const [, m] = prev.month.split("-");
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      referenceLabel = monthNames[parseInt(m) - 1];
    } else if (months && months.length === 1) {
      referenceTotal = months[0].expense;
      referenceLabel = "current";
    }

    // Build daily cumulative
    const sorted = [...dailyTotals].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    const chartData = sorted.map((d, i) => {
      cumulative += d.expense;
      const dayNum = i + 1;
      // Reference pace: linear from 0 to referenceTotal over totalDays
      const pace = referenceTotal > 0 ? (dayNum / totalDays) * referenceTotal : 0;
      return {
        day: dayNum,
        label: d.date.slice(5), // "MM-DD"
        actual: Math.round(cumulative),
        pace: Math.round(pace),
      };
    });

    // Fill remaining days with pace line only
    const lastDay = sorted.length;
    for (let d = lastDay + 1; d <= totalDays; d++) {
      const pace = referenceTotal > 0 ? (d / totalDays) * referenceTotal : 0;
      chartData.push({ day: d, label: "", actual: null as any, pace: Math.round(pace) });
    }

    const currentCumulative = cumulative;
    const expectedAtThisPoint = referenceTotal > 0 ? (daysElapsed / totalDays) * referenceTotal : 0;
    const aheadOrBehind = currentCumulative - expectedAtThisPoint;

    return { chartData, referenceTotal, currentCumulative, aheadOrBehind, referenceLabel };
  }, [dailyTotals, months, totalDays, daysElapsed]);

  if (!dailyTotals || dailyTotals.length < 3) {
    return (
      <WidgetCard title="Spending Pace">
        <p className="text-white/40 text-xs text-center py-8">Need at least 3 days of data</p>
      </WidgetCard>
    );
  }

  const isOver = aheadOrBehind > 0;
  const paceColor = isOver ? "#f87171" : "#34d399";

  return (
    <WidgetCard
      title="Spending Pace"
      subtitle={`Cumulative spend vs ${referenceLabel} pace`}
      action={
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${paceColor}20`, color: paceColor }}
        >
          {isOver ? "+" : "-"}{fmtAmt(Math.abs(aheadOrBehind))} {isOver ? "over" : "under"} pace
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[9px] text-white/40">Spent so far</p>
          <p className="text-sm font-bold text-white tabular-nums">{fmtAmt(currentCumulative)}</p>
        </div>
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[9px] text-white/40">{referenceLabel} total</p>
          <p className="text-sm font-bold text-white/60 tabular-nums">{fmtAmt(referenceTotal)}</p>
        </div>
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[9px] text-white/40">Day {daysElapsed}/{totalDays}</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: paceColor }}>
            {((daysElapsed / totalDays) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="h-[160px] -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={paceColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={paceColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v % 5 === 0 ? String(v) : "")}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAmt}
              width={42}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                    <p className="text-white/50 mb-1">Day {d.day}</p>
                    {d.actual != null && (
                      <p style={{ color: paceColor }}>Actual: {fmtAmt(d.actual)}</p>
                    )}
                    <p className="text-white/40">Pace: {fmtAmt(d.pace)}</p>
                  </div>
                );
              }}
            />
            {/* Pace reference line */}
            <Line
              type="linear"
              dataKey="pace"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
            {/* Actual cumulative */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={paceColor}
              strokeWidth={2}
              fill="url(#spendGrad)"
              dot={false}
              connectNulls={false}
              activeDot={{ r: 4, fill: paceColor }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5" style={{ backgroundColor: paceColor }} />
          <span className="text-[9px] text-white/40">Actual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-px border-t border-dashed border-white/20" />
          <span className="text-[9px] text-white/40">{referenceLabel} pace</span>
        </div>
      </div>
    </WidgetCard>
  );
}
