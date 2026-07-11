import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const placeSchema = z.object({
  name: z.string().min(1).max(300),
  place_type: z.enum(["hotel", "activity", "restaurant", "attraction", "transport", "note", "other"]).nullish(),
  url: z.string().url().max(2000).nullish(),
  description: z.string().max(2000).nullish(),
  cost: z.number().nonnegative().nullish(),
  currency: z.string().max(10).nullish(),
  priority: z.enum(["mandatory", "flexible", "wishlist"]).default("flexible"),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  is_booked: z.boolean().default(false),
  position: z.number().int().default(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("trip_places")
    .select("*")
    .eq("trip_id", id)
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("position");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = placeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const { data, error } = await supabase
    .from("trip_places")
    .insert({
      user_id: user.id,
      trip_id: id,
      name: d.name,
      place_type: d.place_type ?? null,
      url: d.url ?? null,
      description: d.description ?? null,
      cost: d.cost ?? null,
      currency: d.currency ?? null,
      priority: d.priority,
      scheduled_date: d.scheduled_date ?? null,
      scheduled_time: d.scheduled_time ?? null,
      is_booked: d.is_booked,
      position: d.position,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
