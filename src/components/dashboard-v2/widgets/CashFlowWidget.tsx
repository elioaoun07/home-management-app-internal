"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { DailyTotal } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";
import {
  Bar,
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
  dailyTotals: DailyTotal[] | undefined;
};

export default function CashFlowWidget({ dailyTotals }: Props) {
  const data = useMemo(() => {
    if (!dailyTotals || dailyTotals.length === 0) return [];

    let runningBalance = 0;
    return dailyTotals.map((d) => {
      const net = d.income - d.expense;
      runningBalance += net;
      return {
        name: d.date.slice(8), // day number
        income: d.income,
        expense: -d.expense, // negative for below-zero bars
        net,
        balance: Math.round(runningBalance * 100) / 100,
      };
    });
  }, [dailyTotals]);

  if (!data.length) {
    return (
      <WidgetCard title="Cash Flow">
        <p className="text-white/40 text-xs text-center py-8">No daily data</p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Cash Flow" subtitle="Daily income vs expense">
      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAmt}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
            <Bar
              dataKey="income"
              fill="#34d399"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="expense"
              fill="#f87171"
              opacity={0.7}
              radius={[0, 0, 2, 2]}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#a78bfa"
              strokeWidth={1.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-1">
        <Legend color="#34d399" label="Income" />
        <Legend color="#f87171" label="Expense" />
        <Legend color="#a78bfa" label="Running Balance" />
      </div>
    </WidgetCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-white/50">{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
      <p className="text-white/60 mb-1">Day {label}</p>
      {payload.map((p: any) => {
        const val = Number(p.value);
        return (
          <p
            key={p.dataKey}
            style={{ color: p.stroke || p.fill }}
            className="font-medium"
          >
            {p.dataKey}: ${Math.abs(val).toLocaleString()}
          </p>
        );
      })}
    </div>
  );
}

function fmtAmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n > 0 ? "" : "-"}${(abs / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
