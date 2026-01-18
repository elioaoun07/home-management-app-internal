import { supabaseServer } from "@/lib/supabase/server";
import { format, startOfMonth, subDays } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to get partner user ID if linked
async function getPartnerUserId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id, active")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link) return null;
  return link.owner_user_id === userId
    ? link.partner_user_id
    : link.owner_user_id;
}

// GET /api/accounts/[id]/balance/daily - Get daily summaries
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: accountId } = await params;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const limit = parseInt(searchParams.get("limit") || "30");

  // Get partner ID if linked
  const partnerId = await getPartnerUserId(supabase, user.id);
  const allowedUserIds = partnerId ? [user.id, partnerId] : [user.id];

  // Verify account access
  const { data: account } = await supabase
    .from("accounts")
    .select("id, user_id")
    .eq("id", accountId)
    .in("user_id", allowedUserIds)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Try to get from daily summaries table first
  let query = supabase
    .from("account_daily_summaries")
    .select("*")
    .eq("account_id", accountId)
    .order("summary_date", { ascending: false })
    .limit(limit);

  if (start) query = query.gte("summary_date", start);
  if (end) query = query.lte("summary_date", end);

  const { data: summaries, error } = await query;

  if (error) {
    console.error("Error fetching daily summaries:", error);
    // Fallback: generate on-the-fly from transactions
    return await generateDailySummariesOnFly(
      supabase,
      accountId,
      start,
      end,
      limit,
    );
  }

  // Get the current month boundaries
  const now = new Date();
  const currentMonthStart = format(startOfMonth(now), "yyyy-MM-dd");

  // If we have stored summaries, check if we need to supplement with current month data
  const storedSummaries = summaries || [];

  // Get current month transactions (always compute on-the-fly for current month)
  const currentMonthSummaries = await getCurrentMonthSummaries(
    supabase,
    accountId,
    currentMonthStart,
  );

  // Merge: stored summaries for past months + current month on-the-fly
  // Filter out any stored summaries from current month (they may be stale)
  const pastMonthSummaries = storedSummaries.filter(
    (s: any) => s.summary_date < currentMonthStart,
  );

  // Combine and sort
  const allSummaries = [...currentMonthSummaries, ...pastMonthSummaries].sort(
    (a, b) =>
      new Date(b.summary_date).getTime() - new Date(a.summary_date).getTime(),
  );

  // Apply date filters if provided
  let filtered = allSummaries;
  if (start) {
    filtered = filtered.filter((s) => s.summary_date >= start);
  }
  if (end) {
    filtered = filtered.filter((s) => s.summary_date <= end);
  }

  return NextResponse.json(filtered.slice(0, limit));
}

// Get current month summaries (always computed fresh)
async function getCurrentMonthSummaries(
  supabase: any,
  accountId: string,
  currentMonthStart: string,
): Promise<any[]> {
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `
      id,
      date,
      amount,
      description,
      category:user_categories!transactions_category_fk(name, color)
    `,
    )
    .eq("account_id", accountId)
    .gte("date", currentMonthStart)
    .order("date", { ascending: false });

  if (!transactions || transactions.length === 0) {
    return [];
  }

  type TransactionEntry = {
    id: string;
    date: string;
    amount: number;
    description: string | null;
    category: { name: string; color: string } | null;
  };

  // Group by date
  const dateGroups: Record<string, TransactionEntry[]> = {};
  for (const txn of transactions as TransactionEntry[]) {
    const date = txn.date;
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(txn);
  }

  return Object.entries(dateGroups).map(([date, txns]) => {
    const incomes = txns.filter((t: TransactionEntry) => Number(t.amount) > 0);
    const expenses = txns.filter((t: TransactionEntry) => Number(t.amount) < 0);

    const totalIncome = incomes.reduce(
      (s: number, t: TransactionEntry) => s + Number(t.amount),
      0,
    );
    const totalExpenses = Math.abs(
      expenses.reduce(
        (s: number, t: TransactionEntry) => s + Number(t.amount),
        0,
      ),
    );
    const netTransactions = totalIncome - totalExpenses;

    const largestIncome =
      incomes.length > 0
        ? incomes.reduce((max: TransactionEntry, t: TransactionEntry) =>
            Number(t.amount) > Number(max.amount) ? t : max,
          )
        : null;
    const largestExpense =
      expenses.length > 0
        ? expenses.reduce((max: TransactionEntry, t: TransactionEntry) =>
            Math.abs(Number(t.amount)) > Math.abs(Number(max.amount)) ? t : max,
          )
        : null;

    const categoryMap: Record<
      string,
      { name: string; color: string; amount: number; count: number }
    > = {};
    for (const txn of txns) {
      const catName = txn.category?.name || "Uncategorized";
      const catColor = txn.category?.color || "#888888";
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          name: catName,
          color: catColor,
          amount: 0,
          count: 0,
        };
      }
      categoryMap[catName].amount += Number(txn.amount);
      categoryMap[catName].count += 1;
    }

    return {
      id: `current-${date}`,
      account_id: accountId,
      summary_date: date,
      opening_balance: 0,
      closing_balance: 0,
      transaction_count: txns.length,
      income_count: incomes.length,
      expense_count: expenses.length,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net_transactions: netTransactions,
      largest_income: largestIncome ? Number(largestIncome.amount) : null,
      largest_income_desc: largestIncome?.description || null,
      largest_expense: largestExpense
        ? Math.abs(Number(largestExpense.amount))
        : null,
      largest_expense_desc: largestExpense?.description || null,
      category_breakdown: Object.values(categoryMap),
    };
  });
}

// Generate daily summaries on-the-fly from transactions
async function generateDailySummariesOnFly(
  supabase: any,
  accountId: string,
  start: string | null,
  end: string | null,
  limit: number,
) {
  // Default to last 30 days if no range specified
  const endDate = end || format(new Date(), "yyyy-MM-dd");
  const startDate = start || format(subDays(new Date(), 30), "yyyy-MM-dd");

  // Get transactions for the date range
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `
      id,
      date,
      amount,
      description,
      category:user_categories!transactions_category_fk(name, color)
    `,
    )
    .eq("account_id", accountId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  if (!transactions || transactions.length === 0) {
    return NextResponse.json([]);
  }

  // Define transaction type for proper typing
  type TransactionEntry = {
    id: string;
    date: string;
    amount: number;
    description: string | null;
    category: { name: string; color: string } | null;
  };

  // Group by date
  const dateGroups: Record<string, TransactionEntry[]> = {};
  for (const txn of transactions as TransactionEntry[]) {
    const date = txn.date;
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(txn);
  }

  // Build summaries
  const summaries = Object.entries(dateGroups)
    .map(([date, txns]) => {
      const incomes = txns.filter(
        (t: TransactionEntry) => Number(t.amount) > 0,
      );
      const expenses = txns.filter(
        (t: TransactionEntry) => Number(t.amount) < 0,
      );

      const totalIncome = incomes.reduce(
        (s: number, t: TransactionEntry) => s + Number(t.amount),
        0,
      );
      const totalExpenses = Math.abs(
        expenses.reduce(
          (s: number, t: TransactionEntry) => s + Number(t.amount),
          0,
        ),
      );
      const netTransactions = totalIncome - totalExpenses;

      // Find largest
      const largestIncome =
        incomes.length > 0
          ? incomes.reduce((max: TransactionEntry, t: TransactionEntry) =>
              Number(t.amount) > Number(max.amount) ? t : max,
            )
          : null;
      const largestExpense =
        expenses.length > 0
          ? expenses.reduce((max: TransactionEntry, t: TransactionEntry) =>
              Math.abs(Number(t.amount)) > Math.abs(Number(max.amount))
                ? t
                : max,
            )
          : null;

      // Category breakdown
      const categoryMap: Record<
        string,
        { name: string; color: string; amount: number; count: number }
      > = {};
      for (const txn of txns) {
        const catName = txn.category?.name || "Uncategorized";
        const catColor = txn.category?.color || "#888888";
        if (!categoryMap[catName]) {
          categoryMap[catName] = {
            name: catName,
            color: catColor,
            amount: 0,
            count: 0,
          };
        }
        categoryMap[catName].amount += Number(txn.amount);
        categoryMap[catName].count += 1;
      }

      return {
        id: `generated-${date}`,
        account_id: accountId,
        summary_date: date,
        opening_balance: 0, // Not available in on-the-fly mode
        closing_balance: 0, // Not available in on-the-fly mode
        transaction_count: txns.length,
        income_count: incomes.length,
        expense_count: expenses.length,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_transactions: netTransactions,
        largest_income: largestIncome ? Number(largestIncome.amount) : null,
        largest_income_desc: largestIncome?.description || null,
        largest_expense: largestExpense
          ? Math.abs(Number(largestExpense.amount))
          : null,
        largest_expense_desc: largestExpense?.description || null,
        category_breakdown: Object.values(categoryMap),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.summary_date).getTime() - new Date(a.summary_date).getTime(),
    )
    .slice(0, limit);

  return NextResponse.json(summaries);
}
