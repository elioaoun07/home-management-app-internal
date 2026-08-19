// src/app/api/statement-import/imports/[id]/route.ts
//
// Open one import: the batch record plus every transaction it touched, each
// paired with how that transaction looks NOW. The `drifted` flag is what lets
// the UI say "3 of these were edited since" before the user reverts, rather
// than discovering it in the receipt afterwards.

import { hasDrifted, type LedgerEntry } from "@/lib/statement-revert";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENTRY_COLUMNS =
  "id, import_id, row_id, action, transaction_id, account_id, statement_hash, applied_delta, previous, applied, reverted_at, revert_note, created_at";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: record, error } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!record) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const { data: entryRows, error: entriesError } = await supabase
    .from("statement_import_entries")
    .select(ENTRY_COLUMNS)
    .eq("import_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 });
  }

  const entries = entryRows || [];
  const txIds = [
    ...new Set(entries.map((e) => e.transaction_id).filter(Boolean)),
  ] as string[];

  // Soft-deleted rows are deliberately INCLUDED — "this one is already in the
  // Recycle Bin" is exactly what the user needs to see here.
  const liveById = new Map<
    string,
    {
      description: string;
      date: string;
      amount: number;
      is_draft: boolean;
      deleted_at: string | null;
      statement_hash: string | null;
      is_debt_return: boolean;
      account_id: string;
      id: string;
    }
  >();

  if (txIds.length > 0) {
    const { data: txRows } = await supabase
      .from("transactions")
      .select(
        "id, description, date, amount, is_draft, deleted_at, statement_hash, is_debt_return, account_id",
      )
      .eq("user_id", user.id)
      .in("id", txIds);

    for (const tx of txRows || []) {
      liveById.set(tx.id, {
        id: tx.id,
        description: tx.description || "",
        date: tx.date,
        amount: Math.abs(Number(tx.amount)),
        is_draft: !!tx.is_draft,
        deleted_at: tx.deleted_at ?? null,
        statement_hash: tx.statement_hash ?? null,
        is_debt_return: !!tx.is_debt_return,
        account_id: tx.account_id,
      });
    }
  }

  const withCurrent = entries.map((entry) => {
    const tx = entry.transaction_id ? liveById.get(entry.transaction_id) : undefined;
    return {
      ...entry,
      current: tx
        ? {
            description: tx.description,
            date: tx.date,
            amount: tx.amount,
            is_draft: tx.is_draft,
            deleted_at: tx.deleted_at,
            statement_hash: tx.statement_hash,
            drifted: hasDrifted(entry as unknown as LedgerEntry, tx),
          }
        : null,
    };
  });

  const { data: account } = record.account_id
    ? await supabase
        .from("accounts")
        .select("name, currency")
        .eq("id", record.account_id)
        .maybeSingle()
    : { data: null };

  return NextResponse.json(
    {
      ...record,
      account_name: account?.name ?? null,
      account_currency: account?.currency ?? null,
      entries: withCurrent,
      revertable: withCurrent.some(
        (e) => !e.reverted_at && e.current && !e.current.deleted_at,
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
