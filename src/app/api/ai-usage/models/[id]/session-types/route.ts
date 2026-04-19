// src/app/api/ai-usage/models/[id]/session-types/route.ts
// GET list + POST create session types for a given model.

import { supabaseServer } from "@/lib/supabase/server";
import type { AISessionType } from "@/types/aiUsage";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function assertOwnsModel(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  modelId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("ai_usage_models")
    .select("id")
    .eq("id", modelId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id: modelId } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ai_session_types")
    .select("*")
    .eq("model_id", modelId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching AI session types:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as AISessionType[], {
    headers: { "Cache-Control": "no-store" },
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  estimated_usage_pct: z.number().min(0).max(999.999),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const { id: modelId } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!(await assertOwnsModel(supabase, modelId, user.id))) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("ai_session_types")
    .insert({
      user_id: user.id,
      model_id: modelId,
      name: parsed.data.name,
      estimated_usage_pct: parsed.data.estimated_usage_pct,
    })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A session type with this name already exists" },
        { status: 409 },
      );
    }
    console.error("Error creating AI session type:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as AISessionType, { status: 201 });
}
