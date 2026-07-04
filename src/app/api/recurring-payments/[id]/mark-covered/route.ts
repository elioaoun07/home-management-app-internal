import { advanceRecurringPastDate } from "@/features/recurring/commitments";
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const markCoveredSchema = z.object({
  transaction_id: z.string().min(1),
  coverage_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = markCoveredSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: recurringPayment, error: recurringError } = await supabase
    .from("recurring_payments")
    .select("*")
    .eq("id", id)
    .single();

  if (recurringError || !recurringPayment) {
    return NextResponse.json(
      { error: "Recurring payment not found" },
      { status: 404 },
    );
  }

  if (recurringPayment.user_id !== user.id) {
    if (recurringPayment.is_private) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

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

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select(
      "id, user_id, date, is_draft, deleted_at, amount, description, account_id, category_id, subcategory_id",
    )
    .eq("id", parsed.data.transaction_id)
    .eq("user_id", user.id)
    .single();

  if (transactionError || !transaction) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 },
    );
  }

  if (transaction.is_draft || transaction.deleted_at) {
    return NextResponse.json(
      { error: "Transaction cannot cover a recurring payment" },
      { status: 400 },
    );
  }

  const paidDate = parsed.data.coverage_date ?? transaction.date;
  const nextDueDate = advanceRecurringPastDate({
    currentDueDate: recurringPayment.next_due_date,
    recurrenceType: recurringPayment.recurrence_type,
    recurrenceDay: recurringPayment.recurrence_day,
    paidDate,
  });

  const { error: updateError } = await supabase
    .from("recurring_payments")
    .update({
      last_processed_date: paidDate,
      next_due_date: nextDueDate,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to mark recurring payment covered" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    recurring_payment_id: id,
    transaction,
    last_processed_date: paidDate,
    next_due_date: nextDueDate,
  });
}
