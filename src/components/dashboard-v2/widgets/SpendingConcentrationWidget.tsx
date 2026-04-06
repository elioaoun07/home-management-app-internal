"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Transaction = {
  id: string;
  amount: number;
  description?: string;
  category?: string | null;
};

type Props = {
  transactions: Transaction[];
};

export default function SpendingConcentrationWidget({ transactions }: Props) {
  const { chartData, paretoIdx, topPct, topAmount, total } = useMemo(() => {
    if (transactions.length < 5)
      return {
        chartData: [],
        paretoIdx: 0,
        topPct: 0,
        topAmount: 0,
        total: 0,
      };

    const sorted = transactions
      .map((t) => Math.abs(t.amount))
      .sort((a, b) => b - a);
    const total = sorted.reduce((s, a) => s + a, 0);

    let cumulative = 0;
    let paretoIdx = 0;
    const chartData = sorted.map((amount, i) => {
      cumulative += amount;
      const cumulativePct = (cumulative / total) * 100;
      const txPct = ((i + 1) / sorted.length) * 100;
      if (cumulativePct <= 80) paretoIdx = i;
      return {
        index: i + 1,
        txPct: Math.round(txPct * 10) / 10,
        cumulativePct: Math.round(cumulativePct * 10) / 10,
        amount,
      };
    });

    const topCount = paretoIdx + 1;
    const topPct = Math.round((topCount / sorted.length) * 100);
    const topAmount = sorted.slice(0, topCount).reduce((s, a) => s + a, 0);

    return { chartData, paretoIdx, topPct, topAmount, total };
  }, [transactions]);

  if (chartData.length < 5) {
    return (
      <WidgetCard title="Spending Concentration">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 5 transactions
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Spending Concentration"
      subtitle="Pareto analysis — how spending is distributed"
    >
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/35">80% of spend</p>
          <p className="text-sm font-bold text-amber-400 tabular-nums">
            {topPct}% of txns
          </p>
        </div>
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/35">Top chunk</p>
          <p className="text-sm font-bold text-cyan-400 tabular-nums">
            ${topAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/35">Total</p>
          <p className="text-sm font-bold text-white/60 tabular-nums">
            ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="h-[160px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="paretoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="txPct"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
              label={{
                value: "% of transactions",
                position: "insideBottom",
                offset: -2,
                fill: "rgba(255,255,255,0.25)",
                fontSize: 9,
              }}
            />
            <YAxis
              dataKey="cumulativePct"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
              width={38}
              domain={[0, 100]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                    <p className="text-white/60">
                      Top {d.txPct}% of transactions
                    </p>
                    <p className="text-amber-400 font-semibold">
                      = {d.cumulativePct}% of spending
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={80}
              stroke="rgba(251,191,36,0.4)"
              strokeDasharray="4 4"
              label={{
                value: "80%",
                fill: "rgba(251,191,36,0.5)",
                fontSize: 9,
                position: "right",
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulativePct"
              stroke="#fbbf24"
              strokeWidth={2}
              fill="url(#paretoGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-white/30 text-center mt-2">
        {topPct < 30
          ? "Highly concentrated — a few big expenses drive most spending"
          : topPct < 50
            ? "Moderately concentrated — focus on top transactions for savings"
            : "Well distributed — spending is spread across many transactions"}
      </p>
    </WidgetCard>
  );
}
