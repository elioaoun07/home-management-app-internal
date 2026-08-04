import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SnapshotEntry = { id: string; packed_quantity: number; is_packed: boolean };

function isSnapshotEntry(v: unknown): v is SnapshotEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.packed_quantity === "number" && typeof e.is_packed === "boolean";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: checkpoint, error: checkpointError } = await supabase
    .from("trip_packing_checkpoints")
    .select("snapshot")
    .eq("trip_id", id)
    .maybeSingle();

  if (checkpointError) return NextResponse.json({ error: checkpointError.message }, { status: 500 });
  if (!checkpoint) return NextResponse.json({ error: "No checkpoint saved yet" }, { status: 404 });

  const entries = Array.isArray(checkpoint.snapshot) ? checkpoint.snapshot.filter(isSnapshotEntry) : [];

  await Promise.all(
    entries.map((entry) =>
      supabase
        .from("trip_packing_items")
        .update({ packed_quantity: entry.packed_quantity, is_packed: entry.is_packed, updated_at: new Date().toISOString() })
        .eq("id", entry.id)
        .eq("trip_id", id),
    ),
  );

  return NextResponse.json({ applied: entries.length });
}
