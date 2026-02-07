import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/debts/[id] - Get a single debt
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

  const { id } = await params;

  const { data: debt, error } = await supabase
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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  const formatted = {
    ...debt,
    transaction: (debt as any).transaction
      ? {
          date: (debt as any).transaction.date,
          description: (debt as any).transaction.description,
          account_id: (debt as any).transaction.account_id,
          category_id: (debt as any).transaction.category_id,
          is_private: (debt as any).transaction.is_private,
          account_name: (debt as any).transaction.account?.name || "Unknown",
          category_name: (debt as any).transaction.category?.name || null,
        }
      : null,
  };

  return NextResponse.json({ debt: formatted });
}

// PATCH /api/debts/[id] - Settle a debt (partial or full)
export async function PATCH(
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

  const { id } = await params;
  const body = await req.json();

  // Handle unarchive action
  if (body.action === "unarchive") {
    const { data: debt, error } = await supabase
      .from("debts")
      .update({
        status: "open",
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "archived")
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to unarchive debt" },
        { status: 500 },
      );
    }

    return NextResponse.json({ debt });
  }

  // Settlement flow
  const { amount_returned } = body;

  if (!amount_returned || amount_returned <= 0) {
    return NextResponse.json(
      { error: "amount_returned must be a positive number" },
      { status: 400 },
    );
  }

  // Get the current debt
  const { data: debt, error: fetchError } = await supabase
    .from("debts")
    .select(
      `
      id, user_id, transaction_id, debtor_name, original_amount, returned_amount,
      status, notes,
      transaction:transactions!debts_transaction_id_fkey(account_id, category_id, subcategory_id, date, is_private)
    `,
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !debt) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  if (debt.status === "closed") {
    return NextResponse.json(
      { error: "Debt is already closed" },
      { status: 400 },
    );
  }

  const newReturnedAmount = Number(debt.returned_amount) + amount_returned;
  const remaining = Number(debt.original_amount) - newReturnedAmount;
  const isFullyClosed = remaining <= 0.01; // floating point tolerance

  const txData = debt.transaction as any;
  const accountId = txData?.account_id;
  const txDate = new Date().toISOString().split("T")[0];

  // 1. Create an income transaction for the returned amount (is_debt_return = true)
  if (accountId) {
    const { data: returnTx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        date: txDate,
        amount: amount_returned,
        description: `Debt return from ${debt.debtor_name}${isFullyClosed ? " (settled)" : ""}`,
        account_id: accountId,
        category_id: txData?.category_id || null,
        subcategory_id: txData?.subcategory_id || null,
        is_draft: false,
        is_private: txData?.is_private || false,
        is_debt_return: true,
      })
      .select()
      .single();

    if (txError) {
      console.error("Error creating debt return transaction:", txError);
      return NextResponse.json(
        { error: "Failed to create return transaction" },
        { status: 500 },
      );
    }

    // 2. Add the returned amount back to the account balance
    const { data: currentBalance } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", accountId)
      .single();

    if (currentBalance) {
      const previousBalance = Number(currentBalance.balance);
      const newBalance = previousBalance + amount_returned;

      await supabase
        .from("account_balances")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", accountId);

      // 3. Log balance history as debt_settled
      await supabase.from("account_balance_history").insert({
        account_id: accountId,
        user_id: user.id,
        previous_balance: previousBalance,
        new_balance: newBalance,
        change_amount: amount_returned,
        change_type: "debt_settled",
        transaction_id: returnTx?.id || null,
        reason: `Debt settled by ${debt.debtor_name}: $${amount_returned}${isFullyClosed ? " (fully closed)" : ""}`,
        effective_date: txDate,
      });
    }
  }

  // 4. Update the debt record
  const updateData: Record<string, any> = {
    returned_amount: Math.min(newReturnedAmount, Number(debt.original_amount)),
    updated_at: new Date().toISOString(),
  };

  if (isFullyClosed) {
    updateData.status = "closed";
    updateData.closed_at = new Date().toISOString();
  } else if (debt.status === "archived") {
    // If settling from archive, move back to open
    updateData.status = "open";
    updateData.archived_at = null;
  }

  const { data: updatedDebt, error: updateError } = await supabase
    .from("debts")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating debt:", updateError);
    return NextResponse.json(
      { error: "Failed to update debt" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    debt: updatedDebt,
    settlement: {
      amount_settled: amount_returned,
      total_returned: Math.min(newReturnedAmount, Number(debt.original_amount)),
      remaining: Math.max(0, remaining),
      is_fully_closed: isFullyClosed,
    },
  });
}

// DELETE /api/debts/[id] - Delete a debt (and optionally its transaction)
export async function DELETE(
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

  const { id } = await params;

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting debt:", error);
    return NextResponse.json(
      { error: "Failed to delete debt" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
