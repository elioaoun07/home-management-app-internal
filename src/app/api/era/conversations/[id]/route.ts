// src/app/api/era/conversations/[id]/route.ts
// HUB-52 — act on one ERA conversation from the History picker.
//
// PATCH { action: "resume" }                → continue it: updated_at = now, so
//                                              it is the active chat everywhere.
// PATCH { action: "archive", archived }     → hide it from History (or restore
//                                              it — the Undo). Messages are kept.
//
// era_conversations RLS is owner-only (`auth.uid() = user_id`, db-state.json);
// the explicit user_id filter is defence in depth. Household linking (Hard
// Rule #13) does not apply — ERA conversations are private by design.

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("archive"), archived: z.boolean() }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const patch =
    parsed.data.action === "resume"
      ? { updated_at: new Date().toISOString() }
      : { is_archived: parsed.data.archived };

  const { data, error } = await supabase
    .from("era_conversations")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
