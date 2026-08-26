import {
  type AnalysisReport,
  generateAnalysisReport,
  isAnalysisIntent,
} from "@/lib/ai/analysisReport";
import { fetchBudgetContext } from "@/lib/ai/context";
import {
  BudgetContext,
  ChatMessage,
  GeminiRateLimitError,
  generateSystemPrompt,
  sendMessageToGemini,
  streamMessageToGemini,
} from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  getAIUsageStats,
  MONTHLY_TOKEN_LIMIT,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { estimateTokens } from "@/lib/ai/tokenUtils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Rate limiting: Track Gemini API rate limits with exponential backoff
let lastRateLimitError: number = 0;
let rateLimitCooldownMs = 30000; // Start with 30 seconds

function isRateLimited(): { limited: boolean; retryInSeconds: number } {
  if (lastRateLimitError === 0) return { limited: false, retryInSeconds: 0 };
  const elapsed = Date.now() - lastRateLimitError;
  const remaining = rateLimitCooldownMs - elapsed;
  if (remaining <= 0) {
    return { limited: false, retryInSeconds: 0 };
  }
  return { limited: true, retryInSeconds: Math.ceil(remaining / 1000) };
}

function recordRateLimitError(errorMessage: string): number {
  lastRateLimitError = Date.now();

  // Extract retry-after if available from error message
  const retryMatch = errorMessage.match(/retry in ([\d.]+)s/i);
  if (retryMatch) {
    rateLimitCooldownMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 5000; // Add 5s buffer
  } else {
    // Exponential backoff: double the cooldown up to 5 min max
    rateLimitCooldownMs = Math.min(rateLimitCooldownMs * 2, 300000);
  }

  console.log(
    `AI Chat rate limit cooldown set to ${rateLimitCooldownMs / 1000}s`,
  );
  return Math.ceil(rateLimitCooldownMs / 1000);
}

interface ChatRequest {
  message: string;
  chatHistory?: ChatMessage[];
  includeContext?: boolean;
  sessionId?: string;
  parentMessageId?: string;
  /** When true, stream tokens as SSE instead of returning a buffered JSON response. */
  stream?: boolean;
  /** "analysis" forces a structured spending-analysis report (dashboard-ready). */
  mode?: "chat" | "analysis";
}

/**
 * POST /api/ai-chat
 * Send a message to the AI assistant with optional budget context
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ChatRequest = await req.json();
    const {
      message,
      chatHistory = [],
      includeContext = true,
      sessionId,
      parentMessageId,
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // Decide whether to produce a structured, dashboard-ready analysis report.
    // Forced via { mode: "analysis" } (the "View as Dashboard" affordance) or
    // detected from the message intent. Buffered only — never on the SSE path.
    const wantsAnalysis =
      !body.stream &&
      includeContext &&
      (body.mode === "analysis" || isAnalysisIntent(message));

    // Check monthly usage before making request
    const monthlyUsage = await getMonthlyTokenUsage(supabase, user.id);
    if (monthlyUsage >= MONTHLY_TOKEN_LIMIT) {
      return NextResponse.json(
        {
          error: "Monthly token limit reached. Please try again next month.",
          usage: {
            used: monthlyUsage,
            limit: MONTHLY_TOKEN_LIMIT,
            percentage: 100,
          },
        },
        { status: 429 },
      );
    }

    // Check if we're in a rate limit cooldown period (in-memory, fast check)
    const inMemoryRateLimit = isRateLimited();
    if (inMemoryRateLimit.limited) {
      return NextResponse.json(
        {
          error: `AI is temporarily unavailable due to rate limits. Please try again in ${inMemoryRateLimit.retryInSeconds} seconds.`,
          retryAfter: inMemoryRateLimit.retryInSeconds,
        },
        { status: 429 },
      );
    }

    // Generate request hash for deduplication
    const requestHash = generateRequestHash(message, sessionId);

    // Check persistent rate limit (Supabase-based, works across instances)
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

    // Record request hash for deduplication (rate limiting uses ai_messages)
    await recordRequestHash(supabase, user.id, "ai-chat", requestHash);

    // Build budget context if requested
    let budgetContext: BudgetContext | undefined;

    if (includeContext) {
      try {
        budgetContext = await fetchBudgetContext(supabase, user.id, {
          includeTrend: wantsAnalysis,
        });
      } catch (error) {
        console.error("Failed to fetch budget context:", error);
        // Continue without context
      }
    }

    // Convert chat history dates from strings to Date objects
    const formattedHistory: ChatMessage[] = chatHistory.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));

    // Estimate input tokens before making request
    const systemPrompt = generateSystemPrompt(budgetContext);
    const chatHistoryText = formattedHistory.map((m) => m.content).join(" ");
    const inputTokensEstimate =
      estimateTokens(systemPrompt) +
      estimateTokens(chatHistoryText) +
      estimateTokens(message);

    // ── Streaming path ──────────────────────────────────────────────────────
    if (body.stream) {
      const enc = new TextEncoder();
      const sse = (data: Record<string, unknown>) =>
        enc.encode(`data: ${JSON.stringify(data)}\n\n`);
      const streamStartTime = Date.now();

      const readable = new ReadableStream({
        async start(ctrl) {
          let fullText = "";
          try {
            for await (const chunk of streamMessageToGemini(
              message,
              formattedHistory,
              budgetContext,
            )) {
              fullText += chunk;
              ctrl.enqueue(sse({ type: "chunk", text: chunk }));
            }
            ctrl.enqueue(sse({ type: "done" }));
            const outputTokensEstimate = estimateTokens(fullText);
            await logMessagesToDatabase(supabase, {
              userId: user.id,
              sessionId: sessionId || `session_${Date.now()}`,
              userMessage: message,
              assistantResponse: fullText,
              inputTokens: inputTokensEstimate,
              outputTokens: outputTokensEstimate,
              includedBudgetContext: includeContext && !!budgetContext,
              responseTimeMs: Date.now() - streamStartTime,
              parentMessageId: parentMessageId || null,
            });
          } catch (err) {
            const msg =
              err instanceof GeminiRateLimitError ? err.message : "AI error";
            ctrl.enqueue(sse({ type: "error", error: msg }));
          } finally {
            ctrl.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Send message to Gemini with detailed error capture
    let response: string;
    let analysisReport: AnalysisReport | undefined;
    try {
      if (wantsAnalysis && budgetContext) {
        // Structured, dashboard-ready report. generateAnalysisReport never throws
        // — it falls back to a deterministic report so the dashboard always works.
        analysisReport = await generateAnalysisReport({
          message,
          history: formattedHistory,
          context: budgetContext,
        });
        response =
          analysisReport.narrative ||
          analysisReport.headline ||
          "Here's your spending analysis.";
      } else {
        response = await sendMessageToGemini(
          message,
          formattedHistory,
          budgetContext,
        );
      }
    } catch (geminiError) {
      // Capture Gemini-specific errors with full details
      const errMsg =
        geminiError instanceof Error
          ? geminiError.message
          : String(geminiError);
      const errStack =
        geminiError instanceof Error ? geminiError.stack : undefined;
      throw new Error(`Gemini call failed: ${errMsg}`, {
        cause: { stack: errStack },
      });
    }

    const responseTime = Date.now() - startTime;

    // Estimate output tokens
    const outputTokensEstimate = estimateTokens(response);
    const totalTokensEstimate = inputTokensEstimate + outputTokensEstimate;

    // Log messages to new ai_messages table
    const messageIds = await logMessagesToDatabase(supabase, {
      userId: user.id,
      sessionId: sessionId || `session_${Date.now()}`,
      userMessage: message,
      assistantResponse: response,
      inputTokens: inputTokensEstimate,
      outputTokens: outputTokensEstimate,
      includedBudgetContext: includeContext && !!budgetContext,
      responseTimeMs: responseTime,
      parentMessageId: parentMessageId || null,
      analysisReport,
    });

    // Calculate updated usage
    const newMonthlyUsage = monthlyUsage + totalTokensEstimate;

    return NextResponse.json({
      message: response,
      // Present only for analysis requests — drives the "View as Dashboard" view.
      report: analysisReport,
      timestamp: new Date().toISOString(),
      messageIds, // Return the new message IDs for reference
      usage: {
        requestTokens: totalTokensEstimate,
        inputTokens: inputTokensEstimate,
        outputTokens: outputTokensEstimate,
        monthlyUsed: newMonthlyUsage,
        monthlyLimit: MONTHLY_TOKEN_LIMIT,
        monthlyPercentage:
          Math.round((newMonthlyUsage / MONTHLY_TOKEN_LIMIT) * 100 * 10) / 10,
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error("AI Chat error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : "UnknownError";

    // Log detailed error to database for debugging
    try {
      const supabase = await supabaseServer(await cookies());
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("error_logs").insert({
          user_id: user.id,
          error_message: `AI Chat Error: ${errorMessage}`,
          error_stack: errorStack || null,
          context: JSON.stringify({
            errorName,
            endpoint: "/api/ai-chat",
            timestamp: new Date().toISOString(),
          }),
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    // Typed rate-limit from the centralized helper — distinguishes daily
    // RPD exhaustion (no useful retry until midnight Pacific) from per-minute
    // throttling. Both buckets (primary + fallback model) were already exhausted
    // by the time we reach here.
    if (error instanceof GeminiRateLimitError) {
      recordRateLimitError(errorMessage); // keep in-memory cooldown in sync
      return NextResponse.json(
        {
          error: error.message,
          retryAfter: error.retryAfterSeconds,
          dailyQuotaExhausted: error.daily,
        },
        { status: 429 },
      );
    }

    // Fallback: non-typed rate-limit error (older code path or third-party).
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED")
    ) {
      // Record the rate limit and get cooldown
      const retrySeconds = recordRateLimitError(errorMessage);

      return NextResponse.json(
        {
          error: `AI is temporarily unavailable due to rate limits. Please try again in ${retrySeconds} seconds.`,
          retryAfter: retrySeconds,
        },
        { status: 429 },
      );
    }

    // Check for API key issues
    if (errorMessage.includes("API key") || errorMessage.includes("401")) {
      return NextResponse.json(
        { error: "AI service not configured. Please check your API key." },
        { status: 503 },
      );
    }

    // Check for network/timeout errors
    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("fetch failed")
    ) {
      return NextResponse.json(
        { error: "AI service timed out. Please try again." },
        { status: 504 },
      );
    }

    // Return full error details for debugging (temporarily)
    return NextResponse.json(
      {
        error: `Failed to get AI response: ${errorMessage}`,
        debug: {
          name: errorName,
          message: errorMessage,
          stack: errorStack?.split("\n").slice(0, 5).join("\n"),
        },
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/ai-chat
 * Get chat history and usage stats
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

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Try new ai_messages table first, fall back to ai_chat_logs
    let messages: Array<{
      id: string;
      role: string;
      content: string;
      created_at: string;
      input_tokens?: number;
      output_tokens?: number;
      is_edited?: boolean;
      analysis_report?: AnalysisReport | null;
    }> = [];

    if (sessionId) {
      // Query from ai_messages table
      const { data: newMessages, error: newError } = await supabase
        .from("ai_messages")
        .select(
          "id, role, content, created_at, input_tokens, output_tokens, is_edited, analysis_report, sequence_num",
        )
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .eq("is_active", true)
        .order("sequence_num", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(limit);

      if (isMissingAnalysisReportColumn(newError)) {
        const { data: fallbackMessages, error: fallbackError } = await supabase
          .from("ai_messages")
          .select(
            "id, role, content, created_at, input_tokens, output_tokens, is_edited, sequence_num",
          )
          .eq("user_id", user.id)
          .eq("session_id", sessionId)
          .eq("is_active", true)
          .order("sequence_num", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(limit);

        if (fallbackError) {
          console.error("Failed to fetch messages:", fallbackError);
        } else if (fallbackMessages) {
          messages = fallbackMessages;
        }
      } else if (newError) {
        console.error("Failed to fetch messages:", newError);
      } else if (newMessages) {
        messages = newMessages;
      }
    }

    // Get unified usage stats from ai_messages (single source of truth)
    const usageStats = await getAIUsageStats(supabase, user.id);

    return NextResponse.json({
      messages,
      // Keep chatHistory for backward compatibility
      chatHistory: messages,
      usage: {
        // Monthly token stats
        monthlyUsed: usageStats.monthlyTokensUsed,
        monthlyLimit: usageStats.monthlyTokenLimit,
        monthlyPercentage: usageStats.monthlyPercentage,
        remaining: usageStats.monthlyTokenLimit - usageStats.monthlyTokensUsed,
        // Rate limit stats (per minute)
        requestsInLastMinute: usageStats.requestsInLastMinute,
        maxRequestsPerMinute: usageStats.maxRequestsPerMinute,
        // Today's stats
        todayRequests: usageStats.todayRequests,
        todayTokens: usageStats.todayTokens,
      },
    });
  } catch (error) {
    console.error("AI Chat GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/ai-chat
 * Edit a message or regenerate a response
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, action, newContent } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    if (action === "edit" && newContent) {
      // Get original message
      const { data: original } = await supabase
        .from("ai_messages")
        .select("content")
        .eq("id", messageId)
        .eq("user_id", user.id)
        .single();

      // Update the message
      const { error } = await supabase
        .from("ai_messages")
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
          original_content: original?.content || null,
        })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to edit message:", error);
        return NextResponse.json(
          { error: "Failed to edit message" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "deactivate") {
      // Mark message and all subsequent messages as inactive (for regeneration)
      const { data: message } = await supabase
        .from("ai_messages")
        .select("session_id, sequence_num")
        .eq("id", messageId)
        .eq("user_id", user.id)
        .single();

      if (message) {
        await supabase
          .from("ai_messages")
          .update({ is_active: false })
          .eq("session_id", message.session_id)
          .eq("user_id", user.id)
          .gte("sequence_num", message.sequence_num);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("AI Chat PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 },
    );
  }
}

/**
 * Log messages to the new ai_messages table
 */
async function logMessagesToDatabase(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  data: {
    userId: string;
    sessionId: string;
    userMessage: string;
    assistantResponse: string;
    inputTokens: number;
    outputTokens: number;
    includedBudgetContext: boolean;
    responseTimeMs: number;
    parentMessageId: string | null;
    analysisReport?: AnalysisReport;
  },
): Promise<{
  userMessageId: string | null;
  assistantMessageId: string | null;
}> {
  try {
    // Ensure session exists
    await supabase.from("ai_sessions").upsert(
      {
        id: data.sessionId,
        user_id: data.userId,
        title:
          data.userMessage.slice(0, 50) +
          (data.userMessage.length > 50 ? "..." : ""),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    // Get the next sequence number
    const { data: lastMessage } = await supabase
      .from("ai_messages")
      .select("sequence_num")
      .eq("session_id", data.sessionId)
      .eq("user_id", data.userId)
      .order("sequence_num", { ascending: false })
      .limit(1)
      .single();

    const nextSeq = (lastMessage?.sequence_num || 0) + 1;

    // Insert user message
    const { data: userMsg, error: userError } = await supabase
      .from("ai_messages")
      .insert({
        user_id: data.userId,
        session_id: data.sessionId,
        role: "user",
        content: data.userMessage,
        parent_id: data.parentMessageId,
        sequence_num: nextSeq,
        input_tokens: data.inputTokens,
      })
      .select("id")
      .single();

    if (userError) {
      console.error("Failed to insert user message:", userError);
      return { userMessageId: null, assistantMessageId: null };
    }

    const assistantInsert = {
      user_id: data.userId,
      session_id: data.sessionId,
      role: "assistant",
      content: data.assistantResponse,
      parent_id: userMsg.id,
      sequence_num: nextSeq + 1,
      output_tokens: data.outputTokens,
      included_budget_context: data.includedBudgetContext,
      response_time_ms: data.responseTimeMs,
      analysis_report: data.analysisReport ?? null,
    };

    // Insert assistant message
    let { data: assistantMsg, error: assistantError } = await supabase
      .from("ai_messages")
      .insert(assistantInsert)
      .select("id")
      .single();

    if (isMissingAnalysisReportColumn(assistantError)) {
      const fallbackInsert: Omit<typeof assistantInsert, "analysis_report"> & {
        analysis_report?: AnalysisReport | null;
      } = { ...assistantInsert };
      delete fallbackInsert.analysis_report;
      const fallback = await supabase
        .from("ai_messages")
        .insert(fallbackInsert)
        .select("id")
        .single();
      assistantMsg = fallback.data;
      assistantError = fallback.error;
    }

    if (assistantError) {
      console.error("Failed to insert assistant message:", assistantError);
    }

    return {
      userMessageId: userMsg?.id || null,
      assistantMessageId: assistantMsg?.id || null,
    };
  } catch (error) {
    console.error("Failed to log messages:", error);
    return { userMessageId: null, assistantMessageId: null };
  }
}

function isMissingAnalysisReportColumn(error: {
  code?: string;
  message?: string;
} | null): boolean {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.message?.includes("analysis_report")),
  );
}

/**
 * Get monthly token usage for a user (from ai_messages table)
 */
async function getMonthlyTokenUsage(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
): Promise<number> {
  try {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

    // Try using total_tokens column first (if migration applied)
    // Fall back to summing input_tokens + output_tokens
    const { data, error } = await supabase
      .from("ai_messages")
      .select("input_tokens, output_tokens")
      .eq("user_id", userId)
      .eq("is_active", true)
      .gte("created_at", startOfMonth);

    if (error) {
      console.error("Failed to fetch monthly usage:", error);
      return 0;
    }

    // Sum all tokens (input + output) from all messages
    return (data || []).reduce((sum, row) => {
      const input = row.input_tokens || 0;
      const output = row.output_tokens || 0;
      return sum + input + output;
    }, 0);
  } catch (error) {
    console.error("Failed to get monthly usage:", error);
    return 0;
  }
}
