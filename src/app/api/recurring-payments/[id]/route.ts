import { adjustAccountBalance } from "@/lib/balance";
import { getBalanceDelta } from "@/lib/balance-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific fields (owner only — enforced by user_id filter below)
    const allowedFields = [
      "name",
      "amount",
      "description",
      "category_id",
      "subcategory_id",
      "recurrence_type",
      "recurrence_day",
      "next_due_date",
      "is_active",
      "payment_method",
      "is_private",
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("recurring_payments")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating recurring payment:", error);
      return NextResponse.json(
        { error: "Failed to update recurring payment" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Recurring payment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from("recurring_payments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting recurring payment:", error);
      return NextResponse.json(
        { error: "Failed to delete recurring payment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST endpoint to confirm a due payment - creates transaction and updates next_due_date
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get the recurring payment
    const { data: recurringPayment, error: fetchError } = await supabase
      .from("recurring_payments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !recurringPayment) {
      return NextResponse.json(
        { error: "Recurring payment not found" },
        { status: 404 },
      );
    }

    // Authorization: owner can always confirm. Partner can confirm non-private items.
    if (recurringPayment.user_id !== user.id) {
      if (recurringPayment.is_private) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      // Verify current user and payment owner share an active household link
      const ownerId = recurringPayment.user_id;
      const { data: link } = await supabase
        .from("household_links")
        .select("id")
        .or(
          `and(owner_user_id.eq.${user.id},partner_user_id.eq.${ownerId}),and(partner_user_id.eq.${user.id},owner_user_id.eq.${ownerId})`,
        )
        .eq("active", true)
        .maybeSingle();

      if (!link) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    // Allow overriding amount, description, account, category, subcategory at confirm time
    const finalAmount = body.amount ?? recurringPayment.amount;
    const finalDescription = body.description ?? recurringPayment.description;
    const finalDate = body.date ?? recurringPayment.next_due_date;
    const finalAccountId = body.account_id ?? recurringPayment.account_id;
    const finalCategoryId =
      body.category_id !== undefined
        ? body.category_id
        : recurringPayment.category_id;
    const finalSubcategoryId =
      body.subcategory_id !== undefined
        ? body.subcategory_id
        : recurringPayment.subcategory_id;

    // Create the transaction under the CURRENT user (whoever confirms it)
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: finalAccountId,
        category_id: finalCategoryId,
        subcategory_id: finalSubcategoryId,
        amount: finalAmount,
        description: finalDescription || recurringPayment.name,
        date: finalDate,
      })
      .select()
      .single();

    if (transactionError) {
      console.error("Error creating transaction:", transactionError);
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 },
      );
    }

    // Adjust the account balance — this was missing and caused balance drift
    const { data: accountData } = await supabase
      .from("accounts")
      .select("type")
      .eq("id", finalAccountId)
      .maybeSingle();

    const accountType = ((accountData?.type) || "expense") as "expense" | "income" | "saving";
    const delta = getBalanceDelta(finalAmount, accountType, false, "create");
    await adjustAccountBalance(finalAccountId, delta, "transaction", {
      userId: user.id,
      transactionId: transaction.id,
      reason: `Recurring payment: ${recurringPayment.name}`,
      effectiveDate: finalDate,
    });

    // Calculate next due date using the database function
    const { data: nextDueDateResult } = await supabase.rpc(
      "calculate_next_due_date",
      {
        current_due_date: recurringPayment.next_due_date,
        recurrence_type: recurringPayment.recurrence_type,
        recurrence_day: recurringPayment.recurrence_day,
      },
    );

    // Update the recurring payment with new due date
    const { error: updateError } = await supabase
      .from("recurring_payments")
      .update({
        next_due_date: nextDueDateResult,
        last_processed_date: finalDate,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating recurring payment:", updateError);
      // Transaction was created but couldn't update recurring payment
      // This is not critical - return success anyway
    }

    return NextResponse.json({
      transaction,
      next_due_date: nextDueDateResult,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
