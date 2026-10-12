import { celebratedBodySchema } from "@/lib/fitness/contracts";
import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/fitness/rewards/seen — mark reveals shown so no device replays them.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = celebratedBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabase.rpc("fitness_mark_celebrated", { p_keys: parsed.data.keys });
  if (error) return fitnessRpcError(error);
  return NextResponse.json({ marked: data }, { headers: NO_STORE });
}
