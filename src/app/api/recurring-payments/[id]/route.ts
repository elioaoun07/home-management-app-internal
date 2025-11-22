import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    // Only allow updating specific fields
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
        { status: 400 }
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
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Recurring payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST endpoint to confirm a due payment - creates transaction and updates next_due_date
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
      .eq("user_id", user.id)
      .single();

    if (fetchError || !recurringPayment) {
      return NextResponse.json(
        { error: "Recurring payment not found" },
        { status: 404 }
      );
    }

    // Allow editing amount/description before confirming
    const finalAmount = body.amount ?? recurringPayment.amount;
    const finalDescription = body.description ?? recurringPayment.description;
    const finalDate = body.date ?? recurringPayment.next_due_date;

    // Create the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: recurringPayment.account_id,
        category_id: recurringPayment.category_id,
        subcategory_id: recurringPayment.subcategory_id,
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
        { status: 500 }
      );
    }

    // Calculate next due date using the database function
    const { data: nextDueDateResult } = await supabase.rpc(
      "calculate_next_due_date",
      {
        current_due_date: recurringPayment.next_due_date,
        recurrence_type: recurringPayment.recurrence_type,
        recurrence_day: recurringPayment.recurrence_day,
      }
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
      { status: 500 }
    );
  }
}
