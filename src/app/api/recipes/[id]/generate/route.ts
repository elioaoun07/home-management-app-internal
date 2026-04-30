// src/app/api/recipes/[id]/generate/route.ts
import { generateContentWithFallback } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  RecipeFeedback,
  RecipeIngredient,
  RecipeStep,
} from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Gemini calls go through generateContentWithFallback for retry + fallback model.

// POST: Generate ingredients and steps for a recipe using AI
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

  // Rate limit check with deduplication
  const requestHash = generateRequestHash(`recipe-generate-${id}`);
  const rateLimitCheck = await checkUserRateLimit(
    supabase,
    user.id,
    requestHash,
  );
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error:
          rateLimitCheck.reason ||
          "Rate limit exceeded. Please try again later.",
        retryAfter: rateLimitCheck.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // Record request hash for deduplication
  await recordRequestHash(supabase, user.id, "recipe-generate", requestHash);

  // Get the recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  try {
    // Build the prompt with recipe context
    const feedbackNotes = (recipe.feedback as RecipeFeedback[])
      ?.map((f) => f.notes)
      .filter(Boolean)
      .join("; ");

    const prompt = `Generate a detailed recipe for "${recipe.name}".
${recipe.description ? `Description: ${recipe.description}` : ""}
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ""}
${recipe.category ? `Category: ${recipe.category}` : ""}
${recipe.servings ? `Servings: ${recipe.servings}` : "Servings: 4"}
${recipe.source_url ? `Reference URL (for style): ${recipe.source_url}` : ""}
${feedbackNotes ? `User preferences from past cooking: ${feedbackNotes}` : ""}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "ingredients": [
    {"name": "ingredient name", "quantity": "500", "unit": "g", "notes": "optional notes"}
  ],
  "steps": [
    {"step": 1, "instruction": "detailed instruction", "duration_minutes": 5, "tip": "optional tip"}
  ],
  "prep_time_minutes": 15,
  "cook_time_minutes": 30
}

Make the recipe practical and clear. Include all ingredients needed. Steps should be detailed but concise.
Consider the user's past feedback when available (e.g., if they said "too salty", use less salt).`;

    const response = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response (handle potential markdown code blocks)
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const generated = JSON.parse(jsonStr) as {
      ingredients: RecipeIngredient[];
      steps: RecipeStep[];
      prep_time_minutes?: number;
      cook_time_minutes?: number;
    };

    // Update the recipe with generated content
    const { data: updatedRecipe, error: updateError } = await supabase
      .from("recipes")
      .update({
        ingredients: generated.ingredients,
        steps: generated.steps,
        prep_time_minutes:
          generated.prep_time_minutes || recipe.prep_time_minutes,
        cook_time_minutes:
          generated.cook_time_minutes || recipe.cook_time_minutes,
        ai_generated: true,
        ai_generation_prompt: prompt,
        last_ai_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating recipe:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedRecipe);
  } catch (err) {
    console.error("Error generating recipe:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to generate recipe",
      },
      { status: 500 },
    );
  }
}
