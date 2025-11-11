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
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }

  // Get balance
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
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

  return NextResponse.json(data);
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
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }

  // Upsert balance (insert or update)
  const { data, error } = await supabase
    .from("account_balances")
    .upsert(
      {
        account_id: accountId,
        user_id: user.id,
        balance,
        updated_at: new Date().toISOString(),
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

// PATCH /api/accounts/[id]/balance - Adjust balance by an amount (for transactions)
export async function PATCH(
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
  const { amount } = body;

  if (typeof amount !== "number") {
    return NextResponse.json(
      { error: "Amount must be a number" },
      { status: 400 }
    );
  }

  // Verify account belongs to user
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, type")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 }
    );
  }

  // Get current balance
  const { data: currentBalance } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("account_id", accountId)
    .single();

  const current = currentBalance?.balance || 0;
  
  // For expense accounts, subtract the amount
  // For income accounts, add the amount
  const newBalance = account.type === "expense" 
    ? Number(current) - Number(amount)
    : Number(current) + Number(amount);

  // Update balance
  const { data, error } = await supabase
    .from("account_balances")
    .upsert(
      {
        account_id: accountId,
        user_id: user.id,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "account_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error updating balance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
