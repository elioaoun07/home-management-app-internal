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

    // Accumulate results across all strategies — fill gaps, don't return early
    let accountId: string | null = null;
    let categoryId: string | null = null;
    let subcategoryId: string | null = null;
    let source: string | null = null;

    // 1. Try to find an exact-name match in the user's own recurring payments
    const { data: ownRecurring } = await supabase
      .from("recurring_payments")
      .select("account_id, category_id, subcategory_id")
      .eq("user_id", user.id)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (ownRecurring) {
      accountId = ownRecurring.account_id || null;
      categoryId = ownRecurring.category_id || null;
      subcategoryId = ownRecurring.subcategory_id || null;
      source = "recurring";
    }

    // 2. Fill gaps from recent transactions with similar description
    if (!accountId || !categoryId) {
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
        if (!accountId && recentTx.account_id) accountId = recentTx.account_id;
        if (!categoryId && recentTx.category_id)
          categoryId = recentTx.category_id;
        if (!subcategoryId && recentTx.subcategory_id)
          subcategoryId = recentTx.subcategory_id;
        if (!source) source = "transaction";
      }
    }

    // 3. Fill remaining gaps by matching account/category/subcategory fields
    //    (partner confirms owner's payment — resolve partner's own IDs)
    //    Categories: prefer slug (canonical cross-user key), fall back to name ilike
    //    Accounts: name ilike only (accounts have no slug column)
    const accountName = req.nextUrl.searchParams.get("account_name");
    const categorySlug = req.nextUrl.searchParams.get("category_slug");
    const categoryName = req.nextUrl.searchParams.get("category_name");
    const subcategorySlug = req.nextUrl.searchParams.get("subcategory_slug");
    const subcategoryName = req.nextUrl.searchParams.get("subcategory_name");

    if (!accountId && accountName) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", accountName)
        .limit(1)
        .maybeSingle();
      if (acct) {
        accountId = acct.id;
        if (!source) source = "name-match";
      }
    }

    if (!categoryId && (categorySlug || categoryName)) {
      let catQuery = supabase
        .from("user_categories")
        .select("id")
        .eq("user_id", user.id)
        .is("parent_id", null);
      catQuery = categorySlug
        ? catQuery.eq("slug", categorySlug)
        : catQuery.ilike("name", categoryName!);
      const { data: cat } = await catQuery.limit(1).maybeSingle();
      if (cat) {
        categoryId = cat.id;
        if (!source) source = categorySlug ? "slug-match" : "name-match";
      }
    }

    if (!subcategoryId && (subcategorySlug || subcategoryName) && categoryId) {
      let subQuery = supabase
        .from("user_categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("parent_id", categoryId);
      subQuery = subcategorySlug
        ? subQuery.eq("slug", subcategorySlug)
        : subQuery.ilike("name", subcategoryName!);
      const { data: sub } = await subQuery.limit(1).maybeSingle();
      if (sub) {
        subcategoryId = sub.id;
        if (!source) source = subcategorySlug ? "slug-match" : "name-match";
      }
    }

    return NextResponse.json({
      account_id: accountId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      source,
    });
  } catch (error: any) {
    console.error("Error matching fields:", error);
    return NextResponse.json(
      { error: error.message || "Failed to match fields" },
      { status: 500 },
    );
  }
}
