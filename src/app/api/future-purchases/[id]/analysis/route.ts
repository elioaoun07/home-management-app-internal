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

  // Apply urgency multiplier to monthly savings
  // Urgency 1: 1.0x (spread evenly), Urgency 5: 1.5x (front-load savings)
  const urgencyMultiplier = 1 + ((purchase.urgency - 1) / 4) * 0.5; // Range: 1.0 - 1.5
  const baseMonthlySavings = amountRemaining / monthsRemaining;
  const recommendedMonthlySavings = baseMonthlySavings * urgencyMultiplier;

  // Determine if achievable
  const isAchievable = averageMonthlySurplus >= recommendedMonthlySavings;
  const surplusRatio =
    averageMonthlySurplus > 0
      ? recommendedMonthlySavings / averageMonthlySurplus
      : Infinity;

  // Calculate confidence level
  let confidenceLevel = 100;
  if (surplusRatio > 1) confidenceLevel -= (surplusRatio - 1) * 50;
  if (monthlyVariance > averageMonthlySurplus * 0.5) confidenceLevel -= 20;
  if (trend === "decreasing") confidenceLevel -= 15;
  confidenceLevel = Math.max(0, Math.min(100, confidenceLevel));

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" = "low";
  if (surplusRatio > 0.8 || confidenceLevel < 50) riskLevel = "high";
  else if (surplusRatio > 0.5 || confidenceLevel < 70) riskLevel = "medium";

  // Generate suggestions
  const suggestions: string[] = [];
  if (!isAchievable) {
    suggestions.push(
      `Consider extending your target date or reducing the target amount`
    );
  }
  if (surplusRatio > 0.7) {
    suggestions.push(
      `This goal will use ${(surplusRatio * 100).toFixed(0)}% of your typical surplus`
    );
  }
  if (monthlyVariance > averageMonthlySurplus * 0.3) {
    suggestions.push(
      `Your monthly savings vary significantly - consider building a buffer`
    );
  }
  if (purchase.urgency >= 4 && !isAchievable) {
    suggestions.push(
      `High urgency but challenging timeline - consider prioritizing this purchase`
    );
  }
  if (trend === "decreasing") {
    suggestions.push(
      `Your surplus is trending down - monitor spending to stay on track`
    );
  }

  // Project completion date based on current savings rate
  let projectedCompletionDate: string | null = null;
  if (averageMonthlySurplus > 0) {
    const monthsToComplete = Math.ceil(amountRemaining / averageMonthlySurplus);
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + monthsToComplete);
    projectedCompletionDate = format(projectedDate, "yyyy-MM-dd");
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
