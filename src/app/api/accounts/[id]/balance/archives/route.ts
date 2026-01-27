import { supabaseServer } from "@/lib/supabase/server";
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

// GET /api/accounts/[id]/balance/archives - Get monthly summaries from archived daily data
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

  // Get current balance for calculating historical balances
  const { data: balanceData } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("account_id", accountId)
    .single();

  const currentBalance = Number(balanceData?.balance ?? 0);

  // Get archived daily summaries grouped by month
  const { data: archivedDays, error } = await supabase
    .from("account_daily_summaries")
    .select("*")
    .eq("account_id", accountId)
    .eq("is_archived", true)
    .order("summary_date", { ascending: false });

  if (error) {
    console.error("Error fetching archived summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch archives" },
      { status: 500 },
    );
  }

  if (!archivedDays || archivedDays.length === 0) {
    return NextResponse.json([]);
  }

  // Also get transfers for archived months
  const oldestDate = archivedDays[archivedDays.length - 1].summary_date;
  const newestDate = archivedDays[0].summary_date;

  const { data: transfersIn } = await supabase
    .from("transfers")
    .select("date, amount")
    .eq("to_account_id", accountId)
    .gte("date", oldestDate)
    .lte("date", newestDate);

  const { data: transfersOut } = await supabase
    .from("transfers")
    .select("date, amount")
    .eq("from_account_id", accountId)
    .gte("date", oldestDate)
    .lte("date", newestDate);

  // Group by month
  const monthMap: Record<
    string,
    {
      year_month: string;
      transaction_count: number;
      total_expenses: number;
      transfers_in: number;
      transfers_out: number;
      days: any[];
    }
  > = {};

  for (const day of archivedDays) {
    const yearMonth = day.summary_date.substring(0, 7); // "2025-12"
    if (!monthMap[yearMonth]) {
      monthMap[yearMonth] = {
        year_month: yearMonth,
        transaction_count: 0,
        total_expenses: 0,
        transfers_in: 0,
        transfers_out: 0,
        days: [],
      };
    }
    monthMap[yearMonth].transaction_count += day.transaction_count || 0;
    monthMap[yearMonth].total_expenses += Number(day.total_expenses) || 0;
    monthMap[yearMonth].days.push(day);
  }

  // Add transfers to months
  for (const tr of transfersIn || []) {
    const yearMonth = tr.date.substring(0, 7);
    if (monthMap[yearMonth]) {
      monthMap[yearMonth].transfers_in += Number(tr.amount);
    }
  }

  for (const tr of transfersOut || []) {
    const yearMonth = tr.date.substring(0, 7);
    if (monthMap[yearMonth]) {
      monthMap[yearMonth].transfers_out += Number(tr.amount);
    }
  }

  // Convert to array and calculate balances
  const months = Object.values(monthMap).sort((a, b) =>
    b.year_month.localeCompare(a.year_month),
  );

  // Calculate running balances for each month (work backwards from current)
  // First, get all non-archived (current month) totals
  const { data: currentMonthDays } = await supabase
    .from("account_daily_summaries")
    .select("total_expenses")
    .eq("account_id", accountId)
    .eq("is_archived", false);

  const { data: currentTransfersIn } = await supabase
    .from("transfers")
    .select("amount")
    .eq("to_account_id", accountId)
    .gt("date", newestDate);

  const { data: currentTransfersOut } = await supabase
    .from("transfers")
    .select("amount")
    .eq("from_account_id", accountId)
    .gt("date", newestDate);

  // Current month net change
  const currentMonthExpenses = (currentMonthDays || []).reduce(
    (s, d) => s + Number(d.total_expenses),
    0,
  );
  const currentMonthTrIn = (currentTransfersIn || []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );
  const currentMonthTrOut = (currentTransfersOut || []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );

  // Balance at end of last archived month = current - current month changes
  let runningBalance =
    currentBalance -
    (currentMonthTrIn - currentMonthTrOut - currentMonthExpenses);

  const result = months.map((m) => {
    const netChange = m.transfers_in - m.transfers_out - m.total_expenses;
    const closingBalance = runningBalance;
    const openingBalance = runningBalance - netChange;
    runningBalance = openingBalance; // Move back for next month

    // Format month name
    const [year, month] = m.year_month.split("-");
    const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = monthDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    return {
      id: m.year_month,
      year_month: m.year_month,
      month_name: monthName,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      net_change: netChange,
      total_transaction_count: m.transaction_count,
      total_expenses: m.total_expenses,
      total_income: 0, // All transactions are expenses in this app
      total_transfers_in: m.transfers_in,
      total_transfers_out: m.transfers_out,
      transfer_count: 0, // Could calculate if needed
    };
  });

  return NextResponse.json(result);
}
