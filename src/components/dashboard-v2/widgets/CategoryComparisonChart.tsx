"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Curated palette designed for dark backgrounds — cohesive, neon-futuristic
const CHART_PALETTE = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#34d399", // emerald
  "#f472b6", // pink
  "#fbbf24", // amber
  "#60a5fa", // blue
  "#fb923c", // orange
  "#e879f9", // fuchsia
];

type Props = {
  months: MonthlyAnalytics[] | undefined;
};

export default function CategoryComparisonChart({ months }: Props) {
  const [showType, setShowType] = useState<"expense" | "income">("expense");

  // Get top 6 categories across all months
  const { data, categoryColors } = useMemo(() => {
    if (!months || months.length === 0) return { data: [], categoryColors: {} };

    // Aggregate category totals across all months
    const totals = new Map<string, number>();
    for (const m of months) {
      for (const c of m.categoryBreakdown) {
        totals.set(c.name, (totals.get(c.name) || 0) + c.amount);
      }
    }

    const topCategories = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    const colors: Record<string, string> = {};
    topCategories.forEach((name, i) => {
      colors[name] = CHART_PALETTE[i % CHART_PALETTE.length];
    });

    const chartData = months.map((m) => {
      const point: Record<string, any> = {
        name: formatMonth(m.month),
      };
      for (const catName of topCategories) {
        const cat = m.categoryBreakdown.find((c) => c.name === catName);
        point[catName] = cat?.amount || 0;
      }
      return point;
    });

    return { data: chartData, categoryColors: colors };
  }, [months]);

  const categories = Object.keys(categoryColors);

  if (!data.length || categories.length === 0) {
    return (
      <WidgetCard title="Spending by Category">
        <p className="text-white/40 text-xs text-center py-8">
          No category data yet
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Spending by Category" subtitle="Monthly breakdown">
      <div className="h-[220px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <defs>
              {categories.map((cat) => (
                <linearGradient
                  key={cat}
                  id={`grad-${cat.replace(/\s+/g, "-")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={categoryColors[cat]}
                    stopOpacity={0.95}
                  />
                  <stop
                    offset="100%"
                    stopColor={categoryColors[cat]}
                    stopOpacity={0.6}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
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
            <Tooltip
              content={<CustomTooltip categoryColors={categoryColors} />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            {categories.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="a"
                fill={`url(#grad-${cat.replace(/\s+/g, "-")})`}
                radius={
                  i === categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
        {categories.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full ring-1 ring-white/10"
              style={{
                backgroundColor: categoryColors[cat],
                boxShadow: `0 0 6px ${categoryColors[cat]}50`,
              }}
            />
            <span className="text-[10px] text-white/60 truncate max-w-[72px]">
              {cat}
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function CustomTooltip({ active, payload, label, categoryColors }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => p.value > 0);
  const total = items.reduce((sum: number, p: any) => sum + Number(p.value), 0);
  return (
    <div className="neo-card rounded-xl px-3.5 py-2.5 text-xs border border-white/10 backdrop-blur-md shadow-lg shadow-black/30">
      <p className="text-white/70 font-medium mb-1.5 text-[11px]">{label}</p>
      <div className="space-y-1">
        {items.map((p: any) => (
          <div
            key={p.dataKey}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: categoryColors?.[p.dataKey] || p.fill,
                  boxShadow: `0 0 4px ${categoryColors?.[p.dataKey] || p.fill}60`,
                }}
              />
              <span className="text-white/80">{p.dataKey}</span>
            </div>
            <span className="font-semibold text-white/90 tabular-nums">
              ${Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="border-t border-white/10 mt-1.5 pt-1.5 flex justify-between">
          <span className="text-white/50">Total</span>
          <span className="font-semibold text-white/80 tabular-nums">
            ${total.toLocaleString()}
          </span>
        </div>
      )}
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
