// Outfits: list (with outfit_items embed) + create from a slot map.
// Personal per user by locked design D4 — NO household_links here, ever.
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SlotEnum = z.enum(["top", "bottom", "shoes", "outerwear", "accessory", "headwear"]);

const createOutfitSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    occasion_hint: z.string().trim().max(60).nullish(),
    notes: z.string().trim().max(500).nullish(),
    items: z
      .array(z.object({ slot: SlotEnum, item_id: z.string().uuid() }))
      .min(1)
      .max(6),
  })
  .refine(
    (o) => new Set(o.items.map((i) => i.slot)).size === o.items.length,
    { message: "One garment per slot" },
  );

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";

  let query = supabase
    .from("outfits")
    .select("*, outfit_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { outfits: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = createOutfitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, occasion_hint, notes, items } = parsed.data;

    // Every referenced garment must be the caller's.
    const itemIds = items.map((i) => i.item_id);
    const { data: owned, error: ownedErr } = await supabase
      .from("wardrobe_items")
      .select("id")
      .eq("user_id", user.id)
      .in("id", itemIds);
    if (ownedErr) return NextResponse.json({ error: ownedErr.message }, { status: 500 });
    if ((owned ?? []).length !== new Set(itemIds).size) {
      return NextResponse.json({ error: "Unknown garment in outfit" }, { status: 400 });
    }

    const { data: outfit, error: outfitErr } = await supabase
      .from("outfits")
      .insert({ user_id: user.id, name, occasion_hint, notes })
      .select()
      .single();

    if (outfitErr) {
      if (outfitErr.code === "23505") {
        return NextResponse.json({ error: "Outfit already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: outfitErr.message }, { status: 500 });
    }

    // Denormalized user_id set server-side (flat RLS on the junction — Hard Rule 20).
    const { data: junction, error: itemsErr } = await supabase
      .from("outfit_items")
      .insert(
        items.map((i) => ({
          user_id: user.id,
          outfit_id: outfit.id,
          item_id: i.item_id,
          slot: i.slot,
        })),
      )
      .select();

    if (itemsErr) {
      // Roll the outfit back so a failed insert never leaves an empty shell.
      await supabase.from("outfits").delete().eq("id", outfit.id).eq("user_id", user.id);
      if (itemsErr.code === "23505") {
        return NextResponse.json({ error: "One garment per slot" }, { status: 409 });
      }
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { outfit: { ...outfit, outfit_items: junction ?? [] } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create outfit" }, { status: 500 });
  }
}
