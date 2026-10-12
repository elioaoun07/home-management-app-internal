import { planActionBodySchema } from "@/lib/fitness/contracts";
import { planFingerprint, validatePtPlan } from "@/lib/fitness/ptPlan";
import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST /api/fitness/plans/[id] — one transactional RPC per action:
// version | revert-version | review | activate | deactivate | delete |
// pause | resume | archive | restore. Each carries an op_id receipt.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
  const parsed = planActionBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  let result;
  switch (body.action) {
    case "version": {
      const validation = validatePtPlan(body.content);
      if (!validation.ok) return NextResponse.json({ error: "Plan has structural errors", errors: validation.errors }, { status: 400 });
      result = await supabase.rpc("fitness_add_plan_version", {
        p_op: body.op_id,
        p_plan: id,
        p: {
          name: validation.plan.name,
          fingerprint: await planFingerprint(validation.plan),
          source_text: body.source_text ?? null,
          content: validation.plan,
          issues: validation.issues,
        },
      });
      break;
    }
    case "revert-version":
      result = await supabase.rpc("fitness_revert_plan_version", { p_op: body.op_id, p_plan: id, p_version: body.version });
      break;
    case "review":
      result = await supabase.rpc("fitness_review_plan", { p_op: body.op_id, p_plan: id, p_ack: body.acknowledged });
      break;
    case "activate":
      // Creates Schedule items through create_item_complete (SCH-24); the
      // migration refuses to install without it, so there is no partial path.
      result = await supabase.rpc("fitness_activate_plan", { p_op: body.op_id, p_plan: id, p_week: body.week, p_tz: body.timezone });
      break;
    case "deactivate":
      result = await supabase.rpc("fitness_deactivate_plan", { p_op: body.op_id, p_plan: id });
      break;
    case "delete":
      result = await supabase.rpc("fitness_delete_plan", { p_op: body.op_id, p_plan: id });
      break;
    default:
      result = await supabase.rpc("fitness_set_plan_state", {
        p_op: body.op_id,
        p_plan: id,
        p_action: body.action,
        p_local_date: body.local_date,
      });
  }
  if (result.error) return fitnessRpcError(result.error);
  return NextResponse.json(result.data, { headers: NO_STORE });
}
