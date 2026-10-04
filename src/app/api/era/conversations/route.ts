// src/app/api/era/conversations/route.ts
// ERA conversations — GET (list user's conversations) + POST (create new).
//
// Per-user RLS at the DB level; this route just enforces auth + zod-validates
// the payload. Hard Rule #13 (household linking) intentionally NOT applied —
// ERA conversations are private by default. See ERA Notes/03 - Junction
// Modules/ERA/Overview.md for the rationale.
//
// HUB-52 — `?history=1` returns the History picker's rows instead: chats that
// have at least one sentence from the person, each titled deterministically
// from its first sentence (conversationTitle — no model, no stored title).

import { conversationTitle } from "@/features/era/thread";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const FACE_KEYS = ["budget", "schedule", "chef", "brain"] as const;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  history: z.enum(["1"]).optional().catch(undefined),
});

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = listQuerySchema.parse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    history: req.nextUrl.searchParams.get("history") ?? undefined,
  });

  const { data, error } = await supabase
    .from("era_conversations")
    .select("*")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(query.limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!query.history) {
    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // One read for every listed chat's sentences, oldest first — the first one
  // per conversation names it; a chat with none never reaches History.
  const ids = (data ?? []).map((c) => c.id as string);
  const firstUserText = new Map<string, string>();
  if (ids.length > 0) {
    const { data: rows, error: msgError } = await supabase
      .from("era_messages")
      .select("conversation_id, content")
      .in("conversation_id", ids)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(2000);
    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }
    for (const row of rows ?? []) {
      const id = row.conversation_id as string;
      if (!firstUserText.has(id)) firstUserText.set(id, row.content as string);
    }
  }

  const history = (data ?? [])
    .filter((c) => firstUserText.has(c.id as string))
    .map((c) => ({
      id: c.id as string,
      title: conversationTitle(firstUserText.get(c.id as string)),
      active_face_key: c.active_face_key as string,
      created_at: c.created_at as string,
      updated_at: c.updated_at as string,
    }));

  return NextResponse.json(history, {
    headers: { "Cache-Control": "no-store" },
  });
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
    title: z.string().max(200).optional(),
    active_face_key: z.enum(FACE_KEYS).default("budget"),
  });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("era_conversations")
    .insert({
      user_id: user.id,
      title: parsed.data.title ?? null,
      active_face_key: parsed.data.active_face_key,
    })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
