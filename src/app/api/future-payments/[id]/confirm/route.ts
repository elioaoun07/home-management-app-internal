import { adjustAccountBalance } from "@/lib/balance";
import { getBalanceDelta } from "@/lib/balance-utils";
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

    // Get account type for correct delta calculation
    const { data: account } = await supabase
      .from("accounts")
      .select("type")
      .eq("id", draft.account_id)
      .single();

    const accountType = (account?.type || "expense") as
      | "expense"
      | "income"
      | "saving";
    const delta = getBalanceDelta(
      Number(draft.amount),
      accountType,
      false,
      "create",
    );
    await adjustAccountBalance(draft.account_id, delta, "future_payment", {
      userId: user.id,
      transactionId: id,
      reason: `Future payment confirmed: ${draft.description || "Scheduled payment"}`,
    });

    return NextResponse.json(confirmed);
  } catch (error: any) {
    console.error("Error confirming future payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm payment" },
      { status: 500 },
    );
  }
}
