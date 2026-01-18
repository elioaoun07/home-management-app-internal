import { supabaseServer } from "@/lib/supabase/server";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
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

// GET /api/accounts/[id]/balance/archives - Get monthly archives
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
  const year = searchParams.get("year");

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

  // Build query
  let query = supabase
    .from("account_balance_archives")
    .select("*")
    .eq("account_id", accountId)
    .order("year_month", { ascending: false });

  if (year) {
    query = query.like("year_month", `${year}-%`);
  }

  const { data: archives, error } = await query;

  if (error) {
    console.error("Error fetching archives:", error);
    return NextResponse.json(
      { error: "Failed to fetch archives" },
      { status: 500 },
    );
  }

  return NextResponse.json(archives || []);
}

// POST /api/accounts/[id]/balance/archives - Generate archive for a month
export async function POST(
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
  const body = await req.json();
  const { year_month } = body;

  if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json(
      { error: "Invalid year_month format. Use YYYY-MM" },
      { status: 400 },
    );
  }

  // Verify account ownership
  const { data: account } = await supabase
    .from("accounts")
    .select("id, user_id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Parse the month
  const [year, month] = year_month.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  // Get the previous month's closing balance (our opening balance)
  const prevMonth = subMonths(monthStart, 1);
  const prevMonthStr = format(prevMonth, "yyyy-MM");

  let openingBalance = 0;

  // Check if there's a previous archive
  const { data: prevArchive } = await supabase
    .from("account_balance_archives")
    .select("closing_balance")
    .eq("account_id", accountId)
    .eq("year_month", prevMonthStr)
    .single();

  if (prevArchive) {
    openingBalance = Number(prevArchive.closing_balance);
  } else {
    // Get the earliest balance history entry before this month
    const { data: earlierHistory } = await supabase
      .from("account_balance_history")
      .select("previous_balance")
      .eq("account_id", accountId)
      .lt("effective_date", monthStartStr)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (earlierHistory) {
      // Get the last balance before this month from history
      const { data: lastBeforeMonth } = await supabase
        .from("account_balance_history")
        .select("new_balance")
        .eq("account_id", accountId)
        .lt("effective_date", monthStartStr)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      openingBalance = lastBeforeMonth
        ? Number(lastBeforeMonth.new_balance)
        : 0;
    }
  }

  // Get transactions for this month WITH full details for daily summaries
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
    .gte("date", monthStartStr)
    .lte("date", monthEndStr);

  const txns = transactions || [];
  const totalIncome = txns
    .filter((t: any) => Number(t.amount) > 0)
    .reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpenses = Math.abs(
    txns
      .filter((t: any) => Number(t.amount) < 0)
      .reduce((s: number, t: any) => s + Number(t.amount), 0),
  );
  const transactionCount = txns.length;

  // Get transfers for this month
  const { data: transfersIn } = await supabase
    .from("transfers")
    .select("amount")
    .eq("to_account_id", accountId)
    .gte("date", monthStartStr)
    .lte("date", monthEndStr);

  const { data: transfersOut } = await supabase
    .from("transfers")
    .select("amount")
    .eq("from_account_id", accountId)
    .gte("date", monthStartStr)
    .lte("date", monthEndStr);

  const totalTransfersIn = (transfersIn || []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );
  const totalTransfersOut = (transfersOut || []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );
  const transferCount =
    (transfersIn || []).length + (transfersOut || []).length;

  // Get manual adjustments for this month
  const { data: adjustments } = await supabase
    .from("account_balance_history")
    .select("change_amount")
    .eq("account_id", accountId)
    .gte("effective_date", monthStartStr)
    .lte("effective_date", monthEndStr)
    .in("change_type", ["manual_set", "manual_adjustment", "correction"]);

  const totalAdjustments = (adjustments || []).reduce(
    (s, a) => s + Number(a.change_amount),
    0,
  );
  const adjustmentCount = (adjustments || []).length;

  // Calculate closing balance
  const closingBalance =
    openingBalance +
    totalIncome -
    totalExpenses +
    totalTransfersIn -
    totalTransfersOut +
    totalAdjustments;
  const netChange = closingBalance - openingBalance;

  // Upsert the archive
  const { data: archive, error } = await supabase
    .from("account_balance_archives")
    .upsert(
      {
        account_id: accountId,
        user_id: user.id,
        year_month,
        month_start_date: monthStartStr,
        month_end_date: monthEndStr,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        total_transaction_count: transactionCount,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_change: netChange,
        total_transfers_in: totalTransfersIn,
        total_transfers_out: totalTransfersOut,
        transfer_count: transferCount,
        total_adjustments: totalAdjustments,
        adjustment_count: adjustmentCount,
        archived_at: new Date().toISOString(),
      },
      {
        onConflict: "account_id,year_month",
      },
    )
    .select()
    .single();

  if (error) {
    console.error("Error creating archive:", error);
    return NextResponse.json(
      { error: "Failed to create archive" },
      { status: 500 },
    );
  }

  // Also archive daily summaries for this month
  await archiveDailySummaries(
    supabase,
    accountId,
    user.id,
    txns,
    monthStartStr,
    monthEndStr,
  );

  return NextResponse.json(archive);
}

// Helper to archive daily summaries for a month
async function archiveDailySummaries(
  supabase: any,
  accountId: string,
  userId: string,
  transactions: any[],
  monthStartStr: string,
  monthEndStr: string,
) {
  if (!transactions || transactions.length === 0) return;

  // Group transactions by date
  const dateGroups: Record<string, any[]> = {};
  for (const txn of transactions) {
    const date = txn.date;
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(txn);
  }

  // Build and upsert daily summaries
  const dailySummaries = Object.entries(dateGroups).map(([date, txns]) => {
    const incomes = txns.filter((t: any) => Number(t.amount) > 0);
    const expenses = txns.filter((t: any) => Number(t.amount) < 0);

    const totalIncome = incomes.reduce(
      (s: number, t: any) => s + Number(t.amount),
      0,
    );
    const totalExpenses = Math.abs(
      expenses.reduce((s: number, t: any) => s + Number(t.amount), 0),
    );
    const netTransactions = totalIncome - totalExpenses;

    // Find largest transactions
    const largestIncome =
      incomes.length > 0
        ? incomes.reduce((max: any, t: any) =>
            Number(t.amount) > Number(max.amount) ? t : max,
          )
        : null;
    const largestExpense =
      expenses.length > 0
        ? expenses.reduce((max: any, t: any) =>
            Math.abs(Number(t.amount)) > Math.abs(Number(max.amount)) ? t : max,
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
      account_id: accountId,
      user_id: userId,
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

  // Delete existing daily summaries for this month and insert new ones
  await supabase
    .from("account_daily_summaries")
    .delete()
    .eq("account_id", accountId)
    .gte("summary_date", monthStartStr)
    .lte("summary_date", monthEndStr);

  if (dailySummaries.length > 0) {
    const { error } = await supabase
      .from("account_daily_summaries")
      .insert(dailySummaries);

    if (error) {
      console.error("Error archiving daily summaries:", error);
    }
  }
}
