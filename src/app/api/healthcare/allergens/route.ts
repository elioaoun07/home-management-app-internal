import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/healthcare/allergens — the household allergen feed for recipe
// warnings. ALWAYS includes every profile in the household regardless of
// shared_with_household (a partner cooking must see the other's allergens);
// deliberately minimal fields (no medical notes) — see get_household_allergens().
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_household_allergens");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { allergens: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
