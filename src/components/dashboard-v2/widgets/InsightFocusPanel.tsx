"use client";

import BlurredAmount from "@/components/ui/BlurredAmount";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import type { TransactionOutlier } from "@/lib/utils/anomalyDetection";
import type { TransactionWithAccount } from "@/lib/utils/incomeExpense";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  EyeOff,
  Minus,
  Sparkles,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type MonthBucket = { key: string; label: string };

type Props = {
  expenseTransactions: TransactionWithAccount[];
  months: MonthBucket[];
  analyticsMonths: MonthlyAnalytics[] | undefined;
  budgetByCategory: Record<string, { budget: number; spent: number }>;
  totalBudget: number;
  currentMonthKey: string | undefined;
  categoryColors: Record<string, string>;
  outliers: TransactionOutlier[];
  focusedMonth: string | null;
  focusedCategory: string | null;
  onFocusMonth: (m: string | null) => void;
  onFocusCategory: (c: string | null) => void;
  onClear: () => void;
};

const FALLBACK_COLOR = "#64748b";

// ── Format helpers ───────────────────────────────────────────────────────────

function fmtFull(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDollar(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function monthLabel(key: string): string {
  return format(new Date(`${key}-01`), "MMM yyyy");
}

function pctDelta(curr: number, base: number): number | null {
  if (base <= 0) return null;
  return ((curr - base) / base) * 100;
}

// ── Presentational atoms ─────────────────────────────────────────────────────

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] text-white/45">{label}</span>
      <span className="text-xs font-medium text-white/85 tabular-nums">
        {children}
      </span>
    </div>
  );
}

/** Up = spent more (rose), down = spent less (emerald). */
function Delta({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-white/30">—</span>;
  }
  const up = pct >= 0;
  const Icon = Math.abs(pct) < 0.5 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        Math.abs(pct) < 0.5
          ? "text-white/45"
          : up
            ? "text-rose-400"
            : "text-emerald-400",
      )}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mt-3 mb-1.5">
      {children}
    </p>
  );
}

/** Horizontal mini bar (share of a max). */
function ShareBar({
  label,
  value,
  max,
  color,
  onClick,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  onClick?: () => void;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const Wrap = onClick ? "button" : "div";
  return (
    <Wrap
      onClick={onClick}
      className={cn(
        "w-full text-left group/row",
        onClick && "cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span
            className={cn(
              "text-[11px] text-white/65 truncate",
              onClick && "group-hover/row:text-white/90",
            )}
          >
            {label}
          </span>
        </span>
        <BlurredAmount blurIntensity="sm">
          <span className="text-[11px] text-white/80 tabular-nums flex-shrink-0">
            {fmtDollar(value)}
          </span>
        </BlurredAmount>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </Wrap>
  );
}

/** Vertical 12-month sparkline; bars are clickable to focus a month. */
function MiniBars({
  data,
  color,
  activeKey,
  onPick,
}: {
  data: { key: string; label: string; value: number }[];
  color: string;
  activeKey: string | null;
  onPick: (key: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-14">
      {data.map((d) => {
        const h = Math.max((d.value / max) * 100, d.value > 0 ? 6 : 2);
        const active = d.key === activeKey;
        return (
          <button
            key={d.key}
            onClick={() => onPick(d.key)}
            title={`${d.label}: ${fmtFull(d.value)}`}
            className="flex-1 flex items-end h-full group/bar"
          >
            <span
              className="w-full rounded-sm transition-all group-hover/bar:opacity-100"
              style={{
                height: `${h}%`,
                background: color,
                opacity: active ? 1 : activeKey ? 0.3 : 0.6,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

function TxRow({
  desc,
  date,
  amount,
  color,
  isOutlier,
  masked = false,
}: {
  desc: string;
  date: string;
  amount: number;
  color: string;
  isOutlier: boolean;
  /** Partner's private transaction — amount permanently blurred (eye toggle
   *  can't reveal it); only the owner sees it. */
  masked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <span className="text-white/70 truncate">{desc}</span>
        {masked && (
          <EyeOff
            className="w-3 h-3 text-slate-500 flex-shrink-0"
            aria-label="Private — only your partner can see this amount"
          />
        )}
        {isOutlier && (
          <span className="text-[8px] px-1 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-medium flex-shrink-0">
            outlier
          </span>
        )}
      </span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] text-white/30 tabular-nums">
          {format(new Date(`${date}T00:00:00`), "MMM d")}
        </span>
        <BlurredAmount blurIntensity="sm" forceBlur={masked}>
          <span className="text-white/85 tabular-nums font-medium">
            {fmtFull(amount)}
          </span>
        </BlurredAmount>
      </span>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function InsightFocusPanel({
  expenseTransactions,
  months,
  analyticsMonths,
  budgetByCategory,
  totalBudget,
  currentMonthKey,
  categoryColors,
  outliers,
  focusedMonth,
  focusedCategory,
  onFocusMonth,
  onFocusCategory,
  onClear,
}: Props) {
  const colorFor = (cat: string) => categoryColors[cat] || FALLBACK_COLOR;

  const outlierIds = useMemo(
    () => new Set(outliers.map((o) => o.transactionId)),
    [outliers],
  );

  // Aggregate the 12-month window once.
  const agg = useMemo(() => {
    const keys = new Set(months.map((m) => m.key));
    const monthTotal = new Map<string, number>(months.map((m) => [m.key, 0]));
    const monthCat = new Map<string, Map<string, number>>(
      months.map((m) => [m.key, new Map()]),
    );
    const catTotal = new Map<string, number>();
    const catByMonth = new Map<string, Map<string, number>>();
    let totalSpend = 0;

    for (const t of expenseTransactions) {
      const mk = t.date.slice(0, 7);
      if (!keys.has(mk)) continue;
      const cat = t.category ?? "Uncategorized";
      const amt = Math.abs(t.amount);
      totalSpend += amt;
      monthTotal.set(mk, (monthTotal.get(mk) ?? 0) + amt);
      const mc = monthCat.get(mk)!;
      mc.set(cat, (mc.get(cat) ?? 0) + amt);
      catTotal.set(cat, (catTotal.get(cat) ?? 0) + amt);
      let cbm = catByMonth.get(cat);
      if (!cbm) {
        cbm = new Map();
        catByMonth.set(cat, cbm);
      }
      cbm.set(mk, (cbm.get(mk) ?? 0) + amt);
    }

    const monthsWithData = months.filter(
      (m) => (monthTotal.get(m.key) ?? 0) > 0,
    ).length;

    return { monthTotal, monthCat, catTotal, catByMonth, totalSpend, monthsWithData };
  }, [expenseTransactions, months]);

  const analyticsByKey = useMemo(() => {
    const map = new Map<string, MonthlyAnalytics>();
    for (const m of analyticsMonths ?? []) map.set(m.month, m);
    return map;
  }, [analyticsMonths]);

  // ── Header chips (removable) ─────────────────────────────────────────────
  const header = (
    <div className="flex items-start justify-between gap-2 mb-1">
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <Sparkles className="w-3.5 h-3.5" />
          Insights
        </span>
        {focusedMonth && (
          <Chip
            label={monthLabel(focusedMonth)}
            onRemove={() => onFocusMonth(null)}
          />
        )}
        {focusedCategory && (
          <Chip
            label={focusedCategory}
            color={colorFor(focusedCategory)}
            onRemove={() => onFocusCategory(null)}
          />
        )}
      </div>
      <button
        onClick={onClear}
        className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors flex-shrink-0"
        title="Close insights"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // ── Body view selection ──────────────────────────────────────────────────
  let body: React.ReactNode = null;
  if (focusedMonth && focusedCategory) {
    body = renderBothView();
  } else if (focusedMonth) {
    body = renderMonthView();
  } else if (focusedCategory) {
    body = renderCategoryView();
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="neo-card rounded-xl p-4 xl:sticky xl:top-4 xl:self-start"
    >
      {header}
      {body}
    </motion.aside>
  );

  // ── Views ────────────────────────────────────────────────────────────────

  function renderMonthView() {
    const key = focusedMonth!;
    const total = agg.monthTotal.get(key) ?? 0;
    const idx = months.findIndex((m) => m.key === key);
    const prevKey = idx > 0 ? months[idx - 1].key : null;
    const prevTotal = prevKey ? (agg.monthTotal.get(prevKey) ?? 0) : 0;
    const avg = agg.monthsWithData > 0 ? agg.totalSpend / agg.monthsWithData : 0;

    const ranked = months
      .map((m) => ({ key: m.key, total: agg.monthTotal.get(m.key) ?? 0 }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total);
    const rank = ranked.findIndex((m) => m.key === key) + 1;

    const an = analyticsByKey.get(key);
    const cats = Array.from(agg.monthCat.get(key)?.entries() ?? [])
      .sort((a, b) => b[1] - a[1]);
    const maxCat = cats[0]?.[1] ?? 0;
    const monthOutliers = outliers
      .filter((o) => o.date.slice(0, 7) === key)
      .sort((a, b) => b.amount - a.amount);

    return (
      <div>
        <div className="flex items-end justify-between gap-2 mt-2">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              Total spent
            </p>
            <BlurredAmount blurIntensity="sm">
              <p className="text-2xl font-bold text-white tabular-nums">
                {fmtFull(total)}
              </p>
            </BlurredAmount>
          </div>
          {rank > 0 && ranked.length > 1 && (
            <span className="text-[10px] text-white/45 mb-1">
              {ordinal(rank)} highest of {ranked.length}
            </span>
          )}
        </div>

        <div className="mt-2 border-t border-white/5 pt-1">
          <Stat label="vs previous month">
            <Delta pct={pctDelta(total, prevTotal)} />
          </Stat>
          <Stat label="vs 12-month average">
            <Delta pct={pctDelta(total, avg)} />
          </Stat>
          {an && (
            <>
              <Stat label="Income">
                <BlurredAmount blurIntensity="sm">
                  <span className="text-emerald-400">{fmtFull(an.income)}</span>
                </BlurredAmount>
              </Stat>
              <Stat label="Expected savings">
                <BlurredAmount blurIntensity="sm">
                  <span
                    className={
                      an.income - an.expense < 0
                        ? "text-rose-400"
                        : "text-cyan-400"
                    }
                  >
                    {fmtFull(an.income - an.expense)}
                  </span>
                </BlurredAmount>
              </Stat>
            </>
          )}
          {key === currentMonthKey && totalBudget > 0 && (
            <Stat label="Budget left">
              <span
                className={total > totalBudget ? "text-rose-400" : "text-emerald-400"}
              >
                {total > totalBudget
                  ? `${fmtFull(total - totalBudget)} over`
                  : `${fmtFull(totalBudget - total)} left`}
              </span>
            </Stat>
          )}
        </div>

        {cats.length > 0 && (
          <>
            <SectionLabel>Top categories · tap to drill in</SectionLabel>
            <div className="space-y-2">
              {cats.slice(0, 6).map(([cat, amt]) => (
                <ShareBar
                  key={cat}
                  label={cat}
                  value={amt}
                  max={maxCat}
                  color={colorFor(cat)}
                  onClick={() => onFocusCategory(cat)}
                />
              ))}
            </div>
          </>
        )}

        {monthOutliers.length > 0 && (
          <>
            <SectionLabel>
              {monthOutliers.length} outlier
              {monthOutliers.length === 1 ? "" : "s"} this month
            </SectionLabel>
            <div className="space-y-0.5">
              {monthOutliers.slice(0, 5).map((o) => (
                <TxRow
                  key={o.transactionId}
                  desc={o.category}
                  date={o.date}
                  amount={o.amount}
                  color={colorFor(o.category)}
                  isOutlier
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderCategoryView() {
    const cat = focusedCategory!;
    const total = agg.catTotal.get(cat) ?? 0;
    const byMonth = agg.catByMonth.get(cat) ?? new Map<string, number>();
    const share = agg.totalSpend > 0 ? (total / agg.totalSpend) * 100 : 0;
    const color = colorFor(cat);

    const series = months.map((m) => ({
      key: m.key,
      label: m.label,
      value: byMonth.get(m.key) ?? 0,
    }));
    const activeMonths = series.filter((s) => s.value > 0);
    const avg =
      activeMonths.length > 0 ? total / activeMonths.length : 0;
    const latest = series[series.length - 1]?.value ?? 0;
    const peak = activeMonths.reduce(
      (best, s) => (s.value > best.value ? s : best),
      activeMonths[0] ?? { key: "", label: "—", value: 0 },
    );

    const budget = budgetByCategory[cat];
    const catTxs = expenseTransactions
      .filter(
        (t) =>
          (t.category ?? "Uncategorized") === cat &&
          months.some((m) => m.key === t.date.slice(0, 7)),
      )
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const catOutliers = outliers.filter((o) => o.category === cat);

    return (
      <div>
        <div className="flex items-end justify-between gap-2 mt-2">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              Total · last 12 months
            </p>
            <BlurredAmount blurIntensity="sm">
              <p className="text-2xl font-bold text-white tabular-nums">
                {fmtFull(total)}
              </p>
            </BlurredAmount>
          </div>
          <span className="text-[10px] text-white/45 mb-1">
            {share.toFixed(0)}% of spend
          </span>
        </div>

        <div className="mt-2 border-t border-white/5 pt-1">
          <Stat label="Average / active month">
            <BlurredAmount blurIntensity="sm">{fmtFull(avg)}</BlurredAmount>
          </Stat>
          <Stat label="Latest month vs average">
            <Delta pct={pctDelta(latest, avg)} />
          </Stat>
          <Stat label="Active in">
            {activeMonths.length} of {months.length} months
          </Stat>
          {peak.value > 0 && (
            <Stat label="Peak month">
              <span className="text-white/60">{monthLabel(peak.key)} · </span>
              <BlurredAmount blurIntensity="sm">{fmtDollar(peak.value)}</BlurredAmount>
            </Stat>
          )}
          {budget && budget.budget > 0 && (
            <Stat label="This month vs budget">
              <span
                className={
                  budget.spent > budget.budget
                    ? "text-rose-400"
                    : "text-emerald-400"
                }
              >
                {fmtDollar(budget.spent)} / {fmtDollar(budget.budget)}
              </span>
            </Stat>
          )}
        </div>

        <SectionLabel>12-month trend · tap a bar</SectionLabel>
        <MiniBars
          data={series}
          color={color}
          activeKey={null}
          onPick={(k) => onFocusMonth(k)}
        />

        {catOutliers.length > 0 && (
          <>
            <SectionLabel>
              {catOutliers.length} flagged outlier
              {catOutliers.length === 1 ? "" : "s"}
            </SectionLabel>
            <div className="space-y-0.5">
              {catOutliers.slice(0, 4).map((o) => (
                <TxRow
                  key={o.transactionId}
                  desc={monthLabel(o.date.slice(0, 7))}
                  date={o.date}
                  amount={o.amount}
                  color={color}
                  isOutlier
                />
              ))}
            </div>
          </>
        )}

        {catTxs.length > 0 && (
          <>
            <SectionLabel>Largest transactions</SectionLabel>
            <div className="space-y-0.5">
              {catTxs.slice(0, 5).map((t) => (
                <TxRow
                  key={t.id}
                  desc={t.description || cat}
                  date={t.date}
                  amount={Math.abs(t.amount)}
                  color={color}
                  isOutlier={outlierIds.has(t.id)}
                  masked={(t as { is_masked?: boolean }).is_masked}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderBothView() {
    const cat = focusedCategory!;
    const key = focusedMonth!;
    const color = colorFor(cat);
    const amount = agg.monthCat.get(key)?.get(cat) ?? 0;
    const monthTotal = agg.monthTotal.get(key) ?? 0;
    const catTotal = agg.catTotal.get(cat) ?? 0;

    const byMonth = agg.catByMonth.get(cat) ?? new Map<string, number>();
    const activeMonths = months.filter((m) => (byMonth.get(m.key) ?? 0) > 0);
    const catAvg = activeMonths.length > 0 ? catTotal / activeMonths.length : 0;

    const txs = expenseTransactions
      .filter(
        (t) =>
          (t.category ?? "Uncategorized") === cat &&
          t.date.slice(0, 7) === key,
      )
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return (
      <div>
        <div className="mt-2">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            {cat} · {monthLabel(key)}
          </p>
          <BlurredAmount blurIntensity="sm">
            <p className="text-2xl font-bold text-white tabular-nums">
              {fmtFull(amount)}
            </p>
          </BlurredAmount>
        </div>

        <div className="mt-2 border-t border-white/5 pt-1">
          <Stat label="vs this category's average">
            <Delta pct={pctDelta(amount, catAvg)} />
          </Stat>
          <Stat label="Share of month">
            {monthTotal > 0 ? `${((amount / monthTotal) * 100).toFixed(0)}%` : "—"}
          </Stat>
          <Stat label="Share of category (yr)">
            {catTotal > 0 ? `${((amount / catTotal) * 100).toFixed(0)}%` : "—"}
          </Stat>
          <Stat label="Transactions">{txs.length}</Stat>
        </div>

        {txs.length > 0 && (
          <>
            <SectionLabel>
              {txs.length} transaction{txs.length === 1 ? "" : "s"}
            </SectionLabel>
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {txs.map((t) => (
                <TxRow
                  key={t.id}
                  desc={t.description || cat}
                  date={t.date}
                  amount={Math.abs(t.amount)}
                  color={color}
                  isOutlier={outlierIds.has(t.id)}
                  masked={(t as { is_masked?: boolean }).is_masked}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  color,
  onRemove,
}: {
  label: string;
  color?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full bg-white/10 ring-1 ring-white/10 text-[11px] text-white/80">
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: color }}
        />
      )}
      <span className="truncate max-w-[120px]">{label}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-white/15 text-white/45 hover:text-white/80 transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
