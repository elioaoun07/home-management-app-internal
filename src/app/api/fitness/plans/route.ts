import { importPlanBodySchema } from "@/lib/fitness/contracts";
import { planFingerprint, validatePtPlan } from "@/lib/fitness/ptPlan";
import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/fitness/plans — import a PTPlanV1 as an inactive plan (version 1).
// The content is validated again here, independently of the client and of
// the AI's own issues array. Never creates Schedule items.
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = importPlanBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const validation = validatePtPlan(parsed.data.content);
  if (!validation.ok) return NextResponse.json({ error: "Plan has structural errors", errors: validation.errors }, { status: 400 });

  const fingerprint = await planFingerprint(validation.plan);
  const { data, error } = await supabase.rpc("fitness_import_plan", {
    p_op: parsed.data.op_id,
    p: {
      name: validation.plan.name,
      fingerprint,
      source_text: parsed.data.source_text ?? null,
      content: validation.plan,
      issues: validation.issues,
    },
  });
  if (error) {
    if (error.code === "23505" && `${error.message} ${error.details ?? ""}`.includes("fitness_plans_fingerprint_key")) {
      const { data: existing } = await supabase
        .from("fitness_plans")
        .select("id, name, status")
        .eq("user_id", user.id)
        .eq("content_fingerprint", fingerprint)
        .maybeSingle();
      return NextResponse.json({ error: "Plan already imported", reason: "duplicate", existing }, { status: 409, headers: NO_STORE });
    }
    return fitnessRpcError(error);
  }
  return NextResponse.json(data, { status: 201, headers: NO_STORE });
}
