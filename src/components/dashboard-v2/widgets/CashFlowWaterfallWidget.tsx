"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  needsWantsSavings?: {
    needs: number;
    wants: number;
    savings: number;
    unclassified: number;
  };
};

function fmtAmt(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(Math.abs(n) / 1000).toFixed(1)}k`;
  return `$${Math.abs(Math.round(n))}`;
}

export default function CashFlowWaterfallWidget({ months, needsWantsSavings }: Props) {
  const { bars, net } = useMemo(() => {
    if (!months || months.length === 0) return { bars: [], net: 0 };

    const curr = months[months.length - 1];
    const income = curr.income;

    // Build waterfall bars
    // Each bar: { name, value (visible), base (invisible offset), fill, net }
    const bars: { name: string; base: number; value: number; fill: string; displayAmt: number }[] = [];

    // Start: Income (full positive bar)
    bars.push({
      name: "Income",
      base: 0,
      value: income,
      fill: "#34d399",
      displayAmt: income,
    });

    // Middle: Expense categories (negative bars stepping down)
    let runningBase = income;

    if (needsWantsSavings) {
      const segments = [
        { name: "Needs", amount: needsWantsSavings.needs, fill: "#f87171" },
        { name: "Wants", amount: needsWantsSavings.wants, fill: "#fb923c" },
        { name: "Savings", amount: needsWantsSavings.savings, fill: "#a78bfa" },
        { name: "Other", amount: needsWantsSavings.unclassified, fill: "#94a3b8" },
      ].filter((s) => s.amount > 0);

      for (const seg of segments) {
        runningBase -= seg.amount;
        bars.push({
          name: seg.name,
          base: runningBase,
          value: seg.amount,
          fill: seg.fill,
          displayAmt: seg.amount,
        });
      }
    } else {
      // Fallback: just one expense bar
      const top3 = [...curr.categoryBreakdown]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);
      const topTotal = top3.reduce((s, c) => s + c.amount, 0);
      const otherTotal = curr.expense - topTotal;

      const colors = ["#f87171", "#fb923c", "#fbbf24", "#f472b6"];
      for (let i = 0; i < top3.length; i++) {
        const cat = top3[i];
        if (cat.amount <= 0) continue;
        runningBase -= cat.amount;
        bars.push({
          name: cat.name.length > 10 ? cat.name.slice(0, 9) + "…" : cat.name,
          base: runningBase,
          value: cat.amount,
          fill: colors[i],
          displayAmt: cat.amount,
        });
      }

      if (otherTotal > 0) {
        runningBase -= otherTotal;
        bars.push({
          name: "Other",
          base: runningBase,
          value: otherTotal,
          fill: "#64748b",
          displayAmt: otherTotal,
        });
      }
    }

    const net = runningBase;

    // End: Net (remaining)
    bars.push({
      name: net >= 0 ? "Net +" : "Net -",
      base: 0,
      value: Math.max(net, 0) || Math.abs(net),
      fill: net >= 0 ? "#22d3ee" : "#ef4444",
      displayAmt: net,
    });

    return { bars, net };
  }, [months, needsWantsSavings]);

  if (!months || months.length === 0) {
    return (
      <WidgetCard title="Cash Flow">
        <p className="text-white/40 text-xs text-center py-8">No data available</p>
      </WidgetCard>
    );
  }

  const netColor = net >= 0 ? "#22d3ee" : "#ef4444";

  // For recharts waterfall: use stacked bars with invisible base
  const chartData = bars.map((b) => ({
    name: b.name,
    invisible: b.base,
    visible: b.value,
    fill: b.fill,
    displayAmt: b.displayAmt,
  }));

  return (
    <WidgetCard
      title="Cash Flow Breakdown"
      subtitle="How income flows to expenses and savings"
      action={
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${netColor}20`, color: netColor }}
        >
          Net {net >= 0 ? "+" : ""}{fmtAmt(net)}
        </span>
      }
    >
      <div className="h-[200px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
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
                    <p className="text-white/60 mb-1">{d.name}</p>
                    <p className="text-white font-bold" style={{ color: d.fill }}>
                      {d.name.startsWith("Net") && d.displayAmt < 0 ? "-" : ""}
                      {fmtAmt(d.displayAmt)}
                    </p>
                  </div>
                );
              }}
            />
            {/* Invisible base bar */}
            <Bar dataKey="invisible" stackId="a" fill="transparent" />
            {/* Visible value bar */}
            <Bar dataKey="visible" stackId="a" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
        {bars.slice(1, -1).map((b) => (
          <div key={b.name} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: b.fill }} />
            <span className="text-[9px] text-white/40">{b.name}: {fmtAmt(b.displayAmt)}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
