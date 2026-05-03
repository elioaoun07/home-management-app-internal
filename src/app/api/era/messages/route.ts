// src/app/api/era/messages/route.ts
// ERA messages — GET (paginated) + POST (append).
//
// Append-only by design. No PATCH, no DELETE. If you need to remove a
// conversation, archive the parent era_conversation instead. RLS enforces
// per-user access at the DB level.

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const FACE_KEYS = ["budget", "schedule", "chef", "brain"] as const;

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200);
  const cursor = req.nextUrl.searchParams.get("cursor"); // ISO timestamp

  let query = supabase
    .from("era_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return chronological (oldest → newest) so the UI can append directly.
  const messages = (data ?? []).slice().reverse();
  const nextCursor =
    data && data.length === limit ? data[data.length - 1].created_at : null;

  return NextResponse.json(
    { messages, nextCursor },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = z.object({
    conversation_id: z.string().uuid().nullable().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(4000),
    intent_kind: z.string().max(64).nullable().optional(),
    intent_face: z.enum(FACE_KEYS).nullable().optional(),
    intent_payload: z.record(z.string(), z.unknown()).nullable().optional(),
    draft_transaction_id: z.string().uuid().nullable().optional(),
    /** When true and no conversation_id provided, auto-create one. */
    auto_create_conversation: z.boolean().optional(),
  });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let conversationId = parsed.data.conversation_id ?? null;

  // Auto-create a conversation if asked. Used by the command bar so a brand
  // new user doesn't need to think about "starting" anything.
  if (!conversationId && parsed.data.auto_create_conversation) {
    const { data: convo, error: convoErr } = await supabase
      .from("era_conversations")
      .insert({
        user_id: user.id,
        active_face_key: parsed.data.intent_face ?? "budget",
      })
      .select("id")
      .single();
    if (convoErr) {
      return NextResponse.json({ error: convoErr.message }, { status: 500 });
    }
    conversationId = convo.id;
  }

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("era_messages")
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: parsed.data.role,
      content: parsed.data.content,
      intent_kind: parsed.data.intent_kind ?? null,
      intent_face: parsed.data.intent_face ?? null,
      intent_payload: parsed.data.intent_payload ?? null,
      draft_transaction_id: parsed.data.draft_transaction_id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { message: data, conversation_id: conversationId },
    { status: 201 },
  );
}
