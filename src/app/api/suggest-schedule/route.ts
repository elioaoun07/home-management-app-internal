// src/app/api/suggest-schedule/route.ts
// AI-powered schedule suggestions for flexible routines
// Uses completion patterns and optional Gemini for intelligent suggestions

import { generateContentWithFallback } from "@/lib/ai/gemini";
import { supabaseServer } from "@/lib/supabase/server";
import { format } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Gemini calls go through generateContentWithFallback for retry + fallback model.
const MODEL = "gemini-2.0-flash";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface CompletionPattern {
  item_id: string;
  title: string;
  total_completions: number;
  preferred_day_of_week: number | null;
  preferred_hour_of_day: number | null;
  day_of_week_histogram: Record<string, number>;
  hour_of_day_histogram: Record<string, number>;
  avg_days_between_completions: number | null;
}

interface ScheduleSuggestion {
  itemId: string;
  suggestedDate: string; // ISO date
  suggestedTime: string | null; // HH:mm format
  confidence: "high" | "medium" | "low";
  reason: string;
  alternativeDates?: string[];
}

/**
 * POST /api/suggest-schedule
 * Get AI-powered schedule suggestions for flexible routines
 *
 * Body: {
 *   itemIds: string[],           // Items to get suggestions for
 *   periodStart: string,         // Period start date (ISO)
 *   periodEnd: string,           // Period end date (ISO)
 *   useAI?: boolean,             // Whether to use Gemini for enhanced suggestions
 *   existingSchedules?: Array<{  // Already scheduled items to avoid conflicts
 *     date: string,
 *     time?: string
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      itemIds,
      periodStart,
      periodEnd,
      useAI = false,
      existingSchedules = [],
    } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds required" }, { status: 400 });
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd required" },
        { status: 400 },
      );
    }

    // Fetch completion patterns for the items
    const { data: patterns, error: patternsError } = await supabase
      .from("item_completion_patterns")
      .select("*")
      .in("item_id", itemIds);

    if (patternsError) {
      console.error("Error fetching patterns:", patternsError);
      return NextResponse.json(
        { error: "Failed to fetch patterns" },
        { status: 500 },
      );
    }

    const patternMap = new Map<string, CompletionPattern>();
    (patterns || []).forEach((p: CompletionPattern) =>
      patternMap.set(p.item_id, p),
    );

    // Fetch item details for titles
    const { data: items } = await supabase
      .from("items")
      .select("id, title")
      .in("id", itemIds);

    const itemMap = new Map<string, string>();
    (items || []).forEach((i: { id: string; title: string }) =>
      itemMap.set(i.id, i.title),
    );

    // Generate suggestions based on patterns
    const suggestions: ScheduleSuggestion[] = [];
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    // Track scheduled dates to avoid conflicts
    const scheduledDates = new Set<string>(
      existingSchedules.map((s: { date: string }) => s.date),
    );

    for (const itemId of itemIds) {
      const pattern = patternMap.get(itemId);
      const title = itemMap.get(itemId) || "Unknown Task";

      let suggestion: ScheduleSuggestion;

      if (pattern && pattern.total_completions >= 3) {
        // High confidence - we have enough data
        suggestion = generatePatternBasedSuggestion(
          itemId,
          title,
          pattern,
          periodStartDate,
          periodEndDate,
          scheduledDates,
        );
      } else if (pattern && pattern.total_completions >= 1) {
        // Medium confidence - some data
        suggestion = generatePartialPatternSuggestion(
          itemId,
          title,
          pattern,
          periodStartDate,
          periodEndDate,
          scheduledDates,
        );
      } else {
        // Low confidence - no historical data
        suggestion = generateDefaultSuggestion(
          itemId,
          title,
          periodStartDate,
          periodEndDate,
          scheduledDates,
        );
      }

      suggestions.push(suggestion);
      scheduledDates.add(suggestion.suggestedDate);
    }

    // If AI is requested and we have patterns, enhance suggestions with Gemini
    if (useAI && process.env.GEMINI_API_KEY) {
      try {
        const enhancedSuggestions = await enhanceWithAI(
          suggestions,
          patterns as CompletionPattern[],
          periodStart,
          periodEnd,
        );
        return NextResponse.json({ suggestions: enhancedSuggestions });
      } catch (aiError) {
        console.error(
          "AI enhancement failed, returning pattern-based suggestions:",
          aiError,
        );
        // Fall back to pattern-based suggestions
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error in suggest-schedule:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function generatePatternBasedSuggestion(
  itemId: string,
  title: string,
  pattern: CompletionPattern,
  periodStart: Date,
  periodEnd: Date,
  scheduledDates: Set<string>,
): ScheduleSuggestion {
  let suggestedDate = new Date(periodStart);
  let reason = "";
  const alternatives: string[] = [];

  // Find preferred day within period
  if (pattern.preferred_day_of_week !== null) {
    const preferredDay = pattern.preferred_day_of_week;
    const dayName = DAY_NAMES[preferredDay];
    reason = `Usually completed on ${dayName}`;

    // Find the first occurrence of preferred day in period
    const current = new Date(periodStart);
    while (current <= periodEnd) {
      const dateStr = format(current, "yyyy-MM-dd");
      if (current.getDay() === preferredDay && !scheduledDates.has(dateStr)) {
        suggestedDate = new Date(current);
        break;
      }
      // Collect alternatives
      if (!scheduledDates.has(dateStr) && current.getDay() !== preferredDay) {
        alternatives.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
  } else {
    // No day preference, distribute evenly
    reason = "Based on your completion history";
    suggestedDate = findAvailableDate(periodStart, periodEnd, scheduledDates);
  }

  // Add time if we have hour preference
  let suggestedTime: string | null = null;
  if (pattern.preferred_hour_of_day !== null) {
    const hour = pattern.preferred_hour_of_day;
    suggestedTime = `${hour.toString().padStart(2, "0")}:00`;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    reason += ` around ${displayHour}:00 ${period}`;
  }

  return {
    itemId,
    suggestedDate: format(suggestedDate, "yyyy-MM-dd"),
    suggestedTime,
    confidence: "high",
    reason,
    alternativeDates: alternatives.slice(0, 3),
  };
}

function generatePartialPatternSuggestion(
  itemId: string,
  title: string,
  pattern: CompletionPattern,
  periodStart: Date,
  periodEnd: Date,
  scheduledDates: Set<string>,
): ScheduleSuggestion {
  let suggestedDate = findAvailableDate(periodStart, periodEnd, scheduledDates);
  let reason = "Based on limited history";
  let suggestedTime: string | null = null;

  // Use what data we have
  if (pattern.preferred_day_of_week !== null) {
    const preferredDay = pattern.preferred_day_of_week;
    const dayName = DAY_NAMES[preferredDay];
    reason = `Previously done on ${dayName}`;

    // Try to find preferred day
    const current = new Date(periodStart);
    while (current <= periodEnd) {
      if (
        current.getDay() === preferredDay &&
        !scheduledDates.has(format(current, "yyyy-MM-dd"))
      ) {
        suggestedDate = new Date(current);
        break;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  if (pattern.preferred_hour_of_day !== null) {
    const hour = pattern.preferred_hour_of_day;
    suggestedTime = `${hour.toString().padStart(2, "0")}:00`;
  }

  return {
    itemId,
    suggestedDate: format(suggestedDate, "yyyy-MM-dd"),
    suggestedTime,
    confidence: "medium",
    reason,
  };
}

function generateDefaultSuggestion(
  itemId: string,
  title: string,
  periodStart: Date,
  periodEnd: Date,
  scheduledDates: Set<string>,
): ScheduleSuggestion {
  const suggestedDate = findAvailableDate(
    periodStart,
    periodEnd,
    scheduledDates,
  );

  return {
    itemId,
    suggestedDate: format(suggestedDate, "yyyy-MM-dd"),
    suggestedTime: "10:00", // Default to 10 AM
    confidence: "low",
    reason: "No history yet - suggestion based on availability",
  };
}

function findAvailableDate(
  periodStart: Date,
  periodEnd: Date,
  scheduledDates: Set<string>,
): Date {
  // Try to distribute tasks throughout the period
  const current = new Date(periodStart);

  // First pass: find weekend days (typically more free time)
  while (current <= periodEnd) {
    const dateStr = format(current, "yyyy-MM-dd");
    const isWeekend = current.getDay() === 0 || current.getDay() === 6;
    if (isWeekend && !scheduledDates.has(dateStr)) {
      return new Date(current);
    }
    current.setDate(current.getDate() + 1);
  }

  // Second pass: any available day
  current.setTime(periodStart.getTime());
  while (current <= periodEnd) {
    const dateStr = format(current, "yyyy-MM-dd");
    if (!scheduledDates.has(dateStr)) {
      return new Date(current);
    }
    current.setDate(current.getDate() + 1);
  }

  // Fallback to period start if everything is scheduled
  return new Date(periodStart);
}

async function enhanceWithAI(
  suggestions: ScheduleSuggestion[],
  patterns: CompletionPattern[],
  periodStart: string,
  periodEnd: string,
): Promise<ScheduleSuggestion[]> {
  const prompt = `You are a scheduling assistant. Given these task suggestions and completion patterns, provide brief optimization advice.

Current suggestions:
${suggestions.map((s) => `- ${s.itemId}: ${s.suggestedDate} (${s.confidence} confidence) - ${s.reason}`).join("\n")}

Patterns available:
${patterns.map((p) => `- ${p.title}: Preferred day ${p.preferred_day_of_week !== null ? DAY_NAMES[p.preferred_day_of_week] : "unknown"}, ${p.total_completions} completions`).join("\n")}

Period: ${periodStart} to ${periodEnd}

Respond with a JSON array matching the input structure, with enhanced "reason" fields that include actionable advice. Keep the same dates unless there's a clear conflict.
Format: [{"itemId": "...", "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:mm or null", "confidence": "high|medium|low", "reason": "..."}]`;

  const result = await generateContentWithFallback({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    },
  });

  const responseText = result.text || "";

  // Try to parse JSON from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const enhanced = JSON.parse(jsonMatch[0]) as ScheduleSuggestion[];
      return enhanced;
    } catch {
      // Fall back to original suggestions
      return suggestions;
    }
  }

  return suggestions;
}
