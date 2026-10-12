// src/app/api/era/ask/route.ts
// ERA "Ask AI" — the AI handoff. Reached either by an explicit tap in the
// ERA Hub UI, or (Stage C) automatically from useEraTurn when the
// deterministic router misses AND the miss classifies as a "language gap"
// (see missTracking.ts) — a genuine "I don't do that" (capability gap) never
// reaches here on the auto path, only on a manual tap. Builds face-scoped
// context (src/lib/ai/context.ts), asks Gemini for either a plain answer or
// a validated proposal (src/lib/ai/eraAskProposal.ts), and returns it
// with an owner-bound context-source receipt — this route performs no domain
// writes. The client decides what to
// render and performs any write only on the user's explicit confirm.
//
// Auto-escalations (`auto: true`) are capped per day, separately from the
// existing monthly token ceiling below — a manual tap never counts against
// or is blocked by this cap, only the automatic path is.

import { fetchBudgetContext, fetchScheduleContext } from "@/lib/ai/context";
import {
  generateAskAIResponse,
  type AskAIUsage,
} from "@/lib/ai/eraAskProposal";
import { fetchAdaptiveContext } from "@/lib/ai/eraAdaptiveContextSource";
import {
  contextReceipt,
  historyEntrySchema,
} from "@/lib/ai/eraAdaptiveContext";
import type { ChatMessage } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import {
  aggregateAiUsage,
  type AiUsageReceipt,
} from "@/features/era/aiUsage";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FACE_KEYS = ["budget", "schedule", "chef", "brain"] as const;

/** Stage C — ceiling on how many times a router MISS can auto-escalate to the AI in one day; a manual tap is never subject to this. */
const DAILY_AUTO_ESCALATION_CAP = 15;
/** Tags the ai_messages rows this route inserts so the cap above can count only auto-escalations, never manual "Ask AI" taps. */
const AUTO_SESSION_ID = "era-ask-auto";
const MANUAL_SESSION_ID = "era-ask";

/**
 * Monthly AI spend ceiling per user, in USD (owner decision 2026-10-12;
 * replaces the 1M-token cap, which blocked at ~165 calls ≈ $0.12). Priced
 * from the user's own `ai_messages` receipts (cache-aware, see aiUsage.ts),
 * so it is an estimate that counts after inference: concurrent requests can
 * overshoot by a call or two, which at ~$0.0006 a call is not worth a lock.
 */
const MONTHLY_BUDGET_USD = 1;
const RECEIPT_PAGE = 1000;
const MAX_RECEIPT_PAGES = 20;

/** Every receipt this month — PostgREST caps one response at 1000 rows. */
async function monthlyCostUsd(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  since: string,
): Promise<{ cost: number } | { error: true }> {
  const receipts: AiUsageReceipt[] = [];
  for (let page = 0; page < MAX_RECEIPT_PAGES; page++) {
    const { data, error } = await supabase
      .from("ai_messages")
      .select("created_at, role, session_id, input_tokens, output_tokens, model_used")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(page * RECEIPT_PAGE, (page + 1) * RECEIPT_PAGE - 1);
    if (error || !data) return { error: true };
    receipts.push(...(data as AiUsageReceipt[]));
    if (data.length < RECEIPT_PAGE) break;
  }
  return {
    cost: aggregateAiUsage({ receipts, answers: [], chats: [] }).total.cost,
  };
}

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  face: z.enum(FACE_KEYS),
  history: z.array(historyEntrySchema).max(24).optional().default([]),
  conversationId: z.string().uuid().nullable().optional(),
  /** Binds an optimistic tail to its speaker; never used as a DB identity. */
  historyOwnerId: z.string().uuid().optional(),
  /** Set when a "what time?" question was outstanding — see useEraTurn. */
  pendingReminderTitle: z.string().optional(),
  /**
   * Stage 3 (HUB-29) — focus memory lives in browser state (useEraStore),
   * not the DB, so the client sends the single most recent focus reminder
   * here rather than the server trying to look it up. Used only to resolve
   * a "FOCUS" sentinel in a propose_action proposal — see eraAskProposal.ts.
   */
  focusEntity: z
    .object({
      id: z.string().min(1),
      type: z.literal("reminder"),
      title: z.string().min(1),
      addedAt: z.number(),
    })
    .nullable()
    .optional(),
  /** Stage C — true when useEraTurn escalated this automatically after a language-gap miss; never set by a manual "Ask AI" tap. */
  auto: z.boolean().optional().default(false),
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * `model_used` for a receipt. Suffixes (see src/features/era/aiUsage.ts):
 * `:estimated` = tokens not reported by the API; `:cache=R/W` = R input
 * tokens read from and W written to the prompt cache (subsets of input).
 */
function receiptModel(u: AskAIUsage): string {
  if (u.estimated) return `${u.model}:estimated`;
  const r = u.cacheReadTokens ?? 0;
  const w = u.cacheWriteTokens ?? 0;
  return r || w ? `${u.model}:cache=${r}/${w}` : u.model;
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const {
    message,
    face,
    history,
    historyOwnerId,
    conversationId,
    pendingReminderTitle,
    focusEntity,
    auto,
    localDate,
  } = parsed.data;
  const sessionId = auto ? AUTO_SESSION_ID : MANUAL_SESSION_ID;
  const requestHash = generateRequestHash(message, `era-ask-${face}`);
  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const startOfToday = auto
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    : null;

  // These quota checks are independent. Pay one network latency layer.
  const autoCountQuery = startOfToday
    ? supabase
        .from("ai_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("session_id", AUTO_SESSION_ID)
        .eq("role", "user")
        .gte("created_at", startOfToday)
    : null;
  const [autoCountResult, monthlyUsageResult, rateLimitCheck] =
    await Promise.all([
      autoCountQuery ?? Promise.resolve(null),
      monthlyCostUsd(supabase, user.id, startOfMonth),
      checkUserRateLimit(supabase, user.id, requestHash),
    ]);

  if (
    "error" in monthlyUsageResult ||
    (auto && (autoCountResult?.error || autoCountResult?.count == null))
  ) {
    return NextResponse.json(
      { error: "AI usage is unavailable. Try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Stage C — the daily auto-escalation cap. Counted from this route's own
  // `ai_messages` rows (tagged by session_id), not a new table. A manual tap
  // always uses MANUAL_SESSION_ID and is never counted or blocked here.
  if ((autoCountResult?.count ?? 0) >= DAILY_AUTO_ESCALATION_CAP) {
    return NextResponse.json(
      {
        kind: "prose",
        text: "I'm holding off on AI for now — tap Ask AI directly if you'd like.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Monthly spend ceiling (estimated, per user; see MONTHLY_BUDGET_USD).
  if (monthlyUsageResult.cost >= MONTHLY_BUDGET_USD) {
    return NextResponse.json(
      { error: "Monthly AI budget reached." },
      { status: 429 },
    );
  }

  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: rateLimitCheck.reason ?? "Rate limited" },
      { status: 429 },
    );
  }
  const contextPromise = Promise.all([
    face === "budget"
      ? fetchBudgetContext(supabase, user.id)
      : Promise.resolve(undefined),
    face === "schedule"
      ? fetchScheduleContext(supabase, user.id)
      : Promise.resolve(undefined),
    fetchAdaptiveContext(supabase, {
      owner: user.id,
      message,
      conversationId,
      history,
      historyOwnerId,
    }),
  ]);
  await recordRequestHash(supabase, user.id, "era-ask", requestHash);
  const [budgetContext, scheduleContext, adaptive] = await contextPromise;
  const formattedHistory: ChatMessage[] = adaptive.history.map((m) => ({
    ...m,
    timestamp: now,
  }));

  const metering: AskAIUsage[] = [];
  const result = await generateAskAIResponse({
    message,
    history: formattedHistory,
    face,
    budgetContext,
    scheduleContext,
    pendingReminderTitle,
    focusEntity,
    localDate,
    adaptiveContext: adaptive.context,
    onUsage: (usage) => metering.push(usage),
  });

  // Meter the complete provider response, even if admission refused it.
  // No response means unknown usage, not a fabricated count for fallback prose.
  const usage = metering[0];
  const modelUsed = usage ? receiptModel(usage) : "unknown:no-response";
  after(async () => {
    const { error } = await supabase.from("ai_messages").insert([
      {
        user_id: user.id,
        session_id: sessionId,
        role: "user",
        content: message,
        input_tokens: usage?.inputTokens ?? 0,
        output_tokens: 0,
        model_used: modelUsed,
      },
      {
        user_id: user.id,
        session_id: sessionId,
        role: "assistant",
        content: result.text,
        input_tokens: 0,
        output_tokens: usage?.outputTokens ?? 0,
        model_used: modelUsed,
      },
    ]);
    if (error)
      console.error("[era-ask] usage receipt could not be saved", {
        code: error.code,
      });
  });

  return NextResponse.json(
    { ...result, contextReceipt: contextReceipt(adaptive.context) },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
