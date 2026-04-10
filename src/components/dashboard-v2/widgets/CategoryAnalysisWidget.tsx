"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

// ── Constants ────────────────────────────────────────────────────────────────
const ACCENT = "#00C4B4";
const PALETTE = [
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
  "#818cf8",
  "#facc15",
];
const MAX_BARS = 6;
const BAR_DEPTH = 6;

// ── Types ────────────────────────────────────────────────────────────────────
type Transaction = {
  amount: number;
  date: string;
  category?: string | null;
  subcategory?: string | null;
  category_color?: string | null;
};

type PeriodGrouping = "month" | "quarter" | "year";
type BarLayout = "grouped" | "overlapping";

type CategoryData = {
  name: string;
  color: string;
  total: number;
  percent: number;
  count: number;
  avg: number;
  subcategories: {
    name: string;
    total: number;
    percent: number;
    count: number;
  }[];
};

type PeriodBucket = {
  key: string;
  label: string;
  totals: Record<string, number>;
  grandTotal: number;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getPeriodKey(date: string, grouping: PeriodGrouping) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (grouping) {
    case "month":
      return `${y}-${String(m + 1).padStart(2, "0")}`;
    case "quarter":
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case "year":
      return `${y}`;
  }
}

function periodLabel(key: string, grouping: PeriodGrouping) {
  const MO = [
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
  switch (grouping) {
    case "month": {
      const [y, m] = key.split("-");
      return `${MO[+m - 1]} '${y.slice(2)}`;
    }
    case "quarter":
      return key.replace("-", " '").replace("20", "");
    case "year":
      return key;
  }
}

function fmt(n: number) {
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

/** Build a hex opacity suffix (00–FF) from a float 0–1 */
function hexOp(opacity: number) {
  return Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function CategoryAnalysisWidget({
  transactions,
  startDate,
  endDate,
}: Props) {
  const [grouping, setGrouping] = useState<PeriodGrouping>("month");
  const [barLayout, setBarLayout] = useState<BarLayout>("grouped");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);

  // ── Categories ─────────────────────────────────────────────────────────────
  const { categories, colorMap, grandTotal } = useMemo(() => {
    const catMap = new Map<
      string,
      {
        color: string;
        total: number;
        count: number;
        subs: Map<string, { total: number; count: number }>;
      }
    >();

    for (const t of transactions) {
      const cat = t.category || "Uncategorized";
      const amt = Math.abs(t.amount);
      if (!catMap.has(cat))
        catMap.set(cat, {
          color: (t as any).category_color || "#64748b",
          total: 0,
          count: 0,
          subs: new Map(),
        });
      const e = catMap.get(cat)!;
      e.total += amt;
      e.count++;
      if (t.subcategory) {
        if (!e.subs.has(t.subcategory))
          e.subs.set(t.subcategory, { total: 0, count: 0 });
        const s = e.subs.get(t.subcategory)!;
        s.total += amt;
        s.count++;
      }
    }

    const gt = [...catMap.values()].reduce((s, c) => s + c.total, 0);
    const colorMap: Record<string, string> = {};
    const categories: CategoryData[] = [...catMap.entries()]
      .map(([name, d], i) => {
        const color =
          d.color !== "#64748b" ? d.color : PALETTE[i % PALETTE.length];
        colorMap[name] = color;
        return {
          name,
          color,
          total: d.total,
          count: d.count,
          percent: gt > 0 ? (d.total / gt) * 100 : 0,
          avg: d.count > 0 ? d.total / d.count : 0,
          subcategories: [...d.subs.entries()]
            .map(([sn, sd]) => ({
              name: sn,
              total: sd.total,
              count: sd.count,
              percent: d.total > 0 ? (sd.total / d.total) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total),
        };
      })
      .sort((a, b) => b.total - a.total);

    return { categories, colorMap, grandTotal: gt };
  }, [transactions]);

  // ── Period Buckets ─────────────────────────────────────────────────────────
  const periods = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const t of transactions) {
      const key = getPeriodKey(t.date, grouping);
      const cat = t.category || "Uncategorized";
      const amt = Math.abs(t.amount);
      if (!map.has(key)) map.set(key, {});
      const b = map.get(key)!;
      b[cat] = (b[cat] || 0) + amt;
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, totals]): PeriodBucket => ({
          key,
          label: periodLabel(key, grouping),
          totals,
          grandTotal: Object.values(totals).reduce((s, v) => s + v, 0),
        }),
      );
  }, [transactions, grouping]);

  // ── Comparison Pair ────────────────────────────────────────────────────────
  const maxOffset = Math.max(0, periods.length - 2);
  const safeOffset = Math.min(periodOffset, maxOffset);
  const currentIdx = periods.length - 1 - safeOffset;
  const previousIdx = currentIdx - 1;
  const currentPeriod = periods[currentIdx] ?? null;
  const previousPeriod = periods[previousIdx] ?? null;

  // ── Per-category comparison (top N) ────────────────────────────────────────
  const topCats = categories.slice(0, MAX_BARS);

  const comparisons = useMemo(() => {
    return topCats.map((cat) => {
      const curr = currentPeriod?.totals[cat.name] ?? 0;
      const prev = previousPeriod?.totals[cat.name] ?? 0;
      return {
        name: cat.name,
        color: colorMap[cat.name],
        curr,
        prev,
        change: pctChange(curr, prev),
      };
    });
  }, [topCats, currentPeriod, previousPeriod, colorMap]);

  // ── All categories comparison (for rankings) ──────────────────────────────
  const allComparisons = useMemo(() => {
    return categories.map((cat) => {
      const curr = currentPeriod?.totals[cat.name] ?? 0;
      const prev = previousPeriod?.totals[cat.name] ?? 0;
      return { ...cat, curr, prev, change: pctChange(curr, prev) };
    });
  }, [categories, currentPeriod, previousPeriod]);

  // ── KPI data ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const currTotal = currentPeriod?.grandTotal ?? 0;
    const prevTotal = previousPeriod?.grandTotal ?? 0;
    const totalChange = pctChange(currTotal, prevTotal);
    const topCat = allComparisons[0] || null;
    const biggestChange =
      [...allComparisons]
        .filter((c) => c.prev > 0)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0] || null;
    return { currTotal, prevTotal, totalChange, topCat, biggestChange };
  }, [allComparisons, currentPeriod, previousPeriod]);

  // ── Max bar value ──────────────────────────────────────────────────────────
  const maxBarValue = useMemo(() => {
    return Math.max(...comparisons.flatMap((c) => [c.curr, c.prev]), 1);
  }, [comparisons]);

  // ── Category sparklines ────────────────────────────────────────────────────
  const sparklines = useMemo(() => {
    const result: Record<string, { value: number }[]> = {};
    for (const cat of topCats) {
      result[cat.name] = periods.map((p) => ({
        value: p.totals[cat.name] || 0,
      }));
    }
    return result;
  }, [topCats, periods]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (transactions.length === 0) {
    return (
      <WidgetCard title="Category Analysis">
        <p className="text-white/40 text-xs text-center py-12">
          No expense data for this period
        </p>
      </WidgetCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ KPI ROW ═══ */}
      <div className="grid grid-cols-3 gap-2.5">
        <GlassKPI
          label="Total Spend"
          value={kpis.currTotal}
          change={kpis.totalChange}
          prevValue={kpis.prevTotal}
          accent={ACCENT}
        />
        <GlassKPI
          label="Top Category"
          value={kpis.topCat?.curr ?? 0}
          change={kpis.topCat?.change ?? 0}
          subtitle={kpis.topCat?.name}
          accent={kpis.topCat ? colorMap[kpis.topCat.name] : ACCENT}
        />
        <GlassKPI
          label="Biggest Shift"
          value={kpis.biggestChange?.curr ?? 0}
          change={kpis.biggestChange?.change ?? 0}
          subtitle={kpis.biggestChange?.name}
          accent={
            kpis.biggestChange ? colorMap[kpis.biggestChange.name] : ACCENT
          }
        />
      </div>

      {/* ═══ CONTROLS ═══ */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Period grouping */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">
            Period
          </span>
          <div className="flex gap-0.5 p-0.5 bg-white/5 rounded-lg border border-white/5">
            {(["month", "quarter", "year"] as PeriodGrouping[]).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGrouping(g);
                  setPeriodOffset(0);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize",
                  grouping === g
                    ? "bg-white/15 text-white"
                    : "text-white/35 hover:text-white/60",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Period navigator */}
        {periods.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPeriodOffset((o) => Math.min(o + 1, maxOffset))}
              disabled={safeOffset >= maxOffset}
              className="p-1 rounded-md text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-white/50 font-medium min-w-[130px] text-center">
              {previousPeriod?.label ?? "—"} vs {currentPeriod?.label ?? "—"}
            </span>
            <button
              onClick={() => setPeriodOffset((o) => Math.max(o - 1, 0))}
              disabled={safeOffset <= 0}
              className="p-1 rounded-md text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bar layout toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">
            Layout
          </span>
          <div className="flex gap-0.5 p-0.5 bg-white/5 rounded-lg border border-white/5">
            {[
              { id: "grouped" as BarLayout, label: "Side" },
              { id: "overlapping" as BarLayout, label: "Layer" },
            ].map((l) => (
              <button
                key={l.id}
                onClick={() => setBarLayout(l.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  barLayout === l.id
                    ? "bg-white/15 text-white"
                    : "text-white/35 hover:text-white/60",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 3D BAR COMPARISON ═══ */}
      <WidgetCard
        title="Category Comparison"
        subtitle={`${currentPeriod?.label ?? "Current"} vs ${previousPeriod?.label ?? "Previous"}`}
        interactive
      >
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Bar chart area */}
          <div className="flex-1 min-w-0">
            <div
              className="relative"
              style={{
                transform: "perspective(1200px) rotateX(2deg) rotateY(-2deg)",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Y-axis grid */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-10 pl-9">
                {[1, 0.75, 0.5, 0.25].map((pct) => (
                  <div key={pct} className="flex items-center gap-2">
                    <span className="text-[8px] text-white/15 w-8 text-right tabular-nums shrink-0">
                      {fmt(maxBarValue * pct)}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>
                ))}
              </div>

              {/* Bars container */}
              <div className="flex items-end justify-center gap-5 sm:gap-7 pt-4 pb-10 min-h-[280px] pl-10">
                <AnimatePresence mode="wait">
                  {comparisons.map((comp, ci) => (
                    <BarGroup
                      key={comp.name}
                      {...comp}
                      maxValue={maxBarValue}
                      layout={barLayout}
                      index={ci}
                      isExpanded={expandedCat === comp.name}
                      onClick={() =>
                        setExpandedCat(
                          expandedCat === comp.name ? null : comp.name,
                        )
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-6 text-[10px] text-white/40">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-2.5 rounded-sm"
                    style={{ background: `${ACCENT}CC` }}
                  />
                  {currentPeriod?.label ?? "Current"}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2.5 rounded-sm bg-white/15" />
                  {previousPeriod?.label ?? "Previous"}
                </div>
              </div>
            </div>
          </div>

          {/* Trend sparklines panel */}
          <div className="lg:w-[180px] shrink-0 space-y-2 lg:border-l lg:border-white/5 lg:pl-4">
            <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">
              Trends
            </p>
            {topCats.map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: colorMap[cat.name] }}
                />
                <span className="text-[10px] text-white/40 truncate flex-1 min-w-0">
                  {cat.name}
                </span>
                <div className="w-16 h-6 shrink-0">
                  {(sparklines[cat.name]?.length ?? 0) > 1 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklines[cat.name]}>
                        <defs>
                          <linearGradient
                            id={`sp-${i}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={colorMap[cat.name]}
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="100%"
                              stopColor={colorMap[cat.name]}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={colorMap[cat.name]}
                          strokeWidth={1.5}
                          fill={`url(#sp-${i})`}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </WidgetCard>

      {/* ═══ SUBCATEGORY DRILLDOWN ═══ */}
      <AnimatePresence>
        {expandedCat &&
          (() => {
            const cat = categories.find((c) => c.name === expandedCat);
            if (!cat || cat.subcategories.length === 0) return null;
            const color = colorMap[cat.name];

            return (
              <motion.div
                key={expandedCat}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <WidgetCard
                  title={`${cat.name} — Subcategories`}
                  subtitle={`${cat.subcategories.length} subcategories · ${fmt(cat.total)} total`}
                >
                  <div className="space-y-2">
                    {cat.subcategories.map((sub, si) => {
                      const barPct =
                        cat.total > 0 ? (sub.total / cat.total) * 100 : 0;
                      return (
                        <motion.div
                          key={sub.name}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: si * 0.04 }}
                          className="flex items-center gap-3"
                        >
                          <span className="text-[11px] text-white/50 w-[120px] truncate shrink-0">
                            {sub.name}
                          </span>
                          <div className="flex-1 h-6 bg-white/[0.03] rounded-md overflow-hidden relative">
                            <motion.div
                              className="h-full rounded-md"
                              initial={{ width: 0 }}
                              animate={{ width: `${barPct}%` }}
                              transition={{
                                duration: 0.6,
                                delay: si * 0.05,
                                ease: "easeOut",
                              }}
                              style={{
                                background: `linear-gradient(90deg, ${color}BB, ${color}55)`,
                                boxShadow: `inset 0 1px 0 ${color}40`,
                              }}
                            />
                            {barPct > 15 && (
                              <span className="absolute inset-0 flex items-center px-2 text-[9px] font-bold text-white/80">
                                {sub.percent.toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <BlurredAmount blurIntensity="sm">
                            <span
                              className="text-[11px] font-semibold tabular-nums w-[60px] text-right shrink-0"
                              style={{ color }}
                            >
                              {fmt(sub.total)}
                            </span>
                          </BlurredAmount>
                        </motion.div>
                      );
                    })}
                  </div>
                </WidgetCard>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {/* ═══ CATEGORY RANKINGS ═══ */}
      <WidgetCard
        title="All Categories"
        subtitle={`${categories.length} categories ranked by spend`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allComparisons.map((cat, i) => {
            const isUp = cat.change > 5;
            const isDown = cat.change < -5;
            return (
              <motion.button
                key={cat.name}
                onClick={() =>
                  setExpandedCat(expandedCat === cat.name ? null : cat.name)
                }
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left group",
                  expandedCat === cat.name
                    ? "border-white/15 bg-white/[0.05]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]",
                )}
              >
                {/* Rank badge */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                    i === 0
                      ? "bg-amber-500/15 text-amber-400"
                      : i === 1
                        ? "bg-slate-400/10 text-slate-300"
                        : i === 2
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-white/5 text-white/25",
                  )}
                >
                  {i + 1}
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: colorMap[cat.name],
                    boxShadow: `0 0 6px ${colorMap[cat.name]}30`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white/70 truncate">
                    {cat.name}
                  </p>
                  <p className="text-[9px] text-white/25">
                    {cat.count} txns · avg {fmt(cat.avg)}
                  </p>
                </div>
                {/* % Change badge */}
                <div
                  className={cn(
                    "flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0",
                    isUp
                      ? "bg-rose-500/10 text-rose-400"
                      : isDown
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-white/5 text-white/25",
                  )}
                >
                  {isUp ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : isDown ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {Math.abs(cat.change).toFixed(0)}%
                </div>
                <BlurredAmount blurIntensity="sm">
                  <span
                    className="text-sm font-bold tabular-nums shrink-0"
                    style={{ color: colorMap[cat.name] }}
                  >
                    {fmt(cat.curr)}
                  </span>
                </BlurredAmount>
                {cat.subcategories.length > 0 && (
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-white/15 transition-transform shrink-0",
                      expandedCat === cat.name && "rotate-180 text-white/30",
                    )}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </WidgetCard>

      {/* ═══ HEATMAP ═══ */}
      {periods.length > 1 && (
        <WidgetCard
          title="Category Rhythm"
          subtitle={`Spending intensity by ${grouping} · Brighter = higher spend`}
        >
          <HeatmapGrid
            periods={periods}
            categories={categories.slice(0, 10)}
            colorMap={colorMap}
          />
        </WidgetCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GLASS KPI CARD — neon accent glow
// ══════════════════════════════════════════════════════════════════════════════
function GlassKPI({
  label,
  value,
  change,
  prevValue,
  subtitle,
  accent,
}: {
  label: string;
  value: number;
  change: number;
  prevValue?: number;
  subtitle?: string;
  accent: string;
}) {
  const isUp = change > 2;
  const isDown = change < -2;
  return (
    <div
      className="rounded-xl p-3 border relative overflow-hidden"
      style={{
        borderColor: `${accent}20`,
        background: `linear-gradient(135deg, ${accent}08, ${accent}03, transparent)`,
        boxShadow: `0 0 30px ${accent}08, inset 0 1px 0 ${accent}10`,
      }}
    >
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accent}10, transparent)`,
        }}
      />
      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">
        {label}
      </p>
      {subtitle && (
        <p className="text-[10px] font-medium text-white/50 mb-0.5 truncate">
          {subtitle}
        </p>
      )}
      <BlurredAmount blurIntensity="sm">
        <p
          className="text-lg font-black tabular-nums"
          style={{ color: accent }}
        >
          {fmt(value)}
        </p>
      </BlurredAmount>
      <div
        className={cn(
          "flex items-center gap-1 mt-1 text-[10px] font-bold",
          isUp
            ? "text-rose-400"
            : isDown
              ? "text-emerald-400"
              : "text-white/25",
        )}
      >
        {isUp ? (
          <TrendingUp className="w-3 h-3" />
        ) : isDown ? (
          <TrendingDown className="w-3 h-3" />
        ) : null}
        {change !== 0 && (
          <span>
            {change > 0 ? "+" : ""}
            {change.toFixed(0)}%
          </span>
        )}
        {prevValue !== undefined && (
          <span className="text-white/20 ml-1">from {fmt(prevValue)}</span>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BAR GROUP — one category = current + previous 3D bars
// ══════════════════════════════════════════════════════════════════════════════
function BarGroup({
  name,
  color,
  curr,
  prev,
  change,
  maxValue,
  layout,
  index,
  isExpanded,
  onClick,
}: {
  name: string;
  color: string;
  curr: number;
  prev: number;
  change: number;
  maxValue: number;
  layout: BarLayout;
  index: number;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const maxH = 200;
  const currH = maxValue > 0 ? (curr / maxValue) * maxH : 0;
  const prevH = maxValue > 0 ? (prev / maxValue) * maxH : 0;
  const isUp = change > 5;
  const isDown = change < -5;

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 group cursor-pointer"
      onClick={onClick}
      layout
      transition={{ layout: { type: "spring", stiffness: 200, damping: 25 } }}
    >
      {/* % change badge */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08 + 0.3 }}
        className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
          isUp
            ? "bg-rose-500/10 text-rose-400"
            : isDown
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-white/5 text-white/25",
        )}
      >
        {change > 0 ? "+" : ""}
        {change.toFixed(0)}%
      </motion.div>

      {/* Bars area */}
      <div
        className={cn(
          "flex items-end",
          layout === "grouped" ? "gap-1" : "relative",
        )}
      >
        {layout === "grouped" ? (
          <>
            {/* Previous period */}
            <Bar3D
              height={prevH}
              color="#94a3b8"
              opacity={0.3}
              width={22}
              delay={index * 0.08}
            />
            {/* Current period */}
            <Bar3D
              height={currH}
              color={color}
              opacity={1}
              width={22}
              delay={index * 0.08 + 0.1}
              label={curr > 0 ? fmt(curr) : undefined}
              glow={isExpanded}
            />
          </>
        ) : (
          <>
            {/* Previous (back layer) */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{ zIndex: 1 }}
            >
              <Bar3D
                height={prevH}
                color="#94a3b8"
                opacity={0.2}
                width={38}
                delay={index * 0.08}
              />
            </div>
            {/* Current (front layer) */}
            <div className="relative" style={{ zIndex: 2 }}>
              <Bar3D
                height={currH}
                color={color}
                opacity={1}
                width={30}
                delay={index * 0.08 + 0.1}
                label={curr > 0 ? fmt(curr) : undefined}
                glow={isExpanded}
              />
            </div>
          </>
        )}
      </div>

      {/* Category label */}
      <div className="text-center max-w-[60px]">
        <p className="text-[10px] text-white/50 truncate font-medium group-hover:text-white/70 transition-colors">
          {name}
        </p>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BAR 3D — single vertical bar with CSS 3D depth
// ══════════════════════════════════════════════════════════════════════════════
function Bar3D({
  height,
  color,
  opacity,
  width,
  delay,
  label,
  glow,
}: {
  height: number;
  color: string;
  opacity: number;
  width: number;
  delay: number;
  label?: string;
  glow?: boolean;
}) {
  const c = color.startsWith("#") ? color : "#64748b";
  // Hex opacity values for front face gradient (bottom → top)
  const opBot = hexOp(opacity * 0.6);
  const opMid = hexOp(opacity * 0.85);
  const opTop = hexOp(opacity * 1);
  // 3D shadow face (solid offset shadow)
  const opShadow = hexOp(opacity * 0.25);
  // Top face (bright highlight)
  const opHighTop = hexOp(opacity * 0.5);
  const opHighBot = hexOp(opacity * 0.3);
  // Side face
  const opSideT = hexOp(opacity * 0.4);
  const opSideB = hexOp(opacity * 0.15);
  // Edge highlights
  const opEdge = hexOp(opacity * 0.35);

  return (
    <div className="relative" style={{ width: width + BAR_DEPTH }}>
      <motion.div
        className="absolute bottom-0 left-0"
        style={{ width }}
        initial={{ height: 0 }}
        animate={{ height: Math.max(height, 2) }}
        transition={{
          height: { type: "spring", stiffness: 80, damping: 18, delay },
        }}
      >
        {/* ── Front face ── */}
        <div
          className="absolute inset-0 rounded-t-[3px]"
          style={{
            background: `linear-gradient(to top, ${c}${opBot}, ${c}${opMid} 40%, ${c}${opTop})`,
            borderTop: `1px solid ${c}${opEdge}`,
            borderLeft: `1px solid ${c}${hexOp(opacity * 0.2)}`,
            boxShadow: [
              // Solid offset shadow = 3D depth look
              `${BAR_DEPTH}px ${BAR_DEPTH}px 0 ${c}${opShadow}`,
              // Soft ambient shadow
              `0 ${BAR_DEPTH + 6}px 16px rgba(0,0,0,0.35)`,
              // Glow when expanded
              glow ? `0 0 24px ${c}40, 0 0 48px ${c}20` : "",
            ]
              .filter(Boolean)
              .join(", "),
          }}
        />

        {/* ── Top face (parallelogram sitting on top of front face) ── */}
        <div
          className="absolute rounded-sm"
          style={{
            top: -BAR_DEPTH + 1,
            left: 1,
            width: width - 1,
            height: BAR_DEPTH,
            background: `linear-gradient(135deg, ${c}${opHighTop}, ${c}${opHighBot})`,
            transform: "skewX(-45deg)",
            transformOrigin: "bottom left",
          }}
        />

        {/* ── Right side face (parallelogram on the right) ── */}
        <div
          className="absolute rounded-r-sm"
          style={{
            top: -(BAR_DEPTH / 2) + 1,
            right: -BAR_DEPTH,
            width: BAR_DEPTH,
            height: "100%",
            background: `linear-gradient(to bottom, ${c}${opSideT}, ${c}${opSideB})`,
            transform: "skewY(-45deg)",
            transformOrigin: "top left",
          }}
        />

        {/* ── Value label ── */}
        {label && height > 30 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.4 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <BlurredAmount blurIntensity="sm">
              <span className="text-[8px] font-bold tabular-nums text-white/60 drop-shadow-md">
                {label}
              </span>
            </BlurredAmount>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HEATMAP GRID
// ══════════════════════════════════════════════════════════════════════════════
function HeatmapGrid({
  periods,
  categories,
  colorMap,
}: {
  periods: PeriodBucket[];
  categories: CategoryData[];
  colorMap: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="inline-grid gap-px" style={{ minWidth: "100%" }}>
        {/* Header row */}
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `140px repeat(${periods.length}, 1fr)`,
          }}
        >
          <div />
          {periods.map((b) => (
            <div
              key={b.key}
              className="text-[9px] text-white/30 text-center py-1 px-1 truncate"
            >
              {b.label}
            </div>
          ))}
        </div>

        {/* Category rows */}
        {categories.map((cat) => {
          const color = colorMap[cat.name];
          const maxVal = Math.max(
            ...periods.map((b) => b.totals[cat.name] || 0),
            1,
          );
          return (
            <div
              key={cat.name}
              className="grid gap-px items-center"
              style={{
                gridTemplateColumns: `140px repeat(${periods.length}, 1fr)`,
              }}
            >
              <div className="flex items-center gap-1.5 pr-2 truncate">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-white/60 truncate">
                  {cat.name}
                </span>
              </div>
              {periods.map((b) => {
                const val = b.totals[cat.name] || 0;
                const intensity = maxVal > 0 ? val / maxVal : 0;
                return (
                  <motion.div
                    key={b.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-8 rounded-md transition-all hover:ring-1 hover:ring-white/20 group relative cursor-default"
                    style={{
                      backgroundColor: `${color}${hexOp(intensity * 0.78 + 0.04)}`,
                      boxShadow:
                        intensity > 0.6
                          ? `inset 0 0 12px ${color}30`
                          : undefined,
                    }}
                    title={`${cat.name} · ${b.label}: ${fmt(val)}`}
                  >
                    {val > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-bold text-white tabular-nums drop-shadow-md">
                          {fmt(val)}
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
