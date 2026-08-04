import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Single revertible packing-progress snapshot per trip, stored in its own
// collaborative child table (see migrations/2026-08-04_trips-packing-
// checkpoint-recyclebin.sql for why it isn't a column on `trips`).

const restoreSchema = z.object({
  restore: z.object({
    snapshot: z.array(z.object({
      id: z.string().uuid(),
      packed_quantity: z.number().int().min(0),
      is_packed: z.boolean(),
    })),
    created_at: z.string(),
  }).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("trip_packing_checkpoints")
    .select("created_at")
    .eq("trip_id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created_at: data?.created_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Saves a new checkpoint (default), or — when the body carries `restore` —
 * re-upserts an exact prior snapshot verbatim (including its original
 * `created_at`). `restore` is how the "Undo" action on the save toast puts
 * the previous checkpoint back, instead of just hiding the new one on the
 * client while the server keeps the unwanted snapshot (which would silently
 * break a later "Revert to checkpoint").
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: previous, error: previousError } = await supabase
    .from("trip_packing_checkpoints")
    .select("snapshot, created_at")
    .eq("trip_id", id)
    .maybeSingle();
  if (previousError) return NextResponse.json({ error: previousError.message }, { status: 500 });

  let snapshot: Array<{ id: string; packed_quantity: number; is_packed: boolean }>;
  let created_at: string;

  if (parsed.data.restore) {
    snapshot = parsed.data.restore.snapshot;
    created_at = parsed.data.restore.created_at;
  } else {
    const { data: items, error: itemsError } = await supabase
      .from("trip_packing_items")
      .select("id, packed_quantity, is_packed")
      .eq("trip_id", id)
      .is("deleted_at", null);
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
    snapshot = (items ?? []).map((item) => ({
      id: item.id,
      packed_quantity: item.packed_quantity,
      is_packed: item.is_packed,
    }));
    created_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("trip_packing_checkpoints")
    .upsert(
      { trip_id: id, user_id: user.id, snapshot, created_at },
      { onConflict: "trip_id" },
    )
    .select("created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    created_at: data.created_at,
    previous: previous ? { snapshot: previous.snapshot, created_at: previous.created_at } : null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("trip_packing_checkpoints")
    .delete()
    .eq("trip_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
