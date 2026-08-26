// GET/POST for the ERA Activity log (era_actions) — what ERA itself created
// or updated via chat/voice, shown on the /era Top View's Activity card.
// "Today" filtering happens client-side (useEraActivity) against the
// caller's local day, not here — the server has no reliable local timezone
// to filter by (see timezone-handling skill).
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateActionSchema = z.object({
  action: z.enum(["created", "updated"]),
  entity_type: z.enum([
    "reminder",
    "transaction",
    "transfer",
    "debt",
    "meal_plan",
    "memory",
  ]),
  entity_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  route: z.string().trim().min(1).max(300),
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
  const parsed = CreateActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const householdId = await getHouseholdId(supabase, user.id);

  const { data, error } = await supabase
    .from("era_actions")
    .insert({
      user_id: user.id,
      household_id: householdId,
      action: parsed.data.action,
      entity_type: parsed.data.entity_type,
      entity_id: parsed.data.entity_id ?? null,
      title: parsed.data.title,
      route: parsed.data.route,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ action: data }, { status: 201 });
}
