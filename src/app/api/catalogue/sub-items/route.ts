// src/app/api/catalogue/sub-items/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogueSubItem, CreateSubItemInput } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET sub-items for an item
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const itemId = req.nextUrl.searchParams.get("item_id");

  if (!itemId) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("catalogue_sub_items")
    .select("*")
    .eq("item_id", itemId)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching sub-items:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as CatalogueSubItem[], {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST create a new sub-item
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateSubItemInput;
    const { item_id, name, description, metadata_json } = body;

    if (!item_id || !name?.trim()) {
      return NextResponse.json(
        { error: "item_id and name are required" },
        { status: 400 }
      );
    }

    // Verify item exists and belongs to user
    const { data: item } = await supabase
      .from("catalogue_items")
      .select("id")
      .eq("id", item_id)
      .eq("user_id", user.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Get max position
    const { data: maxPos } = await supabase
      .from("catalogue_sub_items")
      .select("position")
      .eq("item_id", item_id)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPos?.position ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("catalogue_sub_items")
      .insert({
        user_id: user.id,
        item_id,
        name: name.trim(),
        description: description?.trim() || null,
        is_completed: false,
        position: nextPosition,
        metadata_json: metadata_json || {},
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating sub-item:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(created as CatalogueSubItem, { status: 201 });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
