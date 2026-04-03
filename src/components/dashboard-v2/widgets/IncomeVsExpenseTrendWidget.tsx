"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
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
  onMonthClick?: (dateRange: { start: string; end: string }) => void;
};

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m) - 1]} '${y.slice(2)}`;
}

export default function IncomeVsExpenseTrendWidget({ months, onMonthClick }: Props) {
  const { chartData, avgSurplus, positiveMonths, totalMonths } = useMemo(() => {
    if (!months) return { chartData: [], avgSurplus: 0, positiveMonths: 0, totalMonths: 0 };
    const data = months.map((m) => ({
      month: m.month,
      label: fmtMonth(m.month),
      income: Math.round(m.income),
      expense: Math.round(m.expense),
      surplus: Math.round(m.income - m.expense),
    }));
    const avgSurplus = data.reduce((s, d) => s + d.surplus, 0) / (data.length || 1);
    const positiveMonths = data.filter((d) => d.surplus >= 0).length;
    return { chartData: data, avgSurplus, positiveMonths, totalMonths: data.length };
  }, [months]);

  if (chartData.length < 2) {
    return (
      <WidgetCard title="Income vs Expense">
        <p className="text-white/40 text-xs text-center py-8">Need at least 2 months of data</p>
      </WidgetCard>
    );
  }

  const latestSurplus = chartData[chartData.length - 1]?.surplus ?? 0;
  const surplusColor = latestSurplus >= 0 ? "#34d399" : "#f87171";

  const handleClick = (data: any) => {
    if (!data?.activePayload?.[0] || !onMonthClick) return;
    const month = data.activePayload[0].payload.month as string;
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    onMonthClick({ start, end });
  };

  return (
    <WidgetCard
      title="Income vs Expense Trend"
      subtitle={
        latestSurplus >= 0
          ? `+$${latestSurplus.toLocaleString()} surplus this month`
          : `-$${Math.abs(latestSurplus).toLocaleString()} deficit this month`
      }
      action={
        <span className="text-[10px] text-white/40">
          {positiveMonths}/{totalMonths} months surplus
        </span>
      }
    >
      <div className="h-[180px] -ml-2" title="Click a month to filter">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
            onClick={handleClick}
            style={{ cursor: onMonthClick ? "pointer" : "default" }}
          >
            <defs>
              <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 11,
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                const surplusC = d.surplus >= 0 ? "#34d399" : "#f87171";
                return (
                  <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                    <p className="text-white/60 mb-1.5">{label}</p>
                    <p className="text-emerald-400">Income: ${d.income.toLocaleString()}</p>
                    <p className="text-red-400">Expense: ${d.expense.toLocaleString()}</p>
                    <p style={{ color: surplusC }} className="font-semibold mt-1">
                      {d.surplus >= 0 ? "Surplus" : "Deficit"}: ${Math.abs(d.surplus).toLocaleString()}
                    </p>
                    {onMonthClick && (
                      <p className="text-white/25 text-[9px] mt-1">Click to filter</p>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#34d399"
              fill="url(#incGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#f87171"
              fill="url(#expGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-white/5">
        <div className="text-center">
          <p className="text-[9px] text-white/30 mb-0.5">Avg Surplus</p>
          <p
            className="text-xs font-bold tabular-nums"
            style={{ color: avgSurplus >= 0 ? "#34d399" : "#f87171" }}
          >
            {avgSurplus >= 0 ? "+" : "-"}${Math.abs(Math.round(avgSurplus)).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-white/30 mb-0.5">Surplus Months</p>
          <p className="text-xs font-bold text-white/70">{positiveMonths}/{totalMonths}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-white/30 mb-0.5">This Month</p>
          <p className="text-xs font-bold tabular-nums" style={{ color: surplusColor }}>
            {latestSurplus >= 0 ? "+" : "-"}${Math.abs(latestSurplus).toLocaleString()}
          </p>
        </div>
      </div>

      {onMonthClick && (
        <p className="text-[9px] text-white/20 text-center mt-1">Click a month to filter dashboard</p>
      )}
    </WidgetCard>
  );
}
