"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
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

type Transaction = {
  amount: number;
  date: string;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
};

export default function TransactionFrequencyWidget({
  transactions,
  startDate,
  endDate,
}: Props) {
  const { chartData, avgPerDay, peakDate, peakCount, activeDaysPct } =
    useMemo(() => {
      const countByDate: Record<string, number> = {};
      for (const t of transactions) {
        countByDate[t.date] = (countByDate[t.date] ?? 0) + 1;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const chartData: { date: string; label: string; count: number }[] = [];

      const d = new Date(start);
      while (d <= end) {
        const dateStr = d.toISOString().slice(0, 10);
        chartData.push({
          date: dateStr,
          label: d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          count: countByDate[dateStr] ?? 0,
        });
        d.setDate(d.getDate() + 1);
      }

      const totalTx = transactions.length;
      const totalDays = chartData.length || 1;
      const avgPerDay = totalTx / totalDays;
      const activeDays = chartData.filter((d) => d.count > 0).length;
      const activeDaysPct = Math.round((activeDays / totalDays) * 100);

      let peakDate = "";
      let peakCount = 0;
      for (const d of chartData) {
        if (d.count > peakCount) {
          peakCount = d.count;
          peakDate = d.label;
        }
      }

      return { chartData, avgPerDay, peakDate, peakCount, activeDaysPct };
    }, [transactions, startDate, endDate]);

  if (transactions.length < 5) {
    return (
      <WidgetCard title="Transaction Frequency">
        <p className="text-white/40 text-xs text-center py-8">
          Not enough transactions
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Transaction Frequency"
      subtitle="Daily transaction count over time"
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/35">Avg/Day</p>
          <p className="text-sm font-bold text-violet-400 tabular-nums">
            {avgPerDay.toFixed(1)}
          </p>
        </div>
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/35">Peak</p>
          <p className="text-sm font-bold text-white/80 tabular-nums">
            {peakCount}
          </p>
          <p className="text-[9px] text-white/25">{peakDate}</p>
        </div>
        <div className="neo-card rounded-lg p-2 text-center">
          <p className="text-[10px] text-white/35">Active Days</p>
          <p className="text-sm font-bold text-cyan-400 tabular-nums">
            {activeDaysPct}%
          </p>
        </div>
      </div>

      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="freqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(Math.floor(chartData.length / 6), 1)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                    <p className="text-white/60">{d.label}</p>
                    <p className="text-violet-400 font-semibold">
                      {d.count} transactions
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              fill="url(#freqGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
