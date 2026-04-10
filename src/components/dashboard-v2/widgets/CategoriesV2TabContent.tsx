"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
import { useCallback, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

type Transaction = {
  amount: number;
  date: string;
  category?: string | null;
  subcategory?: string | null;
  category_color?: string | null;
};

type Props = {
  transactions: Transaction[];
};

type MonthBucket = { key: string; label: string };

type CategoryMonthly = {
  name: string;
  color: string;
  total: number;
  count: number;
  monthlyData: { month: string; label: string; amount: number }[];
  subcategories: SubcategoryMonthly[];
};

type SubcategoryMonthly = {
  name: string;
  color: string;
  total: number;
  monthlyData: { month: string; label: string; amount: number }[];
};

// ── Palette for subcategories ─────────────────────────────────────────────────

const SUB_PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
  "#4ade80",
  "#f87171",
  "#38bdf8",
  "#c084fc",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  if (n >= 10_000) return `$${(n / 1000).toFixed(0)}k`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

/** Build 12 month buckets ending at the current month */
function build12Months(): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    buckets.push({
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM yy"),
    });
  }
  return buckets;
}

// ── Tooltip styling ─────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "rgba(10,12,20,0.96)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: 500,
  padding: "12px 16px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
  backdropFilter: "blur(12px)",
} as const;

/** SVG defs for outlined bars with luminous glow */
function ChartDefs({ id, color }: { id: string; color: string }) {
  const bright = lightenHex(color, 30);
  return (
    <defs>
      {/* Inner fill: rich translucent gradient */}
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bright} stopOpacity={0.45} />
        <stop offset="50%" stopColor={color} stopOpacity={0.22} />
        <stop offset="100%" stopColor={color} stopOpacity={0.1} />
      </linearGradient>
      {/* Top highlight shimmer — brighter, wider */}
      <linearGradient id={`${id}-highlight`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
        <stop offset="20%" stopColor="#fff" stopOpacity={0.1} />
        <stop offset="50%" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
      {/* Outer glow — wider, stronger */}
      <filter id={`${id}-glow`} x="-40%" y="-15%" width="180%" height="130%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** Custom bar shape: outlined rectangle with inner glow fill + top highlight */
function OutlinedBar({
  x,
  y,
  width,
  height,
  fillId,
  highlightId,
  filterId,
  strokeColor,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fillId: string;
  highlightId: string;
  filterId: string;
  strokeColor: string;
}) {
  if (!height || height <= 0) return null;
  const r = Math.min(5, width / 2, height);
  const bright = lightenHex(strokeColor, 25);
  return (
    <g filter={`url(#${filterId})`}>
      {/* Main translucent fill */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={r}
        ry={r}
        fill={`url(#${fillId})`}
      />
      {/* Top shimmer overlay — covers upper half */}
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.min(height, height * 0.55)}
        rx={r}
        ry={r}
        fill={`url(#${highlightId})`}
      />
      {/* Inner vertical side highlights */}
      <rect
        x={x}
        y={y}
        width={2}
        height={height}
        rx={1}
        fill={strokeColor}
        fillOpacity={0.15}
      />
      <rect
        x={x + width - 2}
        y={y}
        width={2}
        height={height}
        rx={1}
        fill={strokeColor}
        fillOpacity={0.08}
      />
      {/* Crisp outline — brighter */}
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={width - 1}
        height={height - 1}
        rx={r}
        ry={r}
        fill="none"
        stroke={bright}
        strokeWidth={1.3}
        strokeOpacity={0.7}
      />
      {/* Bright top edge accent — glowing */}
      <line
        x1={x + r}
        y1={y + 0.5}
        x2={x + width - r}
        y2={y + 0.5}
        stroke={bright}
        strokeWidth={2}
        strokeOpacity={0.9}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Lighten a hex color by a percentage */
function lightenHex(hex: string, pct: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round((255 * pct) / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 * pct) / 100));
  const b = Math.min(255, (num & 0xff) + Math.round((255 * pct) / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function CategoriesV2TabContent({ transactions }: Props) {
  const months = useMemo(() => build12Months(), []);
  const monthKeys = useMemo(() => new Set(months.map((m) => m.key)), [months]);

  // Toggle state: which categories are in "subcategory" view
  const [subcatView, setSubcatView] = useState<Set<string>>(new Set());

  const toggleView = useCallback((cat: string) => {
    setSubcatView((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // ── Aggregate transactions into per-category monthly data ──────────────

  const categories = useMemo(() => {
    const catMap = new Map<
      string,
      {
        color: string;
        total: number;
        count: number;
        months: Map<string, number>;
        subs: Map<
          string,
          { color: string; total: number; months: Map<string, number> }
        >;
      }
    >();

    for (const t of transactions) {
      const monthKey = t.date.slice(0, 7);
      if (!monthKeys.has(monthKey)) continue;

      const cat = t.category || "Uncategorized";
      const sub = t.subcategory || null;
      const amt = Math.abs(t.amount);

      if (!catMap.has(cat)) {
        catMap.set(cat, {
          color: t.category_color || "#64748b",
          total: 0,
          count: 0,
          months: new Map(),
          subs: new Map(),
        });
      }
      const entry = catMap.get(cat)!;
      entry.total += amt;
      entry.count += 1;
      entry.months.set(monthKey, (entry.months.get(monthKey) ?? 0) + amt);

      if (sub) {
        if (!entry.subs.has(sub)) {
          entry.subs.set(sub, {
            color: "",
            total: 0,
            months: new Map(),
          });
        }
        const se = entry.subs.get(sub)!;
        se.total += amt;
        se.months.set(monthKey, (se.months.get(monthKey) ?? 0) + amt);
      }
    }

    // Build sorted result
    const result: CategoryMonthly[] = [];

    for (const [name, data] of catMap) {
      if (data.total <= 0) continue;

      // Assign palette colors to subcategories
      const subEntries = Array.from(data.subs.entries()).sort(
        (a, b) => b[1].total - a[1].total,
      );

      const subcategories: SubcategoryMonthly[] = subEntries.map(
        ([subName, subData], idx) => ({
          name: subName,
          color: SUB_PALETTE[idx % SUB_PALETTE.length],
          total: subData.total,
          monthlyData: months.map((m) => ({
            month: m.key,
            label: m.label,
            amount: subData.months.get(m.key) ?? 0,
          })),
        }),
      );

      result.push({
        name,
        color: data.color,
        total: data.total,
        count: data.count,
        monthlyData: months.map((m) => ({
          month: m.key,
          label: m.label,
          amount: data.months.get(m.key) ?? 0,
        })),
        subcategories,
      });
    }

    result.sort((a, b) => b.total - a.total);
    return result;
  }, [transactions, months, monthKeys]);

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 text-white/40 text-sm">
        No expense data in the last 12 months
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period info */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 tracking-wide font-medium">
        <span>
          {months[0].label} — {months[months.length - 1].label} · 12 months ·{" "}
          {categories.length} categories
        </span>
      </div>

      {/* One widget per category */}
      {categories.map((cat) => (
        <CategoryWidget
          key={cat.name}
          category={cat}
          isSubcatView={subcatView.has(cat.name)}
          onToggleView={() => toggleView(cat.name)}
        />
      ))}
    </div>
  );
}

// ── Per-Category Widget ─────────────────────────────────────────────────────

function CategoryWidget({
  category,
  isSubcatView,
  onToggleView,
}: {
  category: CategoryMonthly;
  isSubcatView: boolean;
  onToggleView: () => void;
}) {
  const hasSubs = category.subcategories.length > 0;
  const showSubs = isSubcatView && hasSubs;

  const avg = useMemo(() => {
    const nonZero = category.monthlyData.filter((m) => m.amount > 0);
    return nonZero.length > 0
      ? nonZero.reduce((s, m) => s + m.amount, 0) / nonZero.length
      : 0;
  }, [category.monthlyData]);

  // Build chart data for subcategory stacked view
  const stackedData = useMemo(() => {
    if (!showSubs) return null;
    return category.monthlyData.map((m, i) => {
      const row: Record<string, string | number> = {
        label: m.label,
        month: m.month,
      };
      for (const sub of category.subcategories) {
        row[sub.name] = sub.monthlyData[i].amount;
      }
      // Add "Other" for uncategorized portion
      const subTotal = category.subcategories.reduce(
        (s, sub) => s + sub.monthlyData[i].amount,
        0,
      );
      const other = m.amount - subTotal;
      if (other > 0.01) {
        row["Other"] = other;
      }
      return row;
    });
  }, [showSubs, category]);

  // Subcategory names/colors (including "Other" if needed)
  const subEntries = useMemo(() => {
    if (!showSubs) return [];
    const entries = category.subcategories.map((s) => ({
      name: s.name,
      color: s.color,
    }));
    // Check if there's any "Other" amount
    const hasOther = category.monthlyData.some((m, i) => {
      const subTotal = category.subcategories.reduce(
        (s, sub) => s + sub.monthlyData[i].amount,
        0,
      );
      return m.amount - subTotal > 0.01;
    });
    if (hasOther) {
      entries.push({ name: "Other", color: "#475569" });
    }
    return entries;
  }, [showSubs, category]);

  return (
    <WidgetCard
      title={category.name}
      subtitle={`${category.count} transactions · avg ${fmtDollar(avg)}/mo`}
      action={
        <div className="flex items-center gap-2.5">
          {/* Total badge */}
          <BlurredAmount blurIntensity="sm">
            <span
              className="text-[15px] font-bold tabular-nums tracking-tight"
              style={{ color: category.color }}
            >
              {fmtDollar(category.total)}
            </span>
          </BlurredAmount>

          {/* Toggle button */}
          {hasSubs && (
            <>
              <div className="w-px h-4 bg-white/10" />
              <button
                onClick={onToggleView}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                  showSubs
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-white/50 hover:text-white/70 hover:bg-white/10",
                )}
              >
                {showSubs ? "Subcategories" : "Category"}
              </button>
            </>
          )}
        </div>
      }
    >
      {/* Color accent bar */}
      <div
        className="h-[3px] rounded-full mb-4"
        style={{
          background: `linear-gradient(90deg, ${category.color}cc, ${category.color}40 60%, transparent)`,
        }}
      />

      {/* Chart */}
      <CategoryChart
        category={category}
        showSubs={showSubs}
        stackedData={stackedData}
        subEntries={subEntries}
      />

      {/* Subcategory legend (when in subcategory view) */}
      {showSubs && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 px-1">
          {subEntries.map((sub) => (
            <div key={sub.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${lightenHex(sub.color, 15)}, ${sub.color})`,
                }}
              />
              <span className="text-xs text-white/65 font-medium">
                {sub.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-xs text-white/45 font-medium">
          Monthly avg:{" "}
          <span className="text-white/70 tabular-nums font-semibold">
            {fmtDollar(avg)}
          </span>
        </span>
        <span className="text-xs text-white/45 font-medium">
          <span className="text-white/70 tabular-nums font-semibold">
            {category.monthlyData.filter((m) => m.amount > 0).length}
          </span>{" "}
          active months
        </span>
      </div>
    </WidgetCard>
  );
}

// ── Chart with Outlined Glow Bars ───────────────────────────────────────────

function CategoryChart({
  category,
  showSubs,
  stackedData,
  subEntries,
}: {
  category: CategoryMonthly;
  showSubs: boolean;
  stackedData: Record<string, string | number>[] | null;
  subEntries: { name: string; color: string }[];
}) {
  const uid = useId().replace(/:/g, "");

  const commonAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
  };

  const tooltipProps = {
    contentStyle: TOOLTIP_STYLE,
    labelStyle: {
      color: "rgba(255,255,255,0.7)",
      fontWeight: 600,
      marginBottom: 6,
      fontSize: 13,
    } as const,
    itemStyle: { color: "rgba(255,255,255,0.85)", fontWeight: 500 } as const,
    cursor: { fill: "rgba(255,255,255,0.04)", radius: 4 } as const,
  };

  const xAxisProps = {
    dataKey: "label" as const,
    tick: { fill: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 },
    ...commonAxisProps,
    tickMargin: 8,
  };

  const yAxisProps = {
    tick: { fill: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500 },
    ...commonAxisProps,
    tickFormatter: (v: number) => fmtDollar(v),
    width: 52,
    tickMargin: 4,
  };

  // ── Stacked subcategory view ──────────────────────────────────────────
  if (showSubs && stackedData) {
    return (
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stackedData} barCategoryGap="20%">
            {/* One set of defs per subcategory color */}
            {subEntries.map((sub, i) => (
              <ChartDefs key={sub.name} id={`${uid}-s${i}`} color={sub.color} />
            ))}
            <CartesianGrid
              strokeDasharray="3 6"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              {...tooltipProps}
              formatter={(value: any, name: any) => [
                `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                name,
              ]}
            />
            {subEntries.map((sub, i) => (
              <Bar
                key={sub.name}
                dataKey={sub.name}
                stackId="subs"
                fill="transparent"
                shape={(props: any) => (
                  <OutlinedBar
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    fillId={`${uid}-s${i}-fill`}
                    highlightId={`${uid}-s${i}-highlight`}
                    filterId={`${uid}-s${i}-glow`}
                    strokeColor={sub.color}
                  />
                )}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Single category view ──────────────────────────────────────────────
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={category.monthlyData} barCategoryGap="20%">
          <ChartDefs id={uid} color={category.color} />
          <CartesianGrid
            strokeDasharray="3 6"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip
            {...tooltipProps}
            formatter={(value: any) => [
              `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
              category.name,
            ]}
          />
          <Bar
            dataKey="amount"
            fill="transparent"
            shape={(props: any) => (
              <OutlinedBar
                x={props.x}
                y={props.y}
                width={props.width}
                height={props.height}
                fillId={`${uid}-fill`}
                highlightId={`${uid}-highlight`}
                filterId={`${uid}-glow`}
                strokeColor={category.color}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
