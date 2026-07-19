// Single wardrobe garment: update tags / archive / delete (incl. storage cleanup).
// Personal per user by locked design D4 — NO household_links here, ever.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BUCKET = "wardrobe";

const SlotEnum = z.enum(["top", "bottom", "shoes", "outerwear", "accessory", "headwear"]);
const SeasonEnum = z.enum(["spring", "summer", "fall", "winter"]);
const FormalityEnum = z.enum(["casual", "smart-casual", "business", "formal", "athletic"]);

const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slot: SlotEnum.optional(),
  subcategory: z.string().trim().max(60).nullish(),
  colors: z.array(z.string().trim().min(1).max(30)).max(6).optional(),
  brand: z.string().trim().max(60).nullish(),
  size: z.string().trim().max(30).nullish(),
  season: z.array(SeasonEnum).max(4).optional(),
  formality: FormalityEnum.nullish(),
  style_tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  fit_note: z.string().trim().max(500).nullish(),
  /** true → archive now; false → unarchive. */
  archived: z.boolean().optional(),
});

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
    const parsed = updateItemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { archived, ...fields } = parsed.data;
    const update: Record<string, unknown> = {
      ...fields,
      updated_at: new Date().toISOString(),
    };
    if (archived !== undefined) {
      update.archived_at = archived ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("wardrobe_items")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Garment not found" }, { status: 404 });

    return NextResponse.json(
      { item: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to update garment" }, { status: 500 });
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

  const { data: item } = await supabase
    .from("wardrobe_items")
    .select("id, image_path, cutout_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 });

  // Row first (outfit_items cascade), then storage — an orphaned file is
  // recoverable noise, an orphaned DB path pointing nowhere is a broken UI.
  const { error: deleteErr } = await supabase
    .from("wardrobe_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  const paths = [item.image_path, item.cutout_path].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  if (paths.length > 0) {
    await supabaseAdmin().storage.from(BUCKET).remove(paths);
  }

  return NextResponse.json({ success: true });
}
