import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const packingSchema = z.object({
  name: z.string().min(1).max(300),
  // Kept during the owner's manual backfill of legacy items.
  category: z.string().max(100).nullish(),
  category_id: z.string().uuid().nullish(),
  quantity: z.number().int().positive().default(1),
  position: z.number().int().default(0),
  inventory_item_id: z.string().uuid().nullish(),
  catalogue_item_id: z.string().uuid().nullish(),
  assigned_to: z.string().uuid().nullish(),
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
    .from("trip_packing_items")
    .select("*, packing_category:trip_packing_category!trip_packing_items_category_id_fkey(*)")
    .eq("trip_id", id)
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
  const parsed = packingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  if (d.category_id) {
    const { data: category, error: categoryError } = await supabase
      .from("trip_packing_category")
      .select("id")
      .eq("id", d.category_id)
      .eq("trip_id", id)
      .maybeSingle();
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
    if (!category) return NextResponse.json({ error: "Category does not belong to this trip" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trip_packing_items")
    .insert({
      user_id: user.id,
      trip_id: id,
      name: d.name,
      category: d.category ?? null,
      category_id: d.category_id ?? null,
      quantity: d.quantity,
      position: d.position,
      inventory_item_id: d.inventory_item_id ?? null,
      catalogue_item_id: d.catalogue_item_id ?? null,
      assigned_to: d.assigned_to ?? null,
    })
    .select("*, packing_category:trip_packing_category!trip_packing_items_category_id_fkey(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
