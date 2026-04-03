"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { type TransactionWithAccount } from "@/lib/utils/incomeExpense";
import { useMemo } from "react";

type Props = {
  transactions: TransactionWithAccount[];
  activeCategories: string[];
  onCategoryClick?: (category: string) => void;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Neon palette matching CategoryDonutWidget
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

export default function CategoryInsightWidget({
  transactions,
  activeCategories,
  onCategoryClick,
}: Props) {
  const insights = useMemo(() => {
    if (!transactions.length || !activeCategories.length) return null;

    // Per-category breakdown
    const byCategory = activeCategories.map((cat, ci) => {
      const txs = transactions.filter((t) => t.category === cat);
      const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
      const avg = txs.length > 0 ? total / txs.length : 0;
      const max = txs.length > 0 ? Math.max(...txs.map((t) => Math.abs(t.amount))) : 0;

      // Day-of-week distribution
      const dayCount = Array(7).fill(0) as number[];
      for (const t of txs) {
        const d = new Date(t.date).getDay();
        dayCount[d]++;
      }
      const peakDayIndex = dayCount.indexOf(Math.max(...dayCount));
      const peakDay = txs.length > 0 ? DAY_NAMES[peakDayIndex] : "—";

      // Color: use category_color from any matching transaction, else palette
      const txColor = (txs.find((t) => (t as any).category_color) as any)?.category_color;
      const color = txColor || PALETTE[ci % PALETTE.length];

      return { cat, total, avg, max, count: txs.length, peakDay, color };
    });

    const grandTotal = byCategory.reduce((s, c) => s + c.total, 0);
    return { byCategory, grandTotal };
  }, [transactions, activeCategories]);

  if (!insights || insights.byCategory.length === 0) {
    return (
      <WidgetCard title="Category Insights ★">
        <p className="text-white/40 text-xs text-center py-8">
          Select a category to see insights
        </p>
      </WidgetCard>
    );
  }

  const { byCategory, grandTotal } = insights;

  return (
    <WidgetCard
      title="Category Insights ★"
      subtitle={`${activeCategories.length} categor${activeCategories.length === 1 ? "y" : "ies"} · ${transactions.length} transactions`}
    >
      <div className="space-y-3">
        {byCategory.map(({ cat, total, avg, max, count, peakDay, color }) => (
          <div key={cat} className="space-y-1.5">
            {/* Category header */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => onCategoryClick?.(cat)}
                className="flex items-center gap-2 min-w-0 group"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                />
                <span
                  className="text-xs font-semibold truncate group-hover:underline"
                  style={{ color }}
                >
                  {cat}
                </span>
              </button>
              <BlurredAmount blurIntensity="sm">
                <span className="text-xs font-bold text-white/80 tabular-nums">
                  ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </BlurredAmount>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-1">
              <Stat label="Transactions" value={String(count)} color={color} />
              <Stat
                label="Avg"
                value={`$${avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color={color}
                blurred
              />
              <Stat
                label="Largest"
                value={`$${max.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color={color}
                blurred
              />
              <Stat label="Peak Day" value={peakDay} color={color} />
            </div>

            {/* Share bar (if multiple categories) */}
            {byCategory.length > 1 && grandTotal > 0 && (
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(total / grandTotal) * 100}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 6px ${color}50`,
                  }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Grand total when multiple categories */}
        {byCategory.length > 1 && (
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Combined total</span>
            <BlurredAmount blurIntensity="sm">
              <span className="text-xs font-bold text-white/70 tabular-nums">
                ${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </BlurredAmount>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

function Stat({
  label,
  value,
  color,
  blurred = false,
}: {
  label: string;
  value: string;
  color: string;
  blurred?: boolean;
}) {
  const content = (
    <div className="neo-card rounded-lg p-1.5 text-center">
      <p className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[10px] font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );

  if (blurred) {
    return <BlurredAmount blurIntensity="sm">{content}</BlurredAmount>;
  }
  return content;
}
