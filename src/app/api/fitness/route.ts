import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/fitness — the whole Fitness page in ONE call (Hard Rule 21).
// Fitness data is owner-private; get_fitness_bundle() adds only the partner's
// opt-in shared summary (rank, badges, weekly completion/target), so there is
// no ?own= variant (Hard Rule 13 is satisfied by the RPC's partner block).
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_fitness_bundle");
  if (error) return fitnessRpcError(error);
  return NextResponse.json({ bundle: data }, { headers: NO_STORE });
}
