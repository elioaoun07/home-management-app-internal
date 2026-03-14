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

  // Calculate the 6-month window: from 5 months ago to current month
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Get all transactions for the 6-month window (both archived and current)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, amount")
    .eq("account_id", accountId)
    .eq("is_draft", false)
    .gte("date", sixMonthsAgoStr)
    .lte("date", todayStr);

  // Get transfers for the 6-month window
  const { data: transfersIn } = await supabase
    .from("transfers")
    .select("date, amount")
    .eq("to_account_id", accountId)
    .gte("date", sixMonthsAgoStr)
    .lte("date", todayStr);

  const { data: transfersOut } = await supabase
    .from("transfers")
    .select("date, amount")
    .eq("from_account_id", accountId)
    .gte("date", sixMonthsAgoStr)
    .lte("date", todayStr);

  // Group by month
  const monthMap: Record<
    string,
    {
      year_month: string;
      transaction_count: number;
      total_expenses: number;
      transfers_in: number;
      transfers_out: number;
    }
  > = {};

  const ensureMonth = (yearMonth: string) => {
    if (!monthMap[yearMonth]) {
      monthMap[yearMonth] = {
        year_month: yearMonth,
        transaction_count: 0,
        total_expenses: 0,
        transfers_in: 0,
        transfers_out: 0,
      };
    }
  };

  // Add transactions
  for (const txn of transactions || []) {
    const yearMonth = txn.date.substring(0, 7);
    ensureMonth(yearMonth);
    monthMap[yearMonth].transaction_count++;
    monthMap[yearMonth].total_expenses += Number(txn.amount);
  }

  // Add transfers
  for (const tr of transfersIn || []) {
    const yearMonth = tr.date.substring(0, 7);
    ensureMonth(yearMonth);
    monthMap[yearMonth].transfers_in += Number(tr.amount);
  }

  for (const tr of transfersOut || []) {
    const yearMonth = tr.date.substring(0, 7);
    ensureMonth(yearMonth);
    monthMap[yearMonth].transfers_out += Number(tr.amount);
  }

  // Ensure current month always appears (even if empty)
  ensureMonth(currentYearMonth);

  // Sort months descending and limit to 6
  const months = Object.values(monthMap)
    .sort((a, b) => b.year_month.localeCompare(a.year_month))
    .slice(0, 6);

  // Calculate running balances backwards from current balance
  // Start with current balance, work backwards month by month
  let runningBalance = currentBalance;

  const result = months.map((m) => {
    const netChange = m.transfers_in - m.transfers_out - m.total_expenses;
    const closingBalance = runningBalance;
    const openingBalance = runningBalance - netChange;
    runningBalance = openingBalance;

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
      total_income: 0,
      total_transfers_in: m.transfers_in,
      total_transfers_out: m.transfers_out,
      transfer_count: 0,
    };
  });

  return NextResponse.json(result);
}
