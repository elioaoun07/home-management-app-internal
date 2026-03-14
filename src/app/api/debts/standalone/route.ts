import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/debts/standalone - Create a standalone debt (no transaction)
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { debtor_name, amount, notes, date } = body;

  if (!debtor_name || typeof debtor_name !== "string" || !debtor_name.trim()) {
    return NextResponse.json(
      { error: "debtor_name is required" },
      { status: 400 },
    );
  }

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 },
    );
  }

  const debtDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split("T")[0];

  // Create debt record without a transaction
  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      transaction_id: null,
      debtor_name: debtor_name.trim(),
      original_amount: amount,
      returned_amount: 0,
      status: "open",
      notes: notes || null,
    })
    .select()
    .single();

  if (debtError) {
    console.error("Error creating standalone debt:", debtError);
    return NextResponse.json({ error: debtError.message }, { status: 500 });
  }

  return NextResponse.json({ debt }, { status: 201 });
}
