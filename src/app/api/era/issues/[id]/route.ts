// src/app/api/era/issues/[id]/route.ts
// HUB-85 — Undo a Report. Removes only the caller's own issue_report system
// row; any other era_messages row is out of reach of this route (the thread
// stays append-only for conversation turns). If the PM bridge already
// imported it, that Hub & ERA item stays for the owner to discard.

import { ISSUE_REPORT_KIND } from "@/features/era/thread";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("era_messages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("role", "system")
    .eq("intent_kind", ISSUE_REPORT_KIND)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
