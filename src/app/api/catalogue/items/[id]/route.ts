// src/app/api/catalogue/items/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogueItem, UpdateItemInput } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

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
    `
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as CatalogueItem);
}

// PATCH update item
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Omit<UpdateItemInput, "id">;

    const updates: Record<string, unknown> = {};

    if (body.category_id !== undefined) {
      if (body.category_id === null) {
        updates.category_id = null;
      } else {
        // Verify category exists
        const { data: category } = await supabase
          .from("catalogue_categories")
          .select("id")
          .eq("id", body.category_id)
          .eq("user_id", user.id)
          .single();

        if (!category) {
          return NextResponse.json(
            { error: "Category not found" },
            { status: 404 }
          );
        }
        updates.category_id = body.category_id;
      }
    }

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.color !== undefined) updates.color = body.color;
    if (body.image_url !== undefined) updates.image_url = body.image_url;
    if (body.is_pinned !== undefined) updates.is_pinned = body.is_pinned;
    if (body.is_favorite !== undefined) updates.is_favorite = body.is_favorite;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.metadata_json !== undefined)
      updates.metadata_json = body.metadata_json;
    if (body.progress_current !== undefined)
      updates.progress_current = body.progress_current;
    if (body.progress_target !== undefined)
      updates.progress_target = body.progress_target;
    if (body.progress_unit !== undefined)
      updates.progress_unit = body.progress_unit;
    if (body.next_due_date !== undefined)
      updates.next_due_date = body.next_due_date;
    if (body.frequency !== undefined) updates.frequency = body.frequency;
    if (body.position !== undefined) updates.position = body.position;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("catalogue_items")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        `
        *,
        category:catalogue_categories(id, name, icon, color),
        sub_items:catalogue_sub_items(*)
      `
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as CatalogueItem);
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
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
    // Soft delete
    const { error } = await supabase
      .from("catalogue_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Return the deleted item for undo functionality
  return NextResponse.json(existing);
}
