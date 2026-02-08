import { supabaseAdmin } from "@/lib/supabase/admin";

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

  // 1. Get anchor balance and balance_set_at
  const { data: anchor, error: anchorError } = await admin
    .from("account_balances")
    .select("balance, balance_set_at, updated_at, created_at")
    .eq("account_id", accountId)
    .maybeSingle();

  if (anchorError || !anchor) {
    return {
      computedBalance: 0,
      anchorBalance: 0,
      balanceSetAt: null,
      updatedAt: null,
      createdAt: null,
    };
  }

  const anchorBalance = Number(anchor.balance);
  const balanceSetAt = anchor.balance_set_at;

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
    updatedAt: anchor.updated_at,
    createdAt: anchor.created_at,
  };
}
