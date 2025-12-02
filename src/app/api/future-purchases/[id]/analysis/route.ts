import { supabaseServer } from "@/lib/supabase/server";
import type { SavingsAnalysis, SpendingPattern } from "@/types/futurePurchase";
import { format, startOfMonth, subMonths } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/future-purchases/[id]/analysis
 * Get detailed savings analysis for a future purchase
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from("future_purchases")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // Fetch accounts to determine income vs expense
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, type")
    .eq("user_id", user.id);

  const incomeAccountIds = new Set(
    (accounts || []).filter((a) => a.type === "income").map((a) => a.id)
  );
  const expenseAccountIds = new Set(
    (accounts || []).filter((a) => a.type === "expense").map((a) => a.id)
  );

  // Fetch last 6 months of transactions for spending analysis
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 6));
  const now = new Date();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, amount, account_id")
    .eq("user_id", user.id)
    .gte("date", format(sixMonthsAgo, "yyyy-MM-dd"))
    .lte("date", format(now, "yyyy-MM-dd"))
    .order("date", { ascending: true });

  // Analyze spending patterns
  const monthlyData: Record<string, { income: number; expense: number }> = {};

  for (let i = 0; i < 6; i++) {
    const month = format(subMonths(now, i), "yyyy-MM");
    monthlyData[month] = { income: 0, expense: 0 };
  }

  (transactions || []).forEach((tx) => {
    const month = tx.date.substring(0, 7); // "yyyy-MM"
    if (monthlyData[month]) {
      if (incomeAccountIds.has(tx.account_id)) {
        monthlyData[month].income += tx.amount;
      } else if (expenseAccountIds.has(tx.account_id)) {
        monthlyData[month].expense += tx.amount;
      }
    }
  });

  // Calculate spending pattern metrics
  const monthlyEntries = Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      surplus: data.income - data.expense,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const validMonths = monthlyEntries.filter(
    (m) => m.income > 0 || m.expense > 0
  );
  const monthCount = Math.max(1, validMonths.length);

  const totalIncome = validMonths.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = validMonths.reduce((sum, m) => sum + m.expense, 0);
  const totalSurplus = totalIncome - totalExpense;

  const averageMonthlyIncome = totalIncome / monthCount;
  const averageMonthlyExpense = totalExpense / monthCount;
  const averageMonthlySurplus = totalSurplus / monthCount;

  // Calculate variance
  const surplusValues = validMonths.map((m) => m.surplus);
  const mean = averageMonthlySurplus;
  const variance =
    surplusValues.length > 1
      ? surplusValues.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
        surplusValues.length
      : 0;
  const monthlyVariance = Math.sqrt(variance);

  // Determine trend
  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (validMonths.length >= 3) {
    const firstHalf = validMonths.slice(0, Math.floor(validMonths.length / 2));
    const secondHalf = validMonths.slice(Math.floor(validMonths.length / 2));
    const firstAvg =
      firstHalf.reduce((s, m) => s + m.surplus, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((s, m) => s + m.surplus, 0) / secondHalf.length;
    const changePercent =
      ((secondAvg - firstAvg) / Math.abs(firstAvg || 1)) * 100;
    if (changePercent > 10) trend = "increasing";
    else if (changePercent < -10) trend = "decreasing";
  }

  const spendingPattern: SpendingPattern = {
    averageMonthlyIncome,
    averageMonthlyExpense,
    averageMonthlySurplus,
    monthlyVariance,
    trend,
    monthlyData: monthlyEntries,
  };

  // Calculate savings analysis for the purchase
  const targetDate = new Date(purchase.target_date);
  const monthsRemaining = Math.max(
    1,
    (targetDate.getFullYear() - now.getFullYear()) * 12 +
      (targetDate.getMonth() - now.getMonth())
  );

  const amountRemaining = purchase.target_amount - purchase.current_saved;
  const progressPercent =
    (purchase.current_saved / purchase.target_amount) * 100;

  // Base monthly savings (what you need to save evenly per month)
  const baseMonthlySavings = amountRemaining / monthsRemaining;

  // URGENCY LOGIC - Front-loading based on urgency
  // Urgency affects HOW you distribute savings across months, not the total amount
  // Higher urgency = save more in early months, less in later months

  let recommendedMonthlySavings = baseMonthlySavings;
  let monthlyAllocationPlan: Array<{ month: number; amount: number }> = [];

  if (purchase.urgency >= 4) {
    // HIGH/CRITICAL urgency: Front-load 60-70% in first half
    const frontLoadPercentage = purchase.urgency === 5 ? 0.7 : 0.6;
    const firstHalfMonths = Math.ceil(monthsRemaining / 2);
    const secondHalfMonths = monthsRemaining - firstHalfMonths;

    const firstHalfAmount = amountRemaining * frontLoadPercentage;
    const secondHalfAmount = amountRemaining - firstHalfAmount;

    const firstMonthlyAmount = firstHalfAmount / firstHalfMonths;
    const secondMonthlyAmount = secondHalfAmount / secondHalfMonths;

    // First recommendation is for the immediate next month
    recommendedMonthlySavings = firstMonthlyAmount;

    // Build allocation plan
    for (let i = 1; i <= firstHalfMonths; i++) {
      monthlyAllocationPlan.push({ month: i, amount: firstMonthlyAmount });
    }
    for (let i = firstHalfMonths + 1; i <= monthsRemaining; i++) {
      monthlyAllocationPlan.push({ month: i, amount: secondMonthlyAmount });
    }
  } else if (purchase.urgency >= 2) {
    // MEDIUM urgency: Slight front-load (55%)
    const frontLoadPercentage = 0.55;
    const firstHalfMonths = Math.ceil(monthsRemaining / 2);
    const secondHalfMonths = monthsRemaining - firstHalfMonths;

    const firstHalfAmount = amountRemaining * frontLoadPercentage;
    const secondHalfAmount = amountRemaining - firstHalfAmount;

    const firstMonthlyAmount = firstHalfAmount / firstHalfMonths;
    const secondMonthlyAmount = secondHalfAmount / secondHalfMonths;

    recommendedMonthlySavings = firstMonthlyAmount;

    for (let i = 1; i <= firstHalfMonths; i++) {
      monthlyAllocationPlan.push({ month: i, amount: firstMonthlyAmount });
    }
    for (let i = firstHalfMonths + 1; i <= monthsRemaining; i++) {
      monthlyAllocationPlan.push({ month: i, amount: secondMonthlyAmount });
    }
  } else {
    // LOW urgency: Even distribution
    recommendedMonthlySavings = baseMonthlySavings;
    for (let i = 1; i <= monthsRemaining; i++) {
      monthlyAllocationPlan.push({ month: i, amount: baseMonthlySavings });
    }
  }

  // SMART ANALYSIS: Check against actual financial capacity
  // 1. Can you afford this based on historical surplus?
  const isAchievable = averageMonthlySurplus >= recommendedMonthlySavings;

  // 2. What % of your surplus will this consume?
  const surplusRatio =
    averageMonthlySurplus > 0
      ? recommendedMonthlySavings / averageMonthlySurplus
      : Infinity;

  // 3. Risk assessment based on spending variance
  // High variance = unstable finances = higher risk
  const stabilityScore =
    monthlyVariance > 0
      ? Math.min(100, (averageMonthlySurplus / monthlyVariance) * 20)
      : 100;

  // 4. Calculate confidence level
  let confidenceLevel = 100;

  // Penalize if you don't have enough surplus
  if (surplusRatio > 1) {
    confidenceLevel -= (surplusRatio - 1) * 50;
  } else if (surplusRatio > 0.8) {
    confidenceLevel -= 20; // Tight but possible
  }

  // Penalize if spending is volatile
  if (stabilityScore < 50) {
    confidenceLevel -= 30;
  } else if (stabilityScore < 75) {
    confidenceLevel -= 15;
  }

  // Penalize if trend is negative
  if (trend === "decreasing") {
    confidenceLevel -= 15;
  } else if (trend === "increasing") {
    confidenceLevel += 10; // Bonus for positive trend
  }

  confidenceLevel = Math.max(0, Math.min(100, confidenceLevel));

  // Determine risk level based on multiple factors
  let riskLevel: "low" | "medium" | "high" = "low";

  if (
    !isAchievable ||
    surplusRatio > 0.9 ||
    confidenceLevel < 50 ||
    stabilityScore < 50
  ) {
    riskLevel = "high";
  } else if (
    surplusRatio > 0.6 ||
    confidenceLevel < 70 ||
    stabilityScore < 75
  ) {
    riskLevel = "medium";
  }

  // Generate SMART suggestions based on actual analysis
  const suggestions: string[] = [];

  if (!isAchievable) {
    const shortfall = recommendedMonthlySavings - averageMonthlySurplus;
    suggestions.push(
      `⚠️ You need $${recommendedMonthlySavings.toFixed(0)}/mo but only have $${averageMonthlySurplus.toFixed(0)} surplus. Short by $${shortfall.toFixed(0)}/mo`
    );

    // Suggest realistic alternatives
    const affordableMonths = Math.ceil(
      amountRemaining / (averageMonthlySurplus * 0.8)
    ); // 80% of surplus
    if (affordableMonths <= 12) {
      suggestions.push(
        `💡 Consider extending to ${affordableMonths} months for a comfortable $${(amountRemaining / affordableMonths).toFixed(0)}/mo`
      );
    }
  } else if (surplusRatio > 0.7) {
    suggestions.push(
      `📊 This goal will use ${(surplusRatio * 100).toFixed(0)}% of your average surplus - leaves little room for unexpected expenses`
    );
  } else if (surplusRatio < 0.5) {
    suggestions.push(
      `✅ Great! This only uses ${(surplusRatio * 100).toFixed(0)}% of your surplus - very achievable`
    );
  }

  if (stabilityScore < 75) {
    suggestions.push(
      `📉 Your monthly surplus varies by $${monthlyVariance.toFixed(0)} - consider a buffer of $${(monthlyVariance * 0.5).toFixed(0)}/mo`
    );
  }

  if (purchase.urgency >= 4) {
    const firstHalfTotal = monthlyAllocationPlan
      .slice(0, Math.ceil(monthsRemaining / 2))
      .reduce((sum, m) => sum + m.amount, 0);
    suggestions.push(
      `🚀 High urgency detected: Save $${monthlyAllocationPlan[0].amount.toFixed(0)}/mo initially (${((firstHalfTotal / amountRemaining) * 100).toFixed(0)}% in first half)`
    );
  }

  if (trend === "decreasing") {
    suggestions.push(
      `⚠️ Your surplus is declining - review your expenses to avoid falling short`
    );
  } else if (trend === "increasing") {
    suggestions.push(
      `📈 Your surplus is growing! You might reach this goal ahead of schedule`
    );
  }

  // Suggest expense optimization opportunities
  if (averageMonthlyExpense > averageMonthlyIncome * 0.7) {
    const targetExpense = averageMonthlyIncome * 0.7;
    const potentialSavings = averageMonthlyExpense - targetExpense;
    suggestions.push(
      `💰 Your expenses are ${((averageMonthlyExpense / averageMonthlyIncome) * 100).toFixed(0)}% of income. Reducing to 70% could free up $${potentialSavings.toFixed(0)}/mo`
    );
  }

  // Project realistic completion date based on actual capacity
  let projectedCompletionDate: string | null = null;
  if (averageMonthlySurplus > 0) {
    // Use 80% of surplus for realistic projection (accounts for life happening)
    const realisticMonthlySaving = averageMonthlySurplus * 0.8;
    const monthsToComplete = Math.ceil(
      amountRemaining / realisticMonthlySaving
    );
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + monthsToComplete);
    projectedCompletionDate = format(projectedDate, "yyyy-MM-dd");

    if (monthsToComplete > monthsRemaining + 2) {
      suggestions.push(
        `📅 Based on your actual savings rate, you'll likely need ${monthsToComplete} months (vs ${monthsRemaining} target)`
      );
    }
  }

  const analysis: SavingsAnalysis = {
    recommendedMonthlySavings,
    monthsRemaining,
    amountRemaining,
    progressPercent,
    isAchievable,
    confidenceLevel,
    averageMonthlySurplus,
    suggestions,
    projectedCompletionDate,
    riskLevel,
  };

  return NextResponse.json({
    purchase,
    analysis,
    spendingPattern,
  });
}
