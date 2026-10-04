// src/app/api/catalogue/items/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import {
  applyMetadataPatch,
  catalogueItemPatchSchema,
  type Metadata,
  MetadataPatchError,
  metadataInverse,
  metadataOps,
  PATCH_SCALAR_KEYS,
} from "@/lib/catalogue/itemPatch";
import type { CatalogueItem } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const TRIMMED_TEXT = new Set(["name", "description", "notes"]);

// GET single item with details
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("catalogue_items")
    .select(
      `
      *,
      category:catalogue_categories(id, name, icon, color),
      sub_items:catalogue_sub_items(*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as CatalogueItem);
}

// PATCH update item — KIT-20 / Catalogue C02.
// Metadata is patched by key (metadata_set / metadata_unset; legacy
// metadata_json merges), so untouched keys survive. `expected_revision` makes
// a stale save return 409 with the current row instead of overwriting another
// device's edit. The response carries `inverse`: the patch that undoes this one.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = catalogueItemPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  let ops: { set: Metadata; unset: string[] };
  try {
    ops = metadataOps(body);
  } catch (err) {
    if (err instanceof MetadataPatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  const touchesMetadata = Object.keys(ops.set).length > 0 || ops.unset.length > 0;

  const { data: current, error: currentErr } = await supabase
    .from("catalogue_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (currentErr) {
    console.error("Error loading catalogue item:", currentErr);
    return NextResponse.json({ error: currentErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // `revision` is absent until 2026-10-04_catalogue-revision.sql is applied;
  // until then the stale-write check is skipped rather than failing every save.
  const currentRevision =
    typeof current.revision === "number" ? current.revision : null;
  if (
    body.expected_revision !== undefined &&
    currentRevision !== null &&
    body.expected_revision !== currentRevision
  ) {
    return NextResponse.json(
      { error: "Changed elsewhere", code: "stale_revision", current },
      { status: 409 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.category_id !== undefined && body.category_id !== null) {
    // The category must belong to this item's module.
    const { data: category } = await supabase
      .from("catalogue_categories")
      .select("id")
      .eq("id", body.category_id)
      .eq("module_id", current.module_id)
      .maybeSingle();
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
  }

  for (const key of PATCH_SCALAR_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    updates[key] =
      typeof value === "string" && TRIMMED_TEXT.has(key)
        ? value.trim() || (key === "name" ? value : null)
        : value;
  }
  if (body.status === "completed") updates.completed_at = new Date().toISOString();
  if (body.chore_category !== undefined) {
    const isChore = body.is_chore ?? current.is_chore;
    updates.chore_category = isChore ? body.chore_category || null : null;
  }
  if (touchesMetadata) {
    updates.metadata_json = applyMetadataPatch(current.metadata_json, ops.set, ops.unset);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  // Compare-and-set: when the caller pinned a revision, or the metadata merge
  // was computed from `current`, the write only lands if nobody changed the
  // row in between. Plain flag toggles (pin/favorite) stay last-write-wins.
  let write = supabase
    .from("catalogue_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);
  const guarded = body.expected_revision !== undefined || touchesMetadata;
  if (guarded && currentRevision !== null) {
    write = write.eq("revision", currentRevision);
  }

  const { data, error } = await write
    .select(
      `
      *,
      category:catalogue_categories(id, name, icon, color),
      sub_items:catalogue_sub_items(*)
    `,
    )
    .maybeSingle();

  if (error) {
    console.error("Error updating catalogue item:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    const { data: latest } = await supabase
      .from("catalogue_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return NextResponse.json(
      { error: "Changed elsewhere", code: "stale_revision", current: latest },
      { status: 409 },
    );
  }

  // Backfill is_chore on all items previously activated from this catalogue template
  if (body.is_chore !== undefined) {
    await supabase
      .from("items")
      .update({ is_chore: body.is_chore })
      .eq("source_catalogue_item_id", id)
      .eq("user_id", user.id);
  }

  // Inverse: prior values of every scalar written + the metadata inverse,
  // guarded by the revision this write produced.
  const inverse: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (key !== "metadata_json") inverse[key] = current[key] ?? null;
  }
  if (touchesMetadata) {
    const inv = metadataInverse(current.metadata_json, ops.set, ops.unset);
    if (Object.keys(inv.set).length > 0) inverse.metadata_set = inv.set;
    if (inv.unset.length > 0) inverse.metadata_unset = inv.unset;
  }
  if (typeof data.revision === "number") inverse.expected_revision = data.revision;

  return NextResponse.json({ ...(data as CatalogueItem), inverse });
}

// DELETE item
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  // Get the item first for undo purposes
  const { data: existing } = await supabase
    .from("catalogue_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (permanent) {
    const { error } = await supabase
      .from("catalogue_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Soft delete (Recycle Bin)
    const { error } = await supabase
      .from("catalogue_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Return the deleted item for undo functionality
  return NextResponse.json(existing);
}
