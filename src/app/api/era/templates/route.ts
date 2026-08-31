// src/app/api/era/templates/route.ts
// ERA Stage 4 (HUB-30) — taught-phrase templates.
//
// GET lists the caller's templates (feeds both the "Taught phrases" UI and
// the client-side matcher cache — see useEraTemplates.ts).
// POST is called ONLY after a `propose_action` Ask AI proposal executes
// successfully (useEraAskAI.confirmProposal → learnTemplateFromProposal).
// Re-teaching the same (capability, pattern) bumps match_count instead of
// creating a duplicate row — a plain unique-violation insert would 409 on
// every re-teach, which isn't an error here, so this reads-then-writes
// rather than relying on the DB constraint as the primary path.
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateTemplateSchema = z.object({
  capabilityId: z.string().min(1).max(64),
  patternText: z.string().min(1).max(500),
  slotNames: z.array(z.string().min(1).max(64)).max(10),
  sourceText: z.string().min(1).max(2000),
});

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("era_templates")
    .select("*")
    // B3 — matchTemplates (matcher.ts) takes the FIRST hit in this order, so
    // when more than one taught pattern could match the same utterance, the
    // most-used one should win the tie, not just the most recently taught.
    .order("match_count", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { capabilityId, patternText, slotNames, sourceText } = parsed.data;

  const { data: existing } = await supabase
    .from("era_templates")
    .select("id, match_count")
    .eq("user_id", user.id)
    .eq("capability_id", capabilityId)
    .eq("pattern_text", patternText)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("era_templates")
      .update({
        match_count: existing.match_count + 1,
        last_matched_at: new Date().toISOString(),
        enabled: true,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  }

  const { data, error } = await supabase
    .from("era_templates")
    .insert({
      user_id: user.id,
      capability_id: capabilityId,
      pattern_text: patternText,
      slot_names: slotNames,
      source_text: sourceText,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template: data }, { status: 201 });
}
