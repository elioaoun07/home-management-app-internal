import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/future-payments/[id]/confirm - Convert a future payment draft into a real transaction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the draft
    const { data: draft, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_draft", true)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: "Future payment not found" },
        { status: 404 },
      );
    }

    // Convert to real transaction: set is_draft=false, clear scheduled_date, use today's date
    const { data: confirmed, error: updateError } = await supabase
      .from("transactions")
      .update({
        is_draft: false,
        scheduled_date: null,
        date: new Date().toISOString().split("T")[0], // Today
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error confirming future payment:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update account balance (subtract from stored balance since it's an expense)
    const { data: currentBalance } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", draft.account_id)
      .single();

    if (currentBalance) {
      const newBalance = currentBalance.balance - draft.amount;
      await supabase
        .from("account_balances")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", draft.account_id);

      // Log balance history
      await supabase.from("account_balance_history").insert({
        account_id: draft.account_id,
        user_id: user.id,
        previous_balance: currentBalance.balance,
        new_balance: newBalance,
        change_amount: -draft.amount,
        change_type: "expense",
        transaction_id: id,
        reason: `Future payment confirmed: ${draft.description || "Scheduled payment"}`,
      });
    }

    return NextResponse.json(confirmed);
  } catch (error: any) {
    console.error("Error confirming future payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm payment" },
      { status: 500 },
    );
  }
}
