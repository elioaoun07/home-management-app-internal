// src/app/api/recipes/[id]/scale/route.ts
// Smart serving scaler using AI for non-linear adjustments
// e.g., "4 slices of ham" stays the same for 3-4 servings, but becomes 7-8 for 10

import { generateContentWithFallback } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import type { RecipeIngredient } from "@/types/recipe";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Gemini calls go through generateContentWithFallback for retry + fallback model.

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
    targetServings: number;
    currentServings?: number;
    ingredients?: RecipeIngredient[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    targetServings,
    currentServings: inputServings,
    ingredients: inputIngredients,
  } = body;
  if (!targetServings || targetServings < 1 || targetServings > 50) {
    return NextResponse.json(
      { error: "Target servings must be 1-50" },
      { status: 400 },
    );
  }

  // Rate limit
  const requestHash = generateRequestHash(
    `recipe-scale-${id}-${targetServings}`,
  );
  const rateLimitCheck = await checkUserRateLimit(
    supabase,
    user.id,
    requestHash,
  );
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: rateLimitCheck.reason || "Rate limit exceeded.",
        retryAfter: rateLimitCheck.retryAfterSeconds,
      },
      { status: 429 },
    );
  }
  await recordRequestHash(supabase, user.id, "recipe-scale", requestHash);

  // Get recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const currentServings = inputServings ?? recipe.servings ?? 4;
  const ingredients: RecipeIngredient[] =
    inputIngredients ?? recipe.ingredients ?? [];

  if (ingredients.length === 0) {
    return NextResponse.json(
      { error: "Recipe has no ingredients to scale" },
      { status: 422 },
    );
  }

  // If same servings, just return as-is
  if (targetServings === currentServings) {
    return NextResponse.json({
      servings: targetServings,
      ingredients,
      reasoning: "No changes needed — same serving count.",
    });
  }

  const prompt = `You are a professional chef. Scale this recipe from ${currentServings} to ${targetServings} servings.

IMPORTANT: Do NOT just multiply linearly. Use real cooking knowledge:
- Spices/seasonings don't scale linearly (doubling a recipe doesn't need double salt)
- "4 slices of ham" for 4 servings → still 4 for 3 servings, maybe 7-8 for 10 servings  
- Baking ingredients (flour, sugar) scale more linearly than seasonings
- Cooking oil amounts don't scale linearly (you don't need 10x oil for 10x recipe)
- Garnishes (parsley, lemon wedge) scale with portions
- Liquid ratios in soups/sauces should maintain consistency

Recipe: ${recipe.name}
Current servings: ${currentServings}
Target servings: ${targetServings}
Current ingredients:
${JSON.stringify(ingredients, null, 2)}

Return ONLY valid JSON (no markdown, no code fences):
{
  "servings": ${targetServings},
  "ingredients": [
    {"name": "ingredient", "quantity": "new amount", "unit": "unit", "notes": "optional", "section": "preserve original section if present"}
  ],
  "reasoning": "Brief explanation of non-obvious scaling decisions"
}

IMPORTANT: Preserve the "section" field from the input ingredients exactly as-is.`;

  try {
    const response = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const result = JSON.parse(jsonStr) as {
      servings: number;
      ingredients: RecipeIngredient[];
      reasoning: string;
    };

    result.ingredients = (result.ingredients || []).slice(0, 50);

    const usage = response.usageMetadata;
    console.log(
      `[recipe-scale] ${recipe.name} ${currentServings}→${targetServings} | Tokens: ${usage?.totalTokenCount ?? "?"}`,
    );

    return NextResponse.json({
      ...result,
      tokensUsed: usage?.totalTokenCount ?? null,
    });
  } catch (err: any) {
    console.error("[recipe-scale] Error:", err.message);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned invalid data. Please try again." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to scale recipe" },
      { status: 500 },
    );
  }
}
