"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { useAccounts } from "@/features/accounts/hooks";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import {
  calculateIncomeExpenseSummary,
  type TransactionWithAccount,
} from "@/lib/utils/incomeExpense";
import { differenceInDays, format, parseISO } from "date-fns";
import { useMemo } from "react";

type Props = {
  transactions: TransactionWithAccount[];
  startDate: string;
  endDate: string;
  months?: MonthlyAnalytics[];
};

function getPeriodLabel(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const days = differenceInDays(e, s) + 1;
  if (days === 1) return format(s, "MMMM d, yyyy");
  if (days <= 8) return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameMonth) return format(s, "MMMM yyyy");
  if (sameYear)
    return `${format(s, "MMM")} – ${format(e, "MMM yyyy")}`;
  return `${format(s, "MMM yyyy")} – ${format(e, "MMM yyyy")}`;
}

function MoMBadge({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous <= 0 || current <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isGood = invert ? pct <= 0 : pct >= 0;
  const absP = Math.abs(pct);
  if (absP < 0.5) return <span className="text-[9px] text-white/25">no change</span>;
  const color = Math.abs(pct) < 3 ? "text-white/40" : isGood ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`text-[9px] font-medium ${color}`}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% MoM
    </span>
  );
}

export default function PeriodSummaryWidget({
  transactions,
  startDate,
  endDate,
  months,
}: Props) {
  const { data: accounts } = useAccounts();

  const summary = useMemo(
    () => calculateIncomeExpenseSummary(transactions, accounts),
    [transactions, accounts],
  );

  // MoM comparison from analytics months
  const momData = useMemo(() => {
    if (!months || months.length < 2) return null;
    const curr = months[months.length - 1];
    const prev = months[months.length - 2];
    return { curr, prev };
  }, [months]);

  const { daysElapsed, totalDays } = useMemo(() => {
    const now = new Date();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const total = Math.max(differenceInDays(end, start) + 1, 1);
    const clampedNow = now < start ? start : now > end ? end : now;
    const elapsed = Math.max(differenceInDays(clampedNow, start) + 1, 1);
    return { daysElapsed: Math.min(elapsed, total), totalDays: total };
  }, [startDate, endDate]);

  const income = summary.totalIncome;
  const expense = summary.totalExpense;
  const remaining = income - expense;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
  const dailyBurn = expense / daysElapsed;
  const projectedTotal = dailyBurn * totalDays;
  const spendPercent = income > 0 ? Math.min((expense / income) * 100, 100) : 0;
  const timePercent = (daysElapsed / totalDays) * 100;

  const remainingColor = remaining >= 0 ? "#22d3ee" : "#f97316";
  const savingsColor =
    savingsRate >= 20
      ? "#34d399"
      : savingsRate >= 10
        ? "#fbbf24"
        : "#f87171";

  return (
    <WidgetCard
      title="Period Summary"
      subtitle={getPeriodLabel(startDate, endDate)}
      action={
        <span
          className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide"
          style={{
            backgroundColor: `${savingsColor}20`,
            color: savingsColor,
            boxShadow: `0 0 10px ${savingsColor}30`,
          }}
        >
          {savingsRate >= 0 ? "+" : ""}
          {savingsRate.toFixed(1)}% saved
        </span>
      }
    >
      {/* KPI trio */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Income */}
        <div className="neo-card rounded-xl p-3 bg-gradient-to-br from-emerald-500/10 to-transparent text-center flex flex-col items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mb-0.5">
            <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
          <p className="text-[9px] text-emerald-300/60 uppercase tracking-widest">Income</p>
          <BlurredAmount>
            <p className="text-sm font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] tabular-nums leading-tight">
              ${income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </BlurredAmount>
          {momData && <MoMBadge current={momData.curr.income} previous={momData.prev.income} />}
        </div>

        {/* Spent */}
        <div className="neo-card rounded-xl p-3 bg-gradient-to-br from-red-500/10 to-transparent text-center flex flex-col items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center mb-0.5">
            <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <p className="text-[9px] text-red-300/60 uppercase tracking-widest">Spent</p>
          <BlurredAmount>
            <p className="text-sm font-bold text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] tabular-nums leading-tight">
              ${expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </BlurredAmount>
          {momData && <MoMBadge current={momData.curr.expense} previous={momData.prev.expense} invert />}
        </div>

        {/* Remaining / Over */}
        <div
          className="neo-card rounded-xl p-3 text-center flex flex-col items-center gap-1"
          style={{
            background: `linear-gradient(135deg, ${remainingColor}12 0%, transparent 100%)`,
          }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center mb-0.5"
            style={{ backgroundColor: `${remainingColor}25` }}
          >
            <svg className="w-3 h-3" style={{ color: remainingColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <p
            className="text-[9px] uppercase tracking-widest"
            style={{ color: `${remainingColor}99` }}
          >
            {remaining >= 0 ? "Saved" : "Over"}
          </p>
          <BlurredAmount>
            <p
              className="text-sm font-bold tabular-nums leading-tight"
              style={{
                color: remainingColor,
                filter: `drop-shadow(0 0 10px ${remainingColor}50)`,
              }}
            >
              {remaining >= 0 ? "+" : "-"}$
              {Math.abs(remaining).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </BlurredAmount>
          {momData && <MoMBadge current={momData.curr.savings} previous={momData.prev.savings} />}
        </div>
      </div>

      {/* Dual-track progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-white/40 font-medium">Period Progress</span>
          <span className="text-[10px] text-white/30">
            Day {daysElapsed} of {totalDays}
          </span>
        </div>
        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
          {/* Time elapsed (background track) */}
          <div
            className="absolute h-full rounded-full transition-all duration-700 bg-white/10"
            style={{ width: `${timePercent}%` }}
          />
          {/* Spend vs income (foreground) */}
          <div
            className="absolute h-full rounded-full transition-all duration-700"
            style={{
              width: `${spendPercent}%`,
              background:
                spendPercent > timePercent
                  ? "linear-gradient(90deg, #f87171, #fb923c)"
                  : "linear-gradient(90deg, #34d399, #22d3ee)",
              boxShadow:
                spendPercent > timePercent
                  ? "0 0 10px rgba(248,113,113,0.5)"
                  : "0 0 10px rgba(52,211,153,0.4)",
            }}
          />
          {/* Time marker line */}
          <div
            className="absolute top-0 h-full w-0.5 bg-white/30"
            style={{ left: `${timePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-white/30">
            ${dailyBurn.toFixed(0)}/day avg spend
          </span>
          {totalDays > daysElapsed && (
            <BlurredAmount blurIntensity="sm">
              <span className="text-[9px] text-white/30">
                Proj. end: ${projectedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </BlurredAmount>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
        <div className="text-center">
          <p className="text-[9px] text-white/30 mb-0.5 uppercase tracking-wider">Savings</p>
          <p className="text-xs font-bold" style={{ color: savingsColor }}>
            {savingsRate.toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-white/30 mb-0.5 uppercase tracking-wider">Daily Burn</p>
          <BlurredAmount blurIntensity="sm">
            <p className="text-xs font-bold text-amber-400">
              ${dailyBurn.toFixed(0)}
            </p>
          </BlurredAmount>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-white/30 mb-0.5 uppercase tracking-wider">Transactions</p>
          <p className="text-xs font-bold text-white/60">{transactions.length}</p>
        </div>
      </div>
    </WidgetCard>
  );
}
