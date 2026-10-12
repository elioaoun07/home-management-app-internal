// src/app/api/era/ai-usage/route.ts
// ERA AI Usage tab — GET ?from&to (ISO instants, one month). Read-only.
//
// Returns the raw pieces; src/features/era/aiUsage.ts buckets them by the
// owner's local day and prices them:
//   receipts — `ai_messages` rows /api/era/ask wrote per model call
//              (manual "era-ask" + auto-escalated "era-ask-auto"). Native
//              turns never call a model and never write one.
//   answers  — `era_messages` ai_answer rows (which chat each answer landed in)
//   chats    — those chats, titled like History (conversationTitle).
//
// Own rows only: ERA conversations are private by design (Hard Rule #13 does
// not apply — see /api/era/conversations).

import { AI_ANSWER_KIND, conversationTitle } from "@/features/era/thread";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ERA_SESSION_IDS = ["era-ask", "era-ask-auto"];
const MAX_RANGE_MS = 32 * 24 * 60 * 60 * 1000;

const querySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .refine((q) => {
    const span = Date.parse(q.to) - Date.parse(q.from);
    return span > 0 && span <= MAX_RANGE_MS;
  }, "Range must be positive and at most one month");

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    from: req.nextUrl.searchParams.get("from"),
    to: req.nextUrl.searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { from, to } = parsed.data;

  const [receiptsResult, answersResult] = await Promise.all([
    supabase
      .from("ai_messages")
      .select("created_at, role, session_id, input_tokens, output_tokens, model_used")
      .eq("user_id", user.id)
      .in("session_id", ERA_SESSION_IDS)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .limit(10000),
    supabase
      .from("era_messages")
      .select("conversation_id, created_at")
      .eq("user_id", user.id)
      .eq("intent_kind", AI_ANSWER_KIND)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .limit(5000),
  ]);
  if (receiptsResult.error || answersResult.error) {
    console.error("[era/ai-usage] read failed", {
      receipts: receiptsResult.error?.code,
      answers: answersResult.error?.code,
    });
    return NextResponse.json({ error: "Failed to load AI usage" }, { status: 500 });
  }

  const answers = answersResult.data ?? [];
  const ids = [...new Set(answers.map((a) => a.conversation_id as string))];
  let chats: {
    id: string;
    title: string;
    active_face_key: string;
    created_at: string;
    updated_at: string;
  }[] = [];

  if (ids.length > 0) {
    const [convResult, firstResult] = await Promise.all([
      supabase
        .from("era_conversations")
        .select("id, active_face_key, created_at, updated_at")
        .eq("user_id", user.id)
        .in("id", ids),
      supabase
        .from("era_messages")
        .select("conversation_id, content")
        .in("conversation_id", ids)
        .eq("role", "user")
        .order("created_at", { ascending: true })
        .limit(5000),
    ]);
    if (convResult.error || firstResult.error) {
      console.error("[era/ai-usage] chat read failed", {
        conversations: convResult.error?.code,
        messages: firstResult.error?.code,
      });
      return NextResponse.json({ error: "Failed to load AI usage" }, { status: 500 });
    }
    const firstUserText = new Map<string, string>();
    for (const row of firstResult.data ?? []) {
      const id = row.conversation_id as string;
      if (!firstUserText.has(id)) firstUserText.set(id, row.content as string);
    }
    chats = (convResult.data ?? []).map((c) => ({
      id: c.id as string,
      title: conversationTitle(firstUserText.get(c.id as string)),
      active_face_key: c.active_face_key as string,
      created_at: c.created_at as string,
      updated_at: c.updated_at as string,
    }));
  }

  return NextResponse.json(
    { receipts: receiptsResult.data ?? [], answers, chats },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
