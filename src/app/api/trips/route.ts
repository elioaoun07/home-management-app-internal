import { getActiveHouseholdPartnerId } from "@/lib/accountAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeTemplates = searchParams.get("templates") === "true";
  const own = searchParams.get("own") === "true";

  // Partner trips are only visible when scope="household" — solo trips stay private.
  let query = supabase.from("trips").select("*").neq("status", "archived");
  if (own) {
    query = query.eq("user_id", user.id);
  } else {
    const partnerId = await getActiveHouseholdPartnerId(supabase, user.id);
    query = partnerId
      ? query.or(`user_id.eq.${user.id},and(user_id.eq.${partnerId},scope.eq.household)`)
      : query.eq("user_id", user.id);
  }

  if (!includeTemplates) {
    query = query.eq("is_template", false);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withOwnership = (data ?? []).map((trip) => ({
    ...trip,
    is_owner: trip.user_id === user.id,
  }));

  return NextResponse.json(withOwnership, { headers: { "Cache-Control": "no-store" } });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  destination_country_code: z.string().max(10).nullish(),
  destination_name: z.string().max(200).nullish(),
  currency: z.string().max(10).default("USD"),
  scope: z.enum(["solo", "household"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(2000).nullish(),
  is_template: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      name: d.name,
      destination_country_code: d.destination_country_code ?? null,
      destination_name: d.destination_name ?? null,
      currency: d.currency,
      scope: d.scope,
      start_date: d.start_date ?? null,
      end_date: d.end_date ?? null,
      notes: d.notes ?? null,
      is_template: d.is_template,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
