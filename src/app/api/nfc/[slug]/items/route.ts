import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/nfc/[slug]/items — list items with prerequisites linked to this NFC tag
export async function GET(
  _req: NextRequest,
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

  // Fetch the tag to get its ID
  const { data: tag, error: tagError } = await supabase
    .from("nfc_tags")
    .select("id")
    .eq("tag_slug", slug)
    .eq("user_id", user.id)
    .maybeSingle();

  if (tagError) {
    return NextResponse.json({ error: tagError.message }, { status: 500 });
  }
  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  // Household linking — include partner's items
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

  // Find all items with nfc_state_change prerequisites pointing to this tag
  const { data: prerequisites, error: prereqError } = await supabase
    .from("item_prerequisites")
    .select("item_id, condition_config")
    .eq("condition_type", "nfc_state_change")
    .eq("is_active", true)
    .contains("condition_config", { tag_id: tag.id });

  if (prereqError) {
    return NextResponse.json({ error: prereqError.message }, { status: 500 });
  }
  if (!prerequisites || prerequisites.length === 0) {
    return NextResponse.json(
      {},
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  // Fetch all connected items
  const itemIds = [...new Set(prerequisites.map((p) => p.item_id))];
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("id, title, type, priority, status, user_id, responsible_user_id")
    .in("id", itemIds)
    .in("user_id", userIds);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Group by target_state
  const grouped: Record<
    string,
    Array<{
      id: string;
      title: string;
      type: string;
      priority: string;
      status: string;
      user_id: string;
      responsible_user_id: string | null;
    }>
  > = {};

  for (const prereq of prerequisites) {
    const item = items?.find((i) => i.id === prereq.item_id);
    if (!item) continue;
    const config = prereq.condition_config as { target_state?: string };
    const state = config.target_state ?? "unknown";
    if (!grouped[state]) grouped[state] = [];
    // Avoid duplicates (an item may have multiple prereqs for the same tag/state)
    if (!grouped[state].some((i) => i.id === item.id)) {
      grouped[state].push(item);
    }
  }

  return NextResponse.json(grouped, {
    headers: { "Cache-Control": "no-store" },
  });
}
