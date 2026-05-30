import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await supabase
    .from("trips")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.status !== "active") {
    return NextResponse.json({ error: "Only active trips can be completed" }, { status: 409 });
  }

  const admin = supabaseAdmin();

  const { data: rpcResult, error: rpcErr } = await admin
    .rpc("complete_trip", { p_trip_id: id });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const { data: updatedTrip, error: updateErr } = await admin
    .from("trips")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ trip: updatedTrip, reversed: rpcResult });
}
