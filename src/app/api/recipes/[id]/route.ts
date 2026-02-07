// src/app/api/recipes/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { RecipeUpdate } from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET a single recipe by ID (includes full details)
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

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    console.error("Error fetching recipe:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(recipe);
}

// PATCH update a recipe
export async function PATCH(
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

  try {
    const body = (await req.json()) as RecipeUpdate;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are explicitly provided
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.source_url !== undefined) updateData.source_url = body.source_url;
    if (body.ingredients !== undefined)
      updateData.ingredients = body.ingredients;
    if (body.steps !== undefined) updateData.steps = body.steps;
    if (body.prep_time_minutes !== undefined)
      updateData.prep_time_minutes = body.prep_time_minutes;
    if (body.cook_time_minutes !== undefined)
      updateData.cook_time_minutes = body.cook_time_minutes;
    if (body.servings !== undefined) updateData.servings = body.servings;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.cuisine !== undefined) updateData.cuisine = body.cuisine;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.feedback !== undefined) updateData.feedback = body.feedback;
    if (body.is_favorite !== undefined)
      updateData.is_favorite = body.is_favorite;
    if (body.ai_generated !== undefined)
      updateData.ai_generated = body.ai_generated;
    if (body.ai_generation_prompt !== undefined)
      updateData.ai_generation_prompt = body.ai_generation_prompt;

    const { data: recipe, error } = await supabase
      .from("recipes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating recipe:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(recipe);
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

// DELETE a recipe (soft delete)
export async function DELETE(
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

  const { error } = await supabase
    .from("recipes")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting recipe:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
