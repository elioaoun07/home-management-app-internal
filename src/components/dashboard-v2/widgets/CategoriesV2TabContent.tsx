"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
import { useCallback, useMemo, useState } from "react";
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
  background: "rgba(15,15,25,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  fontSize: "13px",
  padding: "10px 14px",
} as const;

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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white/40 tracking-wide">
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
        <div className="flex items-center gap-2">
          {/* Total badge */}
          <BlurredAmount blurIntensity="sm">
            <span
              className="text-sm font-bold tabular-nums"
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
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                  showSubs
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10",
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
        className="h-0.5 rounded-full mb-3 opacity-60"
        style={{
          background: `linear-gradient(90deg, ${category.color}, transparent)`,
        }}
      />

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {showSubs && stackedData ? (
            <BarChart data={stackedData} barCategoryGap="18%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => fmtDollar(v)}
                width={50}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
                formatter={(value: any, name: any) => [
                  `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                  name,
                ]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              {subEntries.map((sub, idx) => (
                <Bar
                  key={sub.name}
                  dataKey={sub.name}
                  stackId="subs"
                  fill={sub.color}
                  radius={
                    idx === subEntries.length - 1 ? [4, 4, 0, 0] : undefined
                  }
                />
              ))}
            </BarChart>
          ) : (
            <BarChart data={category.monthlyData} barCategoryGap="18%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => fmtDollar(v)}
                width={50}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
                formatter={(value: any) => [
                  `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                  category.name,
                ]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar
                dataKey="amount"
                fill={category.color}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Subcategory legend (when in subcategory view) */}
      {showSubs && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
          {subEntries.map((sub) => (
            <div key={sub.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: sub.color }}
              />
              <span className="text-[11px] text-white/50">{sub.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[11px] text-white/30">
          Monthly avg:{" "}
          <span className="text-white/50 tabular-nums">{fmtDollar(avg)}</span>
        </span>
        <span className="text-[11px] text-white/30">
          {category.monthlyData.filter((m) => m.amount > 0).length} active
          months
        </span>
      </div>
    </WidgetCard>
  );
}
