import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  place_type: z.enum(["hotel", "activity", "restaurant", "attraction", "transport", "note", "other"]).nullish(),
  url: z.string().url().max(2000).nullish(),
  description: z.string().max(2000).nullish(),
  cost: z.number().nonnegative().nullish(),
  currency: z.string().max(10).nullish(),
  priority: z.enum(["mandatory", "flexible", "wishlist"]).optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  is_booked: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; placeId: string }> },
) {
  const { id, placeId } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from("trip_places")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", placeId)
    .eq("trip_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; placeId: string }> },
) {
  const { id, placeId } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("trip_places")
    .delete()
    .eq("id", placeId)
    .eq("trip_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
