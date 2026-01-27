import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH - Convert draft to confirmed transaction
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
    const {
      amount,
      category_id,
      subcategory_id,
      description,
      date,
      account_id,
    } = body;

    // Fetch the draft to get voice_transcript
    const { data: draft } = await supabase
      .from("transactions")
      .select("voice_transcript")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_draft", true)
      .single();

    // Use voice_transcript if description is empty, otherwise keep user's description
    const finalDescription = description || draft?.voice_transcript || "";

    const parsedAmount = parseFloat(amount);

    // Update and confirm the transaction
    const { data: transaction, error } = await supabase
      .from("transactions")
      .update({
        amount: parsedAmount,
        category_id,
        subcategory_id: subcategory_id || null,
        description: finalDescription,
        date,
        account_id,
        is_draft: false, // Confirm it
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_draft", true)
      .select()
      .single();

    if (error) throw error;

    // Deduct the amount from account balance (this was the bug - we only updated updated_at before)
    const { data: currentBalance } = await supabase
      .from("account_balances")
      .select("balance")
      .eq("account_id", account_id)
      .single();

    if (currentBalance) {
      const newBalance = Number(currentBalance.balance) - parsedAmount;
      await supabase
        .from("account_balances")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", account_id);
    }

    return NextResponse.json({ transaction });
  } catch (error: any) {
    console.error("Error confirming draft:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm draft" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a draft transaction
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
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_draft", true);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting draft:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete draft" },
      { status: 500 },
    );
  }
}
