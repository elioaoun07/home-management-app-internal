import { adjustAccountBalance } from "@/lib/balance";
import { getTransferDeltas } from "@/lib/balance-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to get partner user ID and household link if linked
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
  const partnerId =
    link.owner_user_id === userId ? link.partner_user_id : link.owner_user_id;
  return { partnerId, householdLinkId: link.id };
}

// Legacy helper for backward compatibility
async function getPartnerUserId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { partnerId } = await getHouseholdInfo(supabase, userId);
  return partnerId;
}

// GET /api/transfers - Get all transfers for the user
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

    // Get partner ID if linked
    const partnerId = await getPartnerUserId(supabase, user.id);
    const allowedUserIds = partnerId ? [user.id, partnerId] : [user.id];

    // Build query
    let query = supabase
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
        transfer_type,
        recipient_user_id,
        fee_amount,
        returned_amount,
        household_link_id,
        created_at,
        updated_at,
        from_account:accounts!transfers_from_account_id_fkey(id, name, type, user_id),
        to_account:accounts!transfers_to_account_id_fkey(id, name, type, user_id)
      `,
      )
      .in("user_id", allowedUserIds)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limit);

    // Also include transfers where the current user or partner is the recipient
    // We need a second query for household transfers where the user is the recipient
    let recipientQuery = supabase
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
        transfer_type,
        recipient_user_id,
        fee_amount,
        returned_amount,
        household_link_id,
        created_at,
        updated_at,
        from_account:accounts!transfers_from_account_id_fkey(id, name, type, user_id),
        to_account:accounts!transfers_to_account_id_fkey(id, name, type, user_id)
      `,
      )
      .eq("recipient_user_id", user.id)
      .not("user_id", "in", `(${allowedUserIds.join(",")})`)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(limit);

    if (start) {
      query = query.gte("date", start);
      recipientQuery = recipientQuery.gte("date", start);
    }
    if (end) {
      query = query.lte("date", end);
      recipientQuery = recipientQuery.lte("date", end);
    }

    const [{ data: transfers, error }, { data: recipientTransfers }] =
      await Promise.all([query, recipientQuery]);

    if (error) {
      console.error("Error fetching transfers:", error);
      return NextResponse.json(
        { error: "Failed to fetch transfers" },
        { status: 500 },
      );
    }

    // Merge and deduplicate
    const allTransfers = [...(transfers || []), ...(recipientTransfers || [])];
    const uniqueMap = new Map<string, any>();
    allTransfers.forEach((t) => uniqueMap.set(t.id, t));
    const uniqueTransfers = Array.from(uniqueMap.values());
    uniqueTransfers.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Format response
    const formattedTransfers = uniqueTransfers.map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      from_account_id: t.from_account_id,
      to_account_id: t.to_account_id,
      from_account_name: t.from_account?.name || "Unknown",
      to_account_name: t.to_account?.name || "Unknown",
      from_account_type: t.from_account?.type || "expense",
      to_account_type: t.to_account?.type || "expense",
      from_account_user_id: t.from_account?.user_id || null,
      to_account_user_id: t.to_account?.user_id || null,
      amount: t.amount,
      description: t.description,
      date: t.date,
      transfer_type: t.transfer_type || "self",
      recipient_user_id: t.recipient_user_id,
      fee_amount: t.fee_amount || 0,
      returned_amount: t.returned_amount || 0,
      household_link_id: t.household_link_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_owner: t.user_id === user.id,
      is_recipient: t.recipient_user_id === user.id,
    }));

    return NextResponse.json(formattedTransfers);
  } catch (e: any) {
    console.error("Error in GET /api/transfers:", e);
    return NextResponse.json(
      { error: "Failed to fetch transfers" },
      { status: 500 },
    );
  }
}

// POST /api/transfers - Create a new transfer
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
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
    } = body;

    // Validation
    if (!from_account_id || !to_account_id) {
      return NextResponse.json(
        { error: "from_account_id and to_account_id are required" },
        { status: 400 },
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 },
      );
    }

    if (from_account_id === to_account_id) {
      return NextResponse.json(
        { error: "Cannot transfer to the same account" },
        { status: 400 },
      );
    }

    if (fee_amount < 0) {
      return NextResponse.json(
        { error: "Fee amount cannot be negative" },
        { status: 400 },
      );
    }

    if (returned_amount < 0) {
      return NextResponse.json(
        { error: "Returned amount cannot be negative" },
        { status: 400 },
      );
    }

    if (returned_amount > amount) {
      return NextResponse.json(
        { error: "Returned amount cannot exceed transfer amount" },
        { status: 400 },
      );
    }

    if (fee_amount + returned_amount > amount) {
      return NextResponse.json(
        { error: "Fee + returned amount cannot exceed transfer amount" },
        { status: 400 },
      );
    }

    // Determine date
    let transferDate: string;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      transferDate = date;
    } else {
      transferDate = new Date().toISOString().split("T")[0];
    }

    if (transfer_type === "household") {
      // === HOUSEHOLD TRANSFER ===
      // Verify household link exists
      const { partnerId, householdLinkId } = await getHouseholdInfo(
        supabase,
        user.id,
      );

      if (!partnerId || !householdLinkId) {
        return NextResponse.json(
          { error: "No active household link found" },
          { status: 400 },
        );
      }

      // The recipient must be the partner
      const actualRecipientId = recipient_user_id || partnerId;
      if (actualRecipientId !== partnerId) {
        return NextResponse.json(
          { error: "Recipient must be your household partner" },
          { status: 400 },
        );
      }

      // Verify from_account belongs to the current user (sender)
      const { data: fromAccount, error: fromErr } = await supabase
        .from("accounts")
        .select("id, name, type, user_id")
        .eq("id", from_account_id)
        .eq("user_id", user.id)
        .single();

      if (fromErr || !fromAccount) {
        return NextResponse.json(
          { error: "Source account not found or doesn't belong to you" },
          { status: 404 },
        );
      }

      // Verify to_account belongs to the partner (recipient)
      const { data: toAccount, error: toErr } = await supabase
        .from("accounts")
        .select("id, name, type, user_id")
        .eq("id", to_account_id)
        .eq("user_id", partnerId)
        .single();

      if (toErr || !toAccount) {
        return NextResponse.json(
          {
            error:
              "Destination account not found or doesn't belong to your partner",
          },
          { status: 404 },
        );
      }

      // Create the transfer record
      const { data: transfer, error: insertError } = await supabase
        .from("transfers")
        .insert({
          user_id: user.id,
          from_account_id,
          to_account_id,
          amount: Number(amount),
          description: description || "",
          date: transferDate,
          transfer_type: "household",
          recipient_user_id: partnerId,
          fee_amount: Number(fee_amount),
          returned_amount: Number(returned_amount),
          household_link_id: householdLinkId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating household transfer:", insertError);
        return NextResponse.json(
          { error: "Failed to create transfer" },
          { status: 500 },
        );
      }

      // Balance is formula-based — no manual balance updates needed.
      // The balance will be recomputed on next GET /api/accounts/[id]/balance
      // via computeAccountBalance() which includes transfer impact.

      // Adjust balances for both accounts
      const { fromDelta, toDelta } = getTransferDeltas(
        Number(amount),
        Number(returned_amount),
        "household",
      );
      await adjustAccountBalance(from_account_id, fromDelta, "transfer_out", {
        userId: user.id,
        reason: `Household transfer to ${toAccount?.name || "partner"}`,
      });
      await adjustAccountBalance(to_account_id, toDelta, "transfer_in", {
        userId: user.id,
        reason: `Household transfer from ${fromAccount?.name || "user"}`,
      });

      return NextResponse.json({
        ...transfer,
        from_account_name: fromAccount?.name || "Unknown",
        to_account_name: toAccount?.name || "Unknown",
        from_account_type: fromAccount?.type || "expense",
        to_account_type: toAccount?.type || "expense",
        from_account_user_id: user.id,
        to_account_user_id: partnerId,
        is_owner: true,
        is_recipient: false,
      });
    } else {
      // === SELF TRANSFER ===
      // Verify both accounts belong to user
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id, name, type")
        .eq("user_id", user.id)
        .in("id", [from_account_id, to_account_id]);

      if (accountsError || !accounts || accounts.length !== 2) {
        return NextResponse.json(
          { error: "One or both accounts not found" },
          { status: 404 },
        );
      }

      const fromAccount = accounts.find((a: any) => a.id === from_account_id);
      const toAccount = accounts.find((a: any) => a.id === to_account_id);

      // Create the transfer record
      const { data: transfer, error: insertError } = await supabase
        .from("transfers")
        .insert({
          user_id: user.id,
          from_account_id,
          to_account_id,
          amount: Number(amount),
          description: description || "",
          date: transferDate,
          transfer_type: "self",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating transfer:", insertError);
        return NextResponse.json(
          { error: "Failed to create transfer" },
          { status: 500 },
        );
      }

      // Balance is formula-based — no manual balance updates needed.
      // The balance will be recomputed on next GET /api/accounts/[id]/balance
      // via computeAccountBalance() which includes transfer impact.

      // Adjust balances for both accounts
      const { fromDelta, toDelta } = getTransferDeltas(Number(amount));
      await adjustAccountBalance(from_account_id, fromDelta, "transfer_out", {
        userId: user.id,
        reason: `Self transfer to ${toAccount?.name || "account"}`,
      });
      await adjustAccountBalance(to_account_id, toDelta, "transfer_in", {
        userId: user.id,
        reason: `Self transfer from ${fromAccount?.name || "account"}`,
      });

      // Return the complete transfer with account info
      return NextResponse.json({
        ...transfer,
        from_account_name: fromAccount?.name || "Unknown",
        to_account_name: toAccount?.name || "Unknown",
        from_account_type: fromAccount?.type || "expense",
        to_account_type: toAccount?.type || "expense",
        from_account_user_id: user.id,
        to_account_user_id: user.id,
        is_owner: true,
        is_recipient: false,
      });
    }
  } catch (e: any) {
    console.error("Error in POST /api/transfers:", e);
    return NextResponse.json(
      { error: e.message || "Failed to create transfer" },
      { status: 500 },
    );
  }
}
