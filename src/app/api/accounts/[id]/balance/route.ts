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

// GET /api/accounts/[id]/balance - Get balance for a specific account
export async function GET(
  _req: NextRequest,
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

  // Verify account belongs to user OR partner AND get account type
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, type, user_id")
    .eq("id", accountId)
    .in("user_id", allowedUserIds)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // The account owner (could be current user or partner)
  const accountOwnerId = account.user_id;

  // Read balance directly from account_balances (source of truth, updated atomically by all write operations)
  const { data: balanceRow, error: balanceError } = await supabase
    .from("account_balances")
    .select("balance, balance_set_at, updated_at, created_at")
    .eq("account_id", accountId)
    .maybeSingle();

  const storedBalance = balanceRow ? Number(balanceRow.balance) : 0;
  const balanceSetAt = balanceRow?.balance_set_at || null;
  const updatedAt = balanceRow?.updated_at || null;
  const createdAt = balanceRow?.created_at || null;

  // Get pending draft transactions (always count all drafts)
  // Separate regular drafts from future payments (drafts with scheduled_date)
  const { data: draftTransactions, error: draftError } = await supabase
    .from("transactions")
    .select("amount, scheduled_date")
    .eq("account_id", accountId)
    .eq("user_id", accountOwnerId)
    .eq("is_draft", true);

  if (draftError) {
    console.error("Error fetching draft transactions:", draftError);
  }

  // Split into regular drafts and future payments
  const regularDrafts =
    draftTransactions?.filter((t) => !t.scheduled_date) || [];
  const futurePayments =
    draftTransactions?.filter((t) => t.scheduled_date) || [];

  const totalDrafts = regularDrafts.reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );
  const totalFuturePayments = futurePayments.reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );

  // Current balance = stored balance - all pending drafts (regular + future)
  const allDraftsTotal = totalDrafts + totalFuturePayments;
  const currentBalance = storedBalance - allDraftsTotal;

  // Also fetch open debt count for display
  const { data: openDebts } = await supabase
    .from("debts")
    .select("original_amount, returned_amount")
    .eq("user_id", accountOwnerId)
    .eq("status", "open");

  const debtCount = openDebts?.length || 0;
  const totalOutstandingDebt =
    openDebts?.reduce(
      (sum, d) => sum + (Number(d.original_amount) - Number(d.returned_amount)),
      0,
    ) || 0;

  return NextResponse.json({
    account_id: accountId,
    balance: currentBalance,
    pending_drafts: totalDrafts,
    draft_count: regularDrafts.length,
    future_payment_total: totalFuturePayments,
    future_payment_count: futurePayments.length,
    debt_count: debtCount,
    outstanding_debt: totalOutstandingDebt,
    balance_set_at: balanceSetAt,
    created_at: createdAt || new Date().toISOString(),
    updated_at: updatedAt || new Date().toISOString(),
    _debug: {
      user_id: user.id,
      stored_balance: storedBalance,
      drafts_count: regularDrafts.length,
      drafts_total: totalDrafts,
      future_count: futurePayments.length,
      future_total: totalFuturePayments,
    },
  });
}

// POST /api/accounts/[id]/balance - Set/Update balance for an account (manual reconciliation)
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
  const { balance, reason, is_reconciliation, discrepancy_explanation } = body;

  if (typeof balance !== "number") {
    return NextResponse.json(
      { error: "Balance must be a number" },
      { status: 400 },
    );
  }

  // Verify account belongs to user and get type
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, type")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Get current stored balance for history tracking
  const { data: currentRow } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("account_id", accountId)
    .maybeSingle();

  const previousBalance = currentRow ? Number(currentRow.balance) : 0;

  const isInitialSet = previousBalance === 0;
  const changeAmount = balance - previousBalance;

  // Upsert balance (insert or update)
  // Set balance_set_at to now - this resets the anchor point
  // All future formula calculations start from this new anchor
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const { data, error } = await supabase
    .from("account_balances")
    .upsert(
      {
        account_id: accountId,
        user_id: user.id,
        balance,
        balance_set_at: now,
        updated_at: now,
      },
      {
        onConflict: "account_id",
      },
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting balance:", error);
    if ((error as any).code === "23505") {
      return NextResponse.json({ error: "Balance record already exists for this account" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to balance history
  const historyEntry = {
    account_id: accountId,
    user_id: user.id,
    previous_balance: previousBalance,
    new_balance: balance,
    change_amount: changeAmount,
    change_type: isInitialSet ? "initial_set" : "manual_set",
    reason: reason || null,
    is_reconciliation: is_reconciliation || Math.abs(changeAmount) > 0.01,
    expected_balance: previousBalance,
    discrepancy_amount: changeAmount !== 0 ? changeAmount : null,
    discrepancy_explanation: discrepancy_explanation || null,
    effective_date: today,
  };

  const { error: historyError } = await supabase
    .from("account_balance_history")
    .insert(historyEntry);

  if (historyError) {
    // Log but don't fail - history is supplementary
    console.error("Error logging balance history:", historyError);
  }

  return NextResponse.json(data);
}
