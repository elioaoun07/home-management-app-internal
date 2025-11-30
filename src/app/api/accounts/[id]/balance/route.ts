import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to get partner user ID if linked
async function getPartnerUserId(
  supabase: any,
  userId: string
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

  // Get the balance record for this account (owned by account owner)
  const { data: balanceData, error } = await supabase
    .from("account_balances")
    .select("balance, balance_set_at, created_at, updated_at")
    .eq("account_id", accountId)
    .eq("user_id", accountOwnerId)
    .single();

  if (error) {
    // If no balance exists yet, return 0
    if (error.code === "PGRST116") {
      return NextResponse.json({
        account_id: accountId,
        balance: 0,
        pending_drafts: 0,
        draft_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    console.error("Error fetching balance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // SIMPLE LOGIC:
  // 1. User sets their balance (e.g., $40 on Nov 21)
  // 2. We only subtract transactions that were INSERTED after balance_set_at
  // 3. This ensures we don't double-count old transactions

  const balanceSetAt = balanceData.balance_set_at;

  // Get confirmed transactions inserted AFTER balance was set
  // Use accountOwnerId since transactions belong to the account owner
  const { data: newTransactions, error: transError } = await supabase
    .from("transactions")
    .select("amount")
    .eq("account_id", accountId)
    .eq("user_id", accountOwnerId)
    .eq("is_draft", false)
    .gt("inserted_at", balanceSetAt);

  if (transError) {
    console.error("Error fetching transactions for balance:", transError);
  }

  // Get pending draft transactions (always count all drafts)
  const { data: draftTransactions, error: draftError } = await supabase
    .from("transactions")
    .select("amount")
    .eq("account_id", accountId)
    .eq("user_id", accountOwnerId)
    .eq("is_draft", true);

  if (draftError) {
    console.error("Error fetching draft transactions:", draftError);
  }

  const totalNewTransactions =
    newTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalDrafts =
    draftTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Calculate current balance
  // For expense accounts: balance - expenses
  // For income accounts: balance + income (not typical, but supported)
  const accountType = account.type || "expense";
  const currentBalance =
    accountType === "expense"
      ? Number(balanceData.balance) - totalNewTransactions - totalDrafts
      : Number(balanceData.balance) + totalNewTransactions + totalDrafts;

  return NextResponse.json({
    account_id: accountId,
    balance: currentBalance,
    pending_drafts: totalDrafts,
    draft_count: draftTransactions?.length || 0,
    balance_set_at: balanceSetAt,
    created_at: balanceData.created_at,
    updated_at: balanceData.updated_at,
    // DEBUG - check what's in the database
    _debug: {
      user_id: user.id,
      stored_balance: balanceData.balance,
      balance_set_at: balanceSetAt,
      new_transactions_count: newTransactions?.length || 0,
      new_transactions_total: totalNewTransactions,
      drafts_count: draftTransactions?.length || 0,
      drafts_total: totalDrafts,
      account_type: accountType,
    },
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
