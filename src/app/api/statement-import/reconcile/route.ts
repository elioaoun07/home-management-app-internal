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
  type HouseholdMember,
  type HouseholdTransferRef,
  type ImportedTransferRef,
} from "@/lib/statement-reconcile";
import type { AccountType } from "@/lib/balance-utils";
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
    // Every owned account, not just the statement's: candidates can live in any
    // of them, and each one's TYPE is needed to read a transaction's direction
    // (see `movesMoneyIn` in statement-reconcile.ts — `is_debt_return` alone
    // does not say which way the money went).
    const { data: ownedAccounts } = await supabase
      .from("accounts")
      .select("id, name, type, currency")
      .eq("user_id", user.id);

    const account = (ownedAccounts || []).find((a) => a.id === account_id);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found or not owned by you" },
        { status: 403 },
      );
    }

    const accountTypes = new Map<string, AccountType>(
      (ownedAccounts || []).map((a) => [a.id, a.type as AccountType]),
    );

    // One query for every candidate the matcher could possibly need: the union
    // of all per-row windows (posting − 7 … posting + 1).
    const dates = rows.map((r) => r.date).sort();
    const from = shiftDate(dates[0], -MATCH_WINDOW_BACK_DAYS);
    const to = shiftDate(dates[dates.length - 1], MATCH_WINDOW_FORWARD_DAYS);

    const SELECT =
      "id, account_id, date, amount, description, is_draft, is_debt_return, statement_hash, bank_description, category_id, subcategory_id, inserted_at";

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
      account_type: accountTypes.get(tx.account_id as string) ?? "expense",
      date: tx.date as string,
      amount: Math.abs(Number(tx.amount)),
      description: (tx.description as string) || "",
      is_draft: !!tx.is_draft,
      is_debt_return: !!tx.is_debt_return,
      statement_hash: (tx.statement_hash as string) ?? null,
      bank_description: (tx.bank_description as string) ?? null,
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

    // Rows the owner has already ruled out, looked up by fingerprint so the
    // decision survives a wider re-upload and a re-downloaded PDF.
    const rowHashes = [...new Set(rows.map((r) => r.statement_hash))];
    const { data: skipRows } = await supabase
      .from("statement_skipped_rows")
      .select("statement_hash")
      .eq("user_id", user.id)
      .in("statement_hash", rowHashes.slice(0, 1000));
    const skippedHashes = new Set(
      (skipRows || []).map((r) => r.statement_hash as string),
    );

    // Household members whose names can appear as a transfer counterparty, and
    // the transfers already recorded between them. Both are needed to tell a
    // household movement (not spending) from a payment to an outsider (which
    // is), and to recognise a movement the other side has already logged.
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .eq("active", true)
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .maybeSingle();

    const memberIds = link
      ? [link.owner_user_id, link.partner_user_id].filter(
          (id): id is string => !!id,
        )
      : [user.id];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);

    const householdMembers: HouseholdMember[] = (profiles || [])
      .filter((p) => !!p.full_name)
      .map((p) => ({ user_id: p.id as string, full_name: p.full_name as string }));

    let householdTransfers: HouseholdTransferRef[] = [];
    if (link) {
      const { data: existing } = await supabase
        .from("transfers")
        .select("id, date, amount")
        .eq("transfer_type", "household")
        .is("deleted_at", null)
        .gte("date", from)
        .lte("date", to);
      householdTransfers = (existing || []).map((t) => ({
        id: t.id as string,
        date: t.date as string,
        amount: Math.abs(Number(t.amount)),
      }));
    }

    // Transfers a previous import already created from these very rows. The
    // ONLY money this feature writes outside `transactions`, and until they
    // were looked up the reconciler was blind to them: a household transfer, a
    // cash withdrawal to the wallet or an own-account exchange came back as
    // brand new on every re-import, one confirm away from moving both balances
    // twice. Keyed by fingerprint, scoped exactly like the unique index that
    // backs it up — (user_id, statement_hash) over live rows.
    const { data: transferHashRows } = await supabase
      .from("transfers")
      .select("id, statement_hash")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("statement_hash", rowHashes.slice(0, 1000));
    const importedTransfers: ImportedTransferRef[] = (transferHashRows || [])
      .filter((t): t is { id: string; statement_hash: string } =>
        !!t.statement_hash,
      )
      .map((t) => ({ id: t.id, statement_hash: t.statement_hash }));

    const classifications = reconcileStatementRows(
      rows,
      candidates,
      crossAccountCandidates,
      skippedHashes,
      householdMembers,
      householdTransfers,
      importedTransfers,
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
    for (const id of flaggedAccountIds) {
      const named = (ownedAccounts || []).find((a) => a.id === id);
      if (named) accountNames[id] = named.name;
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
