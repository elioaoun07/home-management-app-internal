"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { NetWorthDataPoint } from "@/features/analytics/useNetWorth";
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
  series: NetWorthDataPoint[];
};

export default function NetWorthWidget({ series }: Props) {
  const { data, change, changePct } = useMemo(() => {
    if (series.length === 0) return { data: [], change: 0, changePct: 0 };

    const data = series.map((s) => ({
      name: fmtMonth(s.month),
      total: Math.round(s.total),
    }));

    const first = series[0].total;
    const last = series[series.length - 1].total;
    const change = last - first;
    const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;

    return { data, change, changePct };
  }, [series]);

  if (!data.length) {
    return (
      <WidgetCard title="Net Worth">
        <p className="text-white/40 text-xs text-center py-8">
          No balance data available
        </p>
      </WidgetCard>
    );
  }

  const isPositive = change >= 0;
  const currentTotal = series[series.length - 1]?.total ?? 0;

  return (
    <WidgetCard
      title="Net Worth"
      subtitle="Total across all accounts"
      action={
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${
            isPositive
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {changePct.toFixed(1)}%
        </span>
      }
    >
      <div className="mb-2">
        <p className="text-2xl font-bold text-white tabular-nums">
          ${Math.round(currentTotal).toLocaleString()}
        </p>
        <p
          className={`text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isPositive ? "+" : ""}${Math.round(change).toLocaleString()} over{" "}
          {series.length} months
        </p>
      </div>
      <div className="h-[140px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? "#34d399" : "#f87171"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? "#34d399" : "#f87171"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAmt}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke={isPositive ? "#34d399" : "#f87171"}
              strokeWidth={2}
              fill="url(#nwGrad)"
              dot={false}
              activeDot={{ r: 4, fill: isPositive ? "#34d399" : "#f87171" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
      <p className="text-white/60 mb-1">{label}</p>
      <p className="text-white font-bold">
        ${Number(payload[0].value).toLocaleString()}
      </p>
    </div>
  );
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const ms = [
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
  return `${ms[parseInt(m) - 1]} ${y.slice(2)}`;
}

function fmtAmt(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
