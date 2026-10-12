import { createMeasurementSchema } from "@/lib/health/measurements";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  profile_id: z.uuid(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

// Measurements are owner-private (RLS: managing_user_id = auth.uid()), even
// when the profile itself is shared with the household — so no partner merge
// here (Hard Rule 13 exception, by product decision; see Healthcare Overview).
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = listQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabase
    .from("health_measurements")
    .select("*")
    .eq("profile_id", parsed.data.profile_id)
    .eq("managing_user_id", user.id)
    .order("measured_at", { ascending: false })
    .limit(parsed.data.limit);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205")
      return NextResponse.json({ error: "Measurements migration not applied", prerequisite: "migrations/2026-10-12_fitness-module.sql" }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ measurements: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = createMeasurementSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    // managing_user_id is stamped from the profile by the owner-sync trigger;
    // RLS WITH CHECK rejects profiles this user does not manage.
    const { data, error } = await supabase
      .from("health_measurements")
      .insert({ ...parsed.data, managing_user_id: user.id })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        // Same client id replayed: return the stored row (idempotent create).
        const { data: existing } = await supabase.from("health_measurements").select("*").eq("id", parsed.data.id).maybeSingle();
        if (existing) return NextResponse.json({ measurement: existing }, { status: 200 });
        return NextResponse.json({ error: "Measurement already exists" }, { status: 409 });
      }
      if (error.code === "42501") return NextResponse.json({ error: "Profile not available" }, { status: 403 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ measurement: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to save measurement" }, { status: 500 });
  }
}
