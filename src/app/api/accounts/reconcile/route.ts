import { adjustAccountBalance, computeAccountBalance } from "@/lib/balance";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/accounts/reconcile
 *
 * Auto-reconciliation: recomputes balance from first principles for every
 * account the user owns, compares with the stored value, and silently
 * corrects any drift.  Called once on app load by the SyncContext.
 */
export async function POST() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all accounts owned by this user
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, type")
    .eq("user_id", user.id);

  if (error || !accounts) {
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 },
    );
  }

  const admin = supabaseAdmin();
  const corrections: Array<{
    accountId: string;
    stored: number;
    computed: number;
    diff: number;
  }> = [];

  for (const account of accounts) {
    // computeAccountBalance reads the true anchor from balance_history and
    // recomputes from first principles (all txns/transfers/splits since anchor).
    const result = await computeAccountBalance(account.id, account.type);

    // Read the LIVE stored balance
    const { data: balRow } = await admin
      .from("account_balances")
      .select("balance")
      .eq("account_id", account.id)
      .maybeSingle();

    const storedBalance = balRow ? Number(balRow.balance) : 0;
    const diff = result.computedBalance - storedBalance;

    if (Math.abs(diff) >= 0.01) {
      // Correct the drift by adjusting the stored balance
      await adjustAccountBalance(account.id, diff, "correction", {
        userId: user.id,
        reason: `Auto-reconciliation corrected drift of ${diff.toFixed(2)}`,
      });
      corrections.push({
        accountId: account.id,
        stored: storedBalance,
        computed: result.computedBalance,
        diff,
      });
    }
  }

  return NextResponse.json({
    reconciled: accounts.length,
    corrections: corrections.length,
    details: corrections,
  });
}
