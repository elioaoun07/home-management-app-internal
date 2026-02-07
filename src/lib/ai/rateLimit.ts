// src/lib/ai/rateLimit.ts
// Unified rate limiting and usage tracking for Gemini API
// Uses ai_messages as single source of truth for both tokens and rate limits
// Works across serverless instances

import { SupabaseClient } from "@supabase/supabase-js";

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per user per minute (conservative)
const GLOBAL_MAX_REQUESTS_PER_WINDOW = 10; // Global limit across all users
const DEDUP_WINDOW_MS = 5_000; // 5 second deduplication window

// Monthly limits
export const MONTHLY_TOKEN_LIMIT = 1_000_000;

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: string;
}

export interface AIUsageStats {
  // Rate limiting (per minute)
  requestsInLastMinute: number;
  maxRequestsPerMinute: number;
  // Token usage (monthly)
  monthlyTokensUsed: number;
  monthlyTokenLimit: number;
  monthlyPercentage: number;
  // Today's stats
  todayRequests: number;
  todayTokens: number;
}

/**
 * Get comprehensive AI usage stats for a user
 * Single source of truth from ai_messages table
 */
export async function getAIUsageStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<AIUsageStats> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    // Get requests in last minute (for rate limit display)
    const { count: minuteCount } = await supabase
      .from("ai_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user") // Only count user messages (1 per request)
      .gte("created_at", oneMinuteAgo.toISOString());

    // Get monthly token usage
    const { data: monthlyData } = await supabase
      .from("ai_messages")
      .select("input_tokens, output_tokens")
      .eq("user_id", userId)
      .eq("is_active", true)
      .gte("created_at", startOfMonth.toISOString());

    const monthlyTokens = (monthlyData || []).reduce((sum, row) => {
      return sum + (row.input_tokens || 0) + (row.output_tokens || 0);
    }, 0);

    // Get today's stats
    const { data: todayData, count: todayCount } = await supabase
      .from("ai_messages")
      .select("input_tokens, output_tokens", { count: "exact" })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", startOfDay.toISOString());

    const todayTokens = (todayData || []).reduce((sum, row) => {
      return sum + (row.input_tokens || 0) + (row.output_tokens || 0);
    }, 0);

    return {
      requestsInLastMinute: minuteCount || 0,
      maxRequestsPerMinute: MAX_REQUESTS_PER_WINDOW,
      monthlyTokensUsed: monthlyTokens,
      monthlyTokenLimit: MONTHLY_TOKEN_LIMIT,
      monthlyPercentage:
        Math.round((monthlyTokens / MONTHLY_TOKEN_LIMIT) * 100 * 10) / 10,
      todayRequests: todayCount || 0,
      todayTokens,
    };
  } catch (error) {
    console.error("Failed to get AI usage stats:", error);
    return {
      requestsInLastMinute: 0,
      maxRequestsPerMinute: MAX_REQUESTS_PER_WINDOW,
      monthlyTokensUsed: 0,
      monthlyTokenLimit: MONTHLY_TOKEN_LIMIT,
      monthlyPercentage: 0,
      todayRequests: 0,
      todayTokens: 0,
    };
  }
}

/**
 * Check if a user is rate limited for AI requests
 * Uses ai_messages table as single source of truth
 */
export async function checkUserRateLimit(
  supabase: SupabaseClient,
  userId: string,
  requestHash?: string,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const dedupStart = new Date(now.getTime() - DEDUP_WINDOW_MS);

  try {
    // Check for duplicate request using ai_messages (same content hash within 5s)
    if (requestHash) {
      // Check ai_rate_limits for dedup (fast, short-lived entries)
      const { data: duplicates } = await supabase
        .from("ai_rate_limits")
        .select("id")
        .eq("user_id", userId)
        .eq("request_hash", requestHash)
        .gte("created_at", dedupStart.toISOString())
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(DEDUP_WINDOW_MS / 1000),
          reason: "Duplicate request detected. Please wait a moment.",
        };
      }
    }

    // Count user's requests in the current window using ai_messages
    // Count user messages only (each request = 1 user message)
    const { count: userCount, error: countError } = await supabase
      .from("ai_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", windowStart.toISOString());

    if (countError) {
      console.error("Rate limit check error:", countError);
      // On error, allow the request but log it
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if ((userCount || 0) >= MAX_REQUESTS_PER_WINDOW) {
      // Calculate when the oldest request will expire
      const { data: oldest } = await supabase
        .from("ai_messages")
        .select("created_at")
        .eq("user_id", userId)
        .eq("role", "user")
        .gte("created_at", windowStart.toISOString())
        .order("created_at", { ascending: true })
        .limit(1);

      let retryAfter = 60;
      if (oldest && oldest[0]) {
        const oldestTime = new Date(oldest[0].created_at).getTime();
        retryAfter = Math.ceil(
          (oldestTime + RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000,
        );
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.max(retryAfter, 5),
        reason: `Rate limit exceeded. Max ${MAX_REQUESTS_PER_WINDOW} AI requests per minute.`,
      };
    }

    // Check global rate limit (across all users)
    const { count: globalCount } = await supabase
      .from("ai_messages")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", windowStart.toISOString());

    if ((globalCount || 0) >= GLOBAL_MAX_REQUESTS_PER_WINDOW) {
      return {
        allowed: false,
        retryAfterSeconds: 30,
        reason: "Service is busy. Please try again in 30 seconds.",
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // On error, allow the request
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Record a request hash for deduplication (short-lived, separate from message logging)
 * This is called BEFORE the AI request to prevent duplicates
 */
export async function recordRequestHash(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  requestHash: string,
): Promise<void> {
  try {
    await supabase.from("ai_rate_limits").insert({
      user_id: userId,
      endpoint,
      request_hash: requestHash,
      created_at: new Date().toISOString(),
    });

    // Clean up old entries (older than 5 minutes) - async, don't wait
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    void supabase
      .from("ai_rate_limits")
      .delete()
      .lt("created_at", fiveMinutesAgo)
      .then(() => {});
  } catch (error) {
    console.error("Failed to record request hash:", error);
  }
}

/**
 * @deprecated Use recordRequestHash instead. Rate limiting now uses ai_messages.
 */
export async function recordAIRequest(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  requestHash?: string,
): Promise<void> {
  if (requestHash) {
    await recordRequestHash(supabase, userId, endpoint, requestHash);
  }
}

/**
 * Generate a hash for request deduplication
 */
export function generateRequestHash(message: string, context?: string): string {
  // Simple hash - take first 100 chars of normalized message
  const normalized = (message + (context || ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
