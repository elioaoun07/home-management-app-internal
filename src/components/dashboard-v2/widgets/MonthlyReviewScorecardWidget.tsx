"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { detectCategoryAnomalies } from "@/lib/utils/anomalyDetection";
import { detectTrend } from "@/lib/utils/forecast";
import { differenceInDays, getDaysInMonth, parseISO } from "date-fns";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  debts?: { totalOwed: number; totalOwedToYou: number; openCount: number };
  recurring?: { totalMonthly: number };
  healthScore: number;
  startDate?: string;
  endDate?: string;
};

type CheckStatus = "pass" | "fail" | "warn" | "info";

type CheckItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  status: CheckStatus;
};

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass: "#34d399",
  fail: "#f87171",
  warn: "#fbbf24",
  info: "#60a5fa",
};

const STATUS_BG: Record<CheckStatus, string> = {
  pass: "bg-emerald-500/15",
  fail: "bg-red-500/15",
  warn: "bg-amber-500/15",
  info: "bg-blue-500/15",
};

function StatusDot({ status }: { status: CheckStatus }) {
  return (
    <div
      className="w-2 h-2 rounded-full shrink-0 mt-0.5"
      style={{
        backgroundColor: STATUS_COLOR[status],
        boxShadow: `0 0 6px ${STATUS_COLOR[status]}60`,
      }}
    />
  );
}

function fmtMonth(ym: string): string {
  const [, m] = ym.split("-");
  return [
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
  ][parseInt(m) - 1];
}

export default function MonthlyReviewScorecardWidget({
  months,
  debts,
  recurring,
  healthScore,
  startDate,
  endDate,
}: Props) {
  const checks = buildChecks(
    months,
    debts,
    recurring,
    healthScore,
    startDate,
    endDate,
  );

  if (!months || months.length < 1) {
    return (
      <WidgetCard title="Monthly Review" subtitle="Checklist">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 1 month of data
        </p>
      </WidgetCard>
    );
  }

  const passed = checks.filter((c) => c.status === "pass").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);
  const scoreColor =
    score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <WidgetCard
      title="Monthly Review"
      subtitle="Health checklist"
      action={
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
        >
          {passed}/{total} pass
        </span>
      }
    >
      {/* Summary KPI bar */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          {
            label: "Pass",
            count: passed,
            color: "#34d399",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Warn",
            count: warned,
            color: "#fbbf24",
            bg: "bg-amber-500/10",
          },
          {
            label: "Fail",
            count: failed,
            color: "#f87171",
            bg: "bg-red-500/10",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.bg}`}>
            <p
              className="text-lg font-bold tabular-nums"
              style={{ color: s.color }}
            >
              {s.count}
            </p>
            <p
              className="text-[9px] uppercase tracking-wider"
              style={{ color: `${s.color}99` }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            backgroundColor: scoreColor,
            boxShadow: `0 0 8px ${scoreColor}50`,
          }}
        />
      </div>

      {/* Compact checklist — 2 column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/3"
          >
            <StatusDot status={check.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-medium text-white/75 truncate">
                  {check.label}
                </p>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BG[check.status]}`}
                  style={{ color: STATUS_COLOR[check.status] }}
                >
                  {check.value}
                </span>
              </div>
              <p
                className="text-[9px] text-white/35 mt-0.5 truncate"
                title={check.detail}
              >
                {check.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function buildChecks(
  months: MonthlyAnalytics[] | undefined,
  debts:
    | { totalOwed: number; totalOwedToYou: number; openCount: number }
    | undefined,
  recurring: { totalMonthly: number } | undefined,
  healthScore: number,
  startDate?: string,
  endDate?: string,
): CheckItem[] {
  if (!months || months.length < 1) return [];

  const items: CheckItem[] = [];
  const current = months[months.length - 1];
  const prev = months.length >= 2 ? months[months.length - 2] : null;

  // Determine how many days have elapsed in the current period month
  // so we can normalize comparisons against full previous months.
  let currentDaysElapsed: number | null = null;
  let currentTotalDays: number | null = null;
  if (startDate && endDate) {
    const now = new Date();
    const end = parseISO(endDate);
    const currentMonthDate = parseISO(current.month + "-01");
    const monthStart = currentMonthDate;
    const monthEnd = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth() + 1,
      0,
    );
    const effectiveEnd = now < end ? now : end;
    currentTotalDays = getDaysInMonth(currentMonthDate);
    currentDaysElapsed = Math.max(
      1,
      Math.min(
        differenceInDays(effectiveEnd, monthStart) + 1,
        currentTotalDays,
      ),
    );
  }

  // 1. Savings Rate — from the period's last month
  const savingsRate = current.savingsRate;
  items.push({
    id: "savings-rate",
    label: "Savings Rate",
    value: `${savingsRate.toFixed(1)}%`,
    detail:
      savingsRate >= 20
        ? "On target (≥20%)"
        : savingsRate >= 10
          ? "Below target — aim for 20%"
          : "Critical — needs attention",
    status: savingsRate >= 20 ? "pass" : savingsRate >= 10 ? "warn" : "fail",
  });

  // 2. Spending Trend — normalize for partial months (daily avg comparison)
  if (prev) {
    const prevDailyAvg =
      prev.expense / getDaysInMonth(parseISO(prev.month + "-01"));
    let currentDailyAvg: number;
    if (currentDaysElapsed && currentDaysElapsed < (currentTotalDays ?? 30)) {
      // Partial month — compare daily averages
      currentDailyAvg = current.expense / currentDaysElapsed;
    } else {
      currentDailyAvg =
        current.expense /
        (currentTotalDays ?? getDaysInMonth(parseISO(current.month + "-01")));
    }
    const expChange =
      prevDailyAvg > 0
        ? ((currentDailyAvg - prevDailyAvg) / prevDailyAvg) * 100
        : 0;
    const isPartial =
      currentDaysElapsed !== null &&
      currentDaysElapsed < (currentTotalDays ?? 30);
    items.push({
      id: "spending-trend",
      label: "Spending Trend",
      value: `${expChange >= 0 ? "+" : ""}${expChange.toFixed(1)}%`,
      detail: `Daily avg vs ${fmtMonth(prev.month)}${isPartial ? " (pro-rated)" : ""} — ${expChange <= 0 ? "down" : expChange <= 10 ? "slight rise" : "review needed"}`,
      status: expChange <= 0 ? "pass" : expChange <= 10 ? "warn" : "fail",
    });
  }

  // 3. Category Compliance
  if (prev && prev.categoryBreakdown.length > 0) {
    const jumpers: { name: string; pct: number }[] = [];
    for (const cat of current.categoryBreakdown) {
      const prevCat = prev.categoryBreakdown.find((c) => c.name === cat.name);
      if (prevCat && prevCat.amount > 20) {
        const pct = ((cat.amount - prevCat.amount) / prevCat.amount) * 100;
        if (pct > 20) jumpers.push({ name: cat.name, pct });
      }
    }
    jumpers.sort((a, b) => b.pct - a.pct);
    items.push({
      id: "category-compliance",
      label: "Category Stability",
      value:
        jumpers.length === 0
          ? "Stable"
          : `${jumpers.length} spike${jumpers.length > 1 ? "s" : ""}`,
      detail:
        jumpers.length === 0
          ? "No categories up >20%"
          : jumpers
              .slice(0, 2)
              .map((j) => `${j.name} +${j.pct.toFixed(0)}%`)
              .join(", "),
      status:
        jumpers.length === 0 ? "pass" : jumpers.length <= 2 ? "warn" : "fail",
    });
  }

  // 4. Forecast
  if (months.length >= 3) {
    const trend = detectTrend(
      months.map((m) => ({ month: m.month, value: m.expense })),
    );
    const perMo = Math.abs(Math.round(trend.monthlyChange));
    items.push({
      id: "forecast",
      label: "Expense Forecast",
      value:
        trend.direction === "down"
          ? "↓ Down"
          : trend.direction === "flat"
            ? "→ Flat"
            : "↑ Up",
      detail:
        trend.direction === "down"
          ? `~$${perMo}/mo decline`
          : trend.direction === "flat"
            ? "Stable trajectory"
            : `~$${perMo}/mo increase`,
      status:
        trend.direction === "down"
          ? "pass"
          : trend.direction === "flat"
            ? "warn"
            : "fail",
    });
  }

  // 5. Top Categories
  const topCats = [...current.categoryBreakdown]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  if (topCats.length > 0) {
    items.push({
      id: "top-categories",
      label: "Top Categories",
      value: topCats[0]?.name ?? "—",
      detail: topCats
        .map((c) => `${c.name} $${Math.round(c.amount)}`)
        .join(" · "),
      status: "info",
    });
  }

  // 6. Fixed Costs
  if (recurring && prev) {
    const recurringBurden =
      current.expense > 0
        ? (recurring.totalMonthly / current.expense) * 100
        : 0;
    items.push({
      id: "recurring-stability",
      label: "Fixed Costs",
      value: `${recurringBurden.toFixed(0)}%`,
      detail:
        recurringBurden <= 50
          ? "Healthy ratio"
          : recurringBurden <= 70
            ? "Watch variable spending"
            : "Very high — review recurring",
      status:
        recurringBurden <= 50
          ? "pass"
          : recurringBurden <= 70
            ? "warn"
            : "fail",
    });
  }

  // 7. Anomaly Check
  if (months.length >= 4) {
    const report = detectCategoryAnomalies(months);
    const critical = report.categoryAnomalies.filter(
      (a) => a.severity === "critical",
    );
    items.push({
      id: "anomalies",
      label: "Anomalies",
      value: critical.length === 0 ? "None" : `${critical.length} critical`,
      detail:
        critical.length === 0
          ? "No unusual spikes detected"
          : critical
              .slice(0, 2)
              .map((a) => a.category)
              .join(", "),
      status: critical.length === 0 ? "pass" : "fail",
    });
  }

  // 8. Debt
  if (debts) {
    items.push({
      id: "debts",
      label: "Open Debts",
      value: debts.openCount === 0 ? "None" : `${debts.openCount}`,
      detail:
        debts.openCount === 0
          ? "Clean slate"
          : `$${Math.round(debts.totalOwed).toLocaleString()} total owed`,
      status:
        debts.openCount === 0 ? "pass" : debts.openCount <= 2 ? "warn" : "fail",
    });
  }

  return items;
}
