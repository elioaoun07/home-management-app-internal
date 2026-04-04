import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/nfc/[slug]/history — get state change history for a tag
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve tag by slug (household sharing)
  let userIds: string[] = [user.id];
  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id, active")
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
  if (partnerId) userIds = [user.id, partnerId];

  const { data: tag } = await supabase
    .from("nfc_tags")
    .select("id")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10),
    200,
  );

  const { data, error } = await supabase
    .from("nfc_state_log")
    .select("*")
    .eq("tag_id", tag.id)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
