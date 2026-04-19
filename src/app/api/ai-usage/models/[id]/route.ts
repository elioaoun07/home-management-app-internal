// src/app/api/ai-usage/models/[id]/route.ts
// PATCH (update fields, reset cycle) + DELETE single AI usage model.

import { supabaseServer } from "@/lib/supabase/server";
import type { AIUsageModel } from "@/types/aiUsage";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    refresh_frequency: z.enum(["weekly", "monthly"]).optional(),
    cycle_start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cycle_start_day: z.number().int().nullable().optional(),
    cycle_anchor_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    current_usage_pct: z.number().min(0).max(999.999).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine(
    (v) => {
      // Validate empty patch
      if (Object.keys(v).length === 0) return false;
      // Validate cycle_start_day range based on frequency (if provided)
      if (v.cycle_start_day === undefined || v.cycle_start_day === null)
        return true;
      if (v.refresh_frequency === "weekly") {
        return v.cycle_start_day >= 1 && v.cycle_start_day <= 7;
      }
      if (v.refresh_frequency === "monthly") {
        return v.cycle_start_day >= 1 && v.cycle_start_day <= 31;
      }
      // If refresh_frequency not provided, allow 1-31 (client is responsible)
      return v.cycle_start_day >= 1 && v.cycle_start_day <= 31;
    },
    {
      message: "empty patch or invalid cycle_start_day for frequency",
    },
  );

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    last_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("ai_usage_models")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A model with this name already exists" },
        { status: 409 },
      );
    }
    console.error("Error updating AI usage model:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data as AIUsageModel);
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("ai_usage_models")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting AI usage model:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
