// src/app/api/meal-plans/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { MealPlanUpdate } from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET a single meal plan by ID
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

  const { data: mealPlan, error } = await supabase
    .from("meal_plans")
    .select(
      `*,
       recipe:recipes!meal_plans_recipe_id_fkey(*)`,
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Meal plan not found" },
        { status: 404 },
      );
    }
    console.error("Error fetching meal plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(mealPlan);
}

// PATCH update a meal plan
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
    const body = (await req.json()) as MealPlanUpdate;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.planned_date !== undefined)
      updateData.planned_date = body.planned_date;
    if (body.meal_type !== undefined) updateData.meal_type = body.meal_type;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "cooked") {
        updateData.cooked_at = new Date().toISOString();
      }
    }
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data: mealPlan, error } = await supabase
      .from("meal_plans")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating meal plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mealPlan);
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

// DELETE a meal plan
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

  const { error } = await supabase.from("meal_plans").delete().eq("id", id);

  if (error) {
    console.error("Error deleting meal plan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
