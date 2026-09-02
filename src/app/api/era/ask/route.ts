// src/app/api/era/ask/route.ts
// ERA "Ask AI" — the AI handoff. Reached either by an explicit tap in the
// ERA Hub UI, or (Stage C) automatically from useEraTurn when the
// deterministic router misses AND the miss classifies as a "language gap"
// (see missTracking.ts) — a genuine "I don't do that" (capability gap) never
// reaches here on the auto path, only on a manual tap. Builds face-scoped
// context (src/lib/ai/context.ts), asks Gemini for either a plain answer or
// a validated proposal (src/lib/ai/eraAskProposal.ts), and returns it
// untouched — this route performs no writes. The client decides what to
// render and performs any write only on the user's explicit confirm.
//
// Auto-escalations (`auto: true`) are capped per day, separately from the
// existing monthly token ceiling below — a manual tap never counts against
// or is blocked by this cap, only the automatic path is.

import { fetchBudgetContext, fetchScheduleContext } from "@/lib/ai/context";
import { generateAskAIResponse } from "@/lib/ai/eraAskProposal";
import type { ChatMessage } from "@/lib/ai/gemini";
import {
  checkUserRateLimit,
  generateRequestHash,
  MONTHLY_TOKEN_LIMIT,
  recordRequestHash,
} from "@/lib/ai/rateLimit";
import { estimateTokens } from "@/lib/ai/tokenUtils";
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
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { message, face, history, pendingReminderTitle, focusEntity, auto } = parsed.data;
  const sessionId = auto ? AUTO_SESSION_ID : MANUAL_SESSION_ID;
  const requestHash = generateRequestHash(message, `era-ask-${face}`);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
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
  const [autoCountResult, monthlyUsageResult, rateLimitCheck] = await Promise.all([
    autoCountQuery ?? Promise.resolve(null),
    monthlyUsageQuery,
    checkUserRateLimit(supabase, user.id, requestHash),
  ]);

  // Stage C — the daily auto-escalation cap. Counted from this route's own
  // `ai_messages` rows (tagged by session_id), not a new table. A manual tap
  // always uses MANUAL_SESSION_ID and is never counted or blocked here.
  if ((autoCountResult?.count ?? 0) >= DAILY_AUTO_ESCALATION_CAP) {
    return NextResponse.json(
      { kind: "prose", text: "I'm holding off on AI for now — tap Ask AI directly if you'd like." },
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
  const formattedHistory: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(),
  }));

  const contextPromise = Promise.all([
    face === "budget" ? fetchBudgetContext(supabase, user.id) : Promise.resolve(undefined),
    face === "schedule" ? fetchScheduleContext(supabase, user.id) : Promise.resolve(undefined),
  ]);
  await recordRequestHash(supabase, user.id, "era-ask", requestHash);
  const [budgetContext, scheduleContext] = await contextPromise;

  const result = await generateAskAIResponse({
    message,
    history: formattedHistory,
    face,
    budgetContext,
    scheduleContext,
    pendingReminderTitle,
    focusEntity,
  });

  // Lightweight usage tracking — same table the rest of AI Assistant uses,
  // grouped under a session id that never collides with a real conversation.
  const outputTokenEstimate = estimateTokens(result.text);
  const inputTokenEstimate =
    estimateTokens(message) +
    formattedHistory.reduce((s, m) => s + estimateTokens(m.content), 0);
  after(async () => {
    await supabase.from("ai_messages").insert([
      {
        user_id: user.id,
        session_id: sessionId,
        role: "user",
        content: message,
        input_tokens: inputTokenEstimate,
        output_tokens: 0,
      },
      {
        user_id: user.id,
        session_id: sessionId,
        role: "assistant",
        content: result.text,
        input_tokens: 0,
        output_tokens: outputTokenEstimate,
        model_used: process.env.GEMINI_MODEL || "gemini-flash-latest",
      },
    ]);
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
