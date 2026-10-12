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
  MONTHLY_TOKEN_LIMIT,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
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
  const monthlyUsageQuery = supabase
    .from("ai_messages")
    .select("input_tokens, output_tokens")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth);
  const [autoCountResult, monthlyUsageResult, rateLimitCheck] =
    await Promise.all([
      autoCountQuery ?? Promise.resolve(null),
      monthlyUsageQuery,
      checkUserRateLimit(supabase, user.id, requestHash),
    ]);

  if (
    monthlyUsageResult.error ||
    !monthlyUsageResult.data ||
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

  // Monthly token budget (Hard Rule-adjacent: same ceiling as /api/ai-chat).
  const usageRows = monthlyUsageResult.data;
  const monthlyUsage = (usageRows ?? []).reduce(
    (sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
    0,
  );
  if (monthlyUsage >= MONTHLY_TOKEN_LIMIT) {
    return NextResponse.json(
      { error: "Monthly token limit reached." },
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
  after(async () => {
    const { error } = await supabase.from("ai_messages").insert([
      {
        user_id: user.id,
        session_id: sessionId,
        role: "user",
        content: message,
        input_tokens: usage?.inputTokens ?? 0,
        output_tokens: 0,
        model_used: usage
          ? `${usage.model}${usage.estimated ? ":estimated" : ""}`
          : "unknown:no-response",
      },
      {
        user_id: user.id,
        session_id: sessionId,
        role: "assistant",
        content: result.text,
        input_tokens: 0,
        output_tokens: usage?.outputTokens ?? 0,
        model_used: usage
          ? `${usage.model}${usage.estimated ? ":estimated" : ""}`
          : "unknown:no-response",
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
