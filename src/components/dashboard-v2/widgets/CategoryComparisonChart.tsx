"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import type { TransactionWithAccount } from "@/lib/utils/incomeExpense";
import { format, parseISO } from "date-fns";
import { ChevronDown, Layers, LayoutGrid } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#34d399", // emerald
  "#f472b6", // pink
  "#fbbf24", // amber
  "#60a5fa", // blue
  "#fb923c", // orange
  "#e879f9", // fuchsia
  "#4ade80", // green
  "#f43f5e", // rose
];

const OTHER_COLOR = "#64748b";

// ── Config ────────────────────────────────────────────────────────────────────
type Mode = "categories" | "subcategories";
type TopN = 5 | 8 | 10 | 999;
const TOP_N_OPTIONS: { value: TopN; label: string }[] = [
  { value: 5, label: "Top 5" },
  { value: 8, label: "Top 8" },
  { value: 10, label: "Top 10" },
  { value: 999, label: "All" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type ChartRow = Record<string, string | number>;

type Props = {
  months: MonthlyAnalytics[] | undefined;
  transactions?: TransactionWithAccount[];
  activeCategories?: string[];
  onCategoryClick?: (category: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function CategoryComparisonChart({
  months,
  transactions,
  activeCategories = [],
  onCategoryClick,
}: Props) {
  const [mode, setMode] = useState<Mode>("categories");
  const [topN, setTopN] = useState<TopN>(8);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Derive available parent categories (for subcategory dropdown) ──────────
  const parentCategories = useMemo(() => {
    if (!months) return [];
    const totals = new Map<string, number>();
    for (const m of months) {
      for (const c of m.categoryBreakdown) {
        totals.set(c.name, (totals.get(c.name) || 0) + c.amount);
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [months]);

  // Auto-select first active category or first parent when switching to subcategory mode
  const effectiveParent = useMemo(() => {
    if (mode !== "subcategories") return null;
    if (selectedParent) return selectedParent;
    if (activeCategories.length > 0) return activeCategories[0];
    return parentCategories[0] ?? null;
  }, [mode, selectedParent, activeCategories, parentCategories]);

  // ── Categories mode: build chart data from months ──────────────────────────
  const categoriesData = useMemo(() => {
    if (!months || months.length === 0 || mode !== "categories") {
      return {
        chartData: [] as ChartRow[],
        series: [] as string[],
        colorMap: {} as Record<string, string>,
      };
    }

    // Aggregate totals across all months
    const totals = new Map<string, number>();
    const colorFromData = new Map<string, string>();
    for (const m of months) {
      for (const c of m.categoryBreakdown) {
        totals.set(c.name, (totals.get(c.name) || 0) + c.amount);
        if (c.color && !colorFromData.has(c.name))
          colorFromData.set(c.name, c.color);
      }
    }

    // Sort by total, apply topN
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    const limit = topN === 999 ? sorted.length : topN;
    const topNames = sorted.slice(0, limit).map(([n]) => n);
    const hasOther = sorted.length > limit;

    // Assign colors
    const colorMap: Record<string, string> = {};
    topNames.forEach((name, i) => {
      colorMap[name] = colorFromData.get(name) || PALETTE[i % PALETTE.length];
    });
    if (hasOther) colorMap["Other"] = OTHER_COLOR;

    const series = hasOther ? [...topNames, "Other"] : topNames;

    // Build per-month rows
    const chartData: ChartRow[] = months.map((m) => {
      const row: ChartRow = { month: fmtMonth(m.month) };
      const breakdown = new Map(
        m.categoryBreakdown.map((c) => [c.name, c.amount]),
      );

      let otherSum = 0;
      for (const [name, amount] of breakdown) {
        if (topNames.includes(name)) {
          row[name] = amount;
        } else {
          otherSum += amount;
        }
      }
      for (const name of topNames) {
        if (!(name in row)) row[name] = 0;
      }
      if (hasOther) row["Other"] = otherSum;

      return row;
    });

    return { chartData, series, colorMap };
  }, [months, mode, topN]);

  // ── Subcategories mode: build chart data from transactions ─────────────────
  const subcategoriesData = useMemo(() => {
    if (mode !== "subcategories" || !transactions || !effectiveParent) {
      return {
        chartData: [] as ChartRow[],
        series: [] as string[],
        colorMap: {} as Record<string, string>,
      };
    }

    const filtered = transactions.filter(
      (t) => t.category === effectiveParent && Math.abs(t.amount) > 0,
    );

    if (filtered.length === 0) {
      return {
        chartData: [] as ChartRow[],
        series: [] as string[],
        colorMap: {} as Record<string, string>,
      };
    }

    // Group by month + subcategory
    const monthMap = new Map<string, Map<string, number>>();
    const subTotals = new Map<string, number>();

    for (const t of filtered) {
      const ym = t.date.slice(0, 7);
      const sub = t.subcategory || "(No subcategory)";
      const amount = Math.abs(t.amount);

      if (!monthMap.has(ym)) monthMap.set(ym, new Map());
      const mMap = monthMap.get(ym)!;
      mMap.set(sub, (mMap.get(sub) || 0) + amount);
      subTotals.set(sub, (subTotals.get(sub) || 0) + amount);
    }

    // Sort subcategories by total, apply topN
    const sorted = Array.from(subTotals.entries()).sort((a, b) => b[1] - a[1]);
    const limit = topN === 999 ? sorted.length : topN;
    const topSubs = sorted.slice(0, limit).map(([n]) => n);
    const hasOther = sorted.length > limit;

    const colorMap: Record<string, string> = {};
    topSubs.forEach((name, i) => {
      colorMap[name] = PALETTE[i % PALETTE.length];
    });
    if (hasOther) colorMap["Other"] = OTHER_COLOR;

    const series = hasOther ? [...topSubs, "Other"] : topSubs;

    const sortedMonths = Array.from(monthMap.keys()).sort();
    const chartData: ChartRow[] = sortedMonths.map((ym) => {
      const mMap = monthMap.get(ym)!;
      const row: ChartRow = { month: fmtMonth(ym) };

      let otherSum = 0;
      for (const [sub, amount] of mMap) {
        if (topSubs.includes(sub)) {
          row[sub] = amount;
        } else {
          otherSum += amount;
        }
      }
      for (const sub of topSubs) {
        if (!(sub in row)) row[sub] = 0;
      }
      if (hasOther) row["Other"] = otherSum;

      return row;
    });

    return { chartData, series, colorMap };
  }, [mode, transactions, effectiveParent, topN]);

  // ── Active data ────────────────────────────────────────────────────────────
  const { chartData, series, colorMap } =
    mode === "categories" ? categoriesData : subcategoriesData;

  const visibleSeries = useMemo(
    () => series.filter((s) => !hiddenSeries.has(s)),
    [series, hiddenSeries],
  );

  // ── Legend toggle ──────────────────────────────────────────────────────────
  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Mode switch ────────────────────────────────────────────────────────────
  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setHiddenSeries(new Set());
      if (m === "subcategories" && !selectedParent) {
        setSelectedParent(activeCategories[0] || parentCategories[0] || null);
      }
    },
    [activeCategories, parentCategories, selectedParent],
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!chartData.length || series.length === 0) {
    return (
      <WidgetCard title="Category Comparison">
        <p className="text-white/40 text-xs text-center py-8">
          {mode === "subcategories" && effectiveParent
            ? `No subcategory data for "${effectiveParent}"`
            : "No category data yet"}
        </p>
      </WidgetCard>
    );
  }

  // ── Compute dynamic bar sizing ─────────────────────────────────────────────
  const monthCount = chartData.length;
  const barCount = visibleSeries.length;
  const minGroupWidth = Math.max(80, barCount * 16 + 24);
  const chartMinWidth = monthCount * minGroupWidth;
  const needsScroll = monthCount > 6 && barCount > 4;

  return (
    <WidgetCard
      interactive
      title="Category Comparison"
      subtitle={
        mode === "subcategories" && effectiveParent
          ? `Subcategories of "${effectiveParent}" across months`
          : "Category spending side-by-side across months"
      }
      filterActive={activeCategories.length > 0}
      action={
        <div className="flex items-center gap-1.5">
          {TOP_N_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setTopN(opt.value);
                setHiddenSeries(new Set());
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                topN === opt.value
                  ? "bg-white/15 text-white"
                  : "text-white/30 hover:text-white/50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      {/* ── Controls: Mode toggle + Parent dropdown ────────────────────────── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Mode toggle */}
        <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => switchMode("categories")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mode === "categories"
                ? "bg-white/15 text-white shadow-sm"
                : "text-white/40 hover:text-white/60",
            )}
          >
            <LayoutGrid className="w-3 h-3" />
            Categories
          </button>
          <button
            onClick={() => switchMode("subcategories")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mode === "subcategories"
                ? "bg-white/15 text-white shadow-sm"
                : "text-white/40 hover:text-white/60",
            )}
          >
            <Layers className="w-3 h-3" />
            Subcategories
          </button>
        </div>

        {/* Parent category dropdown (subcategory mode only) */}
        {mode === "subcategories" && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 transition-colors min-w-[140px]"
            >
              <span className="truncate">
                {effectiveParent || "Select category"}
              </span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 shrink-0 transition-transform",
                  dropdownOpen && "rotate-180",
                )}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-40 w-56 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[var(--theme-bg)] shadow-2xl shadow-black/50 py-1">
                {parentCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedParent(cat);
                      setHiddenSeries(new Set());
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs transition-colors",
                      effectiveParent === cat
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/60 hover:bg-white/5 hover:text-white/80",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      <div
        className={cn("relative", needsScroll && "overflow-x-auto pb-2")}
        style={needsScroll ? { WebkitOverflowScrolling: "touch" } : undefined}
      >
        <div
          className="h-[320px]"
          style={needsScroll ? { minWidth: chartMinWidth } : undefined}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 4, left: -8 }}
              barCategoryGap="18%"
              barGap={2}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtAmount}
                width={48}
              />
              <Tooltip
                content={
                  <CustomTooltip
                    colorMap={colorMap}
                    hiddenSeries={hiddenSeries}
                  />
                }
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {visibleSeries.map((name) => {
                const isDimmed =
                  activeCategories.length > 0 &&
                  !activeCategories.includes(name) &&
                  name !== "Other";

                return (
                  <Bar
                    key={name}
                    dataKey={name}
                    fill={colorMap[name] || PALETTE[0]}
                    radius={[4, 4, 0, 0]}
                    opacity={isDimmed ? 0.2 : 0.85}
                    animationDuration={600}
                    animationEasing="ease-out"
                    cursor="pointer"
                    onClick={() => {
                      if (name !== "Other") onCategoryClick?.(name);
                    }}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mt-3 pt-2 border-t border-white/5">
        {series.map((name) => {
          const isHidden = hiddenSeries.has(name);
          const isDimmed =
            activeCategories.length > 0 &&
            !activeCategories.includes(name) &&
            name !== "Other";

          return (
            <button
              key={name}
              onClick={() => toggleSeries(name)}
              onDoubleClick={() => {
                if (name !== "Other") onCategoryClick?.(name);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs",
                isHidden
                  ? "opacity-30 line-through"
                  : isDimmed
                    ? "opacity-40"
                    : "opacity-100 hover:bg-white/5",
              )}
              title={
                isHidden
                  ? `Show ${name}`
                  : `Hide ${name} · Double-click to filter`
              }
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 transition-transform"
                style={{
                  backgroundColor: isHidden
                    ? "rgba(255,255,255,0.15)"
                    : colorMap[name],
                  boxShadow: isHidden ? "none" : `0 0 6px ${colorMap[name]}40`,
                }}
              />
              <span
                className={cn(
                  "truncate max-w-[100px]",
                  isHidden ? "text-white/30" : "text-white/70",
                )}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
  label,
  colorMap,
  hiddenSeries,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string }>;
  label?: string;
  colorMap: Record<string, string>;
  hiddenSeries: Set<string>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const items = [...payload]
    .filter((p) => !hiddenSeries.has(p.dataKey) && (p.value as number) > 0)
    .sort((a, b) => (b.value as number) - (a.value as number));

  if (items.length === 0) return null;

  const total = items.reduce((sum, p) => sum + (p.value as number), 0);

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--theme-bg)] shadow-xl shadow-black/40 px-3 py-2.5 min-w-[180px] max-w-[260px]">
      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-medium">
        {label}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{
                backgroundColor: colorMap[item.dataKey] || PALETTE[0],
                boxShadow: `0 0 4px ${colorMap[item.dataKey] || PALETTE[0]}40`,
              }}
            />
            <span className="text-white/60 truncate flex-1">
              {item.dataKey}
            </span>
            <span className="text-white font-semibold tabular-nums">
              $
              {(item.value as number).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-xs">
          <span className="text-white/40">Total</span>
          <span className="text-white font-bold tabular-nums">
            ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMonth(ym: string): string {
  try {
    return format(parseISO(`${ym}-01`), "MMM yy");
  } catch {
    return ym;
  }
}

function fmtAmount(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n > 0) return `$${Math.round(n)}`;
  return "$0";
}
