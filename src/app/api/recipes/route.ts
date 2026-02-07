// src/app/api/recipes/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { RecipeInsert } from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET all recipes for the current user (with optional filters)
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const cuisine = searchParams.get("cuisine");
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);
  const difficulty = searchParams.get("difficulty");
  const favoritesOnly = searchParams.get("favorites") === "true";
  const maxPrepTime = searchParams.get("maxPrepTime");
  const maxCookTime = searchParams.get("maxCookTime");

  // Get user's household to include shared recipes
  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .limit(1)
    .single();

  // Build query
  let query = supabase
    .from("recipes")
    .select(
      `id, name, description, image_url, category, cuisine, tags,
       prep_time_minutes, cook_time_minutes, difficulty,
       is_favorite, times_cooked, average_rating`,
    )
    .is("archived_at", null);

  // Filter by ownership (own recipes + household shared)
  if (household) {
    query = query.or(`user_id.eq.${user.id},household_id.eq.${household.id}`);
  } else {
    query = query.eq("user_id", user.id);
  }

  // Apply filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (cuisine) {
    query = query.eq("cuisine", cuisine);
  }
  if (tags && tags.length > 0) {
    query = query.overlaps("tags", tags);
  }
  if (difficulty) {
    query = query.eq("difficulty", difficulty);
  }
  if (favoritesOnly) {
    query = query.eq("is_favorite", true);
  }
  if (maxPrepTime) {
    query = query.lte("prep_time_minutes", parseInt(maxPrepTime));
  }
  if (maxCookTime) {
    query = query.lte("cook_time_minutes", parseInt(maxCookTime));
  }

  // Order by favorites first, then by name
  query = query.order("is_favorite", { ascending: false }).order("name");

  const { data: recipes, error } = await query;

  if (error) {
    console.error("Error fetching recipes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(recipes, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST create a new recipe
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<RecipeInsert>;

    // Get household ID if user wants to share
    let householdId = body.household_id;
    if (householdId === undefined) {
      // Default: share with household if in one
      const { data: household } = await supabase
        .from("household_links")
        .select("id")
        .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .eq("active", true)
        .limit(1)
        .single();
      householdId = household?.id || null;
    }

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({
        user_id: user.id,
        household_id: householdId,
        name: body.name || "Untitled Recipe",
        description: body.description,
        image_url: body.image_url,
        source_url: body.source_url,
        ingredients: body.ingredients || [],
        steps: body.steps || [],
        prep_time_minutes: body.prep_time_minutes,
        cook_time_minutes: body.cook_time_minutes,
        servings: body.servings || 4,
        difficulty: body.difficulty || "medium",
        category: body.category,
        cuisine: body.cuisine,
        tags: body.tags || [],
        ai_generated: body.ai_generated || false,
        ai_generation_prompt: body.ai_generation_prompt,
        feedback: body.feedback || [],
        is_favorite: body.is_favorite || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating recipe:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(recipe, { status: 201 });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
