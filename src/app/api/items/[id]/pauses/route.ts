import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  pause_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  pause_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional(),
  reason: z.string().max(200).nullable().optional(),
});

// GET /api/items/[id]/pauses — list all pause periods for an item
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("recurrence_pauses")
    .select("*")
    .eq("item_id", itemId)
    .order("pause_start", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/items/[id]/pauses — create a pause period
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("recurrence_pauses")
    .insert({
      item_id: itemId,
      pause_start: parsed.data.pause_start,
      pause_end: parsed.data.pause_end ?? null,
      reason: parsed.data.reason ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error?.code === "23505")
    return NextResponse.json(
      { error: "A pause already exists for this range" },
      { status: 409 },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/items/[id]/pauses?pauseId=<uuid> — delete a specific pause
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pauseId = searchParams.get("pauseId");
  if (!pauseId)
    return NextResponse.json({ error: "pauseId query param required" }, { status: 400 });

  const { error } = await supabase
    .from("recurrence_pauses")
    .delete()
    .eq("id", pauseId)
    .eq("item_id", itemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
