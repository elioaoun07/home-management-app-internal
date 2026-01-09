// src/app/api/catalogue/items/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { CatalogueItem, CreateItemInput } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET items with filters
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const moduleId = searchParams.get("module_id");
  const categoryId = searchParams.get("category_id");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const isPinned = searchParams.get("is_pinned");
  const isFavorite = searchParams.get("is_favorite");
  const search = searchParams.get("search");
  const includeArchived = searchParams.get("include_archived") === "true";
  const limit = searchParams.get("limit");

  let query = supabase
    .from("catalogue_items")
    .select(
      `
      *,
      category:catalogue_categories(id, name, icon, color),
      sub_items:catalogue_sub_items(*)
    `
    )
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("position", { ascending: true });

  if (moduleId) {
    query = query.eq("module_id", moduleId);
  }

  if (categoryId) {
    if (categoryId === "uncategorized") {
      query = query.is("category_id", null);
    } else {
      query = query.eq("category_id", categoryId);
    }
  }

  if (status) {
    const statuses = status.split(",");
    if (statuses.length === 1) {
      query = query.eq("status", status);
    } else {
      query = query.in("status", statuses);
    }
  }

  if (priority) {
    const priorities = priority.split(",");
    if (priorities.length === 1) {
      query = query.eq("priority", priority);
    } else {
      query = query.in("priority", priorities);
    }
  }

  if (isPinned === "true") {
    query = query.eq("is_pinned", true);
  }

  if (isFavorite === "true") {
    query = query.eq("is_favorite", true);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  if (limit) {
    query = query.limit(parseInt(limit, 10));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as CatalogueItem[], {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST create a new item
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateItemInput;
    const {
      module_id,
      category_id,
      name,
      description,
      notes,
      status,
      priority,
      icon,
      color,
      image_url,
      tags,
      metadata_json,
      progress_current,
      progress_target,
      progress_unit,
      next_due_date,
      frequency,
    } = body;

    if (!module_id || !name?.trim()) {
      return NextResponse.json(
        { error: "module_id and name are required" },
        { status: 400 }
      );
    }

    // Verify module exists
    const { data: module } = await supabase
      .from("catalogue_modules")
      .select("id")
      .eq("id", module_id)
      .eq("user_id", user.id)
      .single();

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Verify category if provided
    if (category_id) {
      const { data: category } = await supabase
        .from("catalogue_categories")
        .select("id")
        .eq("id", category_id)
        .eq("user_id", user.id)
        .single();

      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        );
      }
    }

    // Get max position
    let posQuery = supabase
      .from("catalogue_items")
      .select("position")
      .eq("module_id", module_id)
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1);

    if (category_id) {
      posQuery = posQuery.eq("category_id", category_id);
    } else {
      posQuery = posQuery.is("category_id", null);
    }

    const { data: maxPos } = await posQuery.single();
    const nextPosition = (maxPos?.position ?? -1) + 1;

    const { data: created, error } = await supabase
      .from("catalogue_items")
      .insert({
        user_id: user.id,
        module_id,
        category_id: category_id || null,
        name: name.trim(),
        description: description?.trim() || null,
        notes: notes?.trim() || null,
        status: status || "active",
        priority: priority || "normal",
        icon: icon || null,
        color: color || null,
        image_url: image_url || null,
        position: nextPosition,
        is_pinned: false,
        is_favorite: false,
        tags: tags || [],
        metadata_json: metadata_json || {},
        progress_current: progress_current ?? null,
        progress_target: progress_target ?? null,
        progress_unit: progress_unit || null,
        next_due_date: next_due_date || null,
        frequency: frequency || null,
      })
      .select(
        `
        *,
        category:catalogue_categories(id, name, icon, color)
      `
      )
      .single();

    if (error) {
      console.error("Error creating item:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(created as CatalogueItem, { status: 201 });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
