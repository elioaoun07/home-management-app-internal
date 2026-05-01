// src/app/api/focus-insights/route.ts
// Smart AI-powered focus insights with persistent caching
// Minimizes Gemini API calls - max 1 per user per day

import { generateContentWithFallback } from "@/lib/ai/gemini";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";
import { differenceInHours, format, startOfWeek } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cache expiry: 24 hours for normal refresh, but can use stale data up to 7 days
const CACHE_FRESH_HOURS = 24;
const CACHE_MAX_STALE_HOURS = 168; // 7 days

interface FocusItem {
  id: string;
  type: "reminder" | "event" | "task";
  title: string;
  description?: string;
  dueAt?: string;
  priority: string;
  isCompleted: boolean;
  isOverdue: boolean;
}

interface FocusInsight {
  id: string;
  greeting: string;
  summary: string;
  focusTip: string | null;
  priorityInsights: Array<{
    itemId: string;
    reason: string;
    suggestedAction?: string;
  }>;
  patternObservations: string | null;
  encouragement: string | null;
  generatedAt: string;
  expiresAt: string;
  itemCountAtGeneration: number;
  isStale: boolean;
  newItemsSinceGeneration: number;
}

function hashItems(items: FocusItem[]): string {
  const data = items.map((i) => `${i.id}:${i.isCompleted}`).join("|");
  return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * GET /api/focus-insights
 * Returns cached insights if valid, or indicates need for generation
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    // Get current items count for comparison
    const { count: currentItemCount } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("status", "in", '("archived","cancelled")');

    // Check for existing insight
    const { data: existingInsight, error } = await supabase
      .from("focus_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStartStr)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching focus insight:", error);
    }

    if (existingInsight) {
      const expiresAt = new Date(existingInsight.expires_at);
      const generatedAt = new Date(existingInsight.generated_at);
      const now = new Date();
      const hoursSinceGeneration = differenceInHours(now, generatedAt);

      const isFresh = now < expiresAt;
      const isUsable = hoursSinceGeneration < CACHE_MAX_STALE_HOURS;
      const newItemsSinceGeneration = Math.max(
        0,
        (currentItemCount || 0) - existingInsight.item_count_at_generation,
      );

      if (isUsable) {
        return NextResponse.json({
          insight: {
            id: existingInsight.id,
            greeting: existingInsight.greeting,
            summary: existingInsight.summary,
            focusTip: existingInsight.focus_tip,
            priorityInsights: existingInsight.priority_insights || [],
            patternObservations: existingInsight.pattern_observations,
            encouragement: existingInsight.encouragement,
            generatedAt: existingInsight.generated_at,
            expiresAt: existingInsight.expires_at,
            itemCountAtGeneration: existingInsight.item_count_at_generation,
            isStale: !isFresh,
            newItemsSinceGeneration,
          } as FocusInsight,
          cached: true,
          shouldRefresh: !isFresh,
        });
      }
    }

    // No valid cached insight
    return NextResponse.json({
      insight: null,
      cached: false,
      shouldRefresh: true,
    });
  } catch (error) {
    console.error("Focus insights GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/focus-insights
 * Generate new AI insights - rate limited to 1 per user per day
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
    const { items, forceRefresh = false } = body as {
      items: FocusItem[];
      forceRefresh?: boolean;
    };

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const now = new Date();

    // Check if we already have a fresh insight (prevent duplicate calls)
    if (!forceRefresh) {
      const { data: existingInsight } = await supabase
        .from("focus_insights")
        .select("id, generated_at, expires_at")
        .eq("user_id", user.id)
        .eq("week_start", weekStartStr)
        .single();

      if (existingInsight) {
        const generatedAt = new Date(existingInsight.generated_at);
        const hoursSinceGeneration = differenceInHours(now, generatedAt);

        // If generated less than 6 hours ago, don't regenerate
        if (hoursSinceGeneration < 6) {
          return NextResponse.json(
            {
              error: "Insights were recently generated. Please wait.",
              retryAfterHours: 6 - hoursSinceGeneration,
            },
            { status: 429 },
          );
        }
      }
    }

    // Check daily rate limit using ai_messages table
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayFocusInsightCalls } = await supabase
      .from("focus_insights")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("generated_at", todayStart.toISOString());

    if ((todayFocusInsightCalls || 0) >= 2) {
      return NextResponse.json(
        {
          error: "Daily focus insight limit reached. Try again tomorrow.",
          retryAfterHours: 24 - now.getHours(),
        },
        { status: 429 },
      );
    }

    // Prepare items context for AI
    const itemsContext = items.slice(0, 20).map((item) => ({
      type: item.type,
      title: item.title,
      description: item.description?.slice(0, 100),
      due: item.dueAt,
      priority: item.priority,
      status: item.isCompleted
        ? "completed"
        : item.isOverdue
          ? "overdue"
          : "pending",
    }));

    const overdueCount = items.filter(
      (i) => i.isOverdue && !i.isCompleted,
    ).length;
    const completedCount = items.filter((i) => i.isCompleted).length;
    const upcomingCount = items.filter(
      (i) => !i.isCompleted && !i.isOverdue,
    ).length;

    const hour = now.getHours();
    const dayOfWeek = format(now, "EEEE");
    const dateFormatted = format(now, "MMMM d, yyyy");

    const prompt = `You are Focus, a smart personal AI assistant for task and reminder management.

Current context:
- Day: ${dayOfWeek}, ${dateFormatted}
- Time of day: ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night"}
- Total items this week: ${items.length}
- Overdue: ${overdueCount}
- Completed this week: ${completedCount}
- Upcoming: ${upcomingCount}

User's items (up to 20):
${JSON.stringify(itemsContext, null, 2)}

Generate a personalized focus briefing. Respond in JSON format ONLY:
{
  "greeting": "A warm, personalized greeting based on time of day (1 sentence)",
  "summary": "Brief overview of their day/week status (2-3 sentences max)",
  "focusTip": "One actionable productivity tip based on their current items (1 sentence, or null if not applicable)",
  "priorityInsights": [
    {
      "itemTitle": "exact title from items",
      "reason": "why this should be prioritized",
      "suggestedAction": "optional specific action"
    }
  ],
  "patternObservations": "Any patterns you notice (e.g., 'You have multiple health tasks - consider batching them') or null",
  "encouragement": "Motivational message based on their progress (1 sentence, or null if no completions)"
}

Keep the tone friendly but professional. Be concise - users want quick insights, not essays.
Max 3 items in priorityInsights. Focus on what matters most.`;

    // Call Gemini
    const response = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 800,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    // Parse JSON response
    let aiInsight;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      aiInsight = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      // Fallback to default insights
      aiInsight = {
        greeting:
          hour < 12
            ? "Good morning! Ready to tackle the day?"
            : hour < 17
              ? "Good afternoon! Let's keep the momentum going."
              : "Good evening! Time to wrap up or plan ahead.",
        summary:
          upcomingCount > 0
            ? `You have ${upcomingCount} items ahead of you${overdueCount > 0 ? ` and ${overdueCount} need attention from earlier` : ""}.`
            : completedCount > 0
              ? `Amazing progress! You've completed ${completedCount} items this week.`
              : "Your schedule is clear. Perfect time to plan ahead!",
        focusTip:
          overdueCount > 0
            ? "Consider tackling overdue items first to clear your mental backlog."
            : null,
        priorityInsights: [],
        patternObservations: null,
        encouragement:
          completedCount > 0
            ? `Great work on completing ${completedCount} item${completedCount > 1 ? "s" : ""}!`
            : null,
      };
    }

    // Map priority insights to use item IDs
    const priorityInsights = (aiInsight.priorityInsights || [])
      .slice(0, 3)
      .map(
        (pi: {
          itemTitle?: string;
          reason: string;
          suggestedAction?: string;
        }) => {
          const matchedItem = items.find(
            (i) => i.title.toLowerCase() === pi.itemTitle?.toLowerCase(),
          );
          return {
            itemId: matchedItem?.id || null,
            reason: pi.reason,
            suggestedAction: pi.suggestedAction,
          };
        },
      )
      .filter((pi: { itemId: string | null }) => pi.itemId);

    const expiresAt = new Date(
      now.getTime() + CACHE_FRESH_HOURS * 60 * 60 * 1000,
    );
    const itemsHash = hashItems(items);

    // Upsert the insight
    const { data: savedInsight, error: saveError } = await supabase
      .from("focus_insights")
      .upsert(
        {
          user_id: user.id,
          week_start: weekStartStr,
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          items_snapshot_hash: itemsHash,
          item_count_at_generation: items.length,
          greeting: aiInsight.greeting,
          summary: aiInsight.summary,
          focus_tip: aiInsight.focusTip,
          priority_insights: priorityInsights,
          pattern_observations: aiInsight.patternObservations,
          encouragement: aiInsight.encouragement,
          completed_count_at_generation: completedCount,
          overdue_count_at_generation: overdueCount,
        },
        {
          onConflict: "user_id,week_start",
        },
      )
      .select()
      .single();

    if (saveError) {
      console.error("Error saving focus insight:", saveError);
      // Still return the insight even if save fails
    }

    return NextResponse.json({
      insight: {
        id: savedInsight?.id || crypto.randomUUID(),
        greeting: aiInsight.greeting,
        summary: aiInsight.summary,
        focusTip: aiInsight.focusTip,
        priorityInsights,
        patternObservations: aiInsight.patternObservations,
        encouragement: aiInsight.encouragement,
        generatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        itemCountAtGeneration: items.length,
        isStale: false,
        newItemsSinceGeneration: 0,
      } as FocusInsight,
      cached: false,
      shouldRefresh: false,
    });
  } catch (error) {
    console.error("Focus insights POST error:", error);

    // Check if it's a rate limit error from Gemini
    if (error instanceof Error && error.message.includes("429")) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again later." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 },
    );
  }
}
