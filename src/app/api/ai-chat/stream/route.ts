import {
  ChatMessage,
  GeminiRateLimitError,
  streamMessageToGemini,
} from "@/lib/ai/gemini";
import { checkUserRateLimit, generateRequestHash, MONTHLY_TOKEN_LIMIT, recordRequestHash } from "@/lib/ai/rateLimit";
import { estimateTokens } from "@/lib/ai/tokenUtils";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.string(),
      }),
    )
    .optional()
    .default([]),
  sessionId: z.string().optional(),
});

function sseChunk(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * POST /api/ai-chat/stream
 * Streams Gemini responses as Server-Sent Events (text/event-stream).
 * Each event carries: { type: "chunk"|"done"|"error", text?: string, error?: string }
 * Used by ERA voice conversation mode — voice turn auth, rate limit, and token budget
 * are identical to POST /api/ai-chat.
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(sseChunk({ type: "error", error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      sseChunk({ type: "error", error: "Invalid request" }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const { message, chatHistory, sessionId } = parsed.data;

  // Monthly token budget check
  const { data: usageRows } = await supabase
    .from("ai_messages")
    .select("input_tokens, output_tokens")
    .eq("user_id", user.id)
    .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const monthlyUsage = (usageRows ?? []).reduce(
    (sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
    0,
  );
  if (monthlyUsage >= MONTHLY_TOKEN_LIMIT) {
    return new Response(
      sseChunk({ type: "error", error: "Monthly token limit reached." }),
      { status: 429, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  // Rate limit check
  const requestHash = generateRequestHash(message, sessionId);
  const rateLimitCheck = await checkUserRateLimit(supabase, user.id, requestHash);
  if (!rateLimitCheck.allowed) {
    return new Response(
      sseChunk({ type: "error", error: rateLimitCheck.reason ?? "Rate limited" }),
      { status: 429, headers: { "Content-Type": "text/event-stream" } },
    );
  }
  await recordRequestHash(supabase, user.id, "ai-chat-stream", requestHash);

  const formattedHistory: ChatMessage[] = chatHistory.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
  }));

  const inputTokenEstimate =
    estimateTokens(message) +
    formattedHistory.reduce((s, m) => s + estimateTokens(m.content), 0);

  const startTime = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Record<string, unknown>) =>
        controller.enqueue(new TextEncoder().encode(sseChunk(data)));

      let fullText = "";
      try {
        for await (const chunk of streamMessageToGemini(message, formattedHistory)) {
          fullText += chunk;
          enqueue({ type: "chunk", text: chunk });
        }
        enqueue({ type: "done" });

        // Log to ai_messages after stream completes
        const outputTokenEstimate = estimateTokens(fullText);
        const sid = sessionId ?? `voice_${Date.now()}`;
        await supabase.from("ai_sessions").upsert(
          { id: sid, user_id: user.id, title: message.slice(0, 50), updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
        const { data: lastMsg } = await supabase
          .from("ai_messages")
          .select("sequence_num")
          .eq("session_id", sid)
          .eq("user_id", user.id)
          .order("sequence_num", { ascending: false })
          .limit(1)
          .single();
        const nextSeq = (lastMsg?.sequence_num ?? 0) + 1;
        const { data: userMsg } = await supabase
          .from("ai_messages")
          .insert({ user_id: user.id, session_id: sid, role: "user", content: message, sequence_num: nextSeq, input_tokens: inputTokenEstimate })
          .select("id")
          .single();
        await supabase.from("ai_messages").insert({
          user_id: user.id,
          session_id: sid,
          role: "assistant",
          content: fullText,
          parent_id: userMsg?.id ?? null,
          sequence_num: nextSeq + 1,
          output_tokens: outputTokenEstimate,
          response_time_ms: Date.now() - startTime,
        });
      } catch (err) {
        const msg =
          err instanceof GeminiRateLimitError
            ? err.message
            : err instanceof Error
              ? err.message
              : "AI error";
        enqueue({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
