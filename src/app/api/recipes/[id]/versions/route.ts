// src/app/api/recipes/[id]/versions/route.ts
// CRUD for recipe versions

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: List all versions for a recipe
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recipe_versions")
    .select("*")
    .eq("recipe_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create a new version (and optionally set it as active)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    version_label: string;
    source: string;
    is_active?: boolean;
    ingredients?: unknown[];
    steps?: unknown[];
    prep_time_minutes?: number | null;
    cook_time_minutes?: number | null;
    servings?: number;
    difficulty?: string;
    category?: string | null;
    cuisine?: string | null;
    tags?: string[];
    description?: string | null;
    ai_prompt?: string | null;
    ai_reasoning?: string | null;
    tokens_used?: number | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.version_label) {
    return NextResponse.json(
      { error: "version_label is required" },
      { status: 400 },
    );
  }

  // If setting as active, deactivate all other versions first
  if (body.is_active) {
    await supabase
      .from("recipe_versions")
      .update({ is_active: false })
      .eq("recipe_id", id);
  }

  const { data: version, error } = await supabase
    .from("recipe_versions")
    .insert({
      recipe_id: id,
      user_id: user.id,
      version_label: body.version_label,
      source: body.source || "user",
      is_active: body.is_active ?? false,
      ingredients: body.ingredients || [],
      steps: body.steps || [],
      prep_time_minutes: body.prep_time_minutes ?? null,
      cook_time_minutes: body.cook_time_minutes ?? null,
      servings: body.servings ?? 4,
      difficulty: body.difficulty || "medium",
      category: body.category ?? null,
      cuisine: body.cuisine ?? null,
      tags: body.tags || [],
      description: body.description ?? null,
      ai_prompt: body.ai_prompt ?? null,
      ai_reasoning: body.ai_reasoning ?? null,
      tokens_used: body.tokens_used ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If active, update the recipe's active_version_id
  if (body.is_active && version) {
    await supabase
      .from("recipes")
      .update({
        active_version_id: version.id,
        // Also update the recipe's own fields to match
        ingredients: body.ingredients || [],
        steps: body.steps || [],
        prep_time_minutes: body.prep_time_minutes ?? null,
        cook_time_minutes: body.cook_time_minutes ?? null,
        servings: body.servings ?? 4,
        difficulty: body.difficulty || "medium",
        category: body.category ?? null,
        cuisine: body.cuisine ?? null,
        tags: body.tags || [],
        description: body.description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return NextResponse.json(version, { status: 201 });
}
