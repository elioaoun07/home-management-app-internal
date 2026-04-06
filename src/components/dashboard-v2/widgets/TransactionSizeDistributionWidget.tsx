"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Transaction = {
  id: string;
  amount: number;
  category?: string | null;
};

type Props = {
  transactions: Transaction[];
};

type ViewMode = "count" | "total";

const BUCKETS = [
  { label: "< $10", min: 0, max: 10 },
  { label: "$10–25", min: 10, max: 25 },
  { label: "$25–50", min: 25, max: 50 },
  { label: "$50–100", min: 50, max: 100 },
  { label: "$100–250", min: 100, max: 250 },
  { label: "$250–500", min: 250, max: 500 },
  { label: "$500+", min: 500, max: Infinity },
];

export default function TransactionSizeDistributionWidget({
  transactions,
}: Props) {
  const [mode, setMode] = useState<ViewMode>("count");

  const { chartData, median, mean, totalCount } = useMemo(() => {
    if (!transactions.length)
      return { chartData: [], median: 0, mean: 0, totalCount: 0 };

    const amounts = transactions
      .map((t) => Math.abs(t.amount))
      .filter((a) => a > 0);
    amounts.sort((a, b) => a - b);

    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const median =
      amounts.length % 2 === 0
        ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
        : amounts[Math.floor(amounts.length / 2)];

    const chartData = BUCKETS.map((b) => {
      const inBucket = amounts.filter((a) => a >= b.min && a < b.max);
      return {
        label: b.label,
        count: inBucket.length,
        total: Math.round(inBucket.reduce((s, a) => s + a, 0)),
        min: b.min,
        max: b.max,
      };
    });

    return { chartData, median, mean, totalCount: amounts.length };
  }, [transactions]);

  if (!transactions.length || totalCount < 5) {
    return (
      <WidgetCard title="Transaction Distribution">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 5 transactions
        </p>
      </WidgetCard>
    );
  }

  const dataKey = mode === "count" ? "count" : "total";
  const maxVal = Math.max(...chartData.map((d) => d[dataKey]));

  // Find which bucket the mean and median fall in
  const meanBucket = BUCKETS.findIndex((b) => mean >= b.min && mean < b.max);
  const medianBucket = BUCKETS.findIndex(
    (b) => median >= b.min && median < b.max,
  );

  return (
    <WidgetCard
      title="Transaction Distribution"
      subtitle="Spending by transaction size"
      action={
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(["count", "total"] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors capitalize ${
                mode === m
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {m === "count" ? "# Txns" : "$ Total"}
            </button>
          ))}
        </div>
      }
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="neo-card rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-white/40 mb-0.5">Transactions</p>
          <p className="text-base font-bold text-white tabular-nums">
            {totalCount}
          </p>
        </div>
        <div className="neo-card rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-white/40 mb-0.5">Median</p>
          <p className="text-base font-bold text-amber-400 tabular-nums">
            ${Math.round(median)}
          </p>
        </div>
        <div className="neo-card rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-white/40 mb-0.5">Average</p>
          <p className="text-base font-bold text-cyan-400 tabular-nums">
            ${Math.round(mean)}
          </p>
        </div>
      </div>

      <div className="h-[180px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                mode === "total" && v >= 1000
                  ? `$${(v / 1000).toFixed(0)}k`
                  : String(v)
              }
              width={mode === "total" ? 40 : 30}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                    <p className="text-white/60 mb-1">{d.label}</p>
                    <p className="text-white font-bold">
                      {mode === "count"
                        ? `${d.count} transactions`
                        : `$${d.total.toLocaleString()} total`}
                    </p>
                    {mode === "count" && (
                      <p className="text-white/40">
                        ${d.total.toLocaleString()} total
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={`rgba(34,211,238,${0.4 + (chartData[i][dataKey] / Math.max(...chartData.map((d) => d[dataKey]), 1)) * 0.5})`}
                />
              ))}
            </Bar>
            {/* Mark median and mean buckets */}
            {medianBucket >= 0 && (
              <ReferenceLine
                x={BUCKETS[medianBucket].label}
                stroke="#fbbf24"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                label={{
                  value: "Median",
                  fill: "#fbbf24",
                  fontSize: 10,
                  position: "top",
                }}
              />
            )}
            {meanBucket >= 0 && meanBucket !== medianBucket && (
              <ReferenceLine
                x={BUCKETS[meanBucket].label}
                stroke="#22d3ee"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                label={{
                  value: "Average",
                  fill: "#22d3ee",
                  fontSize: 10,
                  position: "top",
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insight line */}
      {(() => {
        const smallTxns = chartData
          .slice(0, 3)
          .reduce((s, d) => s + d.count, 0);
        const largeTxns = chartData.slice(4).reduce((s, d) => s + d.count, 0);
        const smallPct =
          totalCount > 0 ? Math.round((smallTxns / totalCount) * 100) : 0;
        const largePct =
          totalCount > 0 ? Math.round((largeTxns / totalCount) * 100) : 0;
        return (
          <p className="text-[11px] text-white/40 text-center mt-3">
            {smallPct}% under $50 · {largePct}% over $250
          </p>
        );
      })()}
    </WidgetCard>
  );
}
