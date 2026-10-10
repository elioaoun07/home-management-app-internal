// GET/POST for ERA Artifacts (era_actions) — what ERA itself created,
// updated or deleted via chat/voice, shown on the /era Artifacts tab.
// POST takes the adapter's `artifacts` (src/lib/era/artifacts.ts); the deep
// link is built here from entity + id, never accepted from the client.
// Day bucketing happens client-side (useEraArtifacts) against the caller's
// local day; the server only ever sees UTC instants (see timezone-handling skill).
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

// ?from=&to= (ISO instants, the caller's local-day bounds) → that day's rows.
// ?view=days → every artifact timestamp, so the client can bucket them into
// its own local days and jump between the days that have any.
const ListQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  view: z.literal("days").optional(),
});

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = ListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ error: q.error.flatten() }, { status: 400 });
  const { from, to, view } = q.data;

  if (view === "days") {
    const { data, error } = await supabase
      .from("era_actions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ days: (data ?? []).map((r) => r.created_at as string) });
  }

  let query = supabase.from("era_actions").select("*").order("created_at", { ascending: false });
  if (from && to) {
    query = query.gte("created_at", from).lt("created_at", to).limit(200);
  } else {
    query = query.limit(30);
  }
  const { data, error } = await query;

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
