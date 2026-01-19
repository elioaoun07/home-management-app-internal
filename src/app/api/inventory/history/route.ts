// src/app/api/inventory/history/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET restock history
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const itemId = searchParams.get("item_id");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  let query = supabase
    .from("inventory_restock_history")
    .select("*")
    .eq("user_id", user.id)
    .order("restocked_at", { ascending: false })
    .limit(limit);

  if (itemId) {
    query = query.eq("item_id", itemId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
