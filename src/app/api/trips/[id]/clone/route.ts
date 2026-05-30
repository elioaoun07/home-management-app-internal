import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const cloneSchema = z.object({
  name: z.string().min(1).max(200),
  as_template: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = cloneSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: source } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!source) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const { data: newTrip, error: tripErr } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      destination_country_code: source.destination_country_code,
      destination_name: source.destination_name,
      currency: source.currency,
      scope: source.scope,
      notes: source.notes,
      is_template: parsed.data.as_template,
      status: "draft",
    })
    .select()
    .single();

  if (tripErr || !newTrip) return NextResponse.json({ error: tripErr?.message ?? "Clone failed" }, { status: 500 });

  const { data: places } = await supabase
    .from("trip_places")
    .select("*")
    .eq("trip_id", id)
    .eq("user_id", user.id);

  if (places?.length) {
    await supabase.from("trip_places").insert(
      places.map(({ id: _id, created_at: _c, updated_at: _u, trip_id: _t, ...rest }) => ({
        ...rest,
        user_id: user.id,
        trip_id: newTrip.id,
        scheduled_date: null,
        scheduled_time: null,
      })),
    );
  }

  const { data: packingItems } = await supabase
    .from("trip_packing_items")
    .select("*")
    .eq("trip_id", id)
    .eq("user_id", user.id);

  if (packingItems?.length) {
    await supabase.from("trip_packing_items").insert(
      packingItems.map(({ id: _id, created_at: _c, updated_at: _u, trip_id: _t, is_packed: _p, ...rest }) => ({
        ...rest,
        user_id: user.id,
        trip_id: newTrip.id,
        is_packed: false,
      })),
    );
  }

  return NextResponse.json(newTrip, { status: 201 });
}
