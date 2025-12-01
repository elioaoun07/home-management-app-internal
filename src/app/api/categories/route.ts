import { DEFAULT_ACCOUNTS } from "@/constants/defaultCategories";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // no caching

export async function GET(_req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const accountId = _req.nextUrl.searchParams.get("accountId") ?? "";
  const includeHidden =
    _req.nextUrl.searchParams.get("includeHidden") === "true";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!accountId)
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );

  // If accountId is a non-UUID (e.g., "acc-salary"/"acc-wallet" from defaults),
  // return the static categories directly and skip DB lookup.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      accountId
    );
  if (!isUuid) {
    const seed = DEFAULT_ACCOUNTS.find((a) => a.id === accountId);
    if (seed) {
      return NextResponse.json(seed.categories ?? [], {
        headers: { "Cache-Control": "no-store" },
      });
    }
    // Unknown non-UUID account id: return empty so client can decide fallback
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  let query = supabase
    .from("user_categories")
    .select("id,name,color,parent_id,position,visible,account_id")
    .eq("user_id", user.id)
    .eq("account_id", accountId);

  // Only filter out hidden categories if not explicitly including them
  if (!includeHidden) {
    query = query.eq("visible", true);
  }

  const { data, error } = await query
    .order("position", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("user_categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }

  // If no user categories, return empty array (client will use static defaults)
  if (!data || data.length === 0) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Return only the fields the UI needs (icon is derived from name via getCategoryIcon)
  const categories = data.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    parent_id: c.parent_id,
    position: c.position ?? 0,
    account_id: c.account_id,
    visible: c.visible,
  }));

  return NextResponse.json(categories, {
    headers: { "Cache-Control": "no-store" },
  });
}
