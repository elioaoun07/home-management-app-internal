import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Resolve household user IDs for shared access */
async function getHouseholdUserIds(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
): Promise<string[]> {
  const userIds = [userId];
  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id, active")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const partnerId = link
    ? link.owner_user_id === userId
      ? link.partner_user_id
      : link.owner_user_id
    : null;
  if (partnerId) userIds.push(partnerId);
  return userIds;
}

// GET /api/nfc/[slug]/checklist — list checklist items for a tag (all states)
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

  const userIds = await getHouseholdUserIds(supabase, user.id);

  const { data: tag } = await supabase
    .from("nfc_tags")
    .select("id")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("nfc_checklist_items")
    .select(
      "*, source_tag:nfc_tags!nfc_checklist_items_source_tag_id_fkey(label, current_state)",
    )
    .eq("tag_id", tag.id)
    .order("state")
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with source tag info
  const enriched = (data ?? []).map((row) => {
    const sourceTag = row.source_tag as {
      label: string;
      current_state: string | null;
    } | null;
    return {
      ...row,
      source_tag: undefined,
      source_tag_label: sourceTag?.label ?? null,
      source_tag_current_state: sourceTag?.current_state ?? null,
    };
  });

  return NextResponse.json(enriched, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST /api/nfc/[slug]/checklist — add a checklist item
export async function POST(
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

  const userIds = await getHouseholdUserIds(supabase, user.id);

  const { data: tag } = await supabase
    .from("nfc_tags")
    .select("id")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const schema = z.object({
    state: z.string().min(1).max(50),
    title: z.string().min(1).max(500),
    order_index: z.number().int().min(0).optional(),
    source_tag_id: z.string().uuid().nullish(),
    source_state: z.string().min(1).max(50).nullish(),
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("nfc_checklist_items")
    .insert({
      tag_id: tag.id,
      state: parsed.data.state,
      title: parsed.data.title,
      order_index: parsed.data.order_index ?? 0,
      source_tag_id: parsed.data.source_tag_id ?? null,
      source_state: parsed.data.source_state ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/nfc/[slug]/checklist — update a checklist item
export async function PATCH(
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

  const userIds = await getHouseholdUserIds(supabase, user.id);

  const { data: tag } = await supabase
    .from("nfc_tags")
    .select("id")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const schema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    order_index: z.number().int().min(0).optional(),
    source_tag_id: z.string().uuid().nullish(),
    source_state: z.string().min(1).max(50).nullish(),
    is_active: z.boolean().optional(),
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, ...updates } = parsed.data;

  const { data, error } = await supabase
    .from("nfc_checklist_items")
    .update(updates)
    .eq("id", id)
    .eq("tag_id", tag.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/nfc/[slug]/checklist — delete a checklist item
export async function DELETE(
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

  const userIds = await getHouseholdUserIds(supabase, user.id);

  const { data: tag } = await supabase
    .from("nfc_tags")
    .select("id")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json(
      { error: "itemId query param required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("nfc_checklist_items")
    .delete()
    .eq("id", itemId)
    .eq("tag_id", tag.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
