"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo, useState } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
};

type Mode = "mom" | "yoy";

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(m) - 1]} ${y.slice(2)}`;
}

function fmtAmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function DeltaBadge({ change, pct, invert = false }: { change: number; pct: number; invert?: boolean }) {
  const isGood = invert ? change <= 0 : change >= 0;
  const color = Math.abs(pct) < 2 ? "text-white/40" : isGood ? "text-emerald-400" : "text-red-400";
  const sign = change >= 0 ? "+" : "";
  return (
    <span className={`text-[10px] font-medium tabular-nums ${color}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

export default function PeriodComparisonWidget({ months }: Props) {
  const [mode, setMode] = useState<Mode>("mom");

  const { rows, currentLabel, prevLabel } = useMemo(() => {
    if (!months || months.length < 2) return { rows: [], currentLabel: "", prevLabel: "" };

    const curr = months[months.length - 1];

    let prev: MonthlyAnalytics | undefined;
    if (mode === "mom") {
      prev = months[months.length - 2];
    } else {
      // YoY — find the same month 12 months ago
      const [cy, cm] = curr.month.split("-").map(Number);
      const targetYear = cy - 1;
      const targetMonth = `${targetYear}-${String(cm).padStart(2, "0")}`;
      prev = months.find((m) => m.month === targetMonth);
    }

    if (!prev) return { rows: [], currentLabel: fmtMonth(curr.month), prevLabel: mode === "mom" ? "No prev data" : "No YoY data" };

    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

    const topCatCurr = [...curr.categoryBreakdown].sort((a, b) => b.amount - a.amount)[0];
    const topCatPrev = [...prev.categoryBreakdown].sort((a, b) => b.amount - a.amount)[0];

    const rows: { label: string; curr: string; prev: string; change: number; pct: number; invert?: boolean; isAmount?: boolean }[] = [
      {
        label: "Income",
        curr: fmtAmt(curr.income),
        prev: fmtAmt(prev.income),
        change: curr.income - prev.income,
        pct: pct(curr.income, prev.income),
        isAmount: true,
      },
      {
        label: "Expenses",
        curr: fmtAmt(curr.expense),
        prev: fmtAmt(prev.expense),
        change: curr.expense - prev.expense,
        pct: pct(curr.expense, prev.expense),
        invert: true,
        isAmount: true,
      },
      {
        label: "Saved",
        curr: fmtAmt(curr.savings),
        prev: fmtAmt(prev.savings),
        change: curr.savings - prev.savings,
        pct: pct(curr.savings, prev.savings),
        isAmount: true,
      },
      {
        label: "Savings Rate",
        curr: `${curr.savingsRate.toFixed(1)}%`,
        prev: `${prev.savingsRate.toFixed(1)}%`,
        change: curr.savingsRate - prev.savingsRate,
        pct: pct(curr.savingsRate, prev.savingsRate),
      },
      {
        label: "Transactions",
        curr: String(curr.transactionCount),
        prev: String(prev.transactionCount),
        change: curr.transactionCount - prev.transactionCount,
        pct: pct(curr.transactionCount, prev.transactionCount),
      },
      {
        label: "Daily Avg Spend",
        curr: fmtAmt(curr.expense / 30),
        prev: fmtAmt(prev.expense / 30),
        change: curr.expense / 30 - prev.expense / 30,
        pct: pct(curr.expense / 30, prev.expense / 30),
        invert: true,
        isAmount: true,
      },
      {
        label: "Top Category",
        curr: topCatCurr ? `${topCatCurr.name} (${fmtAmt(topCatCurr.amount)})` : "—",
        prev: topCatPrev ? `${topCatPrev.name} (${fmtAmt(topCatPrev.amount)})` : "—",
        change: topCatCurr && topCatPrev ? topCatCurr.amount - topCatPrev.amount : 0,
        pct: topCatCurr && topCatPrev ? pct(topCatCurr.amount, topCatPrev.amount) : 0,
        invert: true,
        isAmount: true,
      },
    ];

    return { rows, currentLabel: fmtMonth(curr.month), prevLabel: fmtMonth(prev.month) };
  }, [months, mode]);

  if (!months || months.length < 2) {
    return (
      <WidgetCard title="Period Comparison">
        <p className="text-white/40 text-xs text-center py-8">Need 2+ months of data</p>
      </WidgetCard>
    );
  }

  const hasYoy = months.length >= 13;

  return (
    <WidgetCard
      title="Period Comparison"
      subtitle={`${prevLabel} → ${currentLabel}`}
      action={
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(["mom", "yoy"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={m === "yoy" && !hasYoy}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                mode === m
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
            >
              {m === "mom" ? "MoM" : "YoY"}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-white/40 text-xs text-center py-4">
          {mode === "yoy" ? "No data for same month last year" : "No comparison data"}
        </p>
      ) : (
        <div className="space-y-0">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 pb-2 border-b border-white/5">
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Metric</span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider text-right w-20">{prevLabel}</span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider text-right w-20">{currentLabel}</span>
            <span className="text-[9px] text-white/30 uppercase tracking-wider text-right w-12">Change</span>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 py-2 items-center ${
                i < rows.length - 1 ? "border-b border-white/3" : ""
              }`}
            >
              <span className="text-[10px] text-white/50 truncate">{row.label}</span>
              <span className="text-[10px] text-white/30 text-right w-20 tabular-nums truncate">{row.prev}</span>
              <BlurredAmount blurIntensity="sm">
                <span className="text-[10px] text-white/80 font-medium text-right w-20 tabular-nums truncate block">
                  {row.curr}
                </span>
              </BlurredAmount>
              <div className="w-12 text-right">
                <DeltaBadge change={row.change} pct={row.pct} invert={row.invert} />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
