"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { useTheme } from "@/contexts/ThemeContext";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import { format, subMonths } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, LayoutList, Users } from "lucide-react";
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

type TransactionLike = {
  amount: number;
  date: string;
  account_id: string;
  user_id?: string;
  is_debt_return?: boolean;
  [key: string]: any;
};

type Props = {
  analyticsMonths: MonthlyAnalytics[] | undefined;
  transactions: TransactionLike[];
  accounts: Account[] | undefined;
  currentUserId?: string;
  hasPartner?: boolean;
};

type Grouping = "month" | "quarter" | "year";
type ViewMode = "combined" | "split";
type Layout = "columns" | "stacked";

type MonthBucket = { key: string; label: string };

type BucketRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
  myIncome: number;
  partnerIncome: number;
  myExpense: number;
  partnerExpense: number;
  mySavings: number;
  partnerSavings: number;
};

type Totals = Omit<BucketRow, "key" | "label">;

// ── Colors ───────────────────────────────────────────────────────────────────

const INCOME_COLOR = "#34d399";
const EXPENSE_COLOR = "#fb7185";
const SAVINGS_COLOR = "#a78bfa";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  if (n >= 10_000) return `$${(n / 1000).toFixed(0)}k`;
  if (n >= 1_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function lightenHex(hex: string, pct: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round((255 * pct) / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 * pct) / 100));
  const b = Math.min(255, (num & 0xff) + Math.round((255 * pct) / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function dateToBucketKey(dateStr: string, grouping: Grouping): string {
  if (grouping === "month") return dateStr.slice(0, 7);
  if (grouping === "quarter") {
    const m = parseInt(dateStr.slice(5, 7), 10);
    return `${dateStr.slice(0, 4)}-Q${Math.ceil(m / 3)}`;
  }
  return dateStr.slice(0, 4);
}

function build12Months(): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy") });
  }
  return buckets;
}

function buildBuckets(grouping: Grouping): MonthBucket[] {
  if (grouping === "month") return build12Months();
  const months = build12Months();
  const seen = new Map<string, string>();
  for (const m of months) {
    const key = dateToBucketKey(`${m.key}-01`, grouping);
    if (!seen.has(key)) {
      if (grouping === "quarter") {
        const q = Math.ceil(parseInt(m.key.slice(5, 7), 10) / 3);
        seen.set(key, `Q${q} ${m.key.slice(2, 4)}`);
      } else {
        seen.set(key, m.key.slice(0, 4));
      }
    }
  }
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
}

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

// ── SVG chart primitives (shared visual system) ──────────────────────────────

function ChartDefs({ id, color }: { id: string; color: string }) {
  const bright = lightenHex(color, 30);
  return (
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bright} stopOpacity={0.45} />
        <stop offset="50%" stopColor={color} stopOpacity={0.22} />
        <stop offset="100%" stopColor={color} stopOpacity={0.1} />
      </linearGradient>
      <linearGradient id={`${id}-hl`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
        <stop offset="20%" stopColor="#fff" stopOpacity={0.1} />
        <stop offset="50%" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
      <filter id={`${id}-glow`} x="-40%" y="-15%" width="180%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.55 0" result="glow" />
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.35" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function OutlinedBar({
  x, y, width, height, fillId, hlId, filterId, strokeColor, onClick,
}: {
  x: number; y: number; width: number; height: number;
  fillId: string; hlId: string; filterId: string;
  strokeColor: string; onClick?: () => void;
}) {
  if (!height || height <= 0) return null;
  const r = Math.min(5, width / 2, height);
  const bright = lightenHex(strokeColor, 25);
  return (
    <g
      filter={`url(#${filterId})`}
      style={{ cursor: onClick ? "pointer" : undefined, transition: "opacity 0.3s ease" }}
      onClick={onClick}
    >
      <rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={`url(#${fillId})`} />
      <rect x={x} y={y} width={width} height={Math.min(height, height * 0.55)} rx={r} ry={r} fill={`url(#${hlId})`} />
      <rect x={x} y={y} width={2} height={height} rx={1} fill={strokeColor} fillOpacity={0.15} />
      <rect x={x + width - 2} y={y} width={2} height={height} rx={1} fill={strokeColor} fillOpacity={0.08} />
      <rect x={x + 0.5} y={y + 0.5} width={width - 1} height={height - 1} rx={r} ry={r} fill="none" stroke={bright} strokeWidth={1.3} strokeOpacity={0.7} />
      <line x1={x + r} y1={y + 0.5} x2={x + width - r} y2={y + 0.5} stroke={bright} strokeWidth={2} strokeOpacity={0.9} strokeLinecap="round" />
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonthlyDistributionTabContent({
  analyticsMonths,
  transactions,
  accounts,
  currentUserId,
  hasPartner,
}: Props) {
  const { theme } = useTheme();
  const myColor = theme === "pink" ? "#ec4899" : "#3b82f6";
  const partnerColor = theme === "pink" ? "#3b82f6" : "#ec4899";

  const [grouping, setGrouping] = useState<Grouping>("month");
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [layout, setLayout] = useState<Layout>("columns");

  const buckets = useMemo(() => buildBuckets(grouping), [grouping]);
  const bucketKeys = useMemo(() => new Set(buckets.map((b) => b.key)), [buckets]);

  const accountTypeMap = useMemo(() => {
    const m = new Map<string, "income" | "expense" | "saving">();
    for (const a of accounts ?? []) m.set(a.id, a.type);
    return m;
  }, [accounts]);

  const rows = useMemo((): BucketRow[] => {
    const map = new Map<string, BucketRow>();
    for (const b of buckets) {
      map.set(b.key, {
        key: b.key, label: b.label,
        income: 0, expense: 0, savings: 0,
        myIncome: 0, partnerIncome: 0,
        myExpense: 0, partnerExpense: 0,
        mySavings: 0, partnerSavings: 0,
      });
    }

    // Fill combined + expense split from analytics
    for (const m of analyticsMonths ?? []) {
      const bk = dateToBucketKey(`${m.month}-01`, grouping);
      if (!bucketKeys.has(bk)) continue;
      const row = map.get(bk)!;
      row.income += m.income;
      row.expense += m.expense;
      row.savings += m.savings;
      row.myExpense += m.myExpense;
      row.partnerExpense += m.partnerExpense;
    }

    // Derive income + savings split from raw transactions
    for (const t of transactions) {
      const bk = dateToBucketKey(t.date, grouping);
      if (!bucketKeys.has(bk)) continue;
      const row = map.get(bk);
      if (!row) continue;
      const acctType = accountTypeMap.get(t.account_id);
      const isMe = t.user_id === currentUserId;
      const amt = Math.abs(Number(t.amount));
      if (acctType === "income" && !t.is_debt_return) {
        if (isMe) row.myIncome += amt;
        else row.partnerIncome += amt;
      } else if (acctType === "saving") {
        if (isMe) row.mySavings += amt;
        else row.partnerSavings += amt;
      }
    }

    return buckets.map((b) => map.get(b.key)!);
  }, [analyticsMonths, transactions, buckets, bucketKeys, grouping, accountTypeMap, currentUserId]);

  const totals = useMemo((): Totals => ({
    income: rows.reduce((s, r) => s + r.income, 0),
    expense: rows.reduce((s, r) => s + r.expense, 0),
    savings: rows.reduce((s, r) => s + r.savings, 0),
    myIncome: rows.reduce((s, r) => s + r.myIncome, 0),
    partnerIncome: rows.reduce((s, r) => s + r.partnerIncome, 0),
    myExpense: rows.reduce((s, r) => s + r.myExpense, 0),
    partnerExpense: rows.reduce((s, r) => s + r.partnerExpense, 0),
    mySavings: rows.reduce((s, r) => s + r.mySavings, 0),
    partnerSavings: rows.reduce((s, r) => s + r.partnerSavings, 0),
  }), [rows]);

  if (!analyticsMonths) {
    return <div className="text-center py-16 text-white/40 text-sm">No monthly data available</div>;
  }

  const periodLabel = buckets.length > 0 ? `${buckets[0].label} — ${buckets[buckets.length - 1].label}` : "";
  const groupLabel = grouping === "month" ? "months" : grouping === "quarter" ? "quarters" : "years";

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 tracking-wide font-medium flex-wrap">
        <span className="flex-1 min-w-0 truncate">
          {periodLabel} · {buckets.length} {groupLabel}
        </span>

        {/* Combined / Split — only shown when partner exists */}
        {hasPartner && (
          <div className="flex rounded-lg bg-white/[0.08] p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("combined")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                viewMode === "combined" ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/60",
              )}
            >
              Combined
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                viewMode === "split" ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/60",
              )}
            >
              <Users className="w-3 h-3" />
              Split
            </button>
          </div>
        )}

        {/* Columns / Stacked */}
        <div className="flex rounded-lg bg-white/[0.08] p-0.5 shrink-0">
          <button
            onClick={() => setLayout("columns")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
              layout === "columns" ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/60",
            )}
            title="3 separate charts"
          >
            <LayoutGrid className="w-3 h-3" />
            Columns
          </button>
          <button
            onClick={() => setLayout("stacked")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
              layout === "stacked" ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/60",
            )}
            title="Single overview chart"
          >
            <LayoutList className="w-3 h-3" />
            Overview
          </button>
        </div>

        {/* Grouping */}
        <div className="flex rounded-lg bg-white/[0.08] p-0.5 shrink-0">
          {(["month", "quarter", "year"] as Grouping[]).map((g) => (
            <button
              key={g}
              onClick={() => setGrouping(g)}
              className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all",
                grouping === g ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/60",
              )}
            >
              {g === "month" ? "Mo" : g === "quarter" ? "Qtr" : "Yr"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      <AnimatePresence mode="wait">
        {layout === "columns" ? (
          <motion.div
            key={`columns-${viewMode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <MetricWidget
              title="Income"
              color={INCOME_COLOR}
              total={viewMode === "split" ? undefined : totals.income}
              rows={rows}
              dataKey="income"
              myKey="myIncome"
              myTotal={totals.myIncome}
              partnerKey="partnerIncome"
              partnerTotal={totals.partnerIncome}
              viewMode={viewMode}
              myColor={myColor}
              partnerColor={partnerColor}
            />
            <MetricWidget
              title="Expense"
              color={EXPENSE_COLOR}
              total={viewMode === "split" ? undefined : totals.expense}
              rows={rows}
              dataKey="expense"
              myKey="myExpense"
              myTotal={totals.myExpense}
              partnerKey="partnerExpense"
              partnerTotal={totals.partnerExpense}
              viewMode={viewMode}
              myColor={myColor}
              partnerColor={partnerColor}
            />
            <MetricWidget
              title="Savings"
              color={SAVINGS_COLOR}
              total={viewMode === "split" ? undefined : totals.savings}
              rows={rows}
              dataKey="savings"
              myKey="mySavings"
              myTotal={totals.mySavings}
              partnerKey="partnerSavings"
              partnerTotal={totals.partnerSavings}
              viewMode={viewMode}
              myColor={myColor}
              partnerColor={partnerColor}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`stacked-${viewMode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <OverviewWidget
              rows={rows}
              totals={totals}
              viewMode={viewMode}
              myColor={myColor}
              partnerColor={partnerColor}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MetricWidget (one per Income / Expense / Savings) ────────────────────────

function MetricWidget({
  title,
  color,
  total,
  rows,
  dataKey,
  myKey,
  myTotal,
  partnerKey,
  partnerTotal,
  viewMode,
  myColor,
  partnerColor,
}: {
  title: string;
  color: string;
  total: number | undefined;
  rows: BucketRow[];
  dataKey: keyof BucketRow;
  myKey: keyof BucketRow;
  myTotal: number;
  partnerKey: keyof BucketRow;
  partnerTotal: number;
  viewMode: ViewMode;
  myColor: string;
  partnerColor: string;
}) {
  const [zoomedKey, setZoomedKey] = useState<string | null>(null);

  const handleBarClick = useCallback((key: string) => {
    setZoomedKey((prev) => (prev === key ? null : key));
  }, []);

  const chartData = zoomedKey ? rows.filter((r) => r.key === zoomedKey) : rows;
  const zoomedRow = zoomedKey ? rows.find((r) => r.key === zoomedKey) : null;

  const avg = useMemo(() => {
    const nonZero = rows.filter((r) => (r[dataKey] as number) > 0);
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((s, r) => s + (r[dataKey] as number), 0) / nonZero.length;
  }, [rows, dataKey]);

  const displayTotal = viewMode === "split" ? myTotal + partnerTotal : (total ?? 0);

  return (
    <WidgetCard
      title={title}
      subtitle={zoomedRow ? `${zoomedRow.label} · ${fmtDollar(zoomedRow[dataKey] as number)}` : undefined}
      filterActive={!!zoomedKey}
      onFilterReset={() => setZoomedKey(null)}
      action={
        <div className="flex items-center gap-2">
          {viewMode === "split" && (
            <div className="flex items-center gap-2 text-[11px] tabular-nums font-semibold">
              <span style={{ color: myColor }}>{fmtDollar(myTotal)}</span>
              <span className="text-white/20">·</span>
              <span style={{ color: partnerColor }}>{fmtDollar(partnerTotal)}</span>
            </div>
          )}
          <BlurredAmount blurIntensity="sm">
            <span className="text-[15px] font-bold tabular-nums tracking-tight" style={{ color }}>
              {fmtDollar(displayTotal)}
            </span>
          </BlurredAmount>
        </div>
      }
    >
      {/* Stats bar */}
      {!zoomedKey && (
        <div className="flex items-center gap-2 flex-wrap px-1 mb-2 text-[11px] text-white/45 font-medium tabular-nums">
          <BlurredAmount blurIntensity="sm">
            <span>
              Total:{" "}
              <span className="font-semibold" style={{ color }}>{fmtDollar(displayTotal)}</span>
            </span>
          </BlurredAmount>
          <span className="text-white/20">|</span>
          <BlurredAmount blurIntensity="sm">
            <span>
              Avg:{" "}
              <span className="text-white/70 font-semibold">{fmtDollar(avg)}/mo</span>
            </span>
          </BlurredAmount>
          {viewMode === "split" && (
            <>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: myColor }} />
                <BlurredAmount blurIntensity="sm">
                  <span className="font-semibold" style={{ color: myColor }}>{fmtDollar(myTotal)}</span>
                </BlurredAmount>
              </span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: partnerColor }} />
                <BlurredAmount blurIntensity="sm">
                  <span className="font-semibold" style={{ color: partnerColor }}>{fmtDollar(partnerTotal)}</span>
                </BlurredAmount>
              </span>
            </>
          )}
        </div>
      )}

      {/* Color accent bar */}
      <div
        className="h-[3px] rounded-full mb-4"
        style={{ background: `linear-gradient(90deg, ${color}cc, ${color}40 60%, transparent)` }}
      />

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewMode}-${zoomedKey ?? "all"}`}
          initial={{ opacity: 0, scale: zoomedKey ? 1.06 : 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: zoomedKey ? 0.95 : 1.04 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <MetricChart
            rows={chartData}
            color={color}
            dataKey={dataKey}
            myKey={myKey}
            partnerKey={partnerKey}
            viewMode={viewMode}
            myColor={myColor}
            partnerColor={partnerColor}
            zoomedKey={zoomedKey}
            onBarClick={handleBarClick}
          />
        </motion.div>
      </AnimatePresence>

      {/* Zoomed detail panel */}
      <AnimatePresence>
        {zoomedRow && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 mt-2 px-2 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/50 font-medium">{zoomedRow.label}</div>
                <BlurredAmount blurIntensity="sm">
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>
                    {fmtDollar(zoomedRow[dataKey] as number)}
                  </span>
                </BlurredAmount>
              </div>
              {viewMode === "split" && (
                <div className="flex gap-4">
                  {[
                    { key: myKey, color: myColor, label: "Me" },
                    { key: partnerKey, color: partnerColor, label: "Partner" },
                  ].map((p) => (
                    <div key={p.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-[10px] text-white/50">{p.label}</span>
                      <BlurredAmount blurIntensity="sm">
                        <span className="text-[11px] tabular-nums font-semibold" style={{ color: p.color }}>
                          {fmtDollar(zoomedRow[p.key] as number)}
                        </span>
                      </BlurredAmount>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </WidgetCard>
  );
}

// ── MetricChart ──────────────────────────────────────────────────────────────

function MetricChart({
  rows,
  color,
  dataKey,
  myKey,
  partnerKey,
  viewMode,
  myColor,
  partnerColor,
  zoomedKey,
  onBarClick,
}: {
  rows: BucketRow[];
  color: string;
  dataKey: keyof BucketRow;
  myKey: keyof BucketRow;
  partnerKey: keyof BucketRow;
  viewMode: ViewMode;
  myColor: string;
  partnerColor: string;
  zoomedKey: string | null;
  onBarClick: (key: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const axisBase = { tickLine: false as const, axisLine: false as const };

  const xAxis = {
    dataKey: "label" as const,
    tick: { fill: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 },
    ...axisBase,
    tickMargin: 8,
  };
  const yAxis = {
    tick: { fill: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500 },
    ...axisBase,
    tickFormatter: (v: number) => fmtDollar(v),
    width: 52,
    tickMargin: 4,
  };

  const renderTooltip = useCallback(
    ({ active, label }: { active?: boolean; label?: string }) => {
      if (!active || !label) return null;
      const row = rows.find((r) => r.label === label);
      if (!row) return null;
      const combined = row[dataKey] as number;
      const me = row[myKey] as number;
      const partner = row[partnerKey] as number;
      return (
        <div style={TOOLTIP_STYLE}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
            {label}
          </div>
          {viewMode === "split" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { label: "Me", color: myColor, value: me },
                { label: "Partner", color: partnerColor, value: partner },
              ].map((e) => (
                <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: e.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{e.label}</span>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    ${Math.round(e.value).toLocaleString()}
                  </span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600 }}>Total</span>
                <span style={{ color, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  ${Math.round(combined).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              ${Math.round(combined).toLocaleString()}
            </div>
          )}
        </div>
      );
    },
    [rows, dataKey, myKey, partnerKey, viewMode, myColor, partnerColor, color],
  );

  const cursorProps = { fill: "rgba(255,255,255,0.04)", radius: 4 } as any;

  if (viewMode === "split") {
    return (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barCategoryGap={zoomedKey ? "40%" : "18%"} barGap={2}>
            <ChartDefs id={`${uid}-me`} color={myColor} />
            <ChartDefs id={`${uid}-pt`} color={partnerColor} />
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.10)" vertical={false} />
            <XAxis {...xAxis} />
            <YAxis {...yAxis} />
            <Tooltip content={renderTooltip as any} cursor={cursorProps} />
            <Bar
              dataKey={myKey as string}
              name="Me"
              fill="transparent"
              maxBarSize={zoomedKey ? 70 : undefined}
              shape={(props: any) => (
                <OutlinedBar
                  x={props.x} y={props.y} width={props.width} height={props.height}
                  fillId={`${uid}-me-fill`} hlId={`${uid}-me-hl`} filterId={`${uid}-me-glow`}
                  strokeColor={myColor}
                  onClick={() => onBarClick(rows[props.index]?.key ?? "")}
                />
              )}
            />
            <Bar
              dataKey={partnerKey as string}
              name="Partner"
              fill="transparent"
              maxBarSize={zoomedKey ? 70 : undefined}
              shape={(props: any) => (
                <OutlinedBar
                  x={props.x} y={props.y} width={props.width} height={props.height}
                  fillId={`${uid}-pt-fill`} hlId={`${uid}-pt-hl`} filterId={`${uid}-pt-glow`}
                  strokeColor={partnerColor}
                  onClick={() => onBarClick(rows[props.index]?.key ?? "")}
                />
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap={zoomedKey ? "40%" : "20%"}>
          <ChartDefs id={uid} color={color} />
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.10)" vertical={false} />
          <XAxis {...xAxis} />
          <YAxis {...yAxis} />
          <Tooltip content={renderTooltip as any} cursor={cursorProps} />
          <Bar
            dataKey={dataKey as string}
            fill="transparent"
            maxBarSize={zoomedKey ? 90 : undefined}
            shape={(props: any) => (
              <OutlinedBar
                x={props.x} y={props.y} width={props.width} height={props.height}
                fillId={`${uid}-fill`} hlId={`${uid}-hl`} filterId={`${uid}-glow`}
                strokeColor={color}
                onClick={() => onBarClick(rows[props.index]?.key ?? "")}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Overview Widget (single chart, all 3 metrics) ────────────────────────────

function OverviewWidget({
  rows,
  totals,
  viewMode,
  myColor,
  partnerColor,
}: {
  rows: BucketRow[];
  totals: Totals;
  viewMode: ViewMode;
  myColor: string;
  partnerColor: string;
}) {
  const uid = useId().replace(/:/g, "");
  const axisBase = { tickLine: false as const, axisLine: false as const };

  const xAxis = {
    dataKey: "label" as const,
    tick: { fill: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600 },
    ...axisBase,
    tickMargin: 8,
  };
  const yAxis = {
    tick: { fill: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 500 },
    ...axisBase,
    tickFormatter: (v: number) => fmtDollar(v),
    width: 52,
    tickMargin: 4,
  };

  const bars = viewMode === "split"
    ? [
        { key: "myIncome" as const, color: myColor, name: "Income (Me)" },
        { key: "partnerIncome" as const, color: partnerColor, name: "Income (Partner)" },
        { key: "myExpense" as const, color: myColor, name: "Expense (Me)" },
        { key: "partnerExpense" as const, color: partnerColor, name: "Expense (Partner)" },
        { key: "mySavings" as const, color: myColor, name: "Savings (Me)" },
        { key: "partnerSavings" as const, color: partnerColor, name: "Savings (Partner)" },
      ]
    : [
        { key: "income" as const, color: INCOME_COLOR, name: "Income" },
        { key: "expense" as const, color: EXPENSE_COLOR, name: "Expense" },
        { key: "savings" as const, color: SAVINGS_COLOR, name: "Savings" },
      ];

  const renderTooltip = useCallback(
    ({ active, label }: { active?: boolean; label?: string }) => {
      if (!active || !label) return null;
      const row = rows.find((r) => r.label === label);
      if (!row) return null;

      const entries = viewMode === "split"
        ? [
            { label: "My Income", color: myColor, value: row.myIncome },
            { label: "Partner Income", color: partnerColor, value: row.partnerIncome },
            { label: "My Expense", color: myColor, value: row.myExpense },
            { label: "Partner Expense", color: partnerColor, value: row.partnerExpense },
            { label: "My Savings", color: myColor, value: row.mySavings },
            { label: "Partner Savings", color: partnerColor, value: row.partnerSavings },
          ]
        : [
            { label: "Income", color: INCOME_COLOR, value: row.income },
            { label: "Expense", color: EXPENSE_COLOR, value: row.expense },
            { label: "Savings", color: SAVINGS_COLOR, value: row.savings },
          ];

      return (
        <div style={TOOLTIP_STYLE}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
            {label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {entries.filter((e) => e.value > 0).map((e) => (
              <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: e.color, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{e.label}</span>
                </div>
                <span style={{ color: e.color, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  ${Math.round(e.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    },
    [rows, viewMode, myColor, partnerColor],
  );

  const legendItems = viewMode === "split"
    ? [
        { color: myColor, label: "Me" },
        { color: partnerColor, label: "Partner" },
      ]
    : [
        { color: INCOME_COLOR, label: "Income", total: totals.income },
        { color: EXPENSE_COLOR, label: "Expense", total: totals.expense },
        { color: SAVINGS_COLOR, label: "Savings", total: totals.savings },
      ];

  return (
    <WidgetCard
      title="Monthly Overview"
      action={
        <BlurredAmount blurIntensity="sm">
          <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
            <span style={{ color: INCOME_COLOR }}>{fmtDollar(totals.income)}</span>
            <span className="text-white/20">·</span>
            <span style={{ color: EXPENSE_COLOR }}>{fmtDollar(totals.expense)}</span>
            <span className="text-white/20">·</span>
            <span style={{ color: SAVINGS_COLOR }}>{fmtDollar(totals.savings)}</span>
          </div>
        </BlurredAmount>
      }
    >
      {/* Legend */}
      <div className="flex items-center gap-5 px-1 mb-3 flex-wrap">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded shrink-0"
              style={{ background: `linear-gradient(135deg, ${lightenHex(item.color, 15)}, ${item.color})` }}
            />
            <span className="text-xs text-white/65 font-medium">{item.label}</span>
            {"total" in item && item.total != null && (
              <BlurredAmount blurIntensity="sm">
                <span className="text-xs tabular-nums font-bold" style={{ color: item.color }}>
                  {fmtDollar(item.total)}
                </span>
              </BlurredAmount>
            )}
          </div>
        ))}
        {viewMode === "split" && (
          <div className="ml-auto flex items-center gap-4 text-[11px] tabular-nums font-semibold text-white/40">
            <span>Income · Expense · Savings</span>
            <span className="text-white/20">(by color above)</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barCategoryGap="15%" barGap={2}>
            {bars.map((b, i) => (
              <ChartDefs key={b.key} id={`${uid}-b${i}`} color={b.color} />
            ))}
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.10)" vertical={false} />
            <XAxis {...xAxis} />
            <YAxis {...yAxis} />
            <Tooltip content={renderTooltip as any} cursor={{ fill: "rgba(255,255,255,0.04)", radius: 4 } as any} />
            {bars.map((b, i) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                name={b.name}
                fill="transparent"
                shape={(props: any) => (
                  <OutlinedBar
                    x={props.x} y={props.y} width={props.width} height={props.height}
                    fillId={`${uid}-b${i}-fill`} hlId={`${uid}-b${i}-hl`} filterId={`${uid}-b${i}-glow`}
                    strokeColor={b.color}
                  />
                )}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
