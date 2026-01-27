import { supabaseServer } from "@/lib/supabase/server";
import { format, startOfMonth } from "date-fns";
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

interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  category:
    | { name: string; color: string }
    | { name: string; color: string }[]
    | null;
}

interface Transfer {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  from_account_id: string;
  to_account_id: string;
  from_account: { name: string } | { name: string }[] | null;
  to_account: { name: string } | { name: string }[] | null;
}

interface DayEntry {
  date: string;
  transactions: Transaction[];
  transfers_in: Transfer[];
  transfers_out: Transfer[];
}

// GET /api/accounts/[id]/balance/daily - Get daily transaction/transfer summaries
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

  // Get current balance
  const { data: balanceData } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("account_id", accountId)
    .single();

  const currentBalance = Number(balanceData?.balance ?? 0);

  // Only show current month (non-archived data)
  const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const endDate = format(new Date(), "yyyy-MM-dd");

  // Get transactions (all are expenses, stored as positive amounts)
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
    .eq("is_draft", false)
    .gte("date", currentMonthStart)
    .lte("date", endDate)
    .order("date", { ascending: false });

  // Get transfers INTO this account
  const { data: transfersIn } = await supabase
    .from("transfers")
    .select(
      `
      id,
      date,
      amount,
      description,
      from_account_id,
      to_account_id,
      from_account:accounts!transfers_from_account_id_fkey(name),
      to_account:accounts!transfers_to_account_id_fkey(name)
    `,
    )
    .eq("to_account_id", accountId)
    .gte("date", currentMonthStart)
    .lte("date", endDate);

  // Get transfers OUT OF this account
  const { data: transfersOut } = await supabase
    .from("transfers")
    .select(
      `
      id,
      date,
      amount,
      description,
      from_account_id,
      to_account_id,
      from_account:accounts!transfers_from_account_id_fkey(name),
      to_account:accounts!transfers_to_account_id_fkey(name)
    `,
    )
    .eq("from_account_id", accountId)
    .gte("date", currentMonthStart)
    .lte("date", endDate);

  // Group everything by date
  const dayMap: Record<string, DayEntry> = {};

  const ensureDay = (date: string) => {
    if (!dayMap[date]) {
      dayMap[date] = {
        date,
        transactions: [],
        transfers_in: [],
        transfers_out: [],
      };
    }
  };

  // Add transactions
  for (const txn of (transactions || []) as Transaction[]) {
    ensureDay(txn.date);
    dayMap[txn.date].transactions.push(txn);
  }

  // Add transfers in
  for (const tr of (transfersIn || []) as Transfer[]) {
    ensureDay(tr.date);
    dayMap[tr.date].transfers_in.push(tr);
  }

  // Add transfers out
  for (const tr of (transfersOut || []) as Transfer[]) {
    ensureDay(tr.date);
    dayMap[tr.date].transfers_out.push(tr);
  }

  // Sort days by date descending
  const sortedDays = Object.values(dayMap).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Calculate running balances (work backwards from current balance)
  // For each day: closing_balance = what we had at end of day
  // opening_balance = what we had at start of day (before any transactions)
  let runningBalance = currentBalance;

  const result = sortedDays.slice(0, limit).map((day) => {
    // Calculate net change for this day
    // Transactions are expenses (subtract from balance)
    const totalExpenses = day.transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    // Transfers in add to balance
    const totalTransfersIn = day.transfers_in.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    // Transfers out subtract from balance
    const totalTransfersOut = day.transfers_out.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );

    const netChange = totalTransfersIn - totalTransfersOut - totalExpenses;

    // This day's closing balance is the running balance
    const closingBalance = runningBalance;
    // Opening balance is before the day's changes
    const openingBalance = runningBalance - netChange;

    // Move running balance back for the previous day
    runningBalance = openingBalance;

    // Helper to extract from array or object
    const getCategoryName = (cat: Transaction["category"]) => {
      if (!cat) return "Uncategorized";
      if (Array.isArray(cat)) return cat[0]?.name || "Uncategorized";
      return cat.name || "Uncategorized";
    };
    const getCategoryColor = (cat: Transaction["category"]) => {
      if (!cat) return "#888888";
      if (Array.isArray(cat)) return cat[0]?.color || "#888888";
      return cat.color || "#888888";
    };
    const getAccountName = (
      acc: Transfer["from_account"] | Transfer["to_account"],
    ) => {
      if (!acc) return "Unknown";
      if (Array.isArray(acc)) return acc[0]?.name || "Unknown";
      return acc.name || "Unknown";
    };

    return {
      date: day.date,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      net_change: netChange,
      total_expenses: totalExpenses,
      total_transfers_in: totalTransfersIn,
      total_transfers_out: totalTransfersOut,
      transaction_count: day.transactions.length,
      transfer_in_count: day.transfers_in.length,
      transfer_out_count: day.transfers_out.length,
      transactions: day.transactions.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        description: t.description || "",
        category: getCategoryName(t.category),
        category_color: getCategoryColor(t.category),
      })),
      transfers_in: day.transfers_in.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        description: t.description || "",
        from_account: getAccountName(t.from_account),
      })),
      transfers_out: day.transfers_out.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        description: t.description || "",
        to_account: getAccountName(t.to_account),
      })),
    };
  });

  return NextResponse.json({
    current_balance: currentBalance,
    days: result,
  });
}
