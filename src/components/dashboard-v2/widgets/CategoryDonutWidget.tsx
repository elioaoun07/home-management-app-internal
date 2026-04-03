"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { useAccounts } from "@/features/accounts/hooks";
import {
  groupExpensesByCategory,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Neon-futuristic palette for dark backgrounds
const PALETTE = [
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
  transactions: TransactionWithAccount[];
  onCategoryClick?: (category: string) => void;
  activeCategories?: string[];
};

type SliceData = {
  name: string;
  value: number;
  color: string;
  percent: number;
};

export default function CategoryDonutWidget({ transactions, onCategoryClick, activeCategories = [] }: Props) {
  const { data: accounts } = useAccounts();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { slices, total } = useMemo(() => {
    const grouped = groupExpensesByCategory(transactions, accounts);
    const entries = Object.entries(grouped).sort((a, b) => b[1].amount - a[1].amount);

    const total = entries.reduce((s, [, d]) => s + d.amount, 0);
    if (total === 0) return { slices: [], total: 0 };

    // Top 7 + "Other"
    const top = entries.slice(0, 7);
    const rest = entries.slice(7);

    const slices: SliceData[] = top.map(([name, data], i) => {
      // Use category_color from transaction if available
      const txColor =
        (transactions.find(
          (t) => t.category === name && t.category_color,
        ) as any)?.category_color;
      return {
        name,
        value: data.amount,
        color: txColor || PALETTE[i % PALETTE.length],
        percent: (data.amount / total) * 100,
      };
    });

    if (rest.length > 0) {
      const otherTotal = rest.reduce((s, [, d]) => s + d.amount, 0);
      slices.push({
        name: "Other",
        value: otherTotal,
        color: "#64748b",
        percent: (otherTotal / total) * 100,
      });
    }

    return { slices, total };
  }, [transactions, accounts]);

  const active = activeIndex !== null ? slices[activeIndex] : null;

  if (slices.length === 0) {
    return (
      <WidgetCard title="Spending by Category">
        <p className="text-white/40 text-xs text-center py-10">
          No expense data for this period
        </p>
      </WidgetCard>
    );
  }

  const titleAction =
    activeCategories.length > 0 ? (
      <div className="flex items-center gap-1 flex-wrap">
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryClick?.(cat)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          >
            {cat}
            <span className="opacity-60">×</span>
          </button>
        ))}
      </div>
    ) : undefined;

  return (
    <WidgetCard title="Spending by Category" subtitle="Click a slice to filter dashboard" action={titleAction}>
      <div className="flex items-center gap-2">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {slices.map((s, i) => (
                  <filter key={i} id={`glow-${i}`}>
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={(data, index) => {
                  setActiveIndex(activeIndex === index ? null : index);
                  if (data.name) onCategoryClick?.(data.name);
                }}
              >
                {slices.map((s, i) => {
                  const isActive = activeCategories.length === 0 || activeCategories.includes(s.name);
                  const isHovered = activeIndex === i;
                  return (
                    <Cell
                      key={s.name}
                      fill={s.color}
                      opacity={
                        isHovered
                          ? 1
                          : activeCategories.length > 0
                            ? isActive ? 1 : 0.2
                            : activeIndex === null ? 1 : 0.35
                      }
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 8px ${s.color})` : undefined,
                        cursor: "pointer",
                        transition: "opacity 0.2s, transform 0.2s",
                        transformOrigin: "center",
                        transform: isHovered ? "scale(1.05)" : "scale(1)",
                      }}
                    />
                  );
                })}
              </Pie>
              <Tooltip
                content={<DonutTooltip total={total} />}
                wrapperStyle={{ zIndex: 10 }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {active ? (
              <>
                <p
                  className="text-[9px] font-medium text-center leading-tight max-w-[60px] truncate"
                  style={{ color: active.color }}
                >
                  {active.name}
                </p>
                <BlurredAmount blurIntensity="sm">
                  <p
                    className="text-sm font-bold tabular-nums"
                    style={{ color: active.color }}
                  >
                    ${active.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </BlurredAmount>
                <p className="text-[9px] text-white/40">
                  {active.percent.toFixed(1)}%
                </p>
              </>
            ) : (
              <>
                <p className="text-[9px] text-white/40 uppercase tracking-wider">Total</p>
                <BlurredAmount blurIntensity="sm">
                  <p className="text-sm font-bold text-white/80 tabular-nums">
                    ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </BlurredAmount>
                <p className="text-[9px] text-white/30">{slices.length} categories</p>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {slices.map((s, i) => (
            <button
              key={s.name}
              className="w-full flex items-center gap-2 group transition-all"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => {
                setActiveIndex(activeIndex === i ? null : i);
                onCategoryClick?.(s.name);
              }}
            >
              <div
                className="flex-shrink-0 w-2 h-2 rounded-full ring-1 ring-white/10 transition-all duration-200"
                style={{
                  backgroundColor: s.color,
                  boxShadow:
                    activeIndex === i || activeCategories.includes(s.name)
                      ? `0 0 8px ${s.color}, 0 0 16px ${s.color}60`
                      : `0 0 4px ${s.color}50`,
                  transform: activeIndex === i || activeCategories.includes(s.name) ? "scale(1.4)" : "scale(1)",
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[10px] truncate font-medium transition-colors"
                    style={{
                      color:
                        activeIndex === i || activeCategories.includes(s.name) || (activeIndex === null && activeCategories.length === 0)
                          ? s.color
                          : `${s.color}35`,
                    }}
                  >
                    {s.name}
                  </span>
                  <BlurredAmount blurIntensity="sm">
                    <span
                      className="text-[10px] font-semibold flex-shrink-0 tabular-nums"
                      style={{
                        color:
                          activeIndex === i || activeCategories.includes(s.name)
                            ? s.color
                            : activeCategories.length > 0
                              ? "rgba(255,255,255,0.25)"
                              : "rgba(255,255,255,0.55)",
                      }}
                    >
                      ${s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </BlurredAmount>
                </div>
                {/* Mini bar */}
                <div className="h-0.5 bg-white/5 rounded-full mt-0.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${s.percent}%`,
                      backgroundColor: s.color,
                      opacity:
                        activeIndex === i || activeCategories.includes(s.name) || (activeIndex === null && activeCategories.length === 0)
                          ? 1
                          : 0.2,
                    }}
                  />
                </div>
              </div>
              <span
                className="text-[9px] flex-shrink-0 tabular-nums"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                {s.percent.toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

function DonutTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
  return (
    <div className="neo-card rounded-xl px-3 py-2 text-xs border border-white/10 backdrop-blur-md shadow-lg">
      <p style={{ color: p.payload.color }} className="font-semibold mb-0.5">
        {p.name}
      </p>
      <p className="text-white/70">
        ${Number(p.value).toLocaleString()} · {pct}%
      </p>
    </div>
  );
}
