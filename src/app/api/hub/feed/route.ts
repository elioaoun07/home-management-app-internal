import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch activity feed for household
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get household ID for this user
  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ feed: [], household_id: null });
  }

  // Fetch feed items for this household
  const { data: feed, error } = await supabase
    .from("hub_feed")
    .select("*")
    .eq("household_id", household.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    feed: feed || [],
    household_id: household.id,
    current_user_id: user.id,
  });
}
