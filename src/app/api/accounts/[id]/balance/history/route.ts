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

// GET /api/accounts/[id]/balance/history - Get balance history for an account
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
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  // New: exclude transaction entries from history (they're shown via daily summaries)
  const excludeTransactions =
    searchParams.get("exclude_transactions") !== "false";

  // Get partner ID if linked
  const partnerId = await getPartnerUserId(supabase, user.id);
  const allowedUserIds = partnerId ? [user.id, partnerId] : [user.id];

  // Verify account belongs to user or partner
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, name, type, user_id")
    .eq("id", accountId)
    .in("user_id", allowedUserIds)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Get current balance
  const { data: balanceData } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("account_id", accountId)
    .single();

  const currentBalance = balanceData?.balance ?? 0;

  // Build history query
  let query = supabase
    .from("account_balance_history")
    .select(
      `
      id,
      previous_balance,
      new_balance,
      change_amount,
      change_type,
      transaction_id,
      transfer_id,
      reason,
      is_reconciliation,
      expected_balance,
      discrepancy_amount,
      discrepancy_explanation,
      effective_date,
      created_at
    `,
      { count: "exact" },
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Exclude transaction entries by default (they're shown via daily summaries now)
  if (excludeTransactions) {
    query = query.not(
      "change_type",
      "in",
      "(transaction_expense,transaction_income,transaction_deleted)",
    );
  }

  if (start) query = query.gte("effective_date", start);
  if (end) query = query.lte("effective_date", end);

  const { data: history, error: historyError, count } = await query;

  if (historyError) {
    console.error("Error fetching balance history:", historyError);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 },
    );
  }

  // Fetch related transaction and transfer details
  const transactionIds = (history || [])
    .map((h: any) => h.transaction_id)
    .filter(Boolean);
  const transferIds = (history || [])
    .map((h: any) => h.transfer_id)
    .filter(Boolean);

  // Fetch transaction details
  let transactionsMap: Record<string, any> = {};
  if (transactionIds.length > 0) {
    const { data: transactions } = await supabase
      .from("transactions")
      .select(
        `
        id,
        description,
        amount,
        date,
        category:user_categories!transactions_category_fk(name, color)
      `,
      )
      .in("id", transactionIds);

    (transactions || []).forEach((t: any) => {
      transactionsMap[t.id] = {
        id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        category: t.category?.name || null,
        category_color: t.category?.color || null,
      };
    });
  }

  // Fetch transfer details
  let transfersMap: Record<string, any> = {};
  if (transferIds.length > 0) {
    const { data: transfers } = await supabase
      .from("transfers")
      .select(
        `
        id,
        description,
        amount,
        date,
        from_account:accounts!transfers_from_account_id_fkey(id, name),
        to_account:accounts!transfers_to_account_id_fkey(id, name)
      `,
      )
      .in("id", transferIds);

    (transfers || []).forEach((t: any) => {
      transfersMap[t.id] = {
        id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        from_account_id: t.from_account?.id || null,
        from_account_name: t.from_account?.name || null,
        to_account_id: t.to_account?.id || null,
        to_account_name: t.to_account?.name || null,
      };
    });
  }

  // Build enriched history
  const enrichedHistory = (history || []).map((h: any) => ({
    id: h.id,
    previous_balance: Number(h.previous_balance),
    new_balance: Number(h.new_balance),
    change_amount: Number(h.change_amount),
    change_type: h.change_type,
    reason: h.reason,
    is_reconciliation: h.is_reconciliation,
    expected_balance: h.expected_balance ? Number(h.expected_balance) : null,
    discrepancy_amount: h.discrepancy_amount
      ? Number(h.discrepancy_amount)
      : null,
    discrepancy_explanation: h.discrepancy_explanation,
    effective_date: h.effective_date,
    created_at: h.created_at,
    transaction: h.transaction_id ? transactionsMap[h.transaction_id] : null,
    transfer: h.transfer_id ? transfersMap[h.transfer_id] : null,
  }));

  return NextResponse.json({
    account_id: accountId,
    account_name: account.name,
    account_type: account.type,
    current_balance: Number(currentBalance),
    history: enrichedHistory,
    pagination: {
      total: count || 0,
      limit,
      offset,
      has_more: (count || 0) > offset + limit,
    },
  });
}
