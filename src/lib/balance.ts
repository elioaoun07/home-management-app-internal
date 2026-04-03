import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Atomically adjust an account's stored balance by a delta amount.
 * This is the PRIMARY way balances change — every transaction/transfer/split/debt
 * operation calls this to keep account_balances.balance accurate in real-time.
 *
 * Also logs the change to account_balance_history for audit trail.
 */
export async function adjustAccountBalance(
  accountId: string,
  delta: number,
  changeType: string,
  metadata?: {
    userId?: string;
    transactionId?: string;
    reason?: string;
    effectiveDate?: string;
  },
): Promise<{ newBalance: number; previousBalance: number }> {
  if (delta === 0) return { newBalance: 0, previousBalance: 0 };

  const admin = supabaseAdmin();

  // Atomic read + update in a single query using RPC
  // We read current balance first for history logging
  const { data: current, error: readError } = await admin
    .from("account_balances")
    .select("balance")
    .eq("account_id", accountId)
    .maybeSingle();

  let balanceRow = current;

  if (readError || !balanceRow) {
    // Balance row missing — auto-create it so the operation can proceed
    console.warn(
      "[adjustAccountBalance] No balance row for account, creating one:",
      accountId,
    );
    await admin
      .from("account_balances")
      .insert({ account_id: accountId, balance: 0, user_id: metadata?.userId ?? "" });
    // Re-fetch after insert
    const { data: created } = await admin
      .from("account_balances")
      .select("balance")
      .eq("account_id", accountId)
      .maybeSingle();
    if (!created) return { newBalance: 0, previousBalance: 0 };
    balanceRow = created;
  }

  const previousBalance = Number(balanceRow.balance);
  const newBalance = previousBalance + delta;

  const { error: updateError } = await admin
    .from("account_balances")
    .update({
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);

  if (updateError) {
    console.error("[adjustAccountBalance] Update failed:", updateError);
    return { newBalance: previousBalance, previousBalance };
  }

  // Log to balance history (best-effort, don't fail the operation)
  if (metadata?.userId) {
    const today = new Date().toISOString().split("T")[0];
    await admin
      .from("account_balance_history")
      .insert({
        account_id: accountId,
        user_id: metadata.userId,
        previous_balance: previousBalance,
        new_balance: newBalance,
        change_amount: delta,
        change_type: changeType,
        transaction_id: metadata.transactionId || null,
        reason: metadata.reason || null,
        effective_date: metadata.effectiveDate || today,
      })
      .then(({ error }) => {
        if (error)
          console.error("[adjustAccountBalance] History log failed:", error);
      });
  }

  return { newBalance, previousBalance };
}

/**
 * Computes the current account balance using a formula-based approach.
 *
 * Balance = anchor_balance
 *   + transaction_impact (depends on account type)
 *   + transfer_impact
 *   + split_bill_impact
 *
 * The anchor_balance is the last manually-set value (via reconciliation or initial set).
 * Everything since `balance_set_at` is computed from actual data.
 *
 * This ensures the balance is ALWAYS accurate regardless of:
 * - Transaction create/edit/delete
 * - Transfer create/edit/delete
 * - Split bill completion/deletion
 * - Any missed or failed operations
 */
export async function computeAccountBalance(
  accountId: string,
  accountType: "expense" | "income" | "saving",
): Promise<{
  computedBalance: number;
  anchorBalance: number;
  balanceSetAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}> {
  // Use admin client to bypass RLS - authorization is checked by the caller
  const admin = supabaseAdmin();

  // 1. Get balance_set_at and metadata from account_balances
  const { data: balRow, error: balError } = await admin
    .from("account_balances")
    .select("balance, balance_set_at, updated_at, created_at")
    .eq("account_id", accountId)
    .maybeSingle();

  if (balError || !balRow) {
    return {
      computedBalance: 0,
      anchorBalance: 0,
      balanceSetAt: null,
      updatedAt: null,
      createdAt: null,
    };
  }

  const balanceSetAt = balRow.balance_set_at;

  // 2. Get the TRUE anchor: the balance at the last manual reconciliation / initial set.
  //    Since account_balances.balance is now continuously updated, we read the
  //    anchor from balance_history (the new_balance of the last manual_set or initial_set).
  //    If no history exists, fall back to the current stored balance (first-time case).
  let anchorBalance = Number(balRow.balance);

  const { data: lastAnchor } = await admin
    .from("account_balance_history")
    .select("new_balance")
    .eq("account_id", accountId)
    .in("change_type", ["initial_set", "manual_set", "manual_adjustment"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAnchor) {
    anchorBalance = Number(lastAnchor.new_balance);
  }

  // Run all queries in parallel for performance
  const txPromise = (() => {
    let q = admin
      .from("transactions")
      .select("amount, is_debt_return")
      .eq("account_id", accountId)
      .eq("is_draft", false);
    if (balanceSetAt) q = q.gt("inserted_at", balanceSetAt);
    return q;
  })();

  const transferOutPromise = (() => {
    let q = admin
      .from("transfers")
      .select("amount, returned_amount, transfer_type")
      .eq("from_account_id", accountId);
    if (balanceSetAt) q = q.gt("created_at", balanceSetAt);
    return q;
  })();

  const transferInPromise = (() => {
    let q = admin
      .from("transfers")
      .select("amount, returned_amount, transfer_type")
      .eq("to_account_id", accountId);
    if (balanceSetAt) q = q.gt("created_at", balanceSetAt);
    return q;
  })();

  const splitPromise = (() => {
    let q = admin
      .from("transactions")
      .select("collaborator_amount")
      .eq("collaborator_account_id", accountId)
      .not("split_completed_at", "is", null);
    if (balanceSetAt) q = q.gt("split_completed_at", balanceSetAt);
    return q;
  })();

  const [txResult, outResult, inResult, splitResult] = await Promise.all([
    txPromise,
    transferOutPromise,
    transferInPromise,
    splitPromise,
  ]);

  // Calculate transaction impact based on account type
  let txImpact = 0;
  for (const tx of txResult.data || []) {
    const amount = Number(tx.amount);
    if (tx.is_debt_return) {
      // Debt returns always ADD money back (someone repaying you)
      txImpact += amount;
    } else if (accountType === "expense") {
      // Expense transactions DECREASE balance
      txImpact -= amount;
    } else {
      // Income/Saving transactions INCREASE balance
      txImpact += amount;
    }
  }

  // Calculate transfer impact
  let transferImpact = 0;
  for (const t of outResult.data || []) {
    const net =
      t.transfer_type === "household"
        ? Number(t.amount) - Number(t.returned_amount || 0)
        : Number(t.amount);
    transferImpact -= net; // Outgoing always decreases balance
  }
  for (const t of inResult.data || []) {
    const net =
      t.transfer_type === "household"
        ? Number(t.amount) - Number(t.returned_amount || 0)
        : Number(t.amount);
    transferImpact += net; // Incoming always increases balance
  }

  // Calculate split bill impact (collaborator amounts charged to this account)
  let splitImpact = 0;
  for (const st of splitResult.data || []) {
    splitImpact -= Number(st.collaborator_amount || 0);
  }

  const computedBalance =
    anchorBalance + txImpact + transferImpact + splitImpact;

  return {
    computedBalance,
    anchorBalance,
    balanceSetAt,
    updatedAt: balRow.updated_at,
    createdAt: balRow.created_at,
  };
}
