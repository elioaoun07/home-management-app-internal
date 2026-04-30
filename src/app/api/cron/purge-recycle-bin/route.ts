// src/app/api/cron/purge-recycle-bin/route.ts
//
// Daily cron: hard-deletes Recycle Bin rows older than RETENTION_DAYS.
//
// Schedule via Vercel cron (e.g. daily at 03:00).
//   {
//     "crons": [
//       { "path": "/api/cron/purge-recycle-bin", "schedule": "0 3 * * *" }
//     ]
//   }
import { RECYCLE_BIN_MODULES } from "@/lib/recycleBin/registry";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const supabase = supabaseAdmin();
  const summary: Record<string, number> = {};

  for (const module of RECYCLE_BIN_MODULES) {
    let query = supabase
      .from(module.table)
      .delete({ count: "exact" })
      .not(module.deletedAtColumn, "is", null)
      .lt(module.deletedAtColumn, cutoff);

    if (module.baseFilter) {
      query = module.baseFilter(query as any) as any;
    }

    const { error, count } = await query;
    if (error) {
      console.error(`[cron purge] ${module.id} failed`, error);
      summary[module.id] = -1;
    } else {
      summary[module.id] = count ?? 0;
    }
  }

  return NextResponse.json({ ok: true, cutoff, summary });
}
