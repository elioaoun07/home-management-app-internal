// src/app/api/era/templates/[id]/route.ts
// PATCH — toggle enabled (Taught phrases UI's disable/enable), or bump
// match_count/last_matched_at when the client-side matcher (Layer 2) used
// this template natively. DELETE — permanently remove (client handles Undo
// by re-POSTing the row it already has, per Hard Rule #1).
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.union([
  z.object({ enabled: z.boolean() }),
  z.object({ bump: z.literal(true) }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if ("enabled" in parsed.data) {
    const { data, error } = await supabase
      .from("era_templates")
      .update({ enabled: parsed.data.enabled })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  }

  // bump — best-effort telemetry (match_count/last_matched_at), read-then-write
  // is fine: a lost race under-counts by at most one, never a correctness issue.
  const { data: existing } = await supabase
    .from("era_templates")
    .select("match_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("era_templates")
    .update({ match_count: existing.match_count + 1, last_matched_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("era_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
