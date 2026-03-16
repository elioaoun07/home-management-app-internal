"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
};

export default function TrendChart({ months }: Props) {
  const tc = useThemeClasses();

  const data = useMemo(() => {
    if (!months) return [];
    return months.map((m) => ({
      name: formatMonth(m.month),
      income: m.income,
      expense: m.expense,
      savings: m.savings,
    }));
  }, [months]);

  if (!data.length) {
    return (
      <WidgetCard title="Income / Expense / Savings">
        <p className="text-white/40 text-xs text-center py-8">
          No data yet — keep logging!
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Income / Expense / Savings" subtitle="Monthly trend">
      <div className="h-[220px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAmount}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#incomeGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#34d399" }}
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#f87171"
              strokeWidth={2}
              fill="url(#expenseGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#f87171" }}
            />
            <Area
              type="monotone"
              dataKey="savings"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#savingsGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#22d3ee" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-1">
        <Legend color="#34d399" label="Income" />
        <Legend color="#f87171" label="Expense" />
        <Legend color="#22d3ee" label="Savings" />
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
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke }} className="font-medium">
          {p.dataKey}: ${Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function formatAmount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
