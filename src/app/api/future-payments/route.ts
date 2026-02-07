import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/future-payments - Fetch draft transactions with scheduled_date
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

    let query = supabase
      .from("transactions")
      .select(
        `
        id,
        date,
        scheduled_date,
        amount,
        description,
        category_id,
        account_id,
        accounts!transactions_account_id_fkey(name),
        category:user_categories!transactions_category_fk(name)
      `,
      )
      .eq("user_id", user.id)
      .eq("is_draft", true)
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true });

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
