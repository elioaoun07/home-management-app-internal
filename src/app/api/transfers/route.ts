import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to get partner user ID if linked
async function getPartnerUserId(
  supabase: any,
  userId: string,
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

// Helper to update account balance
async function updateAccountBalance(
  supabase: any,
  accountId: string,
  userId: string,
  delta: number, // positive = add, negative = subtract
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current balance
    const { data: balanceData, error: fetchError } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      // If no balance exists yet, create one with the delta
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
          console.error("Error creating account balance:", insertError);
          return { success: false, error: insertError.message };
        }
        return { success: true };
      }

      console.error("Error fetching account balance:", fetchError);
      return { success: false, error: fetchError.message };
    }

    // Update the balance
    const newBalance = Number(balanceData.balance) + delta;
    const { error: updateError } = await supabase
      .from("account_balances")
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating account balance:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (e: any) {
    console.error("Error in updateAccountBalance:", e);
    return { success: false, error: e.message };
  }
}

// Helper to update account balance and log history
async function updateAccountBalanceWithHistory(
  supabase: any,
  accountId: string,
  userId: string,
  delta: number, // positive = add, negative = subtract
  changeType: "transfer_in" | "transfer_out",
  transferId: string,
  effectiveDate: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current balance
    const { data: balanceData, error: fetchError } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .single();

    let previousBalance = 0;
    let newBalance = delta;

    if (fetchError) {
      // If no balance exists yet, create one with the delta
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
          console.error("Error creating account balance:", insertError);
          return { success: false, error: insertError.message };
        }
        previousBalance = 0;
        newBalance = delta;
      } else {
        console.error("Error fetching account balance:", fetchError);
        return { success: false, error: fetchError.message };
      }
    } else {
      // Update the balance
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
        console.error("Error updating account balance:", updateError);
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
      // Don't fail - history is supplementary
    }

    return { success: true };
  } catch (e: any) {
    console.error("Error in updateAccountBalanceWithHistory:", e);
    return { success: false, error: e.message };
  }
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
        created_at,
        updated_at,
        from_account:accounts!transfers_from_account_id_fkey(id, name, type),
        to_account:accounts!transfers_to_account_id_fkey(id, name, type)
      `,
      )
      .in("user_id", allowedUserIds)
      .order("date", { ascending: false })
      .limit(limit);

    if (start) query = query.gte("date", start);
    if (end) query = query.lte("date", end);

    const { data: transfers, error } = await query;

    if (error) {
      console.error("Error fetching transfers:", error);
      return NextResponse.json(
        { error: "Failed to fetch transfers" },
        { status: 500 },
      );
    }

    // Format response
    const formattedTransfers = (transfers || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      from_account_id: t.from_account_id,
      to_account_id: t.to_account_id,
      from_account_name: t.from_account?.name || "Unknown",
      to_account_name: t.to_account?.name || "Unknown",
      from_account_type: t.from_account?.type || "expense",
      to_account_type: t.to_account?.type || "expense",
      amount: t.amount,
      description: t.description,
      date: t.date,
      created_at: t.created_at,
      updated_at: t.updated_at,
      is_owner: t.user_id === user.id,
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
    const { from_account_id, to_account_id, amount, description, date } = body;

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

    // Determine date
    let transferDate: string;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      transferDate = date;
    } else {
      transferDate = new Date().toISOString().split("T")[0];
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

    // Update source account balance (subtract) with history
    const fromResult = await updateAccountBalanceWithHistory(
      supabase,
      from_account_id,
      user.id,
      -Number(amount),
      "transfer_out",
      transfer.id,
      transferDate,
    );

    if (!fromResult.success) {
      console.error("Failed to update source balance:", fromResult.error);
    }

    // Update destination account balance (add) with history
    const toResult = await updateAccountBalanceWithHistory(
      supabase,
      to_account_id,
      user.id,
      Number(amount),
      "transfer_in",
      transfer.id,
      transferDate,
    );

    if (!toResult.success) {
      console.error("Failed to update destination balance:", toResult.error);
    }

    // Return the complete transfer with account info
    return NextResponse.json({
      ...transfer,
      from_account_name: fromAccount?.name || "Unknown",
      to_account_name: toAccount?.name || "Unknown",
      from_account_type: fromAccount?.type || "expense",
      to_account_type: toAccount?.type || "expense",
      is_owner: true,
    });
  } catch (e: any) {
    console.error("Error in POST /api/transfers:", e);
    return NextResponse.json(
      { error: e.message || "Failed to create transfer" },
      { status: 500 },
    );
  }
}
