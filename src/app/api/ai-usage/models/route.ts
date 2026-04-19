// src/app/api/ai-usage/models/route.ts
// GET list + POST create for AI usage models (owner-only, not household-shared).

import { supabaseServer } from "@/lib/supabase/server";
import type { AIUsageModel } from "@/types/aiUsage";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ai_usage_models")
    .select("*")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching AI usage models:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as AIUsageModel[], {
    headers: { "Cache-Control": "no-store" },
  });
}

const createSchema = z
  .object({
    name: z.string().trim().min(1, "name required").max(80),
    refresh_frequency: z.enum(["weekly", "monthly"]),
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
  })
  .refine((v) => {
    if (!v.cycle_start_day) return true;
    if (v.refresh_frequency === "weekly") {
      return v.cycle_start_day >= 1 && v.cycle_start_day <= 7;
    }
    if (v.refresh_frequency === "monthly") {
      return v.cycle_start_day >= 1 && v.cycle_start_day <= 31;
    }
    return false;
  }, "cycle_start_day must be 1-7 for weekly, 1-31 for monthly");

export async function POST(req: NextRequest) {
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
  const {
    name,
    refresh_frequency,
    cycle_start_date,
    cycle_start_day,
    cycle_anchor_date,
    current_usage_pct,
    notes,
  } = parsed.data;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("ai_usage_models")
    .insert({
      user_id: user.id,
      name,
      refresh_frequency,
      cycle_start_date: cycle_start_date ?? today,
      cycle_start_day: cycle_start_day ?? null,
      cycle_anchor_date: cycle_anchor_date ?? null,
      current_usage_pct: current_usage_pct ?? 0,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A model with this name already exists" },
        { status: 409 },
      );
    }
    console.error("Error creating AI usage model:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as AIUsageModel, { status: 201 });
}
