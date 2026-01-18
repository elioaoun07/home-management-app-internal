import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to update account balance and log history
async function updateAccountBalanceWithHistory(
  supabase: any,
  accountId: string,
  userId: string,
  delta: number,
  changeType: string,
  transferId: string | null,
  effectiveDate: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: balanceData, error: fetchError } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .single();

    let previousBalance = 0;
    let newBalance = delta;

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        const { error: insertError } = await supabase
          .from("account_balances")
          .insert({
            account_id: accountId,
            user_id: userId,
            balance: delta,
            balance_set_at: new Date().toISOString(),
          });

        if (insertError) {
          return { success: false, error: insertError.message };
        }
        previousBalance = 0;
        newBalance = delta;
      } else {
        return { success: false, error: fetchError.message };
      }
    } else {
      previousBalance = Number(balanceData.balance);
      newBalance = previousBalance + delta;
      const { error: updateError } = await supabase
        .from("account_balances")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", accountId)
        .eq("user_id", userId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    // Log to balance history
    const { error: historyError } = await supabase
      .from("account_balance_history")
      .insert({
        account_id: accountId,
        user_id: userId,
        previous_balance: previousBalance,
        new_balance: newBalance,
        change_amount: delta,
        change_type: changeType,
        transfer_id: transferId,
        effective_date: effectiveDate,
        is_reconciliation: false,
      });

    if (historyError) {
      console.error("Error logging balance history:", historyError);
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// GET /api/transfers/[id] - Get a specific transfer
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

  const { data: transfer, error } = await supabase
    .from("transfers")
    .select(
      `
      id,
      user_id,
      from_account_id,
      to_account_id,
      amount,
      description,
      date,
      created_at,
      updated_at,
      from_account:accounts!transfers_from_account_id_fkey(id, name, type),
      to_account:accounts!transfers_to_account_id_fkey(id, name, type)
    `,
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: transfer.id,
    user_id: transfer.user_id,
    from_account_id: transfer.from_account_id,
    to_account_id: transfer.to_account_id,
    from_account_name: (transfer.from_account as any)?.name || "Unknown",
    to_account_name: (transfer.to_account as any)?.name || "Unknown",
    from_account_type: (transfer.from_account as any)?.type || "expense",
    to_account_type: (transfer.to_account as any)?.type || "expense",
    amount: transfer.amount,
    description: transfer.description,
    date: transfer.date,
    created_at: transfer.created_at,
    updated_at: transfer.updated_at,
    is_owner: true,
  });
}

// DELETE /api/transfers/[id] - Delete a transfer and reverse balance changes
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

  // First fetch the transfer to get the details for reversal
  const { data: transfer, error: fetchError } = await supabase
    .from("transfers")
    .select("id, from_account_id, to_account_id, amount")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !transfer) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  // Delete the transfer
  const { error: deleteError } = await supabase
    .from("transfers")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Error deleting transfer:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete transfer" },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // Reverse the balance changes with history (correction type)
  // Add back to source account
  await updateAccountBalanceWithHistory(
    supabase,
    transfer.from_account_id,
    user.id,
    Number(transfer.amount),
    "correction",
    null, // Transfer is deleted, so no reference
    today,
  );

  // Subtract from destination account
  await updateAccountBalanceWithHistory(
    supabase,
    transfer.to_account_id,
    user.id,
    -Number(transfer.amount),
    "correction",
    null,
    today,
  );

  return NextResponse.json({ success: true });
}

// PATCH /api/transfers/[id] - Update a transfer
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
  const { amount, description, date } = body;

  // Fetch current transfer
  const { data: currentTransfer, error: fetchError } = await supabase
    .from("transfers")
    .select("id, from_account_id, to_account_id, amount")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !currentTransfer) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  const updateFields: Record<string, any> = {};

  if (description !== undefined) {
    updateFields.description = description;
  }

  if (date !== undefined) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 },
      );
    }
    updateFields.date = date;
  }

  // Handle amount change - need to adjust balances
  if (amount !== undefined && amount !== currentTransfer.amount) {
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 },
      );
    }

    const amountDiff = Number(amount) - Number(currentTransfer.amount);
    updateFields.amount = Number(amount);
    const effectiveDate = date || new Date().toISOString().split("T")[0];

    // Adjust source account (subtract the difference) with history
    await updateAccountBalanceWithHistory(
      supabase,
      currentTransfer.from_account_id,
      user.id,
      -amountDiff,
      "manual_adjustment",
      id,
      effectiveDate,
    );

    // Adjust destination account (add the difference) with history
    await updateAccountBalanceWithHistory(
      supabase,
      currentTransfer.to_account_id,
      user.id,
      amountDiff,
      "manual_adjustment",
      id,
      effectiveDate,
    );
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updateFields.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("transfers")
    .update(updateFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(
      `
      id,
      user_id,
      from_account_id,
      to_account_id,
      amount,
      description,
      date,
      created_at,
      updated_at,
      from_account:accounts!transfers_from_account_id_fkey(id, name, type),
      to_account:accounts!transfers_to_account_id_fkey(id, name, type)
    `,
    )
    .single();

  if (updateError) {
    console.error("Error updating transfer:", updateError);
    return NextResponse.json(
      { error: "Failed to update transfer" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: updated.id,
    user_id: updated.user_id,
    from_account_id: updated.from_account_id,
    to_account_id: updated.to_account_id,
    from_account_name: (updated.from_account as any)?.name || "Unknown",
    to_account_name: (updated.to_account as any)?.name || "Unknown",
    from_account_type: (updated.from_account as any)?.type || "expense",
    to_account_type: (updated.to_account as any)?.type || "expense",
    amount: updated.amount,
    description: updated.description,
    date: updated.date,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
    is_owner: true,
  });
}
