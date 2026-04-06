"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
];

type Transaction = {
  amount: number;
  category?: string | null;
  category_color?: string | null;
};

type Props = {
  transactions: Transaction[];
  activeCategories?: string[];
  onCategoryClick?: (category: string) => void;
};

type SortMode = "avg" | "total" | "count";

export default function AvgTransactionByCategoryWidget({
  transactions,
  activeCategories = [],
  onCategoryClick,
}: Props) {
  const [sortBy, setSortBy] = useState<SortMode>("avg");

  const data = useMemo(() => {
    const catMap = new Map<
      string,
      { total: number; count: number; color: string }
    >();

    for (const t of transactions) {
      const cat = t.category || "Uncategorized";
      const amt = Math.abs(t.amount);
      if (!catMap.has(cat)) {
        catMap.set(cat, {
          total: 0,
          count: 0,
          color: t.category_color || "#64748b",
        });
      }
      const entry = catMap.get(cat)!;
      entry.total += amt;
      entry.count += 1;
    }

    const entries = Array.from(catMap.entries())
      .map(([name, d]) => ({
        name,
        avg: Math.round(d.total / d.count),
        total: Math.round(d.total),
        count: d.count,
        color: d.color,
      }))
      .filter((d) => d.count >= 2);

    entries.sort((a, b) => b[sortBy] - a[sortBy]);
    return entries.slice(0, 10);
  }, [transactions, sortBy]);

  if (data.length < 3) {
    return (
      <WidgetCard title="Avg Transaction by Category">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 3 categories with 2+ transactions
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      interactive
      title="Avg Transaction by Category"
      subtitle="Average spending per transaction"
      filterActive={activeCategories.length > 0}
      action={
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(["avg", "total", "count"] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setSortBy(m)}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors capitalize ${
                sortBy === m
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {m === "avg" ? "Avg $" : m === "total" ? "Total" : "Count"}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-[260px] -ml-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
              axisLine={false}
              tickLine={false}
              width={85}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                    <p className="font-medium mb-1" style={{ color: d.color }}>
                      {d.name}
                    </p>
                    <p className="text-white/70">
                      Avg: ${d.avg.toLocaleString()} · {d.count} txns
                    </p>
                    <p className="text-white/40">
                      Total: ${d.total.toLocaleString()}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey={sortBy}
              radius={[0, 6, 6, 0]}
              maxBarSize={18}
              onClick={(data: any) => onCategoryClick?.(data.name)}
              style={{ cursor: "pointer" }}
            >
              {data.map((d, i) => {
                const isActive =
                  activeCategories.length === 0 ||
                  activeCategories.includes(d.name);
                return (
                  <Cell
                    key={d.name}
                    fill={d.color || PALETTE[i % PALETTE.length]}
                    fillOpacity={isActive ? 0.65 : 0.15}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
