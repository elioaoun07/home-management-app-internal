import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/fitness/operations/[id] — durable receipt lookup. After a timeout
// or lost response the client asks here whether the write committed before
// it retries (retrying with the same op id is also safe).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { data, error } = await supabase
    .from("fitness_operations")
    .select("op_id, kind, target_id, result, created_at")
    .eq("op_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return fitnessRpcError(error);
  if (!data) {
    // Session starts are keyed by the session id itself.
    const { data: session } = await supabase.from("fitness_sessions").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    return NextResponse.json({ committed: !!session, receipt: null }, { headers: NO_STORE });
  }
  return NextResponse.json({ committed: true, receipt: data }, { headers: NO_STORE });
}
