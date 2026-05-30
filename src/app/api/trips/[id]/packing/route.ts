import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const packingSchema = z.object({
  name: z.string().min(1).max(300),
  category: z.string().max(100).nullish(),
  quantity: z.number().int().positive().default(1),
  position: z.number().int().default(0),
  inventory_item_id: z.string().uuid().nullish(),
  catalogue_item_id: z.string().uuid().nullish(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("trip_packing_items")
    .select("*")
    .eq("trip_id", id)
    .eq("user_id", user.id)
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

  const body = await req.json();
  const parsed = packingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const { data, error } = await supabase
    .from("trip_packing_items")
    .insert({
      user_id: user.id,
      trip_id: id,
      name: d.name,
      category: d.category ?? null,
      quantity: d.quantity,
      position: d.position,
      inventory_item_id: d.inventory_item_id ?? null,
      catalogue_item_id: d.catalogue_item_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
