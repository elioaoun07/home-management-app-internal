// src/app/api/era/lexicon/route.ts
// HUB-80 — ERA household lexicon (plan §4 component 10).
// GET    → the caller's live rules (revoked_at IS NULL).
// POST   → add a rule. A new default revokes the previous live default for
//          the same (capability, slot, conditions) first — one live default.
// DELETE → ?id= revokes ("Forget"); rows are kept as evidence, never deleted.
// Owner-only RLS (auth.uid() = user_id) — migrations/2026-09-27_era-lexicon.sql.
// Until the owner runs that migration the table is missing: 503 with
// LEXICON_SETUP_REQUIRED, and the client simply runs without a lexicon.

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ruleSchema = z.object({
  kind: z.enum(["alias", "default", "example"]),
  capability: z.string().min(1).max(64),
  phrase: z.string().max(120).nullable().optional(),
  slot: z.string().max(40).nullable().optional(),
  conditions: z.record(z.string(), z.unknown()).default({}),
  value: z.record(z.string(), z.unknown()).default({}),
  depends_on: z.array(z.string().uuid()).max(10).default([]),
  source_message_id: z.string().uuid().nullable().optional(),
});
export type LexiconRuleInput = z.infer<typeof ruleSchema>;

function missingTable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function setupRequired() {
  return NextResponse.json({ error: "Lexicon not enabled yet", code: "LEXICON_SETUP_REQUIRED" }, { status: 503 });
}

async function authed() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("era_lexicon")
    .select("id, kind, capability, phrase, slot, conditions, value, depends_on, use_count, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return missingTable(error.code) ? setupRequired() : NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ruleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const r = parsed.data;

  if (r.kind === "default") {
    const { data: live, error: liveError } = await supabase
      .from("era_lexicon")
      .select("id, slot, conditions")
      .eq("user_id", user.id)
      .eq("kind", "default")
      .eq("capability", r.capability)
      .is("revoked_at", null);
    if (liveError) return missingTable(liveError.code) ? setupRequired() : NextResponse.json({ error: liveError.message }, { status: 500 });
    const key = JSON.stringify(Object.entries(r.conditions).sort());
    const stale = (live ?? [])
      .filter((x) => (x.slot ?? null) === (r.slot ?? null) && JSON.stringify(Object.entries(x.conditions ?? {}).sort()) === key)
      .map((x) => x.id);
    if (stale.length) {
      await supabase
        .from("era_lexicon")
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in("id", stale)
        .eq("user_id", user.id);
    }
  }

  const { data, error } = await supabase
    .from("era_lexicon")
    .insert({
      user_id: user.id,
      kind: r.kind,
      capability: r.capability,
      phrase: r.phrase ?? null,
      slot: r.slot ?? null,
      conditions: r.conditions,
      value: r.value,
      depends_on: r.depends_on,
      source_message_id: r.source_message_id ?? null,
    })
    .select("id, kind, capability, phrase, slot, conditions, value, depends_on, use_count, created_at")
    .single();
  if (error) {
    if (missingTable(error.code)) return setupRequired();
    if (error.code === "23505") return NextResponse.json({ error: "Rule already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { error } = await supabase
    .from("era_lexicon")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return missingTable(error.code) ? setupRequired() : NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
