// src/app/api/recipes/extract-from-url/route.ts
// Extracts recipe data from a URL using Gemini AI
// Strategy:
//   - Recipe websites: fetch HTML → strip to text → send to Gemini (cheap, ~500-1500 tokens)
//   - YouTube: pass URL as context in prompt, Gemini uses training knowledge (no video processing)
// This avoids the URL Context tool (needs 2.5+) and YouTube file_data (300 tokens/sec = very expensive)

import { geminiModel } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { supabaseServer } from "@/lib/supabase/server";
import type { RecipeIngredient, RecipeStep } from "@/types/recipe";
import {
  RECIPE_CATEGORIES,
  RECIPE_CUISINES,
  RECIPE_TAGS,
} from "@/types/recipe";
import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ------- SAFETY CONSTANTS -------
const MAX_HTML_BYTES = 80_000; // ~80KB of text sent to Gemini (well under limits)
const MAX_OUTPUT_TOKENS = 2048; // cap output so we don't blow budget
const FETCH_TIMEOUT_MS = 8_000; // 8s timeout for fetching URLs
const MAX_URL_LENGTH = 2048; // sanity check

// ------- URL helpers -------

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "youtu.be" ||
      u.hostname === "m.youtube.com"
    );
  } catch {
    return false;
  }
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch a webpage and extract meaningful text content.
 * Strips scripts, styles, nav, footer, ads. Keeps the main body text.
 * Returns at most MAX_HTML_BYTES characters.
 */
async function fetchAndExtractText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Pretend to be a browser so recipe sites don't block us
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(
        `Unsupported content type: ${contentType}. Only HTML recipe pages are supported.`,
      );
    }

    let html = await res.text();

    // ---- Strip non-content elements ----
    // Remove script and style blocks
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    // Remove HTML comments
    html = html.replace(/<!--[\s\S]*?-->/g, "");
    // Remove nav, footer, header, aside, iframe elements
    html = html.replace(
      /<(nav|footer|header|aside|iframe)[\s\S]*?<\/\1>/gi,
      "",
    );
    // Remove all HTML tags but keep text content
    html = html.replace(/<[^>]+>/g, " ");
    // Decode common HTML entities
    html = html
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
    // Collapse whitespace
    html = html.replace(/\s+/g, " ").trim();

    // Truncate to limit
    if (html.length > MAX_HTML_BYTES) {
      html = html.slice(0, MAX_HTML_BYTES) + "\n[... truncated for brevity]";
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}

// ------- Main handler -------

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: { url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;

  // Validate URL
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }
  if (url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: "URL is too long" }, { status: 400 });
  }
  if (!isValidHttpUrl(url)) {
    return NextResponse.json(
      { error: "Invalid URL. Must be an http or https URL." },
      { status: 400 },
    );
  }

  // Rate limit (reuses existing system)
  const requestHash = generateRequestHash(`recipe-url-extract-${url}`);
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
  await recordRequestHash(supabase, user.id, "recipe-url-extract", requestHash);

  // Determine URL type and build the prompt
  const isYT = isYouTubeUrl(url);
  let pageText = "";
  let prompt: string;

  if (isYT) {
    // ---- YouTube strategy ----
    // We do NOT process the actual video (would cost ~180K tokens for a 10-min video).
    // Instead we mention the URL so Gemini can use its training knowledge about
    // popular recipe videos. This costs ~0 extra input tokens.
    prompt = `I have a YouTube cooking video at this URL: ${url}

Based on your knowledge of this video (or similar recipes if you don't know this exact video), 
extract or generate a complete recipe.

Return ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "name": "Recipe Name",
  "description": "Brief 1-2 sentence description",
  "category": "one of: ${RECIPE_CATEGORIES.join(", ")}",
  "cuisine": "one of: ${RECIPE_CUISINES.join(", ")}",
  "difficulty": "easy|medium|hard",
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "servings": 4,
  "tags": ["array of applicable tags from: ${RECIPE_TAGS.map((t) => t.value).join(", ")}"],
  "ingredients": [
    {"name": "ingredient", "quantity": "500", "unit": "g", "notes": "optional"}
  ],
  "steps": [
    {"step": 1, "instruction": "detailed instruction", "duration_minutes": 5, "tip": "optional"}
  ]
}

Be accurate. If unsure about the exact recipe from this URL, generate the most likely version based on the video title/channel.`;
  } else {
    // ---- Recipe website strategy ----
    // Fetch HTML, strip to text, send to Gemini as text context (cheap)
    try {
      pageText = await fetchAndExtractText(url);
    } catch (err: any) {
      console.error("Failed to fetch URL:", err.message);
      return NextResponse.json(
        {
          error: `Could not fetch the URL. ${err.message || "The page may be unavailable or require login."}`,
        },
        { status: 422 },
      );
    }

    if (pageText.length < 50) {
      return NextResponse.json(
        { error: "The page content is too short to extract a recipe from." },
        { status: 422 },
      );
    }

    prompt = `Extract the recipe from this webpage content. The content was scraped from: ${url}

--- PAGE CONTENT START ---
${pageText}
--- PAGE CONTENT END ---

Return ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "name": "Recipe Name",
  "description": "Brief 1-2 sentence description",
  "category": "one of: ${RECIPE_CATEGORIES.join(", ")}",
  "cuisine": "one of: ${RECIPE_CUISINES.join(", ")}",
  "difficulty": "easy|medium|hard",
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "servings": 4,
  "tags": ["array of applicable tags from: ${RECIPE_TAGS.map((t) => t.value).join(", ")}"],
  "ingredients": [
    {"name": "ingredient", "quantity": "500", "unit": "g", "notes": "optional"}
  ],
  "steps": [
    {"step": 1, "instruction": "detailed instruction", "duration_minutes": 5, "tip": "optional"}
  ]
}

Extract exactly what the recipe says. Do not invent or add ingredients/steps that aren't on the page. 
If any field is missing from the page, make a reasonable guess based on the recipe content.
For category/cuisine, pick the closest match from the provided options.
For tags, only include tags that clearly apply.`;
  }

  try {
    const response = await genAI.models.generateContent({
      model: geminiModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3, // Low temperature for accurate extraction
        topP: 0.8,
        topK: 40,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let jsonStr = text.trim();
    // Strip markdown code fences if present
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const extracted = JSON.parse(jsonStr) as {
      name: string;
      description?: string;
      category?: string;
      cuisine?: string;
      difficulty?: string;
      prep_time_minutes?: number;
      cook_time_minutes?: number;
      servings?: number;
      tags?: string[];
      ingredients: RecipeIngredient[];
      steps: RecipeStep[];
    };

    // Validate required fields
    if (!extracted.name) {
      throw new Error("Could not extract recipe name");
    }
    if (
      !extracted.ingredients ||
      !Array.isArray(extracted.ingredients) ||
      extracted.ingredients.length === 0
    ) {
      throw new Error("Could not extract ingredients");
    }

    // Sanitize and cap arrays to prevent abuse
    extracted.ingredients = extracted.ingredients.slice(0, 50); // max 50 ingredients
    extracted.steps = (extracted.steps || []).slice(0, 30); // max 30 steps
    extracted.tags = (extracted.tags || []).slice(0, 10); // max 10 tags

    // Log token usage for debugging
    const usage = response.usageMetadata;
    console.log(
      `[recipe-extract] URL: ${url.substring(0, 80)}... | ` +
        `Input tokens: ${usage?.promptTokenCount ?? "?"} | ` +
        `Output tokens: ${usage?.candidatesTokenCount ?? "?"} | ` +
        `Total: ${usage?.totalTokenCount ?? "?"} | ` +
        `Source: ${isYT ? "youtube-knowledge" : "html-scrape"}`,
    );

    return NextResponse.json({
      recipe: extracted,
      source: isYT ? "youtube" : "website",
      tokensUsed: usage?.totalTokenCount ?? null,
    });
  } catch (err: any) {
    console.error("[recipe-extract] AI error:", err.message);

    // Check for JSON parse errors specifically
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        {
          error:
            "The AI could not extract a structured recipe from this page. " +
            "Try a different URL or add the recipe manually.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to extract recipe from URL" },
      { status: 500 },
    );
  }
}
