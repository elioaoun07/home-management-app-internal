import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/healthcare — the whole health page in ONE call (Hard Rule 21).
// get_health_bundle() is SECURITY DEFINER: it returns own profiles (+ their
// allergies/conditions/vaccines) and the partner's shared_with_household
// profiles, resolving the household link internally (Hard Rule 13).
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_health_bundle");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { bundle: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
