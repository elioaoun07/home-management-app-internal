// src/app/api/era/ask/route.ts
// ERA "Ask AI" (Slice 4) — the manual AI handoff. Never invoked by the
// deterministic router; only by an explicit tap in the ERA Hub UI. Builds
// face-scoped context (src/lib/ai/context.ts), asks Gemini for either a
// plain answer or a validated proposal (src/lib/ai/eraAskProposal.ts), and
// returns it untouched — this route performs no writes. The client decides
// what to render and performs any write only on the user's explicit confirm.

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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FACE_KEYS = ["budget", "schedule", "chef", "brain"] as const;

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
  const { message, face, history, pendingReminderTitle, focusEntity } = parsed.data;

  // Monthly token budget (Hard Rule-adjacent: same ceiling as /api/ai-chat).
  const { data: usageRows } = await supabase
    .from("ai_messages")
    .select("input_tokens, output_tokens")
    .eq("user_id", user.id)
    .gte(
      "created_at",
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    );
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

  const requestHash = generateRequestHash(message, `era-ask-${face}`);
  const rateLimitCheck = await checkUserRateLimit(supabase, user.id, requestHash);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: rateLimitCheck.reason ?? "Rate limited" },
      { status: 429 },
    );
  }
  await recordRequestHash(supabase, user.id, "era-ask", requestHash);

  const formattedHistory: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(),
  }));

  const [budgetContext, scheduleContext] = await Promise.all([
    face === "budget" ? fetchBudgetContext(supabase, user.id) : Promise.resolve(undefined),
    face === "schedule" ? fetchScheduleContext(supabase, user.id) : Promise.resolve(undefined),
  ]);

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
  await supabase.from("ai_messages").insert([
    {
      user_id: user.id,
      session_id: "era-ask",
      role: "user",
      content: message,
      input_tokens: inputTokenEstimate,
      output_tokens: 0,
    },
    {
      user_id: user.id,
      session_id: "era-ask",
      role: "assistant",
      content: result.text,
      input_tokens: 0,
      output_tokens: outputTokenEstimate,
      model_used: process.env.GEMINI_MODEL || "gemini-flash-latest",
    },
  ]);

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
