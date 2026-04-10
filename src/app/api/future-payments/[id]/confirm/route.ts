import { adjustAccountBalance } from "@/lib/balance";
import { getBalanceDelta } from "@/lib/balance-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/future-payments/[id]/confirm - Convert a future payment draft into a real transaction
// Supports household: partner can confirm non-private future payments
// Supports editing: body can override amount, description, account_id, category_id, subcategory_id, date
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
    const body = await req.json().catch(() => ({}));

    // Get the draft (no user_id filter — we check authorization below)
    const { data: draft, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .eq("is_draft", true)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: "Future payment not found" },
        { status: 404 },
      );
    }

    const isOwner = draft.user_id === user.id;

    // Authorization: owner can always confirm. Partner can confirm non-private items.
    if (!isOwner) {
      if (draft.is_private) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      // Verify current user and draft owner share an active household link
      const ownerId = draft.user_id;
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

    // Allow overriding values at confirm time
    const finalAmount = body.amount ?? draft.amount;
    const finalDescription = body.description ?? draft.description;
    const finalDate = body.date ?? new Date().toISOString().split("T")[0];
    const finalAccountId = body.account_id ?? draft.account_id;
    const finalCategoryId =
      body.category_id !== undefined ? body.category_id : draft.category_id;
    const finalSubcategoryId =
      body.subcategory_id !== undefined
        ? body.subcategory_id
        : draft.subcategory_id;

    // Convert to real transaction: set is_draft=false, clear scheduled_date
    // The confirming user becomes the transaction owner
    const { data: confirmed, error: updateError } = await supabase
      .from("transactions")
      .update({
        is_draft: false,
        scheduled_date: null,
        date: finalDate,
        amount: finalAmount,
        description: finalDescription,
        account_id: finalAccountId,
        category_id: finalCategoryId,
        subcategory_id: finalSubcategoryId,
        user_id: user.id, // Transaction belongs to whoever confirms it
      })
      .eq("id", id)
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
      .eq("id", finalAccountId)
      .single();

    const accountType = (account?.type || "expense") as
      | "expense"
      | "income"
      | "saving";
    const delta = getBalanceDelta(
      Number(finalAmount),
      accountType,
      false,
      "create",
    );
    await adjustAccountBalance(finalAccountId, delta, "future_payment", {
      userId: user.id,
      transactionId: id,
      reason: `Future payment confirmed: ${finalDescription || "Scheduled payment"}`,
    });

    return NextResponse.json({ transaction: confirmed });
  } catch (error: any) {
    console.error("Error confirming future payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm payment" },
      { status: 500 },
    );
  }
}
