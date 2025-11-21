import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/accounts/[id]/balance - Get balance for a specific account
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: accountId } = await params;

  // Verify account belongs to user
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Get initial balance and balance_set_at timestamp
  const { data: balanceData, error } = await supabase
    .from("account_balances")
    .select("balance, balance_set_at, created_at, updated_at")
    .eq("account_id", accountId)
    .single();

  if (error) {
    // If no balance exists yet, return 0
    if (error.code === "PGRST116") {
      return NextResponse.json({
        account_id: accountId,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    console.error("Error fetching balance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get account type to determine if we add or subtract transactions
  const { data: accountData } = await supabase
    .from("accounts")
    .select("type")
    .eq("id", accountId)
    .single();

  const accountType = accountData?.type || "expense";

  // Calculate current balance from initial balance and transactions since balance_set_at
  // For expense accounts: balance - SUM(transactions)
  // For income accounts: balance + SUM(transactions)
  const { data: transactionsSum } = await supabase
    .from("transactions")
    .select("amount")
    .eq("account_id", accountId)
    .eq("is_draft", false)
    .gte("inserted_at", balanceData.balance_set_at);

  const totalTransactions =
    transactionsSum?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Get pending draft transactions for this account
  const { data: draftTransactions } = await supabase
    .from("transactions")
    .select("amount")
    .eq("account_id", accountId)
    .eq("is_draft", true);

  const totalDrafts =
    draftTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const currentBalance =
    accountType === "expense"
      ? Number(balanceData.balance) - totalTransactions - totalDrafts
      : Number(balanceData.balance) + totalTransactions + totalDrafts;

  return NextResponse.json({
    account_id: accountId,
    balance: currentBalance,
    pending_drafts: totalDrafts,
    draft_count: draftTransactions?.length || 0,
    balance_set_at: balanceData.balance_set_at,
    created_at: balanceData.created_at,
    updated_at: balanceData.updated_at,
  });
}

// POST /api/accounts/[id]/balance - Set/Update balance for an account
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  const { balance } = body;

  if (typeof balance !== "number") {
    return NextResponse.json(
      { error: "Balance must be a number" },
      { status: 400 }
    );
  }

  // Verify account belongs to user
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Upsert balance (insert or update)
  // Set balance_set_at to now so we calculate from this point forward
  const now = new Date().toISOString();
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
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting balance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
