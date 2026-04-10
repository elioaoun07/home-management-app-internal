import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/debts - List debts with lazy auto-archival
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status"); // open, archived, closed, or null for all

  // Lazy auto-archive: batch-update any open debts older than 1 month
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  await supabase
    .from("debts")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("status", "open")
    .lt("created_at", oneMonthAgo.toISOString());

  // Now fetch debts with transaction details
  let query = supabase
    .from("debts")
    .select(
      `
      id, user_id, transaction_id, debtor_name, original_amount, returned_amount,
      status, notes, archived_at, closed_at, created_at, updated_at,
      transaction:transactions!debts_transaction_id_fkey(
        date, description, account_id, category_id, is_private,
        account:accounts!transactions_account_id_fkey(name),
        category:user_categories!transactions_category_fk(name)
      )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: debts, error } = await query;

  if (error) {
    console.error("Error fetching debts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten nested join data
  const formatted = (debts || []).map((d: any) => ({
    ...d,
    transaction: d.transaction
      ? {
          date: d.transaction.date,
          description: d.transaction.description,
          account_id: d.transaction.account_id,
          category_id: d.transaction.category_id,
          is_private: d.transaction.is_private,
          account_name: d.transaction.account?.name || "Unknown",
          category_name: d.transaction.category?.name || null,
        }
      : null,
  }));

  return NextResponse.json({ debts: formatted });
}

// POST /api/debts - Create a new debt (creates transaction + debt record)
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    account_id,
    category_id,
    subcategory_id,
    amount,
    debt_amount,
    description,
    date,
    is_private,
    debtor_name,
    notes,
  } = body;

  if (!account_id || !amount || !debtor_name) {
    return NextResponse.json(
      { error: "account_id, amount, and debtor_name are required" },
      { status: 400 },
    );
  }

  // debt_amount = how much the friend owes (defaults to full amount)
  const effectiveDebtAmount =
    debt_amount && debt_amount > 0 ? debt_amount : amount;

  if (amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be positive" },
      { status: 400 },
    );
  }

  if (effectiveDebtAmount > amount) {
    return NextResponse.json(
      { error: "Debt amount cannot exceed the transaction amount" },
      { status: 400 },
    );
  }

  const txDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split("T")[0];

  // 1. Create the expense transaction (deducts from balance)
  const txResponse = await fetch(
    new URL("/api/transactions", req.url).toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: (await cookies()).toString(),
      },
      body: JSON.stringify({
        account_id,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        amount,
        description: description || `Debt: paid for ${debtor_name}`,
        date: txDate,
        is_private: is_private || false,
      }),
    },
  );

  if (!txResponse.ok) {
    const errData = await txResponse.json().catch(() => ({}));
    return NextResponse.json(
      { error: errData.error || "Failed to create transaction" },
      { status: 500 },
    );
  }

  const transaction = await txResponse.json();

  // 2. Create the debt record linked to that transaction
  //    debt_amount may be less than transaction amount (e.g. $50 bill, friend owes $25)
  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      transaction_id: transaction.id,
      debtor_name,
      original_amount: effectiveDebtAmount,
      returned_amount: 0,
      status: "open",
      notes: notes || null,
    })
    .select()
    .single();

  if (debtError) {
    console.error("Error creating debt record:", debtError);
    if ((debtError as any).code === "23505") {
      return NextResponse.json({ error: "Debt record already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: debtError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      debt: {
        ...debt,
        transaction: {
          date: txDate,
          description: description || `Debt: paid for ${debtor_name}`,
          account_id,
          category_id: category_id || null,
          is_private: is_private || false,
          account_name: transaction.account_name || "Unknown",
          category_name: transaction.category || null,
        },
      },
    },
    { status: 201 },
  );
}
