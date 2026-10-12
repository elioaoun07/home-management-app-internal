import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  commandSchema,
  transition,
  type RunState,
} from "@/features/era/execution/state";
import { runArtifacts } from "@/features/era/execution/projection";

export const dynamic = "force-dynamic";
const patchSchema = z
  .object({ version: z.number().int().nonnegative(), command: commandSchema })
  .strict();
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const db = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!id.success || !body.success)
    return NextResponse.json(
      { error: !body.success ? body.error.flatten() : "Invalid id" },
      { status: 400 },
    );
  const { data: run, error: readError } = await db
    .from("era_runs")
    .select("*")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError)
    return NextResponse.json(
      { error: "Couldn't load execution" },
      { status: 503 },
    );
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.version !== body.data.version)
    return NextResponse.json({ error: "Execution changed" }, { status: 409 });
  let state: RunState;
  try {
    state = transition(run.state as RunState, body.data.command, Date.now());
  } catch {
    return NextResponse.json(
      { error: "Execution changed. Refresh and resume." },
      { status: 409 },
    );
  }
  const { data, error } = await db.rpc("save_era_run", {
    p_id: id.data,
    p_conversation_id: run.conversation_id,
    p_version: body.data.version,
    p_state: state,
    p_artifacts: runArtifacts(state),
  });
  if (error)
    return NextResponse.json(
      { error: "Couldn't save execution" },
      { status: ["23505", "40001"].includes(error.code) ? 409 : 503 },
    );
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
