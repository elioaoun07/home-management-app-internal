// src/app/api/statement-import/reconcile/route.ts
//
// Match parsed statement rows against transactions the user already logged.
// This is what turns the statement upload from data entry into an audit: rows
// the user already logged (possibly days before the bank posted them) come back
// as `matched` and need no work; only the remainder needs review.

import {
  MATCH_WINDOW_BACK_DAYS,
  MATCH_WINDOW_FORWARD_DAYS,
  reconcileStatementRows,
  summarize,
  type CandidateTx,
} from "@/lib/statement-reconcile";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const reconcileSchema = z.object({
  account_id: z.string().uuid(),
  statement_id: z.string().min(8).max(200),
  rows: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        date: isoDate,
        description: z.string().max(500),
        amount: z.number().positive().finite(),
        type: z.enum(["debit", "credit"]),
        statement_hash: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(1000),
});

const DAY_MS = 86_400_000;

function shiftDate(iso: string, days: number): string {
  const shifted = new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = reconcileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { account_id, rows } = parsed.data;

    // Own accounts only — each household member imports their own statements.
    const { data: account } = await supabase
      .from("accounts")
      .select("id, currency")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json(
        { error: "Account not found or not owned by you" },
        { status: 403 },
      );
    }

    // One query for every candidate the matcher could possibly need: the union
    // of all per-row windows (posting − 7 … posting + 1).
    const dates = rows.map((r) => r.date).sort();
    const from = shiftDate(dates[0], -MATCH_WINDOW_BACK_DAYS);
    const to = shiftDate(dates[dates.length - 1], MATCH_WINDOW_FORWARD_DAYS);

    const SELECT =
      "id, account_id, date, amount, description, is_draft, is_debt_return, statement_hash, category_id, subcategory_id, inserted_at";

    // Every account, not just the statement's: a row may have been routed
    // elsewhere by a per-row override, and one filed under the wrong account is
    // exactly what the `other_account` flag exists to surface.
    const { data: windowRows, error: candidatesError } = await supabase
      .from("transactions")
      .select(SELECT)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("date", from)
      .lte("date", to);

    if (candidatesError) {
      return NextResponse.json(
        { error: candidatesError.message },
        { status: 500 },
      );
    }

    // A fingerprint hit outside the date window still means "already imported"
    // — the stored date can be edited after the fact, and a row overridden into
    // another account is found by hash alone. The partial unique index on
    // (user_id, statement_hash) makes this lookup cheap.
    const { data: hashRows } = await supabase
      .from("transactions")
      .select(SELECT)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in(
        "statement_hash",
        [...new Set(rows.map((r) => r.statement_hash))].slice(0, 1000),
      );

    const seen = new Set<string>();
    const toCandidate = (tx: Record<string, unknown>): CandidateTx => ({
      id: tx.id as string,
      account_id: tx.account_id as string,
      date: tx.date as string,
      amount: Math.abs(Number(tx.amount)),
      description: (tx.description as string) || "",
      is_draft: !!tx.is_draft,
      is_debt_return: !!tx.is_debt_return,
      statement_hash: (tx.statement_hash as string) ?? null,
      category_id: (tx.category_id as string) ?? null,
      subcategory_id: (tx.subcategory_id as string) ?? null,
      inserted_at: tx.inserted_at as string,
    });

    const candidates: CandidateTx[] = [];
    const crossAccountCandidates: CandidateTx[] = [];
    for (const raw of [...(windowRows || []), ...(hashRows || [])]) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      const candidate = toCandidate(raw);
      if (candidate.account_id === account_id) candidates.push(candidate);
      else crossAccountCandidates.push(candidate);
    }

    const classifications = reconcileStatementRows(
      rows,
      candidates,
      crossAccountCandidates,
    );
    const results = rows.map((row) => ({
      row_id: row.id,
      ...(classifications.get(row.id) ?? { status: "unmatched" as const }),
    }));

    // Names for the accounts an `other_account` flag can point at, so the
    // review screen can say "already in Debit Card" instead of a raw UUID.
    const flaggedAccountIds = [
      ...new Set(
        [...classifications.values()].flatMap((c) =>
          c.status === "other_account" ? [c.account_id] : [],
        ),
      ),
    ];
    const accountNames: Record<string, string> = {};
    if (flaggedAccountIds.length > 0) {
      const { data: named } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("user_id", user.id)
        .in("id", flaggedAccountIds);
      for (const a of named || []) accountNames[a.id] = a.name;
    }

    return NextResponse.json(
      {
        account_currency: account.currency,
        candidates_considered: candidates.length,
        cross_account_considered: crossAccountCandidates.length,
        account_names: accountNames,
        window: { from, to },
        results,
        summary: summarize(classifications),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to reconcile statement" },
      { status: 500 },
    );
  }
}
