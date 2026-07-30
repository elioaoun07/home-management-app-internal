// src/app/api/recycle-bin/route.ts
//
// Generic Recycle Bin endpoints driven entirely by the registry.
//
//   GET    /api/recycle-bin?module=...&q=...&page=...
//                                       &filters=<json>
//                                       &deletedFrom=...&deletedTo=...
//                                       &ownOnly=true
//   DELETE /api/recycle-bin?module=...&id=...   (permanent delete one row)
//
// See ./restore/route.ts, ./empty/route.ts, ./counts/route.ts for the others.

import {
  getRecycleBinModule,
  RECYCLE_BIN_MODULES,
} from "@/lib/recycleBin/registry";
import { resolveScope } from "@/lib/recycleBin/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function applyFilters(
  query: any,
  binModule: ReturnType<typeof getRecycleBinModule>,
  rawFilters: Record<string, unknown>,
) {
  if (!binModule) return query;
  for (const field of binModule.filterFields) {
    const v = rawFilters[field.key];
    if (v == null || v === "") continue;
    if (field.kind === "enum" || field.kind === "text") {
      if (typeof v === "string" && v.length > 0) {
        query =
          field.kind === "text"
            ? query.ilike(field.column, `%${v}%`)
            : query.eq(field.column, v);
      }
    } else if (field.kind === "boolean") {
      query = query.eq(field.column, Boolean(v));
    } else if (field.kind === "dateRange") {
      const range = v as { from?: string; to?: string };
      if (range.from) query = query.gte(field.column, range.from);
      if (range.to) query = query.lte(field.column, range.to);
    } else if (field.kind === "numericRange") {
      const range = v as { min?: number; max?: number };
      if (typeof range.min === "number")
        query = query.gte(field.column, range.min);
      if (typeof range.max === "number")
        query = query.lte(field.column, range.max);
    }
  }
  return query;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const moduleId = req.nextUrl.searchParams.get("module");
  if (!moduleId)
    return NextResponse.json({ error: "module is required" }, { status: 400 });

  const binModule = getRecycleBinModule(moduleId);
  if (!binModule)
    return NextResponse.json(
      { error: `Unknown module: ${moduleId}` },
      { status: 400 },
    );

  const ownOnly = req.nextUrl.searchParams.get("ownOnly") === "true";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const page = Math.max(
    0,
    parseInt(req.nextUrl.searchParams.get("page") || "0", 10),
  );
  const deletedFrom = req.nextUrl.searchParams.get("deletedFrom");
  const deletedTo = req.nextUrl.searchParams.get("deletedTo");

  let filters: Record<string, unknown> = {};
  const filtersParam = req.nextUrl.searchParams.get("filters");
  if (filtersParam) {
    try {
      filters = JSON.parse(filtersParam);
    } catch {
      // ignore
    }
  }

  const scope = await resolveScope(supabase, user.id, ownOnly);

  let query = supabase
    .from(binModule.table)
    .select(binModule.selectColumns, { count: "exact" })
    .not(binModule.deletedAtColumn, "is", null);

  if (binModule.scope === "user") {
    query = query.in("user_id", scope.userIds);
  } else if (binModule.scope === "household") {
    if (!scope.householdId) {
      return NextResponse.json({ rows: [], total: 0, hasMore: false });
    }
    query = query.eq("household_id", scope.householdId);
  }

  if (binModule.baseFilter) {
    query = binModule.baseFilter(query as any) as any;
  }

  if (q.length > 0 && binModule.searchColumns.length > 0) {
    const orExpr = binModule.searchColumns
      .map((c) => `${c}.ilike.%${q.replace(/[(),]/g, "")}%`)
      .join(",");
    query = query.or(orExpr);
  }

  if (deletedFrom) query = query.gte(binModule.deletedAtColumn, deletedFrom);
  if (deletedTo) query = query.lte(binModule.deletedAtColumn, deletedTo);

  query = applyFilters(query, binModule, filters);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query
    .order(binModule.deletedAtColumn, { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("[recycle-bin] list failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).map((r) => ({
    moduleId: binModule.id,
    ...binModule.formatRow(r as never),
  }));

  return NextResponse.json({
    rows,
    total: count ?? rows.length,
    hasMore: (count ?? 0) > to + 1,
  });
}

export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const moduleId = req.nextUrl.searchParams.get("module");
  const id = req.nextUrl.searchParams.get("id");
  if (!moduleId || !id)
    return NextResponse.json(
      { error: "module and id are required" },
      { status: 400 },
    );

  const binModule = getRecycleBinModule(moduleId);
  if (!binModule)
    return NextResponse.json(
      { error: `Unknown module: ${moduleId}` },
      { status: 400 },
    );

  const scope = await resolveScope(supabase, user.id, false);

  // Fetch the row first so onPurge can run side-effects.
  let fetchQuery = supabase
    .from(binModule.table)
    .select(binModule.selectColumns)
    .eq("id", id)
    .not(binModule.deletedAtColumn, "is", null);
  if (binModule.scope === "user") {
    fetchQuery = fetchQuery.in("user_id", scope.userIds);
  } else if (binModule.scope === "household" && scope.householdId) {
    fetchQuery = fetchQuery.eq("household_id", scope.householdId);
  }
  const { data: row, error: fetchErr } = await fetchQuery.maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = supabaseAdmin();
  if (binModule.onPurge) {
    try {
      await binModule.onPurge({
        row: row as never,
        supabase: supabase as never,
        admin: admin as never,
        userId: user.id,
      });
    } catch (e) {
      console.error("[recycle-bin] onPurge failed", e);
    }
  }

  const { error: delErr } = await admin
    .from(binModule.table)
    .delete()
    .eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Sanity helper used by other route handlers.
export const __MODULE_IDS__ = RECYCLE_BIN_MODULES.map((m) => m.id);
