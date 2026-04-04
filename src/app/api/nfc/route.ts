import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/nfc — list user's NFC tags (includes household partner's)
export async function GET() {
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
    .in("user_id", userIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/nfc — create a new NFC tag
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = z.object({
    tag_slug: z
      .string()
      .min(1)
      .max(100)
      .regex(
        /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
        "Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens",
      ),
    label: z.string().min(1).max(200),
    location_name: z.string().max(200).nullish(),
    icon: z.string().max(50).nullish(),
    states: z
      .array(z.string().min(1).max(50))
      .min(2, "At least 2 states required"),
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
    .insert({
      user_id: user.id,
      tag_slug: parsed.data.tag_slug,
      label: parsed.data.label,
      location_name: parsed.data.location_name ?? null,
      icon: parsed.data.icon ?? null,
      states: parsed.data.states,
    })
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

  return NextResponse.json(data, { status: 201 });
}
