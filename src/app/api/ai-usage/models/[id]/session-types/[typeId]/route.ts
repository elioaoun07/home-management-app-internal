// src/app/api/ai-usage/models/[id]/session-types/[typeId]/route.ts
// PATCH + DELETE a single session type.

import { supabaseServer } from "@/lib/supabase/server";
import type { AISessionType } from "@/types/aiUsage";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; typeId: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    estimated_usage_pct: z.number().min(0).max(999.999).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" });

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id: modelId, typeId } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("ai_session_types")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", typeId)
    .eq("model_id", modelId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A session type with this name already exists" },
        { status: 409 },
      );
    }
    console.error("Error updating AI session type:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data as AISessionType);
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id: modelId, typeId } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("ai_session_types")
    .delete()
    .eq("id", typeId)
    .eq("model_id", modelId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting AI session type:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
