import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/nfc/[slug] — get single NFC tag config + current state
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

  // Household linking
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

  const { data, error } = await supabase
    .from("nfc_tags")
    .select("*")
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// PATCH /api/nfc/[slug] — update NFC tag
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

  // Household linking — partner can also update
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

  const schema = z.object({
    label: z.string().min(1).max(200).optional(),
    location_name: z.string().max(200).nullish(),
    icon: z.string().max(50).nullish(),
    states: z.array(z.string().min(1).max(50)).min(2).optional(),
    is_active: z.boolean().optional(),
    checklists: z
      .record(
        z.string(),
        z.array(
          z.object({
            id: z.string().min(1),
            title: z.string().min(1).max(500),
            order: z.number().int().min(0),
          }),
        ),
      )
      .optional(),
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
    .from("nfc_tags")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("tag_slug", slug)
    .in("user_id", userIds)
    .select()
    .single();

  if (error) {
    if ((error as unknown as Record<string, unknown>).code === "23505") {
      return NextResponse.json(
        { error: "Tag slug already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/nfc/[slug] — delete NFC tag (owner only)
export async function DELETE(
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

  // Delete: only owner can delete (not partner)
  const { error } = await supabase
    .from("nfc_tags")
    .delete()
    .eq("tag_slug", slug)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
