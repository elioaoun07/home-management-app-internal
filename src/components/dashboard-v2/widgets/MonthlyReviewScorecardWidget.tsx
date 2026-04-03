"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { detectCategoryAnomalies } from "@/lib/utils/anomalyDetection";
import { detectTrend } from "@/lib/utils/forecast";
import { useState } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  debts?: { totalOwed: number; totalOwedToYou: number; openCount: number };
  recurring?: { totalMonthly: number };
  healthScore: number;
};

type CheckStatus = "pass" | "fail" | "warn" | "info";

type CheckItem = {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
  discussed?: boolean;
};

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass")
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  if (status === "fail")
    return (
      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>
    );
  if (status === "warn")
    return (
      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
    );
  return (
    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
      <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    </div>
  );
}

function fmtMonth(ym: string): string {
  const [, m] = ym.split("-");
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1];
}

export default function MonthlyReviewScorecardWidget({ months, debts, recurring, healthScore }: Props) {
  const [discussed, setDiscussed] = useState<Set<string>>(new Set());

  const checks = buildChecks(months, debts, recurring, healthScore);

  if (!months || months.length < 1) {
    return (
      <WidgetCard title="Monthly Review" subtitle="Checklist">
        <p className="text-white/40 text-xs text-center py-8">Need at least 1 month of data</p>
      </WidgetCard>
    );
  }

  const passed = checks.filter((c) => c.status === "pass").length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);
  const scoreColor = score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";

  const toggleDiscussed = (id: string) =>
    setDiscussed((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const discussedCount = discussed.size;

  return (
    <WidgetCard
      title="Monthly Review"
      subtitle="Tap items to mark as discussed with partner"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">{discussedCount}/{total} discussed</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
          >
            {passed}/{total} passed
          </span>
        </div>
      }
    >
      {/* Score bar */}
      <div className="mb-4">
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, backgroundColor: scoreColor, boxShadow: `0 0 8px ${scoreColor}50` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {checks.map((check) => {
          const isDiscussed = discussed.has(check.id);
          return (
            <button
              key={check.id}
              onClick={() => toggleDiscussed(check.id)}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                isDiscussed
                  ? "bg-white/5 opacity-60"
                  : "bg-white/3 hover:bg-white/6"
              }`}
            >
              <StatusIcon status={check.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs font-medium ${isDiscussed ? "line-through text-white/40" : "text-white/80"}`}>
                    {check.label}
                  </p>
                  {isDiscussed && (
                    <span className="text-[9px] text-emerald-400/60 shrink-0">✓ discussed</span>
                  )}
                </div>
                <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{check.detail}</p>
              </div>
            </button>
          );
        })}
      </div>

      {discussedCount === total && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-xs text-emerald-400 font-medium">Review complete! Great work.</p>
        </div>
      )}
    </WidgetCard>
  );
}

function buildChecks(
  months: MonthlyAnalytics[] | undefined,
  debts: { totalOwed: number; totalOwedToYou: number; openCount: number } | undefined,
  recurring: { totalMonthly: number } | undefined,
  healthScore: number,
): CheckItem[] {
  if (!months || months.length < 1) return [];

  const items: CheckItem[] = [];
  const current = months[months.length - 1];
  const prev = months.length >= 2 ? months[months.length - 2] : null;

  // 1. Savings Rate
  const savingsRate = current.savingsRate;
  items.push({
    id: "savings-rate",
    label: "Savings Rate ≥ 20%",
    detail:
      savingsRate >= 20
        ? `Achieved ${savingsRate.toFixed(1)}% this month — on track.`
        : savingsRate >= 10
          ? `${savingsRate.toFixed(1)}% saved — below target. Aim for 20%.`
          : `Only ${savingsRate.toFixed(1)}% saved — needs immediate attention.`,
    status: savingsRate >= 20 ? "pass" : savingsRate >= 10 ? "warn" : "fail",
  });

  // 2. Spending Trend
  if (prev) {
    const expChange = prev.expense > 0 ? ((current.expense - prev.expense) / prev.expense) * 100 : 0;
    items.push({
      id: "spending-trend",
      label: "Spending Trend",
      detail:
        expChange <= 0
          ? `Expenses down ${Math.abs(expChange).toFixed(1)}% vs ${fmtMonth(prev.month)} — great control.`
          : expChange <= 10
            ? `Expenses up ${expChange.toFixed(1)}% vs ${fmtMonth(prev.month)} — within acceptable range.`
            : `Expenses up ${expChange.toFixed(1)}% vs ${fmtMonth(prev.month)} — review categories below.`,
      status: expChange <= 0 ? "pass" : expChange <= 10 ? "warn" : "fail",
    });
  }

  // 3. Category Compliance — top categories that jumped >20%
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
      label: "Category Spending Stable",
      detail:
        jumpers.length === 0
          ? "No categories jumped more than 20% this month."
          : `${jumpers.slice(0, 3).map((j) => `${j.name} +${j.pct.toFixed(0)}%`).join(", ")} exceeded 20% MoM.`,
      status: jumpers.length === 0 ? "pass" : jumpers.length <= 2 ? "warn" : "fail",
    });
  }

  // 4. Forecast Check — is expense trend going up?
  if (months.length >= 3) {
    const trend = detectTrend(months.map((m) => ({ month: m.month, value: m.expense })));
    const perMo = Math.abs(Math.round(trend.monthlyChange));
    items.push({
      id: "forecast",
      label: "Expense Forecast",
      detail:
        trend.direction === "down"
          ? `Expenses trending down ~$${perMo}/mo — on a good trajectory.`
          : trend.direction === "flat"
            ? "Expenses are stable across the forecast period."
            : `Expenses trending up ~$${perMo}/mo — projected to increase. Review fixed costs.`,
      status: trend.direction === "down" ? "pass" : trend.direction === "flat" ? "warn" : "fail",
    });
  }

  // 5. Top 3 Categories Review
  const topCats = [...current.categoryBreakdown]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  if (topCats.length > 0) {
    const catSummary = topCats.map((c) => {
      if (!prev) return `${c.name}: $${Math.round(c.amount)}`;
      const p = prev.categoryBreakdown.find((x) => x.name === c.name);
      const delta = p ? Math.round(c.amount - p.amount) : 0;
      const sign = delta >= 0 ? "+" : "";
      return `${c.name}: $${Math.round(c.amount)} (${sign}$${delta})`;
    });
    items.push({
      id: "top-categories",
      label: "Top 3 Categories",
      detail: catSummary.join(" · "),
      status: "info",
    });
  }

  // 6. Recurring Cost Stability
  if (recurring && prev) {
    const recurringBurden = current.expense > 0 ? (recurring.totalMonthly / current.expense) * 100 : 0;
    items.push({
      id: "recurring-stability",
      label: "Fixed Costs",
      detail:
        recurringBurden <= 50
          ? `Fixed costs are ${recurringBurden.toFixed(0)}% of expenses — healthy ratio.`
          : recurringBurden <= 70
            ? `Fixed costs are ${recurringBurden.toFixed(0)}% of expenses — watch variable spending.`
            : `Fixed costs are ${recurringBurden.toFixed(0)}% of expenses — very high. Review recurring items.`,
      status: recurringBurden <= 50 ? "pass" : recurringBurden <= 70 ? "warn" : "fail",
    });
  }

  // 7. Anomaly Check
  if (months.length >= 4) {
    const report = detectCategoryAnomalies(months);
    const critical = report.categoryAnomalies.filter((a) => a.severity === "critical");
    items.push({
      id: "anomalies",
      label: "No Critical Anomalies",
      detail:
        critical.length === 0
          ? "No unusual spending spikes detected this month."
          : `${critical.length} critical anomaly${critical.length > 1 ? "ies" : ""}: ${critical.slice(0, 2).map((a) => a.category).join(", ")}.`,
      status: critical.length === 0 ? "pass" : "fail",
    });
  }

  // 8. Debt Status
  if (debts) {
    items.push({
      id: "debts",
      label: "Debt Status",
      detail:
        debts.openCount === 0
          ? "No open debts — clean slate."
          : `${debts.openCount} open debt${debts.openCount > 1 ? "s" : ""} totaling $${Math.round(debts.totalOwed).toLocaleString()}.`,
      status: debts.openCount === 0 ? "pass" : debts.openCount <= 2 ? "warn" : "fail",
    });
  }

  return items;
}
