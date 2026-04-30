// src/app/api/recipes/extract-from-url/route.ts
// Extracts recipe data from a URL using Gemini AI
// Strategy:
//   - Recipe websites: fetch HTML → strip to text → send to Gemini (cheap, ~500-1500 tokens)
//   - Social media (Instagram, TikTok): scrape caption from OG meta tags / JSON-LD first,
//     fall back to full HTML strip, then AI knowledge as last resort
//   - YouTube: pass URL as context in prompt, Gemini uses training knowledge (no video processing)
// This avoids the URL Context tool (needs 2.5+) and YouTube file_data (300 tokens/sec = very expensive)

import { generateContentWithFallback } from "@/lib/ai/gemini";
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
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Gemini calls go through generateContentWithFallback for retry + fallback model.

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

function isInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "www.instagram.com" ||
      u.hostname === "instagram.com" ||
      u.hostname === "instagr.am"
    );
  } catch {
    return false;
  }
}

function isTikTokUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "www.tiktok.com" ||
      u.hostname === "tiktok.com" ||
      u.hostname === "vm.tiktok.com"
    );
  } catch {
    return false;
  }
}

/** Check if the URL is a social media platform that blocks scraping */
function isSocialMediaUrl(url: string): boolean {
  return isInstagramUrl(url) || isTikTokUrl(url);
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
 * Fetch raw HTML from a URL with appropriate headers.
 * For social media (Instagram, TikTok), uses a crawler User-Agent
 * so the platform serves full OG meta tags with post captions.
 */
async function fetchHtml(url: string, isSocial = false): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: isSocial
        ? {
            // Social media platforms serve full OG meta tags to known crawlers
            // (facebookexternalhit gets the complete post caption in og:description)
            "User-Agent": "facebookexternalhit/1.1",
            Accept: "text/html",
          }
        : {
            // Regular browser UA for normal websites
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

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Decode common HTML entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\n/g, "\n");
}

/**
 * Extract text content from social media HTML (Instagram, TikTok).
 * These platforms embed post captions in meta tags and JSON-LD data.
 * Returns the caption/description text which often contains the full recipe.
 */
function extractSocialMediaCaption(html: string): string {
  const parts: string[] = [];

  // 1. Extract og:title
  const ogTitle = html.match(
    /<meta\s+(?:property|name)="og:title"\s+content="([^"]*)"/i,
  );
  if (ogTitle) parts.push(decodeEntities(ogTitle[1]));

  // 2. Extract og:description — Instagram puts the full caption here
  const ogDesc = html.match(
    /<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"/i,
  );
  if (ogDesc) parts.push(decodeEntities(ogDesc[1]));

  // 3. Also try twitter:description
  const twDesc = html.match(
    /<meta\s+(?:property|name)="twitter:description"\s+content="([^"]*)"/i,
  );
  if (twDesc && twDesc[1] !== ogDesc?.[1])
    parts.push(decodeEntities(twDesc[1]));

  // 4. Try to pull from JSON-LD structured data
  const jsonLdBlocks = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.articleBody) parts.push(decodeEntities(item.articleBody));
        if (item.description) parts.push(decodeEntities(item.description));
        if (item.caption) parts.push(decodeEntities(item.caption));
        // Sometimes nested in @graph
        if (item["@graph"]) {
          for (const g of item["@graph"]) {
            if (g.articleBody) parts.push(decodeEntities(g.articleBody));
            if (g.description) parts.push(decodeEntities(g.description));
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  // 5. Look for "additionalProperty" or data attributes with caption content
  //    Instagram sometimes puts it in a hidden div or span with specific classes
  const captionSpans = html.matchAll(
    /<(?:span|div|h1)[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|h1)>/gi,
  );
  for (const match of captionSpans) {
    const text = match[1].replace(/<[^>]+>/g, " ").trim();
    if (text.length > 20) parts.push(decodeEntities(text));
  }

  // Deduplicate by checking if one part is a substring of another
  const unique = parts.filter(
    (p, i) => p.length > 10 && !parts.some((q, j) => j !== i && q.includes(p)),
  );

  return unique.join("\n\n").trim();
}

/**
 * Fetch a webpage and extract meaningful text content.
 * Strips scripts, styles, nav, footer, ads. Keeps the main body text.
 * Returns at most MAX_HTML_BYTES characters.
 */
function stripHtmlToText(html: string, isSocial = false): string {
  // For social media, try to cut off "more posts" / "suggested" sections
  // to avoid feeding unrelated recipe content to the AI
  if (isSocial) {
    // Instagram puts suggested posts after "More posts from" or in sections
    // with specific patterns. Cut at the first such marker.
    const cutoffMarkers = [
      /More posts from/i,
      /Suggested for you/i,
      /Related accounts/i,
      /Log in to like or comment/i,
    ];
    for (const marker of cutoffMarkers) {
      const idx = html.search(marker);
      if (idx > 500) {
        // Only cut if we have enough content before the marker
        html = html.slice(0, idx);
        break;
      }
    }
  }

  // ---- Strip non-content elements ----
  // Remove script and style blocks
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  // Remove nav, footer, header, aside, iframe elements
  html = html.replace(/<(nav|footer|header|aside|iframe)[\s\S]*?<\/\1>/gi, "");
  // Remove all HTML tags but keep text content
  html = html.replace(/<[^>]+>/g, " ");
  // Decode entities
  html = decodeEntities(html);
  // Collapse whitespace
  html = html.replace(/\s+/g, " ").trim();

  // Truncate to limit
  if (html.length > MAX_HTML_BYTES) {
    html = html.slice(0, MAX_HTML_BYTES) + "\n[... truncated for brevity]";
  }

  return html;
}

/**
 * Fetch a URL and extract text. For social media, uses a crawler UA
 * to get OG meta tags with the full post caption.
 */
async function fetchAndExtractText(
  url: string,
  isSocial: boolean,
): Promise<string> {
  const html = await fetchHtml(url, isSocial);

  if (isSocial) {
    // With the crawler UA, Instagram/TikTok serve full OG meta tags
    const caption = extractSocialMediaCaption(html);
    console.log(
      `[recipe-extract] Social media caption extracted: ${caption.length} chars`,
    );

    if (caption.length >= 50) {
      return caption;
    }

    // Fallback: try full HTML strip (unlikely to help but worth trying)
    const fullText = stripHtmlToText(html, true);
    if (fullText.length > caption.length && fullText.length >= 50) {
      return fullText;
    }

    return caption.length > fullText.length ? caption : fullText;
  }

  return stripHtmlToText(html);
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
  const isSocial = isSocialMediaUrl(url);
  let pageText = "";
  let prompt: string;
  let sourceType: string;

  if (isYT) {
    // ---- YouTube strategy ----
    // We do NOT process the actual video (would cost ~180K tokens for a 10-min video).
    // Instead we mention the URL so Gemini can use its training knowledge.
    sourceType = "youtube";

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
    // ---- Website / Social media strategy ----
    // For social media (Instagram, TikTok): try scraping caption from meta tags first.
    // Many public posts include the full recipe in their caption, which Instagram
    // embeds as og:description in the HTML — no login required.
    // Falls back to full-text stripping if caption extraction yields little content.
    sourceType = isSocial
      ? isInstagramUrl(url)
        ? "instagram"
        : "tiktok"
      : "website";

    try {
      pageText = await fetchAndExtractText(url, isSocial);
    } catch (err: any) {
      console.error("Failed to fetch URL:", err.message);

      // For social media, fall back to AI knowledge if scraping fails entirely
      if (isSocial) {
        console.log(
          "[recipe-extract] Social media scrape failed, falling back to AI knowledge",
        );
        const platformLabel = isInstagramUrl(url)
          ? "Instagram cooking reel/post"
          : "TikTok cooking video";

        prompt = `I have a ${platformLabel} at this URL: ${url}

Based on your knowledge of this content (or similar recipes if you don't know this exact post),
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

Be accurate. If unsure about the exact recipe from this URL, generate the most likely version based on the post/video title and creator.`;

        // Skip the page content prompt — go straight to AI call
        // (prompt is already set, pageText stays empty)
      } else {
        return NextResponse.json(
          {
            error: `Could not fetch the URL. ${err.message || "The page may be unavailable or require login."}`,
          },
          { status: 422 },
        );
      }
    }

    if (!prompt!) {
      // We have page text — validate it
      if (pageText.length < 50) {
        if (isSocial) {
          // Social media but got too little content — fall back to AI knowledge
          const platformLabel = isInstagramUrl(url)
            ? "Instagram cooking reel/post"
            : "TikTok cooking video";

          prompt = `I have a ${platformLabel} at this URL: ${url}

Based on your knowledge of this content (or similar recipes if you don't know this exact post),
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

Be accurate. If unsure about the exact recipe from this URL, generate the most likely version based on the post/video title and creator.`;
        } else {
          return NextResponse.json(
            {
              error: "The page content is too short to extract a recipe from.",
            },
            { status: 422 },
          );
        }
      } else {
        const isSocialScrape = isSocial;
        const sourceLabel = isSocialScrape ? "social media post" : "webpage";

        prompt = `Extract the recipe from this ${sourceLabel} content. The content was scraped from: ${url}
${isSocialScrape ? "\nIMPORTANT: This is a social media page. The page may contain suggested/related posts from other accounts at the bottom — IGNORE those entirely. Only extract the MAIN post's recipe (the first recipe mentioned, which is the one the URL points to). The main post is typically by the account shown at the top of the content.\n" : ""}
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
    }
  }

  try {
    const response = await generateContentWithFallback({
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
        `Source: ${sourceType}`,
    );

    return NextResponse.json({
      recipe: extracted,
      source: sourceType,
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
