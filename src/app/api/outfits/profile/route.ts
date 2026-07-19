// Sizing profile: one row per user (PK = user_id), GET + PUT upsert.
// Personal per user by locked design D4 — NO household_links here, ever.
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  height_cm: z.number().positive().max(300).nullish(),
  weight_kg: z.number().positive().max(500).nullish(),
  sizes: z.record(z.string().max(20), z.string().max(20)).default({}),
  notes: z.string().trim().max(500).nullish(),
});

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("wardrobe_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { profile: data ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("wardrobe_profiles")
      .upsert(
        { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      { profile: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
