// Single outfit: update metadata / replace composition / archive / delete.
// Personal per user by locked design D4 — NO household_links here, ever.
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SlotEnum = z.enum(["top", "bottom", "shoes", "outerwear", "accessory", "headwear"]);

const updateOutfitSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    occasion_hint: z.string().trim().max(60).nullish(),
    notes: z.string().trim().max(500).nullish(),
    archived: z.boolean().optional(),
    /** Full replacement of the composition when present. */
    items: z
      .array(z.object({ slot: SlotEnum, item_id: z.string().uuid() }))
      .min(1)
      .max(6)
      .optional(),
  })
  .refine(
    (o) => !o.items || new Set(o.items.map((i) => i.slot)).size === o.items.length,
    { message: "One garment per slot" },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const parsed = updateOutfitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { archived, items, ...fields } = parsed.data;

    const update: Record<string, unknown> = {
      ...fields,
      updated_at: new Date().toISOString(),
    };
    if (archived !== undefined) {
      update.archived_at = archived ? new Date().toISOString() : null;
    }

    const { data: outfit, error } = await supabase
      .from("outfits")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!outfit) return NextResponse.json({ error: "Outfit not found" }, { status: 404 });

    if (items) {
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

      // Replace-all: delete then insert. Not transactional over PostgREST — a
      // failed insert leaves the outfit empty, surfaced to the client as 500
      // so it can refetch and the user can re-save.
      const { error: delErr } = await supabase
        .from("outfit_items")
        .delete()
        .eq("outfit_id", id)
        .eq("user_id", user.id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

      const { error: insErr } = await supabase.from("outfit_items").insert(
        items.map((i) => ({
          user_id: user.id,
          outfit_id: id,
          item_id: i.item_id,
          slot: i.slot,
        })),
      );
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const { data: full, error: fullErr } = await supabase
      .from("outfits")
      .select("*, outfit_items(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fullErr) return NextResponse.json({ error: fullErr.message }, { status: 500 });

    return NextResponse.json(
      { outfit: full },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to update outfit" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from("outfits")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Outfit not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
