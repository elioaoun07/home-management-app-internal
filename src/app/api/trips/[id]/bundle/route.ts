// GET /api/trips/[id]/bundle — one round-trip read for Trip Detail via the
// get_trip_bundle() SECURITY DEFINER RPC (see migrations/2026-08-03_trips-planner-upgrade.sql).
// Access control lives inside the RPC (mirrors getAccessibleTrip()), so this
// route does not call getAccessibleTrip() itself — a null result means "not
// found or not accessible" and both map to 404, same as every other trip route.
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_trip_bundle", { p_trip_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
