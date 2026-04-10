import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/recurring-payments/match-fields?name=Netflix
 * Auto-populate account/category/subcategory for the current user
 * by matching the recurring payment name against the user's own recurring payments or recent transactions.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const name = req.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json(
        { error: "name parameter required" },
        { status: 400 },
      );
    }

    // 1. Try to find an exact-name match in the user's own recurring payments
    const { data: ownRecurring } = await supabase
      .from("recurring_payments")
      .select("account_id, category_id, subcategory_id")
      .eq("user_id", user.id)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (ownRecurring) {
      return NextResponse.json({
        account_id: ownRecurring.account_id,
        category_id: ownRecurring.category_id,
        subcategory_id: ownRecurring.subcategory_id,
        source: "recurring",
      });
    }

    // 2. Fallback: search recent transactions with similar description (case-insensitive)
    const { data: recentTx } = await supabase
      .from("transactions")
      .select("account_id, category_id, subcategory_id")
      .eq("user_id", user.id)
      .eq("is_draft", false)
      .ilike("description", `%${name}%`)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentTx) {
      return NextResponse.json({
        account_id: recentTx.account_id,
        category_id: recentTx.category_id,
        subcategory_id: recentTx.subcategory_id,
        source: "transaction",
      });
    }

    // 3. No match found
    return NextResponse.json({
      account_id: null,
      category_id: null,
      subcategory_id: null,
      source: null,
    });
  } catch (error: any) {
    console.error("Error matching fields:", error);
    return NextResponse.json(
      { error: error.message || "Failed to match fields" },
      { status: 500 },
    );
  }
}
