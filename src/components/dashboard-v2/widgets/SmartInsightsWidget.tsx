"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type {
  MonthlyAnalytics,
  RecurringItem,
} from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import { generateInsights, type Insight } from "@/lib/utils/insightEngine";
import { useMemo } from "react";

type Transaction = {
  id: string;
  amount: number;
  date: string;
  category?: string | null;
  account_name?: string;
  description?: string | null;
};

type Props = {
  months: MonthlyAnalytics[] | undefined;
  transactions: Transaction[];
  recurring?: { totalMonthly: number; items: RecurringItem[] };
  debts?: { totalOwed: number; totalOwedToYou: number; openCount: number };
  budgetData?: {
    categoryBudgets: { category: string; budget: number; spent: number }[];
  };
  daysElapsed: number;
  totalDays: number;
  onCategoryClick?: (category: string) => void;
};

const severityColors: Record<string, string> = {
  positive: "border-emerald-500/20 bg-emerald-500/5",
  negative: "border-red-500/20 bg-red-500/5",
  neutral: "border-white/5 bg-white/[0.02]",
  info: "border-cyan-500/15 bg-cyan-500/5",
};

export default function SmartInsightsWidget({
  months,
  transactions,
  recurring,
  debts,
  budgetData,
  daysElapsed,
  totalDays,
  onCategoryClick,
}: Props) {
  const insights = useMemo(() => {
    if (!months || months.length < 1) return [];

    const currentMonth = months[months.length - 1];
    return generateInsights({
      months,
      currentMonthExpense: currentMonth.expense,
      currentMonthIncome: currentMonth.income,
      transactions,
      recurring,
      debts,
      budgetData,
      daysElapsed,
      totalDays,
    });
  }, [
    months,
    transactions,
    recurring,
    debts,
    budgetData,
    daysElapsed,
    totalDays,
  ]);

  if (insights.length === 0) {
    return (
      <WidgetCard title="Smart Insights" subtitle="AI-powered analysis">
        <p className="text-white/40 text-xs text-center py-8">
          Not enough data to generate insights
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Smart Insights"
      subtitle={`${insights.length} insights from your data`}
    >
      <div className="space-y-2">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onCategoryClick={onCategoryClick}
          />
        ))}
      </div>
    </WidgetCard>
  );
}

function InsightCard({
  insight,
  onCategoryClick,
}: {
  insight: Insight;
  onCategoryClick?: (cat: string) => void;
}) {
  const Wrapper = insight.category ? "button" : "div";

  return (
    <Wrapper
      {...(insight.category
        ? { onClick: () => onCategoryClick?.(insight.category!) }
        : {})}
      className={cn(
        "w-full flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors text-left",
        severityColors[insight.severity],
        insight.category && "hover:bg-white/5 cursor-pointer",
      )}
    >
      <span className="text-sm shrink-0 mt-0.5">{insight.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/80">{insight.title}</p>
        <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
          {insight.detail}
        </p>
      </div>
    </Wrapper>
  );
}
