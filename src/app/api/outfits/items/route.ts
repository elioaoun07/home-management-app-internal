// Wardrobe garments: list + create.
// Personal per user by locked design D4 — NO household_links here, ever.
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SLOT_VALUES = [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
  "headwear",
] as const;

const SlotEnum = z.enum(SLOT_VALUES);
const SeasonEnum = z.enum(["spring", "summer", "fall", "winter"]);
const FormalityEnum = z.enum(["casual", "smart-casual", "business", "formal", "athletic"]);

const createItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slot: SlotEnum,
  subcategory: z.string().trim().max(60).nullish(),
  colors: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
  brand: z.string().trim().max(60).nullish(),
  size: z.string().trim().max(30).nullish(),
  season: z.array(SeasonEnum).max(4).default([]),
  formality: FormalityEnum.nullish(),
  style_tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  fit_note: z.string().trim().max(500).nullish(),
  ai_tagged: z.boolean().default(false),
  ai_confidence: z.number().min(0).max(1).nullish(),
});

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slot = req.nextUrl.searchParams.get("slot");
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";

  let query = supabase
    .from("wardrobe_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (slot && SlotEnum.safeParse(slot).success) query = query.eq("slot", slot);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { items: data ?? [] },
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
    const parsed = createItemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("wardrobe_items")
      .insert({ user_id: user.id, ...parsed.data })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Garment already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { item: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create garment" }, { status: 500 });
  }
}
