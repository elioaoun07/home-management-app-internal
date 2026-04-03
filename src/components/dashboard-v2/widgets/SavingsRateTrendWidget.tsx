"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
};

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const hitTarget = payload.rate >= 20;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={hitTarget ? 5 : 3}
      fill={hitTarget ? "#34d399" : "#22d3ee"}
      stroke={hitTarget ? "rgba(52,211,153,0.4)" : "none"}
      strokeWidth={hitTarget ? 3 : 0}
    />
  );
}

export default function SavingsRateTrendWidget({ months }: Props) {
  const { chartData, hitCount } = useMemo(() => {
    if (!months) return { chartData: [], hitCount: 0 };
    const data = months.map((m) => ({
      label: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short" }),
      rate: Math.round(m.savingsRate * 10) / 10,
    }));
    return { chartData: data, hitCount: data.filter((d) => d.rate >= 20).length };
  }, [months]);

  if (chartData.length < 2) {
    return (
      <WidgetCard title="Savings Rate Trend">
        <p className="text-white/40 text-xs text-center py-8">Need at least 2 months</p>
      </WidgetCard>
    );
  }

  const latest = chartData[chartData.length - 1]?.rate ?? 0;
  const prev = chartData.length >= 2 ? (chartData[chartData.length - 2]?.rate ?? 0) : 0;
  const trend = latest > prev ? "up" : latest < prev ? "down" : "flat";
  const latestColor = latest >= 20 ? "#34d399" : latest >= 10 ? "#fbbf24" : "#f87171";

  return (
    <WidgetCard
      title="Savings Rate Trend"
      subtitle={`Current: ${latest}%${trend === "up" ? " ↑" : trend === "down" ? " ↓" : ""} · Target: 20%`}
      action={
        <span className="text-[10px] text-white/30">
          {hitCount}/{chartData.length} months hit target
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 8, right: 5, bottom: 0, left: -20 }}>
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
            tickFormatter={(v) => `${v}%`}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(v) => {
              const rate = Number(v);
              return [`${rate}% ${rate >= 20 ? "✓" : ""}`, "Savings Rate"];
            }}
          />
          <ReferenceLine
            y={20}
            stroke="rgba(52,211,153,0.4)"
            strokeDasharray="4 4"
            label={{ value: "20% target", position: "right", fill: "rgba(52,211,153,0.5)", fontSize: 9 }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Quick stat */}
      <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
        <div className="text-center flex-1">
          <p className="text-[9px] text-white/30">Current</p>
          <p className="text-xs font-bold tabular-nums" style={{ color: latestColor }}>{latest}%</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-[9px] text-white/30">Avg</p>
          <p className="text-xs font-bold text-white/60 tabular-nums">
            {(chartData.reduce((s, d) => s + d.rate, 0) / chartData.length).toFixed(1)}%
          </p>
        </div>
        <div className="text-center flex-1">
          <p className="text-[9px] text-white/30">Target hit</p>
          <p className="text-xs font-bold text-emerald-400">{hitCount}/{chartData.length}</p>
        </div>
      </div>
    </WidgetCard>
  );
}
