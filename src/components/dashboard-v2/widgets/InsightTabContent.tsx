"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import InsightFocusPanel from "@/components/dashboard-v2/widgets/InsightFocusPanel";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import {
  detectTransactionOutliers,
  type RecurringHint,
  type TransactionOutlier,
} from "@/lib/utils/anomalyDetection";
import {
  getIncomeTransactions,
  getSpendingTransactions,
  spendAmount,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import type { BudgetSummary } from "@/types/budgetAllocation";
import type { Account } from "@/types/domain";
import { format, subMonths } from "date-fns";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Fragment, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Colors ───────────────────────────────────────────────────────────────────

const EXPENSE_COLOR = "#fb7185";
const EXPECTED_SAVINGS_COLOR = "#22d3ee";
const INCOME_COLOR = "#34d399";
const BUDGET_COLOR = "#34d399";
const OTHER_COLOR = "#64748b";

// Neon-futuristic palette for category fallback colors
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
  "#38bdf8",
  "#c084fc",
];

const MAX_STACK_CATEGORIES = 10;

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  /** Expense transactions, already debt-filtered, with category + category_color */
  expenseTransactions: TransactionWithAccount[];
  /** All transactions for the period (every account type) — drives the cash-flow pie */
  allTransactions: TransactionWithAccount[];
  /** Household accounts — used to classify transactions by type for the pie */
  accounts: Account[] | undefined;
  /** Analytics months (oldest → newest) — feeds the focus drill-down panel */
  analyticsMonths: MonthlyAnalytics[] | undefined;
  /** Current-month budget summary from useBudgetAllocations */
  budgetSummary: BudgetSummary | undefined;
  /** Registered recurring payments — exempted from outlier flagging */
  recurringHints?: RecurringHint[];
  /** Active global date range (header filter) — scopes the cash-flow pie */
  startDate: string;
  endDate: string;
};

type MonthBucket = { key: string; label: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDollar(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function fmtFull(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Build 12 month buckets ending at the current month */
function build12Months(): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy") });
  }
  return buckets;
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

/** Lighten a hex color by a percentage (toward white) */
function lightenHex(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  const num = parseInt(
    c.length === 3
      ? c
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : c,
    16,
  );
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (ch: number) => Math.round(ch + (255 - ch) * (pct / 100));
  return `#${[mix(r), mix(g), mix(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** SVG defs for outlined bars with luminous glow */
function ChartDefs({ id, color }: { id: string; color: string }) {
  const bright = lightenHex(color, 30);
  return (
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bright} stopOpacity={0.45} />
        <stop offset="50%" stopColor={color} stopOpacity={0.22} />
        <stop offset="100%" stopColor={color} stopOpacity={0.1} />
      </linearGradient>
      <linearGradient id={`${id}-highlight`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.28} />
        <stop offset="20%" stopColor="#fff" stopOpacity={0.1} />
        <stop offset="50%" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
      <filter id={`${id}-glow`} x="-40%" y="-15%" width="180%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
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
  dim,
  onClick,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fillId: string;
  highlightId: string;
  filterId: string;
  strokeColor: string;
  dim?: boolean;
  onClick?: () => void;
}) {
  if (!height || height <= 0) return null;
  const r = Math.min(5, width / 2, height);
  const bright = lightenHex(strokeColor, 25);
  return (
    <g
      filter={`url(#${filterId})`}
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : undefined,
        opacity: dim ? 0.16 : 1,
        transition: "opacity 0.18s ease",
      }}
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
        fill={`url(#${highlightId})`}
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function InsightTabContent({
  expenseTransactions,
  allTransactions,
  accounts,
  analyticsMonths,
  budgetSummary,
  recurringHints,
  startDate,
  endDate,
}: Props) {
  const [hideOutliers, setHideOutliers] = useState(false);
  const [showOutlierList, setShowOutlierList] = useState(false);
  const uid = useId().replace(/:/g, "");
  const { isBlurred: isAmountBlurred } = usePrivacyBlur();

  // ── Focus state: a month and/or a category drive the side insight panel ───
  const [focusedMonth, setFocusedMonth] = useState<string | null>(null);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const isFocused = focusedMonth !== null || focusedCategory !== null;
  const clearFocus = () => {
    setFocusedMonth(null);
    setFocusedCategory(null);
  };

  const months = useMemo(() => build12Months(), []);
  const currentMonthKey = months[months.length - 1]?.key;

  /** Click a stacked segment — two-step zoom:
   *  1. First click on any segment → zoom to that month (no category yet)
   *  2. Second click on a segment in the focused month → filter by category
   *  3. Clicking the same segment again → zoom all the way out */
  const handleSegmentClick = (cat: string, monthKey: string | undefined) => {
    if (!monthKey) return;
    const nextCat = cat === "Other" ? null : cat;

    if (focusedMonth === null) {
      // Step 1: zoom to month
      setFocusedMonth(monthKey);
      setFocusedCategory(null);
    } else if (focusedMonth !== monthKey) {
      // Different month clicked → switch month, clear category
      setFocusedMonth(monthKey);
      setFocusedCategory(null);
    } else if (focusedCategory === null) {
      // Step 2: month already focused → zoom into category
      setFocusedCategory(nextCat);
    } else if (focusedCategory === nextCat) {
      // Same segment clicked again → zoom out to full period
      clearFocus();
    } else {
      // Different segment in same month → switch category
      setFocusedCategory(nextCat);
    }
  };

  /** Legend chip → toggle a category across all months. */
  const handleCategoryToggle = (cat: string) => {
    if (cat === "Other") return; // aggregate bucket — not focusable
    setFocusedCategory((prev) => (prev === cat ? null : cat));
  };

  // ── Outlier detection (runtime, no persistence) ───────────────────────────
  const outliers = useMemo(
    () =>
      detectTransactionOutliers(
        expenseTransactions
          // A partner's private (masked) transaction must never be surfaced as a
          // reviewable outlier — the viewer can't act on it and its amount must
          // never be flashed. It still counts in the category totals above.
          .filter((t) => !(t as { is_masked?: boolean }).is_masked)
          .map((t) => ({
            id: t.id,
            amount: Math.abs(t.amount),
            category: t.category ?? "Uncategorized",
            description: t.description ?? null,
            date: t.date,
          })),
        { recurringHints },
      ),
    [expenseTransactions, recurringHints],
  );

  const txById = useMemo(() => {
    const map = new Map<string, TransactionWithAccount>();
    for (const t of expenseTransactions) map.set(t.id, t);
    return map;
  }, [expenseTransactions]);

  const outlierIds = useMemo(
    () => new Set(outliers.map((o) => o.transactionId)),
    [outliers],
  );
  const outlierCount = outlierIds.size;
  const outlierTotal = useMemo(
    () => outliers.reduce((s, o) => s + o.amount, 0),
    [outliers],
  );

  // Group flagged outliers by month (newest first) for the reviewable list
  const outliersByMonth = useMemo(() => {
    const groups = new Map<string, TransactionOutlier[]>();
    for (const o of outliers) {
      const key = o.date.slice(0, 7);
      const list = groups.get(key);
      if (list) list.push(o);
      else groups.set(key, [o]);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({
        key,
        label: format(new Date(`${key}-01`), "MMM yyyy"),
        items: items
          .slice()
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              a.category.localeCompare(b.category),
          ),
      }));
  }, [outliers]);

  // ── Build stacked-bar data: month × category ──────────────────────────────
  const { stackData, categoryMeta, totalSpend } = useMemo(() => {
    const visibleTxs = hideOutliers
      ? expenseTransactions.filter((t) => !outlierIds.has(t.id))
      : expenseTransactions;

    // Aggregate amount per category across the 12-month window
    const monthKeys = new Set(months.map((m) => m.key));
    const catTotals: Record<string, number> = {};
    const catColors: Record<string, string> = {};
    // month → category → amount
    const byMonthCat: Record<string, Record<string, number>> = {};
    for (const m of months) byMonthCat[m.key] = {};

    for (const t of visibleTxs) {
      const monthKey = t.date.slice(0, 7);
      if (!monthKeys.has(monthKey)) continue;
      const cat = t.category ?? "Uncategorized";
      const amt = Math.abs(t.amount);
      catTotals[cat] = (catTotals[cat] ?? 0) + amt;
      if (!catColors[cat] && t.category_color) {
        catColors[cat] = t.category_color;
      }
      byMonthCat[monthKey][cat] = (byMonthCat[monthKey][cat] ?? 0) + amt;
    }

    // Rank categories, keep top N, fold the rest into "Other"
    const ranked = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const topNames = ranked
      .slice(0, MAX_STACK_CATEGORIES)
      .map(([name]) => name);
    const hasOther = ranked.length > MAX_STACK_CATEGORIES;

    const categoryMeta = topNames.map((name, i) => ({
      name,
      color: catColors[name] || PALETTE[i % PALETTE.length],
    }));
    if (hasOther) categoryMeta.push({ name: "Other", color: OTHER_COLOR });

    const topSet = new Set(topNames);
    const stackData = months.map((m) => {
      const row: Record<string, number | string> = {
        month: m.label,
        key: m.key,
      };
      let monthTotal = 0;
      let otherTotal = 0;
      for (const [cat, amt] of Object.entries(byMonthCat[m.key])) {
        monthTotal += amt;
        if (topSet.has(cat)) row[cat] = amt;
        else otherTotal += amt;
      }
      if (hasOther) row["Other"] = otherTotal;
      row.__total = monthTotal;
      return row;
    });

    const totalSpend = Object.values(catTotals).reduce((s, v) => s + v, 0);
    return { stackData, categoryMeta, totalSpend };
  }, [expenseTransactions, hideOutliers, outlierIds, months]);

  // Stable name → color lookup shared by the chart legend and the focus panel.
  const categoryColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categoryMeta) map[c.name] = c.color;
    return map;
  }, [categoryMeta]);

  // ── Budget: total monthly budget + per-category map ───────────────────────
  const { totalBudget, budgetByCategory } = useMemo(() => {
    const map: Record<string, { budget: number; spent: number }> = {};
    let total = 0;
    for (const c of budgetSummary?.categories ?? []) {
      if (c.total_budget > 0) {
        total += c.total_budget;
        map[c.category_name] = {
          budget: c.total_budget,
          spent: c.total_spent,
        };
      }
    }
    return { totalBudget: total, budgetByCategory: map };
  }, [budgetSummary]);

  // ── Pie: cash flow (money in vs money out) over the selected period ───────
  // Computed from the SAME client transactions that feed the stacked chart and
  // with the same rule (debt repayments excluded), so the pie's "Spent" total
  // reconciles exactly with the spending total above. Income is summed from
  // income-type accounts. Previously this read from a separate 12-month
  // analytics fetch that counted debt-return charges as expense — that mismatch
  // is what made the two totals disagree ($1,856 vs $2,116).
  const { pie, periodLabel } = useMemo(() => {
    const inRange = (t: TransactionWithAccount) => {
      const d = t.date.slice(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    };

    const incomeTxns = getIncomeTransactions(allTransactions, accounts).filter(
      (t) => !t.is_debt_return && inRange(t),
    );
    // Spending uses the canonical helper so this total reconciles exactly with
    // the Categories total and the Monthly bars (same rule set everywhere).
    const spendTxns = getSpendingTransactions(allTransactions, accounts, {
      start: startDate,
      end: endDate,
    });

    const income = incomeTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = spendTxns.reduce((s, t) => s + spendAmount(t), 0);
    const net = income - expense; // positive = kept · negative = overspent
    const overspent = net < 0;
    const savingsRate = income > 0 ? (net / income) * 100 : 0;

    // The ring sums to income: it splits the period's income into what was
    // spent vs what was kept. When overspent there is nothing kept, so the ring
    // is all "Spent" and the centre flags the shortfall.
    const slices = overspent
      ? [{ name: "Spent", value: expense, color: EXPENSE_COLOR }]
      : [
          { name: "Spent", value: expense, color: EXPENSE_COLOR },
          { name: "Kept", value: net, color: EXPECTED_SAVINGS_COLOR },
        ];

    const fmtKey = (d: string) =>
      format(new Date(`${d.slice(0, 7)}-01`), "MMM yyyy");
    let periodLabel = "All time";
    if (startDate && endDate) {
      const a = fmtKey(startDate);
      const b = fmtKey(endDate);
      periodLabel = a === b ? a : `${a} – ${b}`;
    } else if (startDate) {
      periodLabel = `From ${fmtKey(startDate)}`;
    } else if (endDate) {
      periodLabel = `Until ${fmtKey(endDate)}`;
    }

    return {
      pie: { income, expense, net, overspent, savingsRate, slices },
      periodLabel,
    };
  }, [allTransactions, accounts, startDate, endDate]);

  const hasData =
    expenseTransactions.length > 0 ||
    allTransactions.length > 0 ||
    (analyticsMonths?.length ?? 0) > 0;
  if (!hasData) {
    return (
      <WidgetCard title="Insight">
        <p className="text-white/40 text-xs text-center py-10">
          No data for this period
        </p>
      </WidgetCard>
    );
  }

  // ── Stacked bar tooltip ───────────────────────────────────────────────────
  type TooltipEntry = {
    dataKey: string;
    value: number;
    color: string;
    payload: Record<string, number | string>;
  };
  const StackTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const monthKey = payload[0]?.payload?.key as string | undefined;
    const total = (payload[0]?.payload?.__total as number) ?? 0;
    const isCurrent = monthKey === currentMonthKey;
    const rows = payload
      .filter((p) => p.dataKey !== "__total" && (p.value ?? 0) > 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return (
      <div style={TOOLTIP_STYLE}>
        <p className="text-white font-semibold mb-1.5">{label}</p>
        {rows.map((p) => {
          const cb = isCurrent ? budgetByCategory[p.dataKey] : undefined;
          return (
            <div
              key={p.dataKey}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="text-white/70">{p.dataKey}</span>
              </span>
              <span
                className="text-white tabular-nums"
                style={isAmountBlurred ? { filter: "blur(5px)" } : undefined}
              >
                {fmtFull(p.value)}
                {cb && (
                  <span className="text-white/35">
                    {" "}
                    / {fmtDollar(cb.budget)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between gap-4 text-xs">
          <span className="text-white/50">Total</span>
          <span
            className="text-white font-semibold tabular-nums"
            style={isAmountBlurred ? { filter: "blur(5px)" } : undefined}
          >
            {fmtFull(total)}
          </span>
        </div>
        {isCurrent && totalBudget > 0 && (
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-emerald-400/70">Budget</span>
            <span
              className={cn(
                "tabular-nums font-medium",
                total > totalBudget ? "text-rose-400" : "text-emerald-400",
              )}
              style={isAmountBlurred ? { filter: "blur(5px)" } : undefined}
            >
              {total > totalBudget
                ? `+${fmtFull(total - totalBudget)} over`
                : `${fmtFull(totalBudget - total)} left`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "grid gap-4",
        isFocused && "xl:grid-cols-[minmax(0,1fr)_360px]",
      )}
    >
      <div className="space-y-4 min-w-0">
        {/* ── Monthly spending — stacked by category ───────────────────────── */}
        <WidgetCard
          title="Monthly Spending by Category"
          subtitle={`Monthly breakdown · ${categoryMeta.length} categories${
            totalBudget > 0 ? " · budget line shown" : ""
          } · tap a bar to zoom in · tap a stack to filter`}
          interactive
          filterActive={isFocused}
          onFilterReset={clearFocus}
          action={
            <button
              onClick={() => setHideOutliers((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                hideOutliers
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                  : "bg-white/5 text-white/50 hover:text-white/70 hover:bg-white/10",
              )}
              title="Hide unusually large one-off or out-of-pattern transactions"
            >
              {hideOutliers ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              {hideOutliers ? "Outliers hidden" : "Hide outliers"}
            </button>
          }
        >
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                Total spent
              </span>
              <BlurredAmount blurIntensity="sm">
                <span className="text-lg font-bold text-white tabular-nums">
                  {fmtFull(totalSpend)}
                </span>
              </BlurredAmount>
            </div>
            <span className="text-[10px] text-white/40">{periodLabel}</span>
          </div>

          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackData}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={({ x, y, payload }: any) =>
                    payload ? (
                      <text
                        x={x}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="rgba(255,255,255,0.35)"
                        fontSize={10}
                        fontWeight={500}
                        style={
                          isAmountBlurred ? { filter: "blur(5px)" } : undefined
                        }
                      >
                        {fmtDollar(payload.value)}
                      </text>
                    ) : null
                  }
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={<StackTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                {categoryMeta.map((c, i) => (
                  <ChartDefs key={c.name} id={`${uid}-c${i}`} color={c.color} />
                ))}
                {categoryMeta.map((c, i) => (
                  <Bar
                    key={c.name}
                    dataKey={c.name}
                    stackId="spend"
                    fill="transparent"
                    maxBarSize={48}
                    shape={(props: {
                      x: number;
                      y: number;
                      width: number;
                      height: number;
                      payload?: { key?: string };
                    }) => {
                      const monthKey = props.payload?.key;
                      const monthDim =
                        focusedMonth !== null && monthKey !== focusedMonth;
                      const catDim =
                        focusedCategory !== null && c.name !== focusedCategory;
                      return (
                        <OutlinedBar
                          x={props.x}
                          y={props.y}
                          width={props.width}
                          height={props.height}
                          fillId={`${uid}-c${i}-fill`}
                          highlightId={`${uid}-c${i}-highlight`}
                          filterId={`${uid}-c${i}-glow`}
                          strokeColor={c.color}
                          dim={monthDim || catDim}
                          onClick={() => handleSegmentClick(c.name, monthKey)}
                        />
                      );
                    }}
                  />
                ))}
                {totalBudget > 0 && (
                  <ReferenceLine
                    y={totalBudget}
                    stroke={BUDGET_COLOR}
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Budget ${fmtDollar(totalBudget)}`,
                      position: "insideTopRight",
                      fill: BUDGET_COLOR,
                      fontSize: 10,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend — tap a category to focus it across all months */}
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
            {categoryMeta.map((c) => {
              const isOther = c.name === "Other";
              const active = focusedCategory === c.name;
              return (
                <button
                  key={c.name}
                  onClick={() => handleCategoryToggle(c.name)}
                  disabled={isOther}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                    isOther
                      ? "cursor-default"
                      : "hover:bg-white/10 cursor-pointer",
                    active && "bg-white/15 ring-1 ring-white/15",
                    focusedCategory !== null &&
                      !active &&
                      !isOther &&
                      "opacity-40",
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="text-white/55">{c.name}</span>
                </button>
              );
            })}
          </div>

          {outlierCount > 0 && (
            <div className="mt-2">
              {hideOutliers && (
                <p className="text-[11px] text-amber-300/80">
                  {outlierCount} outlier transaction
                  {outlierCount === 1 ? "" : "s"} hidden (
                  <BlurredAmount blurIntensity="sm">
                    {fmtFull(outlierTotal)}
                  </BlurredAmount>
                  )
                </p>
              )}
              <button
                onClick={() => setShowOutlierList((v) => !v)}
                className="mt-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    showOutlierList && "rotate-180",
                  )}
                />
                {showOutlierList ? "Hide" : "View"} {outlierCount} outlier
                {outlierCount === 1 ? "" : "s"}
              </button>

              {showOutlierList && (
                <div className="mt-2 space-y-3 rounded-xl bg-white/5 border border-white/10 p-3">
                  {outliersByMonth.map((group) => (
                    <div key={group.key}>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                        {group.label}
                      </p>
                      <div className="space-y-1.5">
                        {group.items.map((o) => {
                          const tx = txById.get(o.transactionId);
                          return (
                            <div
                              key={o.transactionId}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{
                                    background:
                                      tx?.category_color || OTHER_COLOR,
                                  }}
                                />
                                <span className="text-white/70 truncate">
                                  {o.category}
                                </span>
                                {tx?.description && (
                                  <span className="text-white/35 truncate">
                                    · {tx.description}
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-1.5 flex-shrink-0">
                                <BlurredAmount blurIntensity="sm">
                                  <span className="text-white tabular-nums font-medium">
                                    {fmtFull(o.amount)}
                                  </span>
                                </BlurredAmount>
                                <span
                                  className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                                    o.reason === "rare"
                                      ? "bg-violet-500/15 text-violet-300"
                                      : "bg-amber-500/15 text-amber-300",
                                  )}
                                >
                                  {o.reason}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </WidgetCard>

        {/* ── Income vs Spending (cash flow) ───────────────────────────────── */}
        <WidgetCard
          title="Income vs Spending"
          subtitle="Money in, money out, and what's left · debt repayments excluded"
          action={
            periodLabel ? (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] tabular-nums text-white/55">
                {periodLabel}
              </span>
            ) : undefined
          }
        >
          <div className="flex items-center gap-4">
            {/* Pie */}
            <div
              className="relative flex-shrink-0"
              style={{ width: 170, height: 170 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {pie.slices.map((s, i) => {
                      const bright = lightenHex(s.color, 35);
                      return (
                        <Fragment key={s.name}>
                          <radialGradient
                            id={`${uid}-pie${i}-fill`}
                            cx="35%"
                            cy="30%"
                            r="75%"
                          >
                            <stop
                              offset="0%"
                              stopColor={bright}
                              stopOpacity={0.85}
                            />
                            <stop
                              offset="55%"
                              stopColor={s.color}
                              stopOpacity={0.65}
                            />
                            <stop
                              offset="100%"
                              stopColor={s.color}
                              stopOpacity={0.45}
                            />
                          </radialGradient>
                          <filter
                            id={`${uid}-pie${i}-glow`}
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                          >
                            <feGaussianBlur
                              in="SourceGraphic"
                              stdDeviation="3.5"
                              result="blur"
                            />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </Fragment>
                      );
                    })}
                  </defs>
                  <Pie
                    data={pie.slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pie.slices.map((s, i) => (
                      <Cell
                        key={s.name}
                        fill={`url(#${uid}-pie${i}-fill)`}
                        stroke={lightenHex(s.color, 25)}
                        strokeWidth={1}
                        strokeOpacity={0.6}
                        style={{ filter: `url(#${uid}-pie${i}-glow)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      <span
                        key="value"
                        style={
                          isAmountBlurred
                            ? { filter: "blur(5px)" }
                            : undefined
                        }
                      >
                        {fmtFull(Number(value))}
                      </span>,
                      name as string,
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center: the single takeaway — kept or overspent */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-3 text-center">
                <p className="text-[9px] uppercase tracking-wider text-white/40">
                  {pie.overspent ? "Overspent" : "Kept"}
                </p>
                <BlurredAmount blurIntensity="sm">
                  <p
                    className="text-base font-bold tabular-nums"
                    style={{
                      color: pie.overspent
                        ? EXPENSE_COLOR
                        : EXPECTED_SAVINGS_COLOR,
                    }}
                  >
                    {fmtFull(Math.abs(pie.net))}
                  </p>
                </BlurredAmount>
                <p className="text-[9px] text-white/35 tabular-nums">
                  {pie.income > 0
                    ? pie.overspent
                      ? `${Math.abs(pie.savingsRate).toFixed(0)}% over income`
                      : `${pie.savingsRate.toFixed(0)}% of income saved`
                    : "no income logged"}
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <LegendRow
                label="Income"
                value={pie.income}
                color={INCOME_COLOR}
              />
              <LegendRow
                label="Spent"
                value={pie.expense}
                color={EXPENSE_COLOR}
              />
              <LegendRow
                label={pie.overspent ? "Overspent" : "Kept / saved"}
                value={Math.abs(pie.net)}
                color={EXPECTED_SAVINGS_COLOR}
                negative={pie.overspent}
              />
              <div className="flex items-center justify-between gap-2 pt-1.5 mt-0.5 border-t border-white/10">
                <span className="text-xs text-white/45">Savings rate</span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{
                    color: pie.overspent ? "#fb7185" : EXPECTED_SAVINGS_COLOR,
                  }}
                >
                  {pie.income > 0 ? `${pie.savingsRate.toFixed(0)}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </WidgetCard>
      </div>

      {/* ── Focus insight panel — appears on the right (below on mobile) ──── */}
      {isFocused && (
        <InsightFocusPanel
          expenseTransactions={expenseTransactions}
          months={months}
          analyticsMonths={analyticsMonths}
          budgetByCategory={budgetByCategory}
          totalBudget={totalBudget}
          currentMonthKey={currentMonthKey}
          categoryColors={categoryColors}
          outliers={outliers}
          focusedMonth={focusedMonth}
          focusedCategory={focusedCategory}
          onFocusMonth={setFocusedMonth}
          onFocusCategory={setFocusedCategory}
          onClear={clearFocus}
        />
      )}
    </div>
  );
}

function LegendRow({
  label,
  value,
  color,
  negative,
}: {
  label: string;
  value: number;
  color: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/10"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
        <span className="text-xs text-white/60 truncate">{label}</span>
      </span>
      <BlurredAmount blurIntensity="sm">
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: negative ? "#fb7185" : color }}
        >
          {fmtFull(value)}
        </span>
      </BlurredAmount>
    </div>
  );
}
