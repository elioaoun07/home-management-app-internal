// src/app/api/era/messages/[id]/route.ts
// HUB-78 — ERA handoff (plan §4 component 9). The precision form opens
// `/expense?era=<messageId>` and reads the proposal here.
//
// GET  → { handoff, consumed, expired } for the caller's own assistant row.
// POST → marks it consumed by APPENDING a system row (era_messages stays
//        append-only — no PATCH/DELETE exists by design).
// era_messages RLS is owner-only (`auth.uid() = user_id`, db-state.json);
// the explicit user_id filter below is defence in depth, not the guard.

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

async function load(id: string) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: row, error } = await supabase
    .from("era_messages")
    .select("id, conversation_id, role, intent_payload, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!row || row.role !== "assistant") {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const handoff = (row.intent_payload as { handoff?: { expiresAt?: string } } | null)?.handoff ?? null;
  if (!handoff) return { error: NextResponse.json({ error: "No handoff" }, { status: 404 }) };

  const { data: consumedRows } = await supabase
    .from("era_messages")
    .select("id")
    .eq("user_id", user.id)
    .eq("conversation_id", row.conversation_id)
    .eq("intent_kind", "handoff_consumed")
    .eq("intent_payload->>handoffId", id)
    .limit(1);

  return { supabase, user, row, handoff, consumed: (consumedRows?.length ?? 0) > 0 };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const r = await load(id);
  if ("error" in r) return r.error;
  const expired = r.handoff.expiresAt ? new Date(r.handoff.expiresAt).getTime() < Date.now() : false;
  return NextResponse.json(
    { handoff: r.handoff, consumed: r.consumed, expired },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const body = z
    .object({ transactionId: z.string().uuid().nullable().optional() })
    .safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const r = await load(id);
  if ("error" in r) return r.error;
  if (r.consumed) return NextResponse.json({ ok: true, alreadyConsumed: true });

  const { error } = await r.supabase.from("era_messages").insert({
    conversation_id: r.row.conversation_id,
    user_id: r.user.id,
    role: "system",
    content: "handoff consumed",
    intent_kind: "handoff_consumed",
    intent_payload: { handoffId: id, transactionId: body.data.transactionId ?? null },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
