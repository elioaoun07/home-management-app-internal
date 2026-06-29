import { getAccessibleAccount } from "@/lib/accountAccess";
import { adjustAccountBalance } from "@/lib/balance";
import { getTransferDeltas } from "@/lib/balance-utils";
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
  from_account:accounts!transfers_from_account_id_fkey(id, name, type, user_id, is_public),
  to_account:accounts!transfers_to_account_id_fkey(id, name, type, user_id, is_public)
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

  const { data: transfer, error } = await supabase
    .from("transfers")
    .select(TRANSFER_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  const fromAccess = await getAccessibleAccount(
    supabase,
    user.id,
    transfer.from_account_id,
  );
  const toAccess = await getAccessibleAccount(
    supabase,
    user.id,
    transfer.to_account_id,
  );
  const canRead =
    transfer.user_id === user.id ||
    transfer.recipient_user_id === user.id ||
    !!fromAccess ||
    !!toAccess;

  if (!canRead) {
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
    .select(
      "id, from_account_id, to_account_id, amount, returned_amount, transfer_type",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !transfer) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  // Soft-delete the transfer (kept in Recycle Bin for 30 days)
  const { error: deleteError } = await supabase
    .from("transfers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete transfer" },
      { status: 500 },
    );
  }

  // Reverse the balance effects of the deleted transfer
  const { fromDelta, toDelta } = getTransferDeltas(
    Number(transfer.amount),
    Number(transfer.returned_amount || 0),
    (transfer.transfer_type || "self") as "self" | "household",
  );
  // Reverse: negate the original deltas
  await adjustAccountBalance(
    transfer.from_account_id,
    -fromDelta,
    "transfer_deleted",
    {
      userId: user.id,
      transferId: transfer.id,
      reason: "Deleted transfer reversal",
    },
  );
  await adjustAccountBalance(
    transfer.to_account_id,
    -toDelta,
    "transfer_deleted",
    {
      userId: user.id,
      transferId: transfer.id,
      reason: "Deleted transfer reversal",
    },
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
  const { amount, description, date, fee_amount, returned_amount } = body;

  // Only the creator can update
  const { data: currentTransfer, error: fetchError } = await supabase
    .from("transfers")
    .select(
      "id, amount, fee_amount, returned_amount, from_account_id, to_account_id, transfer_type",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
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

  // Adjust balances for the amount/returned_amount change
  const oldAmount = Number(currentTransfer.amount);
  const oldReturned = Number(currentTransfer.returned_amount || 0);
  const transferType = (currentTransfer.transfer_type || "self") as
    | "self"
    | "household";

  const oldDeltas = getTransferDeltas(oldAmount, oldReturned, transferType);
  const newDeltas = getTransferDeltas(newAmount, newReturned, transferType);

  const fromDiff = newDeltas.fromDelta - oldDeltas.fromDelta;
  const toDiff = newDeltas.toDelta - oldDeltas.toDelta;

  if (fromDiff !== 0) {
    await adjustAccountBalance(
      currentTransfer.from_account_id,
      fromDiff,
      "transfer_updated",
      {
        userId: user.id,
        transferId: currentTransfer.id,
        reason: "Transfer updated",
      },
    );
  }
  if (toDiff !== 0) {
    await adjustAccountBalance(
      currentTransfer.to_account_id,
      toDiff,
      "transfer_updated",
      {
        userId: user.id,
        transferId: currentTransfer.id,
        reason: "Transfer updated",
      },
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("transfers")
    .update(updateFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select(TRANSFER_SELECT)
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update transfer" },
      { status: 500 },
    );
  }

  return NextResponse.json(formatTransfer(updated, user.id));
}
