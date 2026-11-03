import { supabaseAdmin } from "@/lib/supabase/admin";

async function logBalanceIssue(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string | undefined,
  message: string,
  error: unknown,
) {
  try {
    await admin.from("error_logs").insert({
      user_id: userId ?? null,
      error_message: message,
      error_stack:
        typeof error === "string" ? error : JSON.stringify(error ?? {}),
      component_name: "adjustAccountBalance",
    });
  } catch {
    /* best-effort diagnostics only */
  }
}

/** Concurrent writers on one account are rare; a few re-reads always settle them. */
const MAX_BALANCE_CAS_ATTEMPTS = 5;

/**
 * Atomically adjust an account's stored balance by a delta amount.
 * This is the PRIMARY way balances change — every transaction/transfer/split/debt
 * operation calls this to keep account_balances.balance accurate in real-time.
 *
 * The write is a compare-and-swap on the exact stored value (read as text so no
 * float rounding hides a change): if another request moved the balance between
 * our read and write, the update matches no row and we re-read. A plain
 * read-then-write lost one of two overlapping updates (BUD-87, 2026-10-28).
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
    transferId?: string;
    reason?: string;
    effectiveDate?: string;
  },
): Promise<{ newBalance: number; previousBalance: number }> {
  if (delta === 0) return { newBalance: 0, previousBalance: 0 };

  const admin = supabaseAdmin();

  const readStoredBalance = async () => {
    const { data, error } = await admin
      .from("account_balances")
      .select("balance::text")
      .eq("account_id", accountId)
      .maybeSingle();
    return { stored: (data?.balance as string | undefined) ?? null, error };
  };

  let previousBalance = 0;
  let newBalance = 0;
  let applied = false;

  for (let attempt = 0; attempt < MAX_BALANCE_CAS_ATTEMPTS; attempt++) {
    const read = await readStoredBalance();
    let stored = read.stored;

    if (read.error || stored === null) {
      // Balance row missing — auto-create it so the operation can proceed
      // (a concurrent creator wins the UNIQUE(account_id) race harmlessly)
      await admin
        .from("account_balances")
        .insert({
          account_id: accountId,
          balance: 0,
          user_id: metadata?.userId ?? "",
        });
      ({ stored } = await readStoredBalance());
      if (stored === null) return { newBalance: 0, previousBalance: 0 };
    }

    previousBalance = Number(stored);
    newBalance = previousBalance + delta;

    const { data: swapped, error: updateError } = await admin
      .from("account_balances")
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId)
      .eq("balance", stored)
      .select("account_id");

    if (updateError) {
      await logBalanceIssue(
        admin,
        metadata?.userId,
        "Account balance update failed",
        updateError,
      );
      return { newBalance: previousBalance, previousBalance };
    }

    if ((swapped?.length ?? 0) > 0) {
      applied = true;
      break;
    }
    // Another writer moved the balance after our read — re-read and retry
  }

  if (!applied) {
    await logBalanceIssue(
      admin,
      metadata?.userId,
      "Account balance update lost to concurrent writers",
      { accountId, delta, changeType },
    );
    return { newBalance: previousBalance, previousBalance };
  }

  // Log to balance history (best-effort, don't fail the operation)
  if (metadata?.userId) {
    const today = new Date().toISOString().split("T")[0];
    const { error: historyError } = await admin
      .from("account_balance_history")
      .insert({
        account_id: accountId,
        user_id: metadata.userId,
        previous_balance: previousBalance,
        new_balance: newBalance,
        change_amount: delta,
        change_type: changeType,
        transaction_id: metadata.transactionId || null,
        transfer_id: metadata.transferId || null,
        reason: metadata.reason || null,
        effective_date: metadata.effectiveDate || today,
      });

    if (historyError) {
      await logBalanceIssue(
        admin,
        metadata.userId,
        "Account balance history log failed",
        historyError,
      );
    }
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
  //    If an older manually-checked account has a checkpoint but no history row, keep
  //    the stored value as its legacy anchor. Fresh accounts without a checkpoint
  //    start from zero so stale transfer deltas cannot become the new baseline.
  let anchorBalance = balanceSetAt ? Number(balRow.balance) : 0;

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
      .eq("is_draft", false)
      .is("deleted_at", null);
    if (balanceSetAt) q = q.gt("inserted_at", balanceSetAt);
    return q;
  })();

  const transferOutPromise = (() => {
    let q = admin
      .from("transfers")
      .select("amount, returned_amount, transfer_type")
      .eq("from_account_id", accountId)
      .is("deleted_at", null);
    if (balanceSetAt) q = q.gt("created_at", balanceSetAt);
    return q;
  })();

  const transferInPromise = (() => {
    let q = admin
      .from("transfers")
      .select("amount, to_amount, returned_amount, transfer_type")
      .eq("to_account_id", accountId)
      .is("deleted_at", null);
    if (balanceSetAt) q = q.gt("created_at", balanceSetAt);
    return q;
  })();

  const splitPromise = (() => {
    let q = admin
      .from("transactions")
      .select("collaborator_amount")
      .eq("collaborator_account_id", accountId)
      .not("split_completed_at", "is", null)
      .is("deleted_at", null);
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
    // Cross-currency conversion transfers land at to_amount (destination
    // units), which may differ from the source `amount` — see transfers API.
    const net =
      t.to_amount != null
        ? Number(t.to_amount)
        : t.transfer_type === "household"
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
