"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { type TransactionWithAccount } from "@/lib/utils/incomeExpense";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  transactions: TransactionWithAccount[];
  activeCategories: string[];
  startDate: string;
  endDate: string;
};

// Neon palette matching the donut widget
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

function fmtAmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function CategoryTrendWidget({
  transactions,
  activeCategories,
  startDate,
  endDate,
}: Props) {
  const { chartData, categoryColors } = useMemo(() => {
    if (!transactions.length || !activeCategories.length) {
      return { chartData: [], categoryColors: {} };
    }

    // Build a map of YYYY-MM → { [category]: total }
    const byMonth: Record<string, Record<string, number>> = {};

    const fromMonth = startDate.slice(0, 7);
    const toMonth = endDate.slice(0, 7);

    for (const t of transactions) {
      const month = t.date.slice(0, 7);
      if (month < fromMonth || month > toMonth) continue;
      if (!activeCategories.includes(t.category ?? "")) continue;

      if (!byMonth[month]) byMonth[month] = {};
      const cat = t.category ?? "Uncategorized";
      byMonth[month][cat] = (byMonth[month][cat] || 0) + Math.abs(t.amount);
    }

    // Sort months
    const months = Object.keys(byMonth).sort();

    const data = months.map((m) => {
      const point: Record<string, number | string> = {
        name: format(parseISO(`${m}-01`), "MMM yy"),
      };
      for (const cat of activeCategories) {
        point[cat] = byMonth[m]?.[cat] ?? 0;
      }
      return point;
    });

    // Assign colors (use category_color from transaction if available)
    const colors: Record<string, string> = {};
    activeCategories.forEach((cat, i) => {
      const txColor = (
        transactions.find((t) => t.category === cat && (t as any).category_color) as any
      )?.category_color;
      colors[cat] = txColor || PALETTE[i % PALETTE.length];
    });

    return { chartData: data, categoryColors: colors };
  }, [transactions, activeCategories, startDate, endDate]);

  if (!chartData.length) {
    return (
      <WidgetCard title="Category Trend ★">
        <p className="text-white/40 text-xs text-center py-8">
          No monthly data for selected categories
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Category Trend ★"
      subtitle="Monthly spending per category"
    >
      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <defs>
              {activeCategories.map((cat) => (
                <filter key={cat} id={`glow-line-${cat.replace(/\s+/g, "-")}`}>
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAmt}
              width={40}
            />
            <Tooltip content={<TrendTooltip categoryColors={categoryColors} />} />
            {activeCategories.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={categoryColors[cat]}
                strokeWidth={2}
                dot={{ r: 3, fill: categoryColors[cat], strokeWidth: 0 }}
                activeDot={{ r: 5, fill: categoryColors[cat], strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {activeCategories.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: categoryColors[cat],
                boxShadow: `0 0 5px ${categoryColors[cat]}60`,
              }}
            />
            <span className="text-[10px] text-white/55 truncate max-w-[80px]">{cat}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
  categoryColors,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  categoryColors: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value > 0);
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-xs border border-white/15 shadow-lg shadow-black/40 bg-slate-900">
      <p className="text-white/60 font-medium mb-1.5 text-[11px]">{label}</p>
      <div className="space-y-1">
        {items.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: categoryColors[p.dataKey] || p.stroke }}
              />
              <span className="text-white/70">{p.dataKey}</span>
            </div>
            <span className="font-semibold text-white/90 tabular-nums">
              ${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
