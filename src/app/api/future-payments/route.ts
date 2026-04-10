import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/future-payments - Fetch draft transactions with scheduled_date (includes partner's non-private)
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = req.nextUrl.searchParams.get("account_id");

    // Check for household link to also fetch partner's future payments
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const partnerId = link
      ? link.owner_user_id === user.id
        ? link.partner_user_id
        : link.owner_user_id
      : null;

    let query = supabase
      .from("transactions")
      .select(
        `
        id,
        user_id,
        date,
        scheduled_date,
        amount,
        description,
        category_id,
        subcategory_id,
        account_id,
        is_private,
        accounts!transactions_account_id_fkey(name),
        category:user_categories!transactions_category_fk(id, name),
        subcategory:user_categories!transactions_subcategory_fk(id, name)
      `,
      )
      .eq("is_draft", true)
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true });

    // Include own + partner's non-private future payments
    if (partnerId) {
      query = query.or(
        `user_id.eq.${user.id},and(user_id.eq.${partnerId},is_private.eq.false)`,
      );
    } else {
      query = query.eq("user_id", user.id);
    }

    if (accountId) {
      query = query.eq("account_id", accountId);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error("Error fetching future payments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payments: payments || [] });
  } catch (error: any) {
    console.error("Error fetching future payments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch future payments" },
      { status: 500 },
    );
  }
}
