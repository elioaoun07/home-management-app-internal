// src/app/api/catalogue/categories/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogueCategory, CreateCategoryInput } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET all categories (optionally filtered by module_id)
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const moduleId = req.nextUrl.searchParams.get("module_id");
  const includeArchived =
    req.nextUrl.searchParams.get("include_archived") === "true";

  let query = supabase
    .from("catalogue_categories")
    .select(
      `
      *,
      items:catalogue_items(count)
    `,
    )
    .order("position", { ascending: true });

  if (moduleId) {
    query = query.eq("module_id", moduleId);
  }

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform counts
  const categoriesWithCounts = data.map((c) => ({
    ...c,
    item_count: c.items?.[0]?.count ?? 0,
    items: undefined,
  }));

  return NextResponse.json(categoriesWithCounts as CatalogueCategory[], {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST create a new category
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateCategoryInput;
    const { module_id, name, description, parent_id, icon, color, is_public } =
      body;

    if (!module_id || !name?.trim()) {
      return NextResponse.json(
        { error: "module_id and name are required" },
        { status: 400 },
      );
    }

    // Verify module exists and belongs to user
    const { data: module } = await supabase
      .from("catalogue_modules")
      .select("id")
      .eq("id", module_id)
      .eq("user_id", user.id)
      .single();

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Calculate depth and path if parent_id is provided
    let depth = 0;
    let path = "/";

    if (parent_id) {
      const { data: parent } = await supabase
        .from("catalogue_categories")
        .select("depth, path, name")
        .eq("id", parent_id)
        .eq("user_id", user.id)
        .single();

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 },
        );
      }

      if (parent.depth >= 5) {
        return NextResponse.json(
          { error: "Maximum category depth (5) reached" },
          { status: 400 },
        );
      }

      depth = parent.depth + 1;
      path = `${parent.path}${parent_id}/`;
    }

    // Get max position for this level
    let posQuery = supabase
      .from("catalogue_categories")
      .select("position")
      .eq("module_id", module_id)
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1);

    if (parent_id) {
      posQuery = posQuery.eq("parent_id", parent_id);
    } else {
      posQuery = posQuery.is("parent_id", null);
    }

    const { data: maxPos } = await posQuery.single();
    const nextPosition = (maxPos?.position ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("catalogue_categories")
      .insert({
        user_id: user.id,
        module_id,
        name: name.trim(),
        description: description?.trim() || null,
        parent_id: parent_id || null,
        depth,
        path,
        icon: icon || "tag",
        color: color || null,
        position: nextPosition,
        is_expanded: true,
        is_public: is_public ?? true, // Default to public
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating category:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(created as CatalogueCategory, { status: 201 });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
