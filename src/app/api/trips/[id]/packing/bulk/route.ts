import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  name: z.string().min(1).max(300),
  // Kept during the owner's manual backfill of legacy items.
  category: z.string().max(100).nullish(),
  category_id: z.string().uuid().nullish(),
  quantity: z.number().int().positive().default(1),
  position: z.number().int().default(0),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
});

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const categoryIds = [...new Set(parsed.data.items.flatMap((item) => item.category_id ? [item.category_id] : []))];
  if (categoryIds.length > 0) {
    const { data: categories, error: categoryError } = await supabase
      .from("trip_packing_category")
      .select("id")
      .eq("trip_id", id)
      .in("id", categoryIds);
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
    if (categories.length !== categoryIds.length) {
      return NextResponse.json({ error: "One or more categories do not belong to this trip" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("trip_packing_items")
    .insert(
      parsed.data.items.map((item) => ({
        user_id: user.id,
        trip_id: id,
        name: item.name,
        category: item.category ?? null,
        category_id: item.category_id ?? null,
        quantity: item.quantity,
        position: item.position,
      })),
    )
    .select("*, packing_category:trip_packing_category!trip_packing_items_category_id_fkey(*)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
