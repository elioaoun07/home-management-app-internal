// src/app/api/statement-import/imports/route.ts
//
// The import history: every statement commit this user has made, newest first.
// Each row is a batch that can be opened (see [id]/route.ts) and reverted
// (see [id]/revert/route.ts).
//
// Read-only. Own rows only — statement imports are personal even inside a
// household, because each member reconciles their own bank statements.

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = Number(req.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const { data, error } = await supabase
    .from("statement_imports")
    .select(
      "id, file_name, imported_at, status, account_id, statement_id, transactions_count, created_count, stamped_count, drafts_confirmed_count, skipped_count, error_count, balance_deltas, learned_mappings, reverted_at",
    )
    .eq("user_id", user.id)
    .order("imported_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Name the accounts in one extra query rather than a join, so a deleted
  // account degrades to "Unknown account" instead of dropping the import row.
  const accountIds = [
    ...new Set((data || []).map((i) => i.account_id).filter(Boolean)),
  ] as string[];

  const accountsById = new Map<string, { name: string; currency: string }>();
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, currency")
      .in("id", accountIds);
    for (const a of accounts || []) {
      accountsById.set(a.id, { name: a.name, currency: a.currency });
    }
  }

  const imports = (data || []).map((row) => {
    const account = row.account_id ? accountsById.get(row.account_id) : undefined;
    return {
      ...row,
      account_name: account?.name ?? null,
      account_currency: account?.currency ?? null,
    };
  });

  return NextResponse.json(
    { imports },
    { headers: { "Cache-Control": "no-store" } },
  );
}
