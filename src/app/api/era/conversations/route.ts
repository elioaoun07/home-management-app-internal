// src/app/api/era/conversations/route.ts
// ERA conversations — GET (list user's conversations) + POST (create new).
//
// Per-user RLS at the DB level; this route just enforces auth + zod-validates
// the payload. Hard Rule #13 (household linking) intentionally NOT applied —
// ERA conversations are private by default. See ERA Notes/03 - Junction
// Modules/ERA/Overview.md for the rationale.

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

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  const { data, error } = await supabase
    .from("era_conversations")
    .select("*")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
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
