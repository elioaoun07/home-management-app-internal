import { preferencesBodySchema } from "@/lib/fitness/contracts";
import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/fitness/preferences — sharing, effects, sound, cosmetic.
// share_summary=false revokes the partner's summary on their next read.
export async function PATCH(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = preferencesBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("fitness_preferences")
    .upsert({ user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return fitnessRpcError(error);
  return NextResponse.json({ preferences: data }, { headers: NO_STORE });
}
