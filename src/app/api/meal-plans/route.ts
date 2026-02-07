// src/app/api/meal-plans/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { MealPlanInsert } from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET meal plans (by date range, specific date, or specific IDs)
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");
  const singleDate = searchParams.get("date");
  const ids = searchParams.getAll("ids"); // Support ?ids=123&ids=456

  // Get user's household
  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .limit(1)
    .single();

  if (!household) {
    // No household = no meal plans (meal plans require household)
    return NextResponse.json([]);
  }

  // Build query with recipe join
  let query = supabase
    .from("meal_plans")
    .select(
      `*,
       recipe:recipes!meal_plans_recipe_id_fkey(
         id, name, description, image_url, category, cuisine, tags,
         prep_time_minutes, cook_time_minutes, difficulty,
         is_favorite, times_cooked, average_rating
       )`,
    )
    .eq("household_id", household.id);

  // Apply filters based on provided params
  if (ids.length > 0) {
    // Fetch specific meal plans by IDs
    query = query.in("id", ids);
  } else if (singleDate) {
    query = query.eq("planned_date", singleDate);
  } else if (startDate && endDate) {
    query = query.gte("planned_date", startDate).lte("planned_date", endDate);
  }

  query = query.order("planned_date", { ascending: true });

  const { data: mealPlans, error } = await query;

  if (error) {
    console.error("Error fetching meal plans:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(mealPlans, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST create a new meal plan
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's household (required for meal plans)
  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .limit(1)
    .single();

  if (!household) {
    return NextResponse.json(
      {
        error:
          "Meal plans require a household. Please set up household sharing first.",
      },
      { status: 400 },
    );
  }

  try {
    const body = (await req.json()) as MealPlanInsert;

    // Check if recipe exists and is accessible
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("id")
      .eq("id", body.recipe_id)
      .single();

    if (recipeError || !recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Check if there's already a meal plan for this date
    const { data: existing } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("household_id", household.id)
      .eq("planned_date", body.planned_date)
      .eq("meal_type", body.meal_type || "lunch")
      .single();

    if (existing) {
      // Update existing meal plan instead of creating new
      const { data: updatedPlan, error: updateError } = await supabase
        .from("meal_plans")
        .update({
          recipe_id: body.recipe_id,
          notes: body.notes,
          status: "planned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating meal plan:", updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json(updatedPlan);
    }

    // Create new meal plan
    const { data: mealPlan, error } = await supabase
      .from("meal_plans")
      .insert({
        user_id: user.id,
        household_id: household.id,
        recipe_id: body.recipe_id,
        planned_date: body.planned_date,
        meal_type: body.meal_type || "lunch",
        notes: body.notes,
        status: "planned",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating meal plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mealPlan, { status: 201 });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
