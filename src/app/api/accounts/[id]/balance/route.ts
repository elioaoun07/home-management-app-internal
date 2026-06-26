import { getAccessibleAccount } from "@/lib/accountAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const postBalanceSchema = z.object({
  balance: z.number(),
  reason: z.string().max(200).nullish(),
  is_reconciliation: z.boolean().optional(),
  discrepancy_explanation: z.string().max(500).nullish(),
  // Undo support: when restoring a prior reconciliation, the client supplies
  // the original balance_set_at timestamp and the history row id to remove.
  balanceSetAt: z.string().datetime().optional(),
  restoreHistoryId: z.string().uuid().optional(),
});

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

  const account = await getAccessibleAccount(supabase, user.id, accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const accountOwnerId = account.user_id;
  const admin = supabaseAdmin();

  // Read balance directly from account_balances (source of truth, updated atomically by all write operations)
  const { data: balanceRow } = await admin
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
  const { data: draftTransactions } = await admin
    .from("transactions")
    .select("amount, scheduled_date")
    .eq("account_id", accountId)
    .eq("is_draft", true)
    .is("deleted_at", null);

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
  const { data: openDebts } = await admin
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
      account_owner_id: accountOwnerId,
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
  const parsed = postBalanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const {
    balance,
    reason,
    is_reconciliation,
    discrepancy_explanation,
    balanceSetAt,
    restoreHistoryId,
  } = parsed.data;

  const account = await getAccessibleAccount(supabase, user.id, accountId);
  if (!account?.canWrite) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const admin = supabaseAdmin();

  // Get current stored balance + checkpoint date for history/undo tracking
  const { data: currentRow } = await admin
    .from("account_balances")
    .select("balance, balance_set_at")
    .eq("account_id", accountId)
    .maybeSingle();

  const previousBalance = currentRow ? Number(currentRow.balance) : 0;
  const previousBalanceSetAt = currentRow?.balance_set_at ?? null;

  const isInitialSet = previousBalance === 0;
  const changeAmount = balance - previousBalance;

  // Set balance_set_at to now (or to a caller-supplied timestamp when
  // restoring a prior checkpoint via Undo) - this resets the anchor point.
  // All future formula calculations start from this new anchor.
  const now = new Date().toISOString();
  const effectiveSetAt = balanceSetAt || now;
  const today = now.split("T")[0];
  const { data, error } = await admin
    .from("account_balances")
    .upsert(
      {
        account_id: accountId,
        user_id: account.user_id,
        balance,
        balance_set_at: effectiveSetAt,
        updated_at: now,
      },
      {
        onConflict: "account_id",
      },
    )
    .select()
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "Balance record already exists for this account" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Undo path: remove the history row created by the reconciliation being
  // undone instead of logging a new one. Scoped to this account + user so a
  // forged id can't delete unrelated history.
  if (restoreHistoryId) {
    await admin
      .from("account_balance_history")
      .delete()
      .eq("id", restoreHistoryId)
      .eq("account_id", accountId)
      .eq("user_id", user.id);

    return NextResponse.json({
      ...data,
      previous_balance: previousBalance,
      previous_balance_set_at: previousBalanceSetAt,
      history_id: null,
    });
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

  const { data: historyData } = await admin
    .from("account_balance_history")
    .insert(historyEntry)
    .select("id")
    .single();

  return NextResponse.json({
    ...data,
    previous_balance: previousBalance,
    previous_balance_set_at: previousBalanceSetAt,
    history_id: historyData?.id ?? null,
  });
}
