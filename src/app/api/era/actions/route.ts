// GET/POST for ERA Artifacts (era_actions) — what ERA itself created,
// updated or deleted via chat/voice, shown on the /era Artifacts tab.
// POST takes the adapter's `artifacts` (src/lib/era/artifacts.ts); the deep
// link is built here from entity + id, never accepted from the client.
// "Today" filtering happens client-side (useEraActivity) against the
// caller's local day, not here — the server has no reliable local timezone
// to filter by (see timezone-handling skill).
import { eraArtifactHref, eraArtifactSchema } from "@/lib/era/artifacts";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateArtifactsSchema = z.object({
  artifacts: z.array(eraArtifactSchema).min(1).max(20),
});

async function getHouseholdId(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("era_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ actions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateArtifactsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const householdId = await getHouseholdId(supabase, user.id);

  const { data, error } = await supabase
    .from("era_actions")
    .insert(
      parsed.data.artifacts.map((a) => ({
        user_id: user.id,
        household_id: householdId,
        action: a.action,
        entity_type: a.entity,
        entity_id: a.id,
        title: a.title,
        route: eraArtifactHref(a),
      })),
    )
    .select();

  if (error) {
    console.error("era_actions insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ actions: data }, { status: 201 });
}
