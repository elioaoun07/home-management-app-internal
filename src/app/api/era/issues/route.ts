// src/app/api/era/issues/route.ts
// HUB-85 — "Report" from the ERA chat. Files a reviewable snapshot of a
// request ERA missed (or got wrong): the turns up to it, each turn's outcome,
// and the ERA actions logged in that window. Stored as a system row
// (intent_kind "issue_report") in the same conversation, so the thread shows
// the marker and the PM bridge (scripts/pm/era-issues.mjs) imports it as a
// Hub & ERA defect. Nothing outside era_* is written.
//
// era_messages / era_conversations RLS is owner-only (db-state.json); the
// explicit user_id filters are defence in depth (era_actions' policies are
// not in the snapshot, so its filter is load-bearing). ERA conversations are
// private by design — Hard Rule #13 household linking does not apply.

import { ISSUE_REPORT_KIND } from "@/features/era/thread";
import {
  buildIssueSnapshot,
  issueRowContent,
  issueWindowStart,
} from "@/lib/era/issueReport";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  kind: z.enum(["missed", "wrong"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reportSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { conversationId, kind, note } = parsed.data;

  try {
    // Newest 200 rows, back to chronological — the reported turn is recent.
    const { data: rows, error: msgError } = await supabase
      .from("era_messages")
      .select("id, role, content, intent_kind, intent_face, intent_payload, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
    const messages = (rows ?? []).slice().reverse();
    if (messages.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messageId =
      parsed.data.messageId && messages.some((m) => m.id === parsed.data.messageId)
        ? parsed.data.messageId
        : null;

    const since = issueWindowStart(messages, messageId);
    let actions: {
      action: string;
      entity_type: string;
      entity_id: string | null;
      title: string;
      route: string;
      created_at: string;
    }[] = [];
    if (since) {
      const { data: actionRows, error: actionError } = await supabase
        .from("era_actions")
        .select("action, entity_type, entity_id, title, route, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50);
      // The activity trail is supporting evidence; a failed read never blocks a report.
      if (!actionError) actions = actionRows ?? [];
    }

    const issue = buildIssueSnapshot({
      conversationId,
      messageId,
      kind,
      note: note ?? null,
      messages,
      actions,
    });

    const { data, error } = await supabase
      .from("era_messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "system",
        content: issueRowContent(issue),
        intent_kind: ISSUE_REPORT_KIND,
        intent_payload: { issue },
      })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Already reported" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to file the report" }, { status: 500 });
  }
}
