// src/app/api/recipes/[id]/substitute/route.ts
// AI suggests ingredient substitutions with impact analysis

import { generateContentWithFallback } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
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
    ingredient: string;
    question?: string;
    recipeName?: string;
    allIngredients?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { ingredient, question, recipeName, allIngredients } = body;
  if (!ingredient) {
    return NextResponse.json(
      { error: "Ingredient is required" },
      { status: 400 },
    );
  }

  // Rate limit
  const requestHash = generateRequestHash(`recipe-sub-${id}-${ingredient}`);
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
  await recordRequestHash(supabase, user.id, "recipe-substitute", requestHash);

  // Get recipe for context
  const { data: recipe } = await supabase
    .from("recipes")
    .select("name, description, cuisine, category, ingredients")
    .eq("id", id)
    .single();

  const name = recipeName || recipe?.name || "this recipe";
  const otherIngredients =
    allIngredients ||
    (recipe?.ingredients as Array<{ name: string }>)?.map((i) => i.name) ||
    [];

  const prompt = `You are a professional chef advisor. A user is cooking "${name}" and has a question about an ingredient.

${
  question
    ? `USER'S QUESTION: "${question}" (about "${ingredient}")`
    : `The user wants substitution suggestions for: "${ingredient}"`
}

Other ingredients in the recipe: ${otherIngredients.filter((i) => i !== ingredient).join(", ") || "unknown"}
${recipe?.cuisine ? `Cuisine: ${recipe.cuisine}` : ""}

${
  question
    ? `Answer the user's specific question directly and helpfully. Then also suggest alternatives if relevant.`
    : `Suggest 3-4 good substitutions.`
}

For each suggestion, explain:
- The exact quantity/unit to use
- How it will affect the final dish
- Whether it's a close match or a creative alternative

Return ONLY valid JSON (no markdown, no code fences):
{
  "answer": "Direct answer to the user's question (if they asked one)",
  "original": "${ingredient}",
  "suggestions": [
    {
      "name": "substitute ingredient",
      "quantity": "amount",
      "unit": "unit",
      "notes": "preparation notes if needed",
      "impact": "How this changes the dish (flavor, texture, etc.)"
    }
  ]
}`;

  try {
    const response = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const result = JSON.parse(jsonStr);
    result.suggestions = (result.suggestions || []).slice(0, 5);

    const usage = response.usageMetadata;
    console.log(
      `[recipe-substitute] ${ingredient} in ${name} | Tokens: ${usage?.totalTokenCount ?? "?"}`,
    );

    return NextResponse.json({
      ...result,
      tokensUsed: usage?.totalTokenCount ?? null,
    });
  } catch (err: any) {
    console.error("[recipe-substitute] Error:", err.message);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned invalid data. Please try again." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: err.message || "Failed to get substitution suggestions" },
      { status: 500 },
    );
  }
}
