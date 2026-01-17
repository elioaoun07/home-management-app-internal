import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch pending split bill requests for the current user
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch pending split transactions where user is the collaborator
    const { data: pendingSplits, error } = await supabase
      .from("transactions")
      .select(
        `
        id,
        date,
        amount,
        description,
        category_id,
        user_id,
        split_requested,
        collaborator_id,
        collaborator_amount,
        split_completed_at,
        category:user_categories!transactions_category_fk(name, color)
      `,
      )
      .eq("split_requested", true)
      .eq("collaborator_id", user.id)
      .is("split_completed_at", null)
      .order("inserted_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending splits:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format the response
    const formatted = (pendingSplits || []).map((tx: any) => ({
      transaction_id: tx.id,
      date: tx.date,
      owner_amount: tx.amount,
      owner_description: tx.description,
      category_name: tx.category?.name || "Expense",
      category_color: tx.category?.color || "#38bdf8",
    }));

    return NextResponse.json({ pending_splits: formatted });
  } catch (error) {
    console.error("Failed to fetch pending splits:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending splits" },
      { status: 500 },
    );
  }
}

// POST - Complete a split bill by adding collaborator's portion
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { transaction_id, amount, description, account_id } =
      await req.json();

    if (!transaction_id) {
      return NextResponse.json(
        { error: "transaction_id is required" },
        { status: 400 },
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 },
      );
    }

    if (!account_id) {
      return NextResponse.json(
        { error: "Payment account is required" },
        { status: 400 },
      );
    }

    // Fetch the transaction where the current user is the collaborator
    // This query explicitly filters by collaborator_id to work with RLS policies
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select(
        "id, split_requested, collaborator_id, split_completed_at, user_id, amount",
      )
      .eq("id", transaction_id)
      .eq("collaborator_id", user.id)
      .single();

    console.log("[Split Bill Debug]", {
      transaction_id,
      user_id: user.id,
      fetchError: fetchError?.message,
      transaction: transaction ? "found" : "not found",
    });

    if (fetchError || !transaction) {
      console.error("[Split Bill Error]", {
        error: fetchError,
        transaction_id,
        user_id: user.id,
      });
      return NextResponse.json(
        {
          error: "Transaction not found or you are not the collaborator",
          debug: {
            transaction_id,
            user_id: user.id,
            fetchError: fetchError?.message,
          },
        },
        { status: 404 },
      );
    }

    if (!transaction.split_requested) {
      return NextResponse.json(
        { error: "This is not a split transaction" },
        { status: 400 },
      );
    }

    if (transaction.split_completed_at) {
      return NextResponse.json(
        { error: "This split has already been completed" },
        { status: 400 },
      );
    }

    // Update the transaction with the collaborator's portion
    const { data: updated, error: updateError } = await supabase
      .from("transactions")
      .update({
        collaborator_amount: amount,
        collaborator_description: description || null,
        collaborator_account_id: account_id,
        split_completed_at: new Date().toISOString(),
      })
      .eq("id", transaction_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error completing split bill:", updateError);
      return NextResponse.json(
        { error: "Failed to complete split bill" },
        { status: 500 },
      );
    }

    // Deduct the amount from the collaborator's account balance
    const { data: currentBalance, error: balanceFetchError } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", account_id)
      .single();

    if (balanceFetchError) {
      console.error("Error fetching account balance:", balanceFetchError);
    } else if (currentBalance) {
      const newBalance = Number(currentBalance.balance) - amount;
      const { error: balanceUpdateError } = await supabase
        .from("account_balances")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", account_id);

      if (balanceUpdateError) {
        console.error("Error updating account balance:", balanceUpdateError);
      }
    }

    // Send notification to the original owner
    await supabase.from("notifications").insert({
      user_id: transaction.user_id,
      title: "Split Bill Completed",
      message: `Your partner added $${amount.toFixed(2)} to the split expense. Total: $${(transaction.amount + amount).toFixed(2)}`,
      icon: "check",
      notification_type: "success",
      severity: "success",
      source: "transaction",
      priority: "normal",
      action_url: null, // Transactions are viewed via expense tab, not direct URL
      transaction_id: transaction_id,
    });

    // Dismiss the pending notification for the collaborator
    await supabase
      .from("notifications")
      .update({ is_dismissed: true, action_taken: true })
      .eq("transaction_id", transaction_id)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      transaction: updated,
      total_amount: transaction.amount + amount,
    });
  } catch (error) {
    console.error("Failed to complete split bill:", error);
    return NextResponse.json(
      { error: "Failed to complete split bill" },
      { status: 500 },
    );
  }
}
