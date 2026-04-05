"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import { getDailySpending } from "@/lib/utils/comparisonAnalytics";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category?: string | null;
};

type Props = {
  transactions: Transaction[];
  days?: number;
  onDateClick?: (date: string) => void;
};

const DAY_OPTIONS = [7, 14, 30, 60] as const;

export default function DailySpendingChartWidget({
  transactions,
  days: defaultDays = 30,
  onDateClick,
}: Props) {
  const [days, setDays] = useState(defaultDays);

  const data = useMemo(
    () => getDailySpending(transactions, days),
    [transactions, days],
  );

  const avg = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((s, d) => s + d.amount, 0) / data.length;
  }, [data]);

  return (
    <WidgetCard
      title="Daily Spending"
      action={
        <div className="flex gap-0.5">
          {DAY_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                days === n
                  ? "bg-white/15 text-white"
                  : "text-white/30 hover:text-white/50",
              )}
            >
              {n}d
            </button>
          ))}
        </div>
      }
      interactive
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={Math.max(0, Math.floor(data.length / 7) - 1)}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`
              }
              width={45}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,15,25,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: any) => [
                `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
                "Spent",
              ]}
              labelStyle={{ color: "rgba(255,255,255,0.5)" }}
            />
            {/* Average reference line */}
            <Line
              type="monotone"
              dataKey={() => avg}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              dot={false}
              strokeWidth={1}
              name="Avg"
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: "#22d3ee",
                stroke: "#0f0f19",
                strokeWidth: 2,
                onClick: (_: any, payload: any) => {
                  if (payload?.payload?.date)
                    onDateClick?.(payload.payload.date);
                },
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[10px] text-white/30">
          Daily avg:{" "}
          <span className="text-white/50 tabular-nums">${avg.toFixed(2)}</span>
        </span>
        <span className="text-[10px] text-white/30">
          {data.filter((d) => d.amount > 0).length}/{data.length} active days
        </span>
      </div>
    </WidgetCard>
  );
}
