// src/app/api/recycle-bin/counts/route.ts
import { RECYCLE_BIN_MODULES } from "@/lib/recycleBin/registry";
import { resolveScope } from "@/lib/recycleBin/scope";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownOnly = req.nextUrl.searchParams.get("ownOnly") === "true";
  const scope = await resolveScope(supabase, user.id, ownOnly);

  const counts: Record<string, number> = {};
  for (const binModule of RECYCLE_BIN_MODULES) {
    let query = supabase
      .from(binModule.table)
      .select("id", { count: "exact", head: true })
      .not(binModule.deletedAtColumn, "is", null);

    if (binModule.scope === "user") {
      query = query.in("user_id", scope.userIds);
    } else if (binModule.scope === "household") {
      if (!scope.householdId) {
        counts[binModule.id] = 0;
        continue;
      }
      query = query.eq("household_id", scope.householdId);
    }

    if (binModule.baseFilter) {
      query = binModule.baseFilter(query as any) as any;
    }

    const { count, error } = await query;
    if (error) {
      console.error(`[recycle-bin] count failed for ${binModule.id}`, error);
      counts[binModule.id] = 0;
      continue;
    }
    counts[binModule.id] = count ?? 0;
  }

  return NextResponse.json({ counts });
}
