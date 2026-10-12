import { sessionBodySchema } from "@/lib/fitness/contracts";
import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const historyQuerySchema = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/fitness/sessions?before=&limit= — paginated history (own rows; RLS).
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = historyQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  let query = supabase
    .from("fitness_sessions")
    .select("id, plan_id, version, slot_id, period_start, workout_id, workout_name, kind, status, source, started_at, finished_at, local_date, has_sets, fully_logged, notes, revision")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .neq("status", "in_progress")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(parsed.data.limit);
  if (parsed.data.before) query = query.lt("finished_at", parsed.data.before);
  const { data, error } = await query;
  if (error) return fitnessRpcError(error);
  return NextResponse.json({ sessions: data ?? [] }, { headers: NO_STORE });
}

const RPC: Record<string, string> = {
  start: "fitness_start_session",
  "log-set": "fitness_log_set",
  "delete-set": "fitness_delete_set",
  finish: "fitness_finish_session",
  reopen: "fitness_reopen_session",
};

// POST /api/fitness/sessions — every workout write. Replayable: the session id
// (start) or op_id (others) is a durable receipt, so offline replays and
// lost acknowledgements never double-apply.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sessionBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { op, ...p } = parsed.data;

  const { data, error } =
    op === "delete" || op === "restore"
      ? await supabase.rpc("fitness_set_session_deleted", { p: { ...p, deleted: op === "delete" } })
      : await supabase.rpc(RPC[op], { p });

  if (error) {
    if (op === "start" && error.code === "23505" && `${error.message} ${error.details ?? ""}`.includes("fitness_sessions_one_open_key")) {
      const { data: open } = await supabase
        .from("fitness_sessions")
        .select("id, workout_name")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .is("deleted_at", null)
        .maybeSingle();
      return NextResponse.json({ error: "Finish or discard the open workout first", reason: "open_session", open }, { status: 409, headers: NO_STORE });
    }
    return fitnessRpcError(error);
  }
  return NextResponse.json(data, { headers: NO_STORE });
}
