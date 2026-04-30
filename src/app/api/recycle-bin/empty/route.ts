// src/app/api/recycle-bin/empty/route.ts
import {
  getRecycleBinModule,
  RECYCLE_BIN_MODULES,
} from "@/lib/recycleBin/registry";
import { resolveScope } from "@/lib/recycleBin/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  module: z.string().min(1).optional(),
  ownOnly: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ownOnly = parsed.data.ownOnly ?? false;
  const scope = await resolveScope(supabase, user.id, ownOnly);

  const targetModules = parsed.data.module
    ? [getRecycleBinModule(parsed.data.module)].filter(Boolean)
    : RECYCLE_BIN_MODULES;

  if (parsed.data.module && targetModules.length === 0) {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }

  let totalDeleted = 0;
  const admin = supabaseAdmin();
  for (const module of targetModules) {
    if (!module) continue;

    let query = admin
      .from(module.table)
      .delete({ count: "exact" })
      .not(module.deletedAtColumn, "is", null);

    if (module.scope === "user") {
      query = query.in("user_id", scope.userIds);
    } else if (module.scope === "household") {
      if (!scope.householdId) continue;
      query = query.eq("household_id", scope.householdId);
    }

    if (module.baseFilter) {
      query = module.baseFilter(query as any) as any;
    }

    const { error, count } = await query;
    if (error) {
      console.error(`[recycle-bin] empty failed for ${module.id}`, error);
      continue;
    }
    totalDeleted += count ?? 0;
  }

  return NextResponse.json({ ok: true, deleted: totalDeleted });
}
