import { supabaseServer } from "@/lib/supabase/server";
import type { SpendingPattern } from "@/types/futurePurchase";
import { format, startOfMonth, subMonths } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/future-purchases/spending-analysis
 * Get spending pattern analysis for the current user
 * Used for suggesting savings amounts for new purchases
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Fetch last 6 months of transactions
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 6));
  const now = new Date();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, amount, account_id")
    .eq("user_id", user.id)
    .gte("date", format(sixMonthsAgo, "yyyy-MM-dd"))
    .lte("date", format(now, "yyyy-MM-dd"))
    .order("date", { ascending: true });

  // Initialize monthly data
  const monthlyData: Record<string, { income: number; expense: number }> = {};
  for (let i = 0; i < 6; i++) {
    const month = format(subMonths(now, i), "yyyy-MM");
    monthlyData[month] = { income: 0, expense: 0 };
  }

  // Aggregate transactions
  (transactions || []).forEach((tx) => {
    const month = tx.date.substring(0, 7);
    if (monthlyData[month]) {
      if (incomeAccountIds.has(tx.account_id)) {
        monthlyData[month].income += tx.amount;
      } else if (expenseAccountIds.has(tx.account_id)) {
        monthlyData[month].expense += tx.amount;
      }
    }
  });

  // Calculate metrics
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

  return NextResponse.json(spendingPattern);
}
