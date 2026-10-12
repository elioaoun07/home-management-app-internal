import { updateMeasurementSchema } from "@/lib/health/measurements";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const parsed = updateMeasurementSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("health_measurements")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("managing_user_id", user.id)
    .select()
    .maybeSingle();
  if (error) {
    // CHECK violations (e.g. clearing both weight and height) are client errors.
    if (error.code === "23514") return NextResponse.json({ error: "Weight or height required" }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Measurement not found" }, { status: 404 });
  return NextResponse.json({ measurement: data }, { headers: { "Cache-Control": "no-store" } });
}

// Hard delete; the client keeps the row for Undo (re-create with the same id).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { data, error } = await supabase
    .from("health_measurements")
    .delete()
    .eq("id", id)
    .eq("managing_user_id", user.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Measurement not found" }, { status: 404 });
  return NextResponse.json({ measurement: data }, { headers: { "Cache-Control": "no-store" } });
}
