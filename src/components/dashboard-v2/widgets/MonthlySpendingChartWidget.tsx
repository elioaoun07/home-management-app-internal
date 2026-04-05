"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import { getMonthlySpending } from "@/lib/utils/comparisonAnalytics";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
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
  months?: number;
  onMonthClick?: (range: { start: string; end: string }) => void;
};

const MONTH_OPTIONS = [6, 12, 24] as const;
type ViewMode = "bar" | "line";

export default function MonthlySpendingChartWidget({
  transactions,
  months: defaultMonths = 12,
  onMonthClick,
}: Props) {
  const [months, setMonths] = useState(defaultMonths);
  const [viewMode, setViewMode] = useState<ViewMode>("bar");

  const data = useMemo(
    () => getMonthlySpending(transactions, months),
    [transactions, months],
  );

  const avg = useMemo(() => {
    const nonZero = data.filter((d) => d.amount > 0);
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((s, d) => s + d.amount, 0) / nonZero.length;
  }, [data]);

  const handleBarClick = (entry: any) => {
    if (!entry?.date || !onMonthClick) return;
    const [year, month] = entry.date.split("-");
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    onMonthClick({
      start: `${entry.date}-01`,
      end: `${entry.date}-${lastDay}`,
    });
  };

  return (
    <WidgetCard
      title="Monthly Spending"
      action={
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {(["bar", "line"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors capitalize",
                  viewMode === m
                    ? "bg-white/15 text-white"
                    : "text-white/30 hover:text-white/50",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex gap-0.5">
            {MONTH_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setMonths(n)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                  months === n
                    ? "bg-white/15 text-white"
                    : "text-white/30 hover:text-white/50",
                )}
              >
                {n}M
              </button>
            ))}
          </div>
        </div>
      }
      interactive
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "bar" ? (
            <BarChart
              data={data}
              onClick={(e: any) =>
                e?.activePayload?.[0] &&
                handleBarClick(e.activePayload[0].payload)
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
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
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <ComposedChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
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
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{
                  fill: "#8b5cf6",
                  r: 3,
                  stroke: "#0f0f19",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 5, fill: "#8b5cf6" }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[10px] text-white/30">
          Monthly avg:{" "}
          <span className="text-white/50 tabular-nums">${avg.toFixed(0)}</span>
        </span>
        <span className="text-[10px] text-white/30">
          {data.filter((d) => d.count > 0).length} active months
        </span>
      </div>
    </WidgetCard>
  );
}
