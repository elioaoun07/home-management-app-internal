// src/app/api/meal-plans/add-to-shopping/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { RecipeIngredient } from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST add selected ingredients from a meal plan to shopping list
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      mealPlanId: string;
      ingredientIndices: number[]; // Indices of ingredients to add
      threadId: string;
    };

    const { mealPlanId, ingredientIndices, threadId } = body;

    // Get the meal plan with recipe
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from("meal_plans")
      .select(
        `*,
         recipe:recipes!meal_plans_recipe_id_fkey(id, name, ingredients)`,
      )
      .eq("id", mealPlanId)
      .single();

    if (mealPlanError || !mealPlan) {
      return NextResponse.json(
        { error: "Meal plan not found" },
        { status: 404 },
      );
    }

    const recipe = mealPlan.recipe;
    const ingredients = recipe.ingredients as RecipeIngredient[];

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: "Recipe has no ingredients" },
        { status: 400 },
      );
    }

    // Verify thread belongs to user's household
    const { data: thread, error: threadError } = await supabase
      .from("hub_chat_threads")
      .select("id, household_id")
      .eq("id", threadId)
      .eq("purpose", "shopping")
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Shopping thread not found" },
        { status: 404 },
      );
    }

    // Get ingredients to add (all if no indices specified)
    const indicesToAdd =
      ingredientIndices.length > 0
        ? ingredientIndices
        : ingredients.map((_, i) => i);

    const selectedIngredients = indicesToAdd
      .filter((i) => i >= 0 && i < ingredients.length)
      .map((i) => ingredients[i]);

    if (selectedIngredients.length === 0) {
      return NextResponse.json(
        { error: "No valid ingredients to add" },
        { status: 400 },
      );
    }

    // Create shopping messages for each ingredient
    const messages = selectedIngredients.map((ing) => {
      // Format: "500g chicken (Orange Chicken)"
      const quantity =
        ing.quantity && ing.unit ? `${ing.quantity}${ing.unit} ` : "";
      const notes = ing.notes ? ` - ${ing.notes}` : "";
      const content = `${quantity}${ing.name}${notes}`;

      return {
        household_id: thread.household_id,
        thread_id: threadId,
        sender_user_id: user.id,
        message_type: "text" as const,
        content,
        item_quantity: ing.quantity
          ? `${ing.quantity} ${ing.unit || ""}`.trim()
          : null,
        source: "ai" as const, // Mark as AI-sourced (from recipe)
        meal_plan_id: mealPlanId,
      };
    });

    const { data: insertedMessages, error: insertError } = await supabase
      .from("hub_messages")
      .insert(messages)
      .select("id");

    if (insertError) {
      console.error("Error inserting shopping messages:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const messageIds = insertedMessages.map((m) => m.id);

    // Update meal plan with shopping info
    await supabase
      .from("meal_plans")
      .update({
        status: "shopping_added",
        shopping_thread_id: threadId,
        shopping_message_ids: messageIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mealPlanId);

    // Update thread's last_message_at
    await supabase
      .from("hub_chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    return NextResponse.json({
      added: messageIds.length,
      messageIds,
      recipeName: recipe.name,
    });
  } catch (err) {
    console.error("Error parsing request:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
