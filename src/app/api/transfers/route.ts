import { getAccessibleAccount } from "@/lib/accountAccess";
import { adjustAccountBalance } from "@/lib/balance";
import { getTransferDeltas } from "@/lib/balance-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

const createTransferSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  description: z.string().max(500).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  transfer_type: z.enum(["self", "household"]).optional(),
  recipient_user_id: z.string().uuid().optional(),
  fee_amount: z.coerce.number().min(0).optional(),
  returned_amount: z.coerce.number().min(0).optional(),
});

async function getHouseholdInfo(
  supabase: any,
  userId: string,
): Promise<{ partnerId: string | null; householdLinkId: string | null }> {
  const { data: link } = await supabase
    .from("household_links")
    .select("id, owner_user_id, partner_user_id, active")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link) return { partnerId: null, householdLinkId: null };
  return {
    partnerId:
      link.owner_user_id === userId ? link.partner_user_id : link.owner_user_id,
    householdLinkId: link.id,
  };
}

function formatTransfer(transfer: any, currentUserId: string) {
  return {
    id: transfer.id,
    user_id: transfer.user_id,
    from_account_id: transfer.from_account_id,
    to_account_id: transfer.to_account_id,
    from_account_name: transfer.from_account?.name || "Unknown",
    to_account_name: transfer.to_account?.name || "Unknown",
    from_account_type: transfer.from_account?.type || "expense",
    to_account_type: transfer.to_account?.type || "expense",
    from_account_user_id: transfer.from_account?.user_id || null,
    to_account_user_id: transfer.to_account?.user_id || null,
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

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const limit = parseInt(searchParams.get("limit") || "100");

    const { partnerId } = await getHouseholdInfo(supabase, user.id);
    const allowedUserIds = partnerId ? [user.id, partnerId] : [user.id];

    let ownerQuery = supabase
      .from("transfers")
      .select(TRANSFER_SELECT)
      .in("user_id", allowedUserIds)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limit);

    let recipientQuery = supabase
      .from("transfers")
      .select(TRANSFER_SELECT)
      .eq("recipient_user_id", user.id)
      .not("user_id", "in", `(${allowedUserIds.join(",")})`)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limit);

    if (start) {
      ownerQuery = ownerQuery.gte("date", start);
      recipientQuery = recipientQuery.gte("date", start);
    }
    if (end) {
      ownerQuery = ownerQuery.lte("date", end);
      recipientQuery = recipientQuery.lte("date", end);
    }

    const [
      { data: ownerTransfers, error },
      { data: recipientTransfers },
    ] = await Promise.all([ownerQuery, recipientQuery]);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch transfers" },
        { status: 500 },
      );
    }

    const uniqueMap = new Map<string, any>();
    [...(ownerTransfers || []), ...(recipientTransfers || [])].forEach((t) =>
      uniqueMap.set(t.id, t),
    );

    const canSeeAccount = (account: any) =>
      account?.user_id === user.id ||
      (partnerId &&
        account?.user_id === partnerId &&
        account?.is_public === true);

    const visibleTransfers = Array.from(uniqueMap.values())
      .filter(
        (t: any) =>
          t.user_id === user.id ||
          t.recipient_user_id === user.id ||
          canSeeAccount(t.from_account) ||
          canSeeAccount(t.to_account),
      )
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

    return NextResponse.json(
      visibleTransfers.map((transfer) => formatTransfer(transfer, user.id)),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch transfers" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createTransferSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      from_account_id,
      to_account_id,
      amount,
      description,
      date,
      transfer_type = "self",
      recipient_user_id,
      fee_amount = 0,
      returned_amount = 0,
    } = parsed.data;
    const effectiveFeeAmount = transfer_type === "household" ? fee_amount : 0;
    const effectiveReturnedAmount =
      transfer_type === "household" ? returned_amount : 0;

    if (from_account_id === to_account_id) {
      return NextResponse.json(
        { error: "Cannot transfer to the same account" },
        { status: 400 },
      );
    }

    if (
      effectiveReturnedAmount > amount ||
      effectiveFeeAmount + effectiveReturnedAmount > amount
    ) {
      return NextResponse.json(
        { error: "Returned amount and fee cannot exceed transfer amount" },
        { status: 400 },
      );
    }

    const fromAccount = await getAccessibleAccount(
      supabase,
      user.id,
      from_account_id,
    );
    const toAccount = await getAccessibleAccount(
      supabase,
      user.id,
      to_account_id,
    );

    if (!fromAccount?.canWrite || !toAccount?.canWrite) {
      return NextResponse.json(
        { error: "One or both accounts not found" },
        { status: 404 },
      );
    }

    const { partnerId, householdLinkId } = await getHouseholdInfo(
      supabase,
      user.id,
    );
    let actualRecipientId: string | null = null;
    let actualHouseholdLinkId: string | null = null;

    if (transfer_type === "household") {
      if (!partnerId || !householdLinkId) {
        return NextResponse.json(
          { error: "No active household link found" },
          { status: 400 },
        );
      }

      actualRecipientId = recipient_user_id || partnerId;
      if (actualRecipientId !== partnerId || toAccount.user_id !== partnerId) {
        return NextResponse.json(
          { error: "Destination must be your household partner" },
          { status: 400 },
        );
      }
      actualHouseholdLinkId = householdLinkId;
    }

    const transferDate = date || new Date().toISOString().split("T")[0];
    const { data: transfer, error: insertError } = await supabase
      .from("transfers")
      .insert({
        user_id: user.id,
        from_account_id,
        to_account_id,
        amount,
        description: description || "",
        date: transferDate,
        transfer_type,
        recipient_user_id: actualRecipientId,
        fee_amount: effectiveFeeAmount,
        returned_amount: effectiveReturnedAmount,
        household_link_id: actualHouseholdLinkId,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create transfer" },
        { status: 500 },
      );
    }

    const { fromDelta, toDelta } = getTransferDeltas(
      amount,
      effectiveReturnedAmount,
      transfer_type,
    );
    const labelPrefix = transfer_type === "household" ? "Household" : "Self";

    await adjustAccountBalance(from_account_id, fromDelta, "transfer_out", {
      userId: user.id,
      reason: `${labelPrefix} transfer to ${toAccount.name || "account"}`,
    });
    await adjustAccountBalance(to_account_id, toDelta, "transfer_in", {
      userId: user.id,
      reason: `${labelPrefix} transfer from ${fromAccount.name || "account"}`,
    });

    return NextResponse.json({
      ...transfer,
      from_account_name: fromAccount.name || "Unknown",
      to_account_name: toAccount.name || "Unknown",
      from_account_type: fromAccount.type || "expense",
      to_account_type: toAccount.type || "expense",
      from_account_user_id: fromAccount.user_id,
      to_account_user_id: toAccount.user_id,
      is_owner: true,
      is_recipient: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create transfer" },
      { status: 500 },
    );
  }
}
