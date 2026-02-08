import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TRANSFER_SELECT = `
  id,
  user_id,
  from_account_id,
  to_account_id,
  amount,
  description,
  date,
  transfer_type,
  recipient_user_id,
  fee_amount,
  returned_amount,
  household_link_id,
  created_at,
  updated_at,
  from_account:accounts!transfers_from_account_id_fkey(id, name, type, user_id),
  to_account:accounts!transfers_to_account_id_fkey(id, name, type, user_id)
`;

function formatTransfer(transfer: any, currentUserId: string) {
  return {
    id: transfer.id,
    user_id: transfer.user_id,
    from_account_id: transfer.from_account_id,
    to_account_id: transfer.to_account_id,
    from_account_name: (transfer.from_account as any)?.name || "Unknown",
    to_account_name: (transfer.to_account as any)?.name || "Unknown",
    from_account_type: (transfer.from_account as any)?.type || "expense",
    to_account_type: (transfer.to_account as any)?.type || "expense",
    from_account_user_id: (transfer.from_account as any)?.user_id || null,
    to_account_user_id: (transfer.to_account as any)?.user_id || null,
    amount: transfer.amount,
    description: transfer.description,
    date: transfer.date,
    transfer_type: transfer.transfer_type || "self",
    recipient_user_id: transfer.recipient_user_id,
    fee_amount: transfer.fee_amount || 0,
    returned_amount: transfer.returned_amount || 0,
    household_link_id: transfer.household_link_id,
    created_at: transfer.created_at,
    updated_at: transfer.updated_at,
    is_owner: transfer.user_id === currentUserId,
    is_recipient: transfer.recipient_user_id === currentUserId,
  };
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

  // Allow fetching if user is the owner OR the recipient
  const { data: transfer, error } = await supabase
    .from("transfers")
    .select(TRANSFER_SELECT)
    .eq("id", id)
    .or(`user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
    .single();

  if (error) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  return NextResponse.json(formatTransfer(transfer, user.id));
}

// DELETE /api/transfers/[id] - Delete a transfer
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

  // Only the creator (sender) can delete
  const { data: transfer, error: fetchError } = await supabase
    .from("transfers")
    .select("id")
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

  // Balance is formula-based — no manual balance reversal needed.
  // Deleting the transfer automatically removes it from the formula calculation.
  // The balance will be recomputed on next GET /api/accounts/[id]/balance.

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
  const { amount, description, date, fee_amount, returned_amount } = body;

  // Only the creator can update
  const { data: currentTransfer, error: fetchError } = await supabase
    .from("transfers")
    .select("id, amount, fee_amount, returned_amount")
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

  if (fee_amount !== undefined) {
    if (fee_amount < 0) {
      return NextResponse.json(
        { error: "Fee amount cannot be negative" },
        { status: 400 },
      );
    }
    updateFields.fee_amount = Number(fee_amount);
  }

  if (returned_amount !== undefined) {
    if (returned_amount < 0) {
      return NextResponse.json(
        { error: "Returned amount cannot be negative" },
        { status: 400 },
      );
    }
    updateFields.returned_amount = Number(returned_amount);
  }

  // Validate final amounts
  const newAmount =
    amount !== undefined ? Number(amount) : Number(currentTransfer.amount);
  const newFee =
    fee_amount !== undefined
      ? Number(fee_amount)
      : Number(currentTransfer.fee_amount || 0);
  const newReturned =
    returned_amount !== undefined
      ? Number(returned_amount)
      : Number(currentTransfer.returned_amount || 0);

  if (newAmount <= 0) {
    return NextResponse.json(
      { error: "Amount must be positive" },
      { status: 400 },
    );
  }

  if (newFee + newReturned > newAmount) {
    return NextResponse.json(
      { error: "Fee + returned amount cannot exceed transfer amount" },
      { status: 400 },
    );
  }

  if (amount !== undefined) {
    updateFields.amount = newAmount;
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updateFields.updated_at = new Date().toISOString();

  // Balance is formula-based — no manual balance adjustments needed.
  // The balance will be recomputed on next GET /api/accounts/[id]/balance.

  const { data: updated, error: updateError } = await supabase
    .from("transfers")
    .update(updateFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(TRANSFER_SELECT)
    .single();

  if (updateError) {
    console.error("Error updating transfer:", updateError);
    return NextResponse.json(
      { error: "Failed to update transfer" },
      { status: 500 },
    );
  }

  return NextResponse.json(formatTransfer(updated, user.id));
}
