// src/app/api/catalogue/categories/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogueCategory, UpdateCategoryInput } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET single category
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
    .from("catalogue_categories")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as CatalogueCategory);
}

// PATCH update category
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
    const body = (await req.json()) as Omit<UpdateCategoryInput, "id">;

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.color !== undefined) updates.color = body.color;
    if (body.position !== undefined) updates.position = body.position;
    if (body.is_expanded !== undefined) updates.is_expanded = body.is_expanded;

    // Handle parent change (recalculate depth and path)
    if (body.parent_id !== undefined) {
      if (body.parent_id === id) {
        return NextResponse.json(
          { error: "Category cannot be its own parent" },
          { status: 400 }
        );
      }

      if (body.parent_id === null) {
        updates.parent_id = null;
        updates.depth = 0;
        updates.path = "/";
      } else {
        const { data: parent } = await supabase
          .from("catalogue_categories")
          .select("depth, path")
          .eq("id", body.parent_id)
          .eq("user_id", user.id)
          .single();

        if (!parent) {
          return NextResponse.json(
            { error: "Parent category not found" },
            { status: 404 }
          );
        }

        if (parent.depth >= 5) {
          return NextResponse.json(
            { error: "Maximum category depth (5) reached" },
            { status: 400 }
          );
        }

        updates.parent_id = body.parent_id;
        updates.depth = parent.depth + 1;
        updates.path = `${parent.path}${body.parent_id}/`;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("catalogue_categories")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as CatalogueCategory);
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// DELETE category (soft delete by setting archived_at)
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

  if (permanent) {
    // Permanently delete (items will have category_id set to null via ON DELETE SET NULL)
    const { error } = await supabase
      .from("catalogue_categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Soft delete
    const { error } = await supabase
      .from("catalogue_categories")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return new NextResponse(null, { status: 204 });
}
