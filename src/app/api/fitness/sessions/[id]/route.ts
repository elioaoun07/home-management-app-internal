import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/fitness/sessions/[id] — one session with its actual set log.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { data, error } = await supabase
    .from("fitness_sessions")
    .select("*, sets:fitness_set_logs(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return fitnessRpcError(error);
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ session: data }, { headers: NO_STORE });
}
