// src/app/api/recipes/[id]/optimize/route.ts
// AI optimizes a user's recipe: fills gaps, corrects times, improves steps
// Returns a diff showing what changed and why

import { generateContentWithFallback } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  AIFieldChange,
  RecipeIngredient,
  RecipeStep,
} from "@/types/recipe";
import {
  RECIPE_CATEGORIES,
  RECIPE_CUISINES,
  RECIPE_TAGS,
} from "@/types/recipe";
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

  // Parse optional user input override (when calling from RecipeDialog before saving)
  let userInput: {
    name?: string;
    description?: string;
    category?: string;
    cuisine?: string;
    difficulty?: string;
    prep_time_minutes?: number | null;
    cook_time_minutes?: number | null;
    servings?: number;
    tags?: string[];
    ingredients?: RecipeIngredient[];
    steps?: RecipeStep[];
  } | null = null;

  try {
    const body = await req.json();
    if (body?.userInput) {
      userInput = body.userInput;
    }
  } catch {
    // No body or invalid JSON — that's fine, we'll use the saved recipe
  }

  // Rate limit
  const requestHash = generateRequestHash(`recipe-optimize-${id}`);
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
  await recordRequestHash(supabase, user.id, "recipe-optimize", requestHash);

  // Get the saved recipe (for context even if userInput is provided)
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Get past cooking logs for learning
  const { data: logs } = await supabase
    .from("cooking_logs")
    .select("*")
    .eq("recipe_id", id)
    .order("cooked_at", { ascending: false })
    .limit(5);

  const cookingHistory = (logs || [])
    .map((log) => {
      const parts: string[] = [];
      if (log.taste_notes) parts.push(`Taste: ${log.taste_notes}`);
      if (log.actual_prep_minutes)
        parts.push(`Actual prep: ${log.actual_prep_minutes}min`);
      if (log.actual_cook_minutes)
        parts.push(`Actual cook: ${log.actual_cook_minutes}min`);
      if (log.perceived_difficulty)
        parts.push(`Felt: ${log.perceived_difficulty}`);
      if (log.substitutions?.length) {
        const subs = log.substitutions
          .map(
            (s: { original: string; replaced_with: string; notes?: string }) =>
              `${s.original} → ${s.replaced_with}${s.notes ? ` (${s.notes})` : ""}`,
          )
          .join(", ");
        parts.push(`Substitutions: ${subs}`);
      }
      if (log.general_notes) parts.push(`Notes: ${log.general_notes}`);
      if (log.rating) parts.push(`Rating: ${log.rating}/5`);
      return parts.join(" | ");
    })
    .filter(Boolean);

  // Use userInput if provided, otherwise use saved recipe
  const current = {
    name: userInput?.name ?? recipe.name,
    description: userInput?.description ?? recipe.description ?? "",
    category: userInput?.category ?? recipe.category ?? "",
    cuisine: userInput?.cuisine ?? recipe.cuisine ?? "",
    difficulty: userInput?.difficulty ?? recipe.difficulty ?? "medium",
    prep_time_minutes: userInput?.prep_time_minutes ?? recipe.prep_time_minutes,
    cook_time_minutes: userInput?.cook_time_minutes ?? recipe.cook_time_minutes,
    servings: userInput?.servings ?? recipe.servings ?? 4,
    tags: userInput?.tags ?? recipe.tags ?? [],
    ingredients: userInput?.ingredients ?? recipe.ingredients ?? [],
    steps: userInput?.steps ?? recipe.steps ?? [],
  };

  const prompt = `You are a professional chef AI assistant. A user has entered their recipe and wants you to OPTIMIZE it.

YOUR ROLE: Review what the user has entered, fill in any missing fields, correct inaccurate estimates, 
and improve the recipe while keeping the user's intent intact.

=== USER'S CURRENT INPUT ===
Name: ${current.name}
Description: ${current.description || "(not set)"}
Category: ${current.category || "(not set)"}
Cuisine: ${current.cuisine || "(not set)"}
Difficulty: ${current.difficulty}
Prep time: ${current.prep_time_minutes ?? "(not set)"} minutes
Cook time: ${current.cook_time_minutes ?? "(not set)"} minutes
Servings: ${current.servings}
Tags: ${current.tags.length > 0 ? current.tags.join(", ") : "(none)"}
Ingredients: ${current.ingredients.length > 0 ? JSON.stringify(current.ingredients) : "(none entered)"}
Steps: ${current.steps.length > 0 ? JSON.stringify(current.steps) : "(none entered)"}

${cookingHistory.length > 0 ? `=== PAST COOKING FEEDBACK ===\nThe user has cooked this before. Use their feedback to ADJUST the recipe:\n${cookingHistory.join("\n")}\nFor example if they said actual prep was 25min but recipe says 30, adjust prep_time_minutes closer to 25. If they said "too salty", reduce salt.\n` : ""}

=== YOUR TASK ===
1. If ingredients/steps are empty, generate them based on the recipe name/description
2. If prep/cook times seem wrong (e.g., steps add up to more), correct them
3. Fill in missing category, cuisine, difficulty, tags based on the recipe
4. Improve vague steps ("cook until done" → "cook for 8-10 minutes until golden brown")
5. Add tips to steps where helpful
6. If past feedback says "too salty" or similar, adjust accordingly
7. Do NOT change the recipe name or fundamentally alter the dish

=== INGREDIENT SECTIONS ===
Group ingredients by their purpose using the "section" field. Examples:
- "Chicken & Coating", "Dressing", "Rice", "Salad", "Sauce", "Garnish", "Marinade"
- If the recipe is simple (e.g., scrambled eggs), use a single section like "Main"
- Choose clear, concise section names that help the cook understand what goes together

=== STEP OPTIMIZATION ===
For each step, identify timing optimizations:
- "parallel_with": array of OTHER step numbers that can run at the same time
  Example: While chicken bakes (step 4, 25min), you can prepare the salad (step 5). So step 5 has parallel_with: [4]
- "is_prerequisite": true if this step should start EARLY to save total cook time
  Example: "Preheat oven to 200°C" should be step 1 with is_prerequisite: true
  Example: "Bring a pot of water to boil" — if needed later for rice, start it early
- "prerequisite_for": which step numbers this enables
  Example: Preheat oven (step 1) → prerequisite_for: [5] (the step that uses the oven)

Think like a professional chef optimizing kitchen time:
- Preheat ovens/grills FIRST
- Start boiling water early if needed later
- While something bakes/simmers passively, prep other components
- Identify natural waiting periods and fill them with productive work

Available categories: ${RECIPE_CATEGORIES.join(", ")}
Available cuisines: ${RECIPE_CUISINES.join(", ")}
Available tags: ${RECIPE_TAGS.map((t) => t.value).join(", ")}

Return ONLY valid JSON (no markdown, no code fences):
{
  "recipe": {
    "name": "${current.name}",
    "description": "improved or kept as-is",
    "category": "one from the list",
    "cuisine": "one from the list",
    "difficulty": "easy|medium|hard",
    "prep_time_minutes": 15,
    "cook_time_minutes": 30,
    "servings": ${current.servings},
    "tags": ["applicable tags"],
    "ingredients": [{"name": "...", "quantity": "...", "unit": "...", "notes": "optional", "section": "Chicken & Coating"}],
    "steps": [{"step": 1, "instruction": "...", "duration_minutes": 5, "tip": "optional", "parallel_with": [], "is_prerequisite": false, "prerequisite_for": []}]
  },
  "reasoning": "A paragraph explaining the key changes you made and why.",
  "changes": [
    {"field": "prep_time_minutes", "from": "10", "to": "20", "reason": "Steps 1-3 take 18 minutes total"}
  ]
}

The "changes" array should list EVERY field you changed from the user's input, with a reason for each.
Only list fields that actually differ from the user's input.`;

  try {
    const response = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.4,
        topP: 0.85,
        topK: 40,
        maxOutputTokens: 3072,
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
      recipe: {
        name: string;
        description: string;
        category: string;
        cuisine: string;
        difficulty: string;
        prep_time_minutes: number;
        cook_time_minutes: number;
        servings: number;
        tags: string[];
        ingredients: RecipeIngredient[];
        steps: RecipeStep[];
      };
      reasoning: string;
      changes: AIFieldChange[];
    };

    // Sanitize
    result.recipe.ingredients = (result.recipe.ingredients || []).slice(0, 50);
    result.recipe.steps = (result.recipe.steps || []).slice(0, 30);
    result.recipe.tags = (result.recipe.tags || []).slice(0, 10);

    const usage = response.usageMetadata;
    console.log(
      `[recipe-optimize] ${recipe.name} | Input: ${usage?.promptTokenCount ?? "?"} | Output: ${usage?.candidatesTokenCount ?? "?"} | Total: ${usage?.totalTokenCount ?? "?"}`,
    );

    return NextResponse.json({
      ...result,
      tokensUsed: usage?.totalTokenCount ?? null,
    });
  } catch (err: any) {
    console.error("[recipe-optimize] Error:", err.message);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned invalid data. Please try again." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to optimize recipe" },
      { status: 500 },
    );
  }
}
