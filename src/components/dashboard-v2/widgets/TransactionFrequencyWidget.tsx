"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
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
  const { chartData, avgPerDay, peakDate, peakCount } = useMemo(() => {
    const countByDate: Record<string, number> = {};
    for (const t of transactions) {
      countByDate[t.date] = (countByDate[t.date] ?? 0) + 1;
    }

    // Fill in all dates in range
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

    let peakDate = "";
    let peakCount = 0;
    for (const d of chartData) {
      if (d.count > peakCount) {
        peakCount = d.count;
        peakDate = d.label;
      }
    }

    return { chartData, avgPerDay, peakDate, peakCount };
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
      subtitle={`Avg ${avgPerDay.toFixed(1)}/day · Peak: ${peakDate} (${peakCount})`}
    >
      <ResponsiveContainer width="100%" height={100}>
        <BarChart
          data={chartData}
          margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.03)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 8, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(Math.floor(chartData.length / 6), 1)}
          />
          <YAxis
            tick={{ fontSize: 8, fill: "rgba(255,255,255,0.25)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(v) => [`${Number(v)} transactions`, "Count"]}
          />
          <Bar
            dataKey="count"
            fill="rgba(139,92,246,0.5)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
