/**
 * Rules-based insight generation engine.
 * Produces natural-language insights from transaction and analytics data
 * without requiring AI API calls — pure client-side computation.
 */

import type {
  MonthlyAnalytics,
  RecurringItem,
} from "@/features/analytics/useAnalytics";

export type InsightSeverity = "positive" | "neutral" | "negative" | "info";

export type Insight = {
  id: string;
  icon: string; // emoji
  title: string;
  detail: string;
  severity: InsightSeverity;
  category?: string; // associated category if any
  priority: number; // lower = more important
};

type Transaction = {
  id: string;
  amount: number;
  date: string;
  category?: string | null;
  account_name?: string;
  description?: string | null;
};

type BudgetData = {
  categoryBudgets: { category: string; budget: number; spent: number }[];
};

type InsightParams = {
  months: MonthlyAnalytics[];
  currentMonthExpense: number;
  currentMonthIncome: number;
  transactions: Transaction[];
  recurring?: { totalMonthly: number; items: RecurringItem[] };
  debts?: { totalOwed: number; totalOwedToYou: number; openCount: number };
  budgetData?: BudgetData;
  hasPartner?: boolean;
  daysElapsed: number;
  totalDays: number;
};

/**
 * Generate insights from analytics data. Returns 5-8 most relevant insights.
 */
export function generateInsights(params: InsightParams): Insight[] {
  const insights: Insight[] = [];
  let id = 0;
  const nextId = () => `insight-${++id}`;

  spendingTrendInsight(params, insights, nextId);
  savingsRateInsight(params, insights, nextId);
  topCategoryGrowthInsight(params, insights, nextId);
  budgetOverrunInsight(params, insights, nextId);
  dayOfWeekInsight(params, insights, nextId);
  largeTransactionsInsight(params, insights, nextId);
  recurringBurdenInsight(params, insights, nextId);
  projectedMonthEndInsight(params, insights, nextId);
  consistencyInsight(params, insights, nextId);
  debtInsight(params, insights, nextId);
  incomeChangeInsight(params, insights, nextId);
  categoryConcentrationInsight(params, insights, nextId);

  // Sort by priority, return top 8
  insights.sort((a, b) => a.priority - b.priority);
  return insights.slice(0, 8);
}

function spendingTrendInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.months.length < 2) return;
  const prev = p.months[p.months.length - 2];
  const curr = p.months[p.months.length - 1];
  if (!prev || prev.expense === 0) return;

  const pctChange = ((curr.expense - prev.expense) / prev.expense) * 100;
  if (Math.abs(pctChange) < 5) return; // not significant

  if (pctChange > 0) {
    out.push({
      id: nextId(),
      icon: "📈",
      title: "Spending Up",
      detail: `Total spending increased ${pctChange.toFixed(0)}% vs last month ($${curr.expense.toFixed(0)} vs $${prev.expense.toFixed(0)})`,
      severity: "negative",
      priority: 10,
    });
  } else {
    out.push({
      id: nextId(),
      icon: "📉",
      title: "Spending Down",
      detail: `Total spending decreased ${Math.abs(pctChange).toFixed(0)}% vs last month — good trend!`,
      severity: "positive",
      priority: 15,
    });
  }
}

function savingsRateInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.months.length < 1) return;
  const curr = p.months[p.months.length - 1];
  const rate = curr.savingsRate;

  if (rate >= 20) {
    out.push({
      id: nextId(),
      icon: "💰",
      title: "Great Savings Rate",
      detail: `You're saving ${rate.toFixed(0)}% of income — meeting the 20% target`,
      severity: "positive",
      priority: 20,
    });
  } else if (rate > 0) {
    out.push({
      id: nextId(),
      icon: "⚠️",
      title: "Below Savings Target",
      detail: `Savings rate is ${rate.toFixed(0)}% — aim for 20% to build solid reserves`,
      severity: "negative",
      priority: 12,
    });
  } else {
    out.push({
      id: nextId(),
      icon: "🚨",
      title: "No Savings This Period",
      detail: `Expenses exceeded income — spending $${Math.abs(curr.savings).toFixed(0)} more than earned`,
      severity: "negative",
      priority: 5,
    });
  }
}

function topCategoryGrowthInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.months.length < 2) return;
  const prev = p.months[p.months.length - 2];
  const curr = p.months[p.months.length - 1];

  const prevMap = new Map(
    prev.categoryBreakdown.map((c) => [c.name, c.amount]),
  );
  let biggestGrowth = { name: "", pct: 0, curr: 0, prev: 0 };

  for (const cat of curr.categoryBreakdown) {
    const prevAmt = prevMap.get(cat.name) ?? 0;
    if (prevAmt < 10) continue;
    const pct = ((cat.amount - prevAmt) / prevAmt) * 100;
    if (pct > biggestGrowth.pct) {
      biggestGrowth = { name: cat.name, pct, curr: cat.amount, prev: prevAmt };
    }
  }

  if (biggestGrowth.pct > 20 && biggestGrowth.name) {
    out.push({
      id: nextId(),
      icon: "🔺",
      title: `${biggestGrowth.name} Spiked`,
      detail: `${biggestGrowth.name} spending jumped ${biggestGrowth.pct.toFixed(0)}% ($${biggestGrowth.prev.toFixed(0)} → $${biggestGrowth.curr.toFixed(0)})`,
      severity: "negative",
      category: biggestGrowth.name,
      priority: 8,
    });
  }
}

function budgetOverrunInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (!p.budgetData?.categoryBudgets.length) return;

  const overBudget = p.budgetData.categoryBudgets.filter(
    (b) => b.budget > 0 && b.spent > b.budget,
  );

  if (overBudget.length > 0) {
    const totalOver = overBudget.reduce((s, b) => s + (b.spent - b.budget), 0);
    out.push({
      id: nextId(),
      icon: "🔴",
      title: `${overBudget.length} Categories Over Budget`,
      detail: `Over budget by $${totalOver.toFixed(0)} total across ${overBudget.length} categories (${overBudget.map((b) => b.category).join(", ")})`,
      severity: "negative",
      priority: 6,
    });
  } else {
    out.push({
      id: nextId(),
      icon: "✅",
      title: "All Categories On Budget",
      detail:
        "Every budgeted category is within its allocation — great discipline!",
      severity: "positive",
      priority: 25,
    });
  }
}

function dayOfWeekInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.transactions.length < 14) return;

  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];

  for (const t of p.transactions) {
    const day = new Date(t.date).getDay();
    dayTotals[day] += t.amount;
    dayCounts[day]++;
  }

  const dayAvgs = dayTotals.map((total, i) =>
    dayCounts[i] > 0 ? total / dayCounts[i] : 0,
  );
  const weekdayAvg = dayAvgs.slice(1, 6).reduce((s, v) => s + v, 0) / 5;

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  let maxDay = 0;
  let maxAvg = 0;
  for (let i = 0; i < 7; i++) {
    if (dayAvgs[i] > maxAvg) {
      maxDay = i;
      maxAvg = dayAvgs[i];
    }
  }

  if (maxAvg > weekdayAvg * 1.3 && weekdayAvg > 0) {
    out.push({
      id: nextId(),
      icon: "📅",
      title: `${dayNames[maxDay]} = Peak Spend`,
      detail: `${dayNames[maxDay]} averages $${maxAvg.toFixed(0)}/transaction — ${((maxAvg / weekdayAvg - 1) * 100).toFixed(0)}% above weekday average`,
      severity: "info",
      priority: 30,
    });
  }
}

function largeTransactionsInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.transactions.length < 5) return;

  const sorted = [...p.transactions].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, t) => s + t.amount, 0);
  const top3Amount = sorted.slice(0, 3).reduce((s, t) => s + t.amount, 0);
  const top3Pct = total > 0 ? (top3Amount / total) * 100 : 0;

  if (top3Pct > 30) {
    out.push({
      id: nextId(),
      icon: "💎",
      title: "Top 3 Dominate",
      detail: `Your 3 largest transactions account for ${top3Pct.toFixed(0)}% of total spending ($${top3Amount.toFixed(0)})`,
      severity: "info",
      priority: 28,
    });
  }
}

function recurringBurdenInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (!p.recurring || p.currentMonthExpense === 0) return;

  const pct = (p.recurring.totalMonthly / p.currentMonthExpense) * 100;
  if (pct > 50) {
    out.push({
      id: nextId(),
      icon: "🔁",
      title: "High Fixed Costs",
      detail: `Recurring bills are ${pct.toFixed(0)}% of expenses ($${p.recurring.totalMonthly.toFixed(0)}/mo) — limited flexibility`,
      severity: "negative",
      priority: 14,
    });
  } else if (pct > 30) {
    out.push({
      id: nextId(),
      icon: "🔁",
      title: "Moderate Fixed Costs",
      detail: `Recurring bills = ${pct.toFixed(0)}% of expenses ($${p.recurring.totalMonthly.toFixed(0)}/mo)`,
      severity: "neutral",
      priority: 35,
    });
  }
}

function projectedMonthEndInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.daysElapsed < 5 || p.totalDays < 20) return;

  const dailyRate = p.currentMonthExpense / p.daysElapsed;
  const projected = dailyRate * p.totalDays;
  const remaining = projected - p.currentMonthExpense;

  if (p.months.length >= 2) {
    const prevExpense = p.months[p.months.length - 2]?.expense ?? 0;
    if (prevExpense > 0 && projected > prevExpense * 1.1) {
      out.push({
        id: nextId(),
        icon: "⏱️",
        title: "Pace Warning",
        detail: `At current pace, you'll spend ~$${projected.toFixed(0)} — ${(((projected - prevExpense) / prevExpense) * 100).toFixed(0)}% more than last month (~$${remaining.toFixed(0)} more to go)`,
        severity: "negative",
        priority: 7,
      });
    } else if (prevExpense > 0 && projected < prevExpense * 0.9) {
      out.push({
        id: nextId(),
        icon: "⏱️",
        title: "Under-Pacing",
        detail: `At current pace, you'll spend ~$${projected.toFixed(0)} — ${(((prevExpense - projected) / prevExpense) * 100).toFixed(0)}% less than last month`,
        severity: "positive",
        priority: 18,
      });
    }
  }
}

function consistencyInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.months.length < 4) return;

  const expenses = p.months.map((m) => m.expense);
  const avg = expenses.reduce((s, e) => s + e, 0) / expenses.length;
  if (avg === 0) return;

  const variance =
    expenses.reduce((s, e) => s + (e - avg) ** 2, 0) / expenses.length;
  const cv = Math.sqrt(variance) / avg; // coefficient of variation

  if (cv < 0.1) {
    out.push({
      id: nextId(),
      icon: "📊",
      title: "Very Consistent",
      detail: `Your spending is remarkably stable — less than 10% variation month to month`,
      severity: "positive",
      priority: 32,
    });
  } else if (cv > 0.35) {
    out.push({
      id: nextId(),
      icon: "🎢",
      title: "High Variability",
      detail: `Spending swings ${(cv * 100).toFixed(0)}% month-to-month — hard to budget predictably`,
      severity: "negative",
      priority: 22,
    });
  }
}

function debtInsight(p: InsightParams, out: Insight[], nextId: () => string) {
  if (!p.debts || p.debts.openCount === 0) return;

  const net = p.debts.totalOwedToYou - p.debts.totalOwed;
  if (net > 0) {
    out.push({
      id: nextId(),
      icon: "🤝",
      title: "Net Positive Debts",
      detail: `You're owed $${net.toFixed(0)} net across ${p.debts.openCount} open debts`,
      severity: "positive",
      priority: 36,
    });
  } else if (net < 0) {
    out.push({
      id: nextId(),
      icon: "🤝",
      title: "Outstanding Debts",
      detail: `You owe $${Math.abs(net).toFixed(0)} net across ${p.debts.openCount} open debts`,
      severity: "negative",
      priority: 16,
    });
  }
}

function incomeChangeInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.months.length < 2) return;
  const prev = p.months[p.months.length - 2];
  const curr = p.months[p.months.length - 1];
  if (!prev || prev.income === 0) return;

  const pctChange = ((curr.income - prev.income) / prev.income) * 100;
  if (Math.abs(pctChange) < 10) return;

  if (pctChange < -10) {
    out.push({
      id: nextId(),
      icon: "📉",
      title: "Income Drop",
      detail: `Income decreased ${Math.abs(pctChange).toFixed(0)}% vs last month ($${curr.income.toFixed(0)} vs $${prev.income.toFixed(0)})`,
      severity: "negative",
      priority: 9,
    });
  } else if (pctChange > 10) {
    out.push({
      id: nextId(),
      icon: "💵",
      title: "Income Up",
      detail: `Income increased ${pctChange.toFixed(0)}% vs last month`,
      severity: "positive",
      priority: 19,
    });
  }
}

function categoryConcentrationInsight(
  p: InsightParams,
  out: Insight[],
  nextId: () => string,
) {
  if (p.months.length < 1) return;
  const curr = p.months[p.months.length - 1];
  if (!curr.categoryBreakdown.length) return;

  const total = curr.categoryBreakdown.reduce((s, c) => s + c.amount, 0);
  if (total === 0) return;

  const sorted = [...curr.categoryBreakdown].sort(
    (a, b) => b.amount - a.amount,
  );
  const topPct = (sorted[0].amount / total) * 100;

  if (topPct > 40) {
    out.push({
      id: nextId(),
      icon: "🏔️",
      title: `${sorted[0].name} Dominates`,
      detail: `${sorted[0].name} accounts for ${topPct.toFixed(0)}% of all spending — highly concentrated`,
      severity: "info",
      category: sorted[0].name,
      priority: 26,
    });
  }
}
