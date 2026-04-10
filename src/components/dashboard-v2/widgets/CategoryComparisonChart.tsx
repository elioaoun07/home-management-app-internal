"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import { useCallback, useMemo, useRef, useState } from "react";

const CHART_PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
];

type BarData = {
  month: string;
  categories: { name: string; amount: number; color: string }[];
};

type Props = {
  months: MonthlyAnalytics[] | undefined;
  activeCategories?: string[];
  onCategoryClick?: (category: string) => void;
};

export default function CategoryComparisonChart({
  months,
  activeCategories = [],
  onCategoryClick,
}: Props) {
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { barData, categoryColors, maxValue, categories } = useMemo(() => {
    if (!months || months.length === 0)
      return {
        barData: [],
        categoryColors: {} as Record<string, string>,
        maxValue: 0,
        categories: [] as string[],
      };

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

    let peak = 0;
    const bars: BarData[] = months.map((m) => {
      const cats = topCategories.map((catName) => {
        const cat = m.categoryBreakdown.find((c) => c.name === catName);
        const amount = cat?.amount || 0;
        if (amount > peak) peak = amount;
        return { name: catName, amount, color: colors[catName] };
      });
      return { month: formatMonth(m.month), categories: cats };
    });

    return {
      barData: bars,
      categoryColors: colors,
      maxValue: peak,
      categories: topCategories,
    };
  }, [months]);

  const handleBarHover = useCallback(
    (e: React.MouseEvent, month: string, cat: string) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
      });
      setHoveredCat(cat);
      setSelectedMonth(month);
    },
    [],
  );

  const handleBarLeave = useCallback(() => {
    setTooltipPos(null);
    setHoveredCat(null);
    setSelectedMonth(null);
  }, []);

  if (!barData.length || categories.length === 0) {
    return (
      <WidgetCard title="Category Trends">
        <p className="text-white/40 text-xs text-center py-8">
          No category data yet
        </p>
      </WidgetCard>
    );
  }

  // Y-axis ticks
  const yTicks = getYTicks(maxValue);
  const chartMax = yTicks[yTicks.length - 1] || maxValue || 1;

  const tooltipData =
    selectedMonth && hoveredCat
      ? barData
          .find((b) => b.month === selectedMonth)
          ?.categories.find((c) => c.name === hoveredCat)
      : null;

  return (
    <WidgetCard
      interactive
      title="Category Trends"
      subtitle="Monthly spending per category"
      filterActive={activeCategories.length > 0}
    >
      <div ref={containerRef} className="relative">
        {/* Chart area */}
        <div className="flex">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between pr-2 py-1 shrink-0 w-10">
            {[...yTicks].reverse().map((tick) => (
              <span
                key={tick}
                className="text-[10px] text-white/35 tabular-nums text-right leading-none"
              >
                {formatAmount(tick)}
              </span>
            ))}
          </div>

          {/* Bar groups */}
          <div className="flex-1 overflow-x-auto">
            <div
              className="flex gap-1 min-w-0"
              style={{ minWidth: barData.length * 60 }}
            >
              {barData.map((group) => (
                <div key={group.month} className="flex-1 min-w-[50px]">
                  {/* Bars container */}
                  <div
                    className="flex items-end gap-[3px] h-[200px] px-0.5"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(to top, transparent, transparent calc(25% - 1px), rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.04) calc(25% + 1px))",
                    }}
                  >
                    {group.categories.map((cat) => {
                      const heightPct =
                        chartMax > 0
                          ? Math.max((cat.amount / chartMax) * 100, 0.5)
                          : 0;
                      const isFiltered =
                        activeCategories.length > 0 &&
                        !activeCategories.includes(cat.name);
                      const isHovered =
                        hoveredCat === cat.name &&
                        selectedMonth === group.month;
                      const isDimmed =
                        isFiltered ||
                        (hoveredCat !== null && hoveredCat !== cat.name);

                      return (
                        <button
                          key={cat.name}
                          className="flex-1 relative rounded-t-md cursor-pointer group"
                          style={{
                            height: `${heightPct}%`,
                            transition:
                              "height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.2s, transform 0.2s",
                            opacity: isDimmed ? 0.25 : 1,
                            transform: isHovered ? "scaleY(1.03)" : "scaleY(1)",
                            transformOrigin: "bottom",
                          }}
                          onMouseEnter={(e) =>
                            handleBarHover(e, group.month, cat.name)
                          }
                          onMouseMove={(e) =>
                            handleBarHover(e, group.month, cat.name)
                          }
                          onMouseLeave={handleBarLeave}
                          onClick={() => onCategoryClick?.(cat.name)}
                        >
                          {/* Bar face */}
                          <div
                            className="absolute inset-0 rounded-t-md"
                            style={{
                              background: `linear-gradient(to top, ${cat.color}CC, ${cat.color}90)`,
                              boxShadow: isHovered
                                ? `4px 4px 0 0 ${cat.color}40, inset 0 1px 0 ${cat.color}60, 0 0 12px ${cat.color}30`
                                : `3px 3px 0 0 ${cat.color}25, inset 0 1px 0 ${cat.color}40`,
                              borderRight: `1px solid ${cat.color}20`,
                              borderTop: `1px solid ${cat.color}50`,
                            }}
                          />
                          {/* Top highlight */}
                          <div
                            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-md"
                            style={{
                              background: `linear-gradient(to right, ${cat.color}80, ${cat.color}30)`,
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  {/* Month label */}
                  <div className="text-center mt-1.5">
                    <span className="text-[10px] text-white/40">
                      {group.month}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltipPos && tooltipData && (
          <div
            ref={tooltipRef}
            className="absolute z-30 pointer-events-none px-3 py-2 rounded-xl border border-white/10 bg-[var(--theme-bg)] shadow-xl shadow-black/40"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: tooltipData.color,
                  boxShadow: `0 0 6px ${tooltipData.color}60`,
                }}
              />
              <span className="text-white/70 truncate max-w-[100px]">
                {tooltipData.name}
              </span>
              <span className="font-semibold text-white tabular-nums ml-1">
                ${tooltipData.amount.toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">{selectedMonth}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
        {categories.map((cat) => {
          const isFiltered =
            activeCategories.length > 0 && !activeCategories.includes(cat);
          const isHovered = hoveredCat === cat;
          return (
            <button
              key={cat}
              className={cn(
                "flex items-center gap-1.5 transition-all",
                isFiltered ? "opacity-30" : "opacity-100",
              )}
              onMouseEnter={() => setHoveredCat(cat)}
              onMouseLeave={() => setHoveredCat(null)}
              onClick={() => onCategoryClick?.(cat)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full ring-1 ring-white/10 transition-transform"
                style={{
                  backgroundColor: categoryColors[cat],
                  boxShadow: isFiltered
                    ? "none"
                    : `0 0 6px ${categoryColors[cat]}50`,
                  transform: isHovered ? "scale(1.4)" : "scale(1)",
                }}
              />
              <span
                className={cn(
                  "text-[11px] truncate max-w-[80px] transition-colors",
                  isHovered ? "text-white font-medium" : "text-white/60",
                )}
              >
                {cat}
              </span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
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

function getYTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find((n) => n * mag >= raw) ?? 10;
  const step = nice * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.5; v += step) {
    ticks.push(Math.round(v));
    if (ticks.length >= 6) break;
  }
  return ticks;
}
