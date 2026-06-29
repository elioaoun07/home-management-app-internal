"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  AccountBalance,
  MonthlyAnalytics,
} from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import { addMonths, format, subMonths } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LayoutGrid, LayoutList, Users } from "lucide-react";
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
  balanceAccounts?: AccountBalance[] | undefined;
  currentUserId?: string;
  hasPartner?: boolean;
  startDate: string;
  endDate: string;
};

type Grouping = "month" | "quarter" | "year";
type ViewMode = "combined" | "split";
type Layout = "columns" | "stacked";
type MetricKey = "income" | "expense" | "savings" | "expectedSavings";

type MonthBucket = { key: string; label: string };

type BucketRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
  expectedSavings: number;
  myIncome: number;
  partnerIncome: number;
  myExpense: number;
  partnerExpense: number;
  mySavings: number;
  partnerSavings: number;
  myExpectedSavings: number;
  partnerExpectedSavings: number;
};

type Totals = Omit<BucketRow, "key" | "label">;

// ── Colors ───────────────────────────────────────────────────────────────────

const INCOME_COLOR = "#34d399";
const EXPENSE_COLOR = "#fb7185";
const SAVINGS_COLOR = "#a78bfa";
const EXPECTED_SAVINGS_COLOR = "#22d3ee";

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string; color: string }> =
  [
    { key: "income", label: "Income", color: INCOME_COLOR },
    { key: "expense", label: "Expense", color: EXPENSE_COLOR },
    { key: "savings", label: "Savings", color: SAVINGS_COLOR },
    {
      key: "expectedSavings",
      label: "Expected Savings",
      color: EXPECTED_SAVINGS_COLOR,
    },
  ];

// ── Helpers ──────────────────────────────────────────────────────────────────

// Full, exact dollars for everything the user reads directly (tooltips, totals,
// summaries) — e.g. "$1,887". Abbreviation is reserved for cramped chart axis
// ticks via fmtAxis.
function fmtDollar(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

/** Abbreviated dollars for cramped chart axis ticks only (e.g. "$1.9k"). */
function fmtAxis(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
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

/** Build month buckets for [startDate, endDate]. Falls back to 12 months when either bound is empty (All Time). */
function buildBuckets(
  grouping: Grouping,
  startDate: string,
  endDate: string,
): MonthBucket[] {
  const start = startDate ? new Date(startDate) : subMonths(new Date(), 11);
  const end = endDate ? new Date(endDate) : new Date();

  // Build the flat month list
  const months: MonthBucket[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    months.push({ key: format(cur, "yyyy-MM"), label: format(cur, "MMM yy") });
    cur = addMonths(cur, 1);
  }

  if (grouping === "month") return months;

  // Aggregate into quarter / year buckets
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
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.55 0"
          result="glow"
        />
        <feDropShadow
          dx="0"
          dy="2"
          stdDeviation="3"
          floodColor="#000"
          floodOpacity="0.35"
          result="shadow"
        />
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
  x,
  y,
  width,
  height,
  fillId,
  hlId,
  filterId,
  strokeColor,
  onClick,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fillId: string;
  hlId: string;
  filterId: string;
  strokeColor: string;
  onClick?: () => void;
}) {
  if (!height || height <= 0) return null;
  const r = Math.min(5, width / 2, height);
  const bright = lightenHex(strokeColor, 25);
  return (
    <g
      filter={`url(#${filterId})`}
      style={{
        cursor: onClick ? "pointer" : undefined,
        transition: "opacity 0.3s ease",
      }}
      onClick={onClick}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={r}
        ry={r}
        fill={`url(#${fillId})`}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.min(height, height * 0.55)}
        rx={r}
        ry={r}
        fill={`url(#${hlId})`}
      />
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonthlyDistributionTabContent({
  transactions,
  accounts,
  balanceAccounts,
  currentUserId,
  hasPartner,
  startDate,
  endDate,
}: Props) {
  const { theme } = useTheme();
  const myColor = theme === "pink" ? "#ec4899" : "#3b82f6";
  const partnerColor = theme === "pink" ? "#3b82f6" : "#ec4899";

  const [grouping, setGrouping] = useState<Grouping>("month");
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [layout, setLayout] = useState<Layout>("columns");
  const [visibleMetrics, setVisibleMetrics] = useState<
    Record<MetricKey, boolean>
  >({
    income: true,
    expense: true,
    savings: true,
    expectedSavings: true,
  });

  const buckets = useMemo(
    () => buildBuckets(grouping, startDate, endDate),
    [grouping, startDate, endDate],
  );
  const bucketKeys = useMemo(
    () => new Set(buckets.map((b) => b.key)),
    [buckets],
  );

  const accountTypeMap = useMemo(() => {
    const m = new Map<string, "income" | "expense" | "saving">();
    for (const a of accounts ?? []) m.set(a.id, a.type);
    return m;
  }, [accounts]);

  const ourSavingsAccount = useMemo(
    () =>
      (balanceAccounts ?? []).find(
        (a) =>
          a.type === "saving" && a.name.trim().toLowerCase() === "our savings",
      ),
    [balanceAccounts],
  );

  const ourSavingsBalance = Number(ourSavingsAccount?.currentBalance ?? 0);
  const mySavingsBalance =
    ourSavingsAccount && currentUserId
      ? ourSavingsAccount.userId === currentUserId
        ? ourSavingsBalance
        : 0
      : ourSavingsBalance;
  const partnerSavingsBalance =
    ourSavingsAccount &&
    currentUserId &&
    ourSavingsAccount.userId !== currentUserId
      ? ourSavingsBalance
      : 0;

  const toggleMetric = useCallback((metric: MetricKey) => {
    setVisibleMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }));
  }, []);

  const hasVisibleMetric = useMemo(
    () => METRIC_OPTIONS.some((metric) => visibleMetrics[metric.key]),
    [visibleMetrics],
  );

  const rows = useMemo((): BucketRow[] => {
    const map = new Map<string, BucketRow>();
    for (const b of buckets) {
      map.set(b.key, {
        key: b.key,
        label: b.label,
        income: 0,
        expense: 0,
        savings: ourSavingsBalance,
        expectedSavings: 0,
        myIncome: 0,
        partnerIncome: 0,
        myExpense: 0,
        partnerExpense: 0,
        mySavings: mySavingsBalance,
        partnerSavings: partnerSavingsBalance,
        myExpectedSavings: 0,
        partnerExpectedSavings: 0,
      });
    }

    // Income + expense are derived from the SAME client transactions that feed
    // the Insight pie and Categories tab, using the canonical spending rule
    // (expense-type accounts only, debt-returns excluded, absolute amounts).
    // The buckets are built from [startDate, endDate] and the client already
    // fetched exactly that window, so these sums reconcile to the penny with
    // the other tabs. (Previously expense came from the calendar-month
    // analytics fetch, which is what made the Monthly total disagree.)
    for (const t of transactions) {
      const bk = dateToBucketKey(t.date, grouping);
      if (!bucketKeys.has(bk)) continue;
      const row = map.get(bk);
      if (!row) continue;
      if (t.is_debt_return) continue;
      const acctType = accountTypeMap.get(t.account_id);
      const isMe = t.user_id === currentUserId;
      const amt = Math.abs(Number(t.amount));
      if (acctType === "income") {
        row.income += amt;
        if (isMe) row.myIncome += amt;
        else row.partnerIncome += amt;
      } else if (acctType === "expense") {
        row.expense += amt;
        if (isMe) row.myExpense += amt;
        else row.partnerExpense += amt;
      }
    }

    return buckets.map((b) => {
      const row = map.get(b.key)!;
      row.expectedSavings = row.income - row.expense;
      row.myExpectedSavings = row.myIncome - row.myExpense;
      row.partnerExpectedSavings = row.partnerIncome - row.partnerExpense;
      return row;
    });
  }, [
    transactions,
    buckets,
    bucketKeys,
    grouping,
    accountTypeMap,
    currentUserId,
    ourSavingsBalance,
    mySavingsBalance,
    partnerSavingsBalance,
  ]);

  const totals = useMemo(
    (): Totals => ({
      income: rows.reduce((s, r) => s + r.income, 0),
      expense: rows.reduce((s, r) => s + r.expense, 0),
      savings: ourSavingsBalance,
      expectedSavings:
        rows.reduce((s, r) => s + r.income, 0) -
        rows.reduce((s, r) => s + r.expense, 0),
      myIncome: rows.reduce((s, r) => s + r.myIncome, 0),
      partnerIncome: rows.reduce((s, r) => s + r.partnerIncome, 0),
      myExpense: rows.reduce((s, r) => s + r.myExpense, 0),
      partnerExpense: rows.reduce((s, r) => s + r.partnerExpense, 0),
      mySavings: mySavingsBalance,
      partnerSavings: partnerSavingsBalance,
      myExpectedSavings:
        rows.reduce((s, r) => s + r.myIncome, 0) -
        rows.reduce((s, r) => s + r.myExpense, 0),
      partnerExpectedSavings:
        rows.reduce((s, r) => s + r.partnerIncome, 0) -
        rows.reduce((s, r) => s + r.partnerExpense, 0),
    }),
    [rows, ourSavingsBalance, mySavingsBalance, partnerSavingsBalance],
  );

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-16 text-white/40 text-sm">
        No monthly data available
      </div>
    );
  }

  const periodLabel =
    buckets.length > 0
      ? `${buckets[0].label} — ${buckets[buckets.length - 1].label}`
      : "";
  const groupLabel =
    grouping === "month"
      ? "months"
      : grouping === "quarter"
        ? "quarters"
        : "years";

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
                viewMode === "combined"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60",
              )}
            >
              Combined
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                viewMode === "split"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60",
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
              layout === "columns"
                ? "bg-white/15 text-white shadow-sm"
                : "text-white/40 hover:text-white/60",
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
              layout === "stacked"
                ? "bg-white/15 text-white shadow-sm"
                : "text-white/40 hover:text-white/60",
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
                grouping === g
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/60",
              )}
            >
              {g === "month" ? "Mo" : g === "quarter" ? "Qtr" : "Yr"}
            </button>
          ))}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          {METRIC_OPTIONS.map((metric) => {
            const active = visibleMetrics[metric.key];
            return (
              <button
                key={metric.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMetric(metric.key)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all",
                  active
                    ? "bg-white/12 text-white"
                    : "bg-white/[0.04] text-white/35 hover:text-white/60",
                )}
              >
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center rounded border"
                  style={{
                    borderColor: active
                      ? metric.color
                      : "rgba(255,255,255,0.18)",
                    backgroundColor: active
                      ? `${metric.color}22`
                      : "transparent",
                  }}
                >
                  {active && (
                    <Check
                      className="h-2.5 w-2.5"
                      style={{ color: metric.color }}
                    />
                  )}
                </span>
                <span>{metric.label}</span>
              </button>
            );
          })}
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
            {visibleMetrics.income && (
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
            )}
            {visibleMetrics.expense && (
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
            )}
            {visibleMetrics.savings && (
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
            )}
            {visibleMetrics.expectedSavings && (
              <MetricWidget
                title="Expected Savings"
                color={EXPECTED_SAVINGS_COLOR}
                total={
                  viewMode === "split" ? undefined : totals.expectedSavings
                }
                rows={rows}
                dataKey="expectedSavings"
                myKey="myExpectedSavings"
                myTotal={totals.myExpectedSavings}
                partnerKey="partnerExpectedSavings"
                partnerTotal={totals.partnerExpectedSavings}
                viewMode={viewMode}
                myColor={myColor}
                partnerColor={partnerColor}
              />
            )}
            {!hasVisibleMetric && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-10 text-center text-sm text-white/40">
                No metrics selected
              </div>
            )}
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
              visibleMetrics={visibleMetrics}
              myColor={myColor}
              partnerColor={partnerColor}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Blurred Y-axis tick (reads privacy context, blurs SVG text) ─────────────

function BlurredYAxisTick({
  x,
  y,
  payload,
  isBlurred,
  fontSize = 12,
}: {
  x?: number;
  y?: number;
  payload?: { value: number };
  isBlurred: boolean;
  fontSize?: number;
  [key: string]: unknown;
}) {
  if (!payload) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="middle"
      fill="rgba(255,255,255,0.55)"
      fontSize={fontSize}
      fontWeight={500}
      style={isBlurred ? { filter: "blur(5px)" } : undefined}
    >
      {fmtAxis(payload.value)}
    </text>
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
    const nonZero = rows.filter((r) => (r[dataKey] as number) !== 0);
    if (nonZero.length === 0) return 0;
    return (
      nonZero.reduce((s, r) => s + (r[dataKey] as number), 0) / nonZero.length
    );
  }, [rows, dataKey]);

  const displayTotal =
    viewMode === "split" ? myTotal + partnerTotal : (total ?? 0);

  return (
    <WidgetCard
      title={title}
      subtitle={
        zoomedRow
          ? `${zoomedRow.label} · ${fmtDollar(zoomedRow[dataKey] as number)}`
          : undefined
      }
      filterActive={!!zoomedKey}
      onFilterReset={() => setZoomedKey(null)}
      action={
        <div className="flex items-center gap-2">
          {viewMode === "split" && (
            <div className="flex items-center gap-2 text-[11px] tabular-nums font-semibold">
              <span style={{ color: myColor }}>{fmtDollar(myTotal)}</span>
              <span className="text-white/20">·</span>
              <span style={{ color: partnerColor }}>
                {fmtDollar(partnerTotal)}
              </span>
            </div>
          )}
          <BlurredAmount blurIntensity="sm">
            <span
              className="text-[15px] font-bold tabular-nums tracking-tight"
              style={{ color }}
            >
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
              <span className="font-semibold" style={{ color }}>
                {fmtDollar(displayTotal)}
              </span>
            </span>
          </BlurredAmount>
          <span className="text-white/20">|</span>
          <BlurredAmount blurIntensity="sm">
            <span>
              Avg:{" "}
              <span className="text-white/70 font-semibold">
                {fmtDollar(avg)}/mo
              </span>
            </span>
          </BlurredAmount>
          {viewMode === "split" && (
            <>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: myColor }}
                />
                <BlurredAmount blurIntensity="sm">
                  <span className="font-semibold" style={{ color: myColor }}>
                    {fmtDollar(myTotal)}
                  </span>
                </BlurredAmount>
              </span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: partnerColor }}
                />
                <BlurredAmount blurIntensity="sm">
                  <span
                    className="font-semibold"
                    style={{ color: partnerColor }}
                  >
                    {fmtDollar(partnerTotal)}
                  </span>
                </BlurredAmount>
              </span>
            </>
          )}
        </div>
      )}

      {/* Color accent bar */}
      <div
        className="h-[3px] rounded-full mb-4"
        style={{
          background: `linear-gradient(90deg, ${color}cc, ${color}40 60%, transparent)`,
        }}
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
              <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/50 font-medium">
                  {zoomedRow.label}
                </div>
                <BlurredAmount blurIntensity="sm">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color }}
                  >
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
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-[10px] text-white/50">
                        {p.label}
                      </span>
                      <BlurredAmount blurIntensity="sm">
                        <span
                          className="text-[11px] tabular-nums font-semibold"
                          style={{ color: p.color }}
                        >
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
  const { isBlurred } = usePrivacyBlur();
  const axisBase = { tickLine: false as const, axisLine: false as const };

  const xAxis = {
    dataKey: "label" as const,
    tick: { fill: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 },
    ...axisBase,
    tickMargin: 8,
  };
  const yAxis = {
    tick: <BlurredYAxisTick isBlurred={isBlurred} />,
    ...axisBase,
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
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            {label}
          </div>
          {viewMode === "split" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { label: "Me", color: myColor, value: me },
                { label: "Partner", color: partnerColor, value: partner },
              ].map((e) => (
                <div
                  key={e.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: e.color,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    >
                      {e.label}
                    </span>
                  </div>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 12,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      ...(isBlurred ? { filter: "blur(5px)" } : null),
                    }}
                  >
                    {fmtDollar(e.value)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  marginTop: 4,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    color,
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    ...(isBlurred ? { filter: "blur(5px)" } : null),
                  }}
                >
                  {fmtDollar(combined)}
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 13,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                ...(isBlurred ? { filter: "blur(5px)" } : null),
              }}
            >
              {fmtDollar(combined)}
            </div>
          )}
        </div>
      );
    },
    [
      rows,
      dataKey,
      myKey,
      partnerKey,
      viewMode,
      myColor,
      partnerColor,
      color,
      isBlurred,
    ],
  );

  const cursorProps = { fill: "rgba(255,255,255,0.04)", radius: 4 } as any;

  if (viewMode === "split") {
    return (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            barCategoryGap={zoomedKey ? "40%" : "18%"}
            barGap={2}
          >
            <ChartDefs id={`${uid}-me`} color={myColor} />
            <ChartDefs id={`${uid}-pt`} color={partnerColor} />
            <CartesianGrid
              strokeDasharray="3 6"
              stroke="rgba(255,255,255,0.10)"
              vertical={false}
            />
            <XAxis {...xAxis} />
            <YAxis {...yAxis} />
            <Tooltip content={renderTooltip as any} cursor={cursorProps} />
            <Bar
              dataKey={myKey as string}
              name="Me"
              fill="transparent"
              maxBarSize={zoomedKey ? 70 : 48}
              shape={(props: any) => (
                <OutlinedBar
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fillId={`${uid}-me-fill`}
                  hlId={`${uid}-me-hl`}
                  filterId={`${uid}-me-glow`}
                  strokeColor={myColor}
                  onClick={() => onBarClick(rows[props.index]?.key ?? "")}
                />
              )}
            />
            <Bar
              dataKey={partnerKey as string}
              name="Partner"
              fill="transparent"
              maxBarSize={zoomedKey ? 70 : 48}
              shape={(props: any) => (
                <OutlinedBar
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fillId={`${uid}-pt-fill`}
                  hlId={`${uid}-pt-hl`}
                  filterId={`${uid}-pt-glow`}
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
          <CartesianGrid
            strokeDasharray="3 6"
            stroke="rgba(255,255,255,0.10)"
            vertical={false}
          />
          <XAxis {...xAxis} />
          <YAxis {...yAxis} />
          <Tooltip content={renderTooltip as any} cursor={cursorProps} />
          <Bar
            dataKey={dataKey as string}
            fill="transparent"
            maxBarSize={zoomedKey ? 90 : 64}
            shape={(props: any) => (
              <OutlinedBar
                x={props.x}
                y={props.y}
                width={props.width}
                height={props.height}
                fillId={`${uid}-fill`}
                hlId={`${uid}-hl`}
                filterId={`${uid}-glow`}
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
  visibleMetrics,
  myColor,
  partnerColor,
}: {
  rows: BucketRow[];
  totals: Totals;
  viewMode: ViewMode;
  visibleMetrics: Record<MetricKey, boolean>;
  myColor: string;
  partnerColor: string;
}) {
  const uid = useId().replace(/:/g, "");
  const { isBlurred } = usePrivacyBlur();
  const axisBase = { tickLine: false as const, axisLine: false as const };

  const xAxis = {
    dataKey: "label" as const,
    tick: { fill: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600 },
    ...axisBase,
    tickMargin: 8,
  };
  const yAxis = {
    tick: <BlurredYAxisTick isBlurred={isBlurred} fontSize={11} />,
    ...axisBase,
    width: 52,
    tickMargin: 4,
  };

  const bars = (
    viewMode === "split"
      ? [
          {
            metric: "income" as const,
            key: "myIncome" as const,
            color: myColor,
            name: "Income (Me)",
          },
          {
            metric: "income" as const,
            key: "partnerIncome" as const,
            color: partnerColor,
            name: "Income (Partner)",
          },
          {
            metric: "expense" as const,
            key: "myExpense" as const,
            color: myColor,
            name: "Expense (Me)",
          },
          {
            metric: "expense" as const,
            key: "partnerExpense" as const,
            color: partnerColor,
            name: "Expense (Partner)",
          },
          {
            metric: "savings" as const,
            key: "mySavings" as const,
            color: myColor,
            name: "Savings (Me)",
          },
          {
            metric: "savings" as const,
            key: "partnerSavings" as const,
            color: partnerColor,
            name: "Savings (Partner)",
          },
          {
            metric: "expectedSavings" as const,
            key: "myExpectedSavings" as const,
            color: myColor,
            name: "Expected Savings (Me)",
          },
          {
            metric: "expectedSavings" as const,
            key: "partnerExpectedSavings" as const,
            color: partnerColor,
            name: "Expected Savings (Partner)",
          },
        ]
      : [
          {
            metric: "income" as const,
            key: "income" as const,
            color: INCOME_COLOR,
            name: "Income",
          },
          {
            metric: "expense" as const,
            key: "expense" as const,
            color: EXPENSE_COLOR,
            name: "Expense",
          },
          {
            metric: "savings" as const,
            key: "savings" as const,
            color: SAVINGS_COLOR,
            name: "Savings",
          },
          {
            metric: "expectedSavings" as const,
            key: "expectedSavings" as const,
            color: EXPECTED_SAVINGS_COLOR,
            name: "Expected Savings",
          },
        ]
  ).filter((bar) => visibleMetrics[bar.metric]);

  const actionItems = METRIC_OPTIONS.filter(
    (metric) => visibleMetrics[metric.key],
  ).map((metric) => ({
    ...metric,
    total: totals[metric.key],
  }));

  const renderTooltip = useCallback(
    ({ active, label }: { active?: boolean; label?: string }) => {
      if (!active || !label) return null;
      const row = rows.find((r) => r.label === label);
      if (!row) return null;

      const entries = (
        viewMode === "split"
          ? [
              {
                metric: "income" as const,
                label: "My Income",
                color: myColor,
                value: row.myIncome,
              },
              {
                metric: "income" as const,
                label: "Partner Income",
                color: partnerColor,
                value: row.partnerIncome,
              },
              {
                metric: "expense" as const,
                label: "My Expense",
                color: myColor,
                value: row.myExpense,
              },
              {
                metric: "expense" as const,
                label: "Partner Expense",
                color: partnerColor,
                value: row.partnerExpense,
              },
              {
                metric: "savings" as const,
                label: "My Savings",
                color: myColor,
                value: row.mySavings,
              },
              {
                metric: "savings" as const,
                label: "Partner Savings",
                color: partnerColor,
                value: row.partnerSavings,
              },
              {
                metric: "expectedSavings" as const,
                label: "My Expected Savings",
                color: myColor,
                value: row.myExpectedSavings,
              },
              {
                metric: "expectedSavings" as const,
                label: "Partner Expected Savings",
                color: partnerColor,
                value: row.partnerExpectedSavings,
              },
            ]
          : [
              {
                metric: "income" as const,
                label: "Income",
                color: INCOME_COLOR,
                value: row.income,
              },
              {
                metric: "expense" as const,
                label: "Expense",
                color: EXPENSE_COLOR,
                value: row.expense,
              },
              {
                metric: "savings" as const,
                label: "Savings",
                color: SAVINGS_COLOR,
                value: row.savings,
              },
              {
                metric: "expectedSavings" as const,
                label: "Expected Savings",
                color: EXPECTED_SAVINGS_COLOR,
                value: row.expectedSavings,
              },
            ]
      ).filter((entry) => visibleMetrics[entry.metric]);

      return (
        <div style={TOOLTIP_STYLE}>
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            {label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {entries
              .filter((e) => e.value !== 0)
              .map((e) => (
                <div
                  key={e.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 3,
                        backgroundColor: e.color,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    >
                      {e.label}
                    </span>
                  </div>
                  <span
                    style={{
                      color: e.color,
                      fontSize: 12,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      ...(isBlurred ? { filter: "blur(5px)" } : null),
                    }}
                  >
                    {fmtDollar(e.value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      );
    },
    [rows, viewMode, myColor, partnerColor, visibleMetrics, isBlurred],
  );

  const legendItems =
    viewMode === "split"
      ? [
          { color: myColor, label: "Me" },
          { color: partnerColor, label: "Partner" },
        ]
      : actionItems;

  return (
    <WidgetCard
      title="Monthly Overview"
      action={
        <BlurredAmount blurIntensity="sm">
          <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
            {actionItems.length > 0 ? (
              actionItems.map((item, index) => (
                <span key={item.key} className="contents">
                  {index > 0 && <span className="text-white/20">·</span>}
                  <span style={{ color: item.color }}>
                    {fmtDollar(item.total)}
                  </span>
                </span>
              ))
            ) : (
              <span className="text-white/35">No metrics</span>
            )}
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
              style={{
                background: `linear-gradient(135deg, ${lightenHex(item.color, 15)}, ${item.color})`,
              }}
            />
            <span className="text-xs text-white/65 font-medium">
              {item.label}
            </span>
            {"total" in item && item.total != null && (
              <BlurredAmount blurIntensity="sm">
                <span
                  className="text-xs tabular-nums font-bold"
                  style={{ color: item.color }}
                >
                  {fmtDollar(item.total)}
                </span>
              </BlurredAmount>
            )}
          </div>
        ))}
        {viewMode === "split" && (
          <div className="ml-auto flex items-center gap-4 text-[11px] tabular-nums font-semibold text-white/40">
            <span>
              {METRIC_OPTIONS.filter((metric) => visibleMetrics[metric.key])
                .map((metric) => metric.label)
                .join(" · ") || "No metrics"}
            </span>
            <span className="text-white/20">(by color above)</span>
          </div>
        )}
      </div>

      {/* Chart */}
      {bars.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barCategoryGap="15%" barGap={2}>
              {bars.map((b, i) => (
                <ChartDefs key={b.key} id={`${uid}-b${i}`} color={b.color} />
              ))}
              <CartesianGrid
                strokeDasharray="3 6"
                stroke="rgba(255,255,255,0.10)"
                vertical={false}
              />
              <XAxis {...xAxis} />
              <YAxis {...yAxis} />
              <Tooltip
                content={renderTooltip as any}
                cursor={{ fill: "rgba(255,255,255,0.04)", radius: 4 } as any}
              />
              {bars.map((b, i) => (
                <Bar
                  key={b.key}
                  dataKey={b.key}
                  name={b.name}
                  fill="transparent"
                  shape={(props: any) => (
                    <OutlinedBar
                      x={props.x}
                      y={props.y}
                      width={props.width}
                      height={props.height}
                      fillId={`${uid}-b${i}-fill`}
                      hlId={`${uid}-b${i}-hl`}
                      filterId={`${uid}-b${i}-glow`}
                      strokeColor={b.color}
                    />
                  )}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-72 flex items-center justify-center text-sm text-white/40">
          No metrics selected
        </div>
      )}
    </WidgetCard>
  );
}
