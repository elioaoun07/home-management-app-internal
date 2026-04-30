// src/app/api/recycle-bin/restore/route.ts
import { getRecycleBinModule } from "@/lib/recycleBin/registry";
import { resolveScope } from "@/lib/recycleBin/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  module: z.string().min(1),
  id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const module = getRecycleBinModule(parsed.data.module);
  if (!module) {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }

  const scope = await resolveScope(supabase, user.id, false);

  // Confirm the row is in scope and currently trashed.
  let fetchQuery = supabase
    .from(module.table)
    .select(module.selectColumns)
    .eq("id", parsed.data.id)
    .not(module.deletedAtColumn, "is", null);
  if (module.scope === "user") {
    fetchQuery = fetchQuery.in("user_id", scope.userIds);
  } else if (module.scope === "household" && scope.householdId) {
    fetchQuery = fetchQuery.eq("household_id", scope.householdId);
  }
  const { data: row, error: fetchErr } = await fetchQuery.maybeSingle();
  if (fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error: updateErr } = await supabase
    .from(module.table)
    .update({ [module.deletedAtColumn]: null })
    .eq("id", parsed.data.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (module.onRestore) {
    try {
      await module.onRestore({
        row: row as never,
        supabase: supabase as never,
        admin: supabaseAdmin() as never,
        userId: user.id,
      });
    } catch (e) {
      console.error("[recycle-bin] onRestore failed", e);
    }
  }

  return NextResponse.json({ ok: true, id: parsed.data.id });
}
