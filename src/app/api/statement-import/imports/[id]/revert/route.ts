// src/app/api/statement-import/imports/[id]/revert/route.ts
//
// Walk a whole statement import backwards.
//
// MONEY INVARIANTS (money-rules) — the mirror image of commit/route.ts. Each
// action undoes exactly the balance move it made, and no more:
//
//   create        → soft-delete the row and free its fingerprint. The balance
//                   gives back what the row currently holds, so an amount the
//                   user edited after importing still nets to zero.
//   stamp         → clear the fingerprint. BALANCE-NEUTRAL, because stamping
//                   was. The single exception is a stamp that took the bank's
//                   amount: the user's own figure is restored and that one
//                   move is reversed — unless they have since set a third
//                   value, which the balance already reflects.
//   confirm_draft → back to draft with its original category and amount.
//                   Drafts are not counted in the stored balance, so today's
//                   amount comes back out.
//
// WORKED EXAMPLE (expense account, balance $961.75 after the commit route's
// own worked example — create 45.50, stamp 80.00, credit 20.00, confirm draft
// 12.75, net −38.25 from $1,000):
//
//   revert create 45.50        → +45.50   (soft-deleted, hash freed)
//   revert stamp 80.00         →   0.00   (hash cleared, amount untouched)
//   revert create 20.00 credit → −20.00   (a refund removed takes the money back out)
//   revert confirm_draft 12.75 → +12.75   (back to draft, uncounted again)
//   ────────────────────────────────────
//   net +38.25 → $1,000.00, the balance before the import. Running it twice
//   moves nothing: every entry is stamped reverted_at and its UPDATE is
//   guarded on the state the first pass left behind.
//
// Rows the user edited after the import are NOT clobbered — see the two
// principles at the top of src/lib/statement-revert.ts. Rows another import
// has since claimed, or that were purged from the Recycle Bin, are reported
// as skipped rather than guessed at.

import { adjustAccountBalance } from "@/lib/balance";
import type { AccountType } from "@/lib/balance-utils";
import {
  planRevert,
  type LedgerEntry,
  type LiveTransaction,
} from "@/lib/statement-revert";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z
  .object({
    /** Also undo what this import taught the merchant map. Default: yes. */
    revert_mappings: z.boolean().default(true),
  })
  .default({ revert_mappings: true });

export async function POST(
  req: NextRequest,
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

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { revert_mappings } = parsed.data;

    // ── 1. The import, owned by the caller ─────────────────────────────────
    const { data: record } = await supabase
      .from("statement_imports")
      .select("id, file_name, status, account_id, learned_mappings")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!record) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }

    // ── 2. The ledger ──────────────────────────────────────────────────────
    const { data: entryRows, error: entriesError } = await supabase
      .from("statement_import_entries")
      .select(
        "id, action, transaction_id, account_id, statement_hash, previous, applied, reverted_at",
      )
      .eq("import_id", id)
      .eq("user_id", user.id);

    if (entriesError) {
      return NextResponse.json(
        { error: entriesError.message },
        { status: 500 },
      );
    }

    const entries = (entryRows || []) as unknown as LedgerEntry[];

    // ── 3. Live state of every transaction the import touched ──────────────
    const txIds = [
      ...new Set(entries.map((e) => e.transaction_id).filter(Boolean)),
    ] as string[];

    const live = new Map<string, LiveTransaction>();
    if (txIds.length > 0) {
      const { data: txRows } = await supabase
        .from("transactions")
        .select(
          "id, amount, is_draft, deleted_at, statement_hash, is_debt_return, account_id",
        )
        .eq("user_id", user.id)
        .in("id", txIds);

      for (const tx of txRows || []) {
        live.set(tx.id, {
          id: tx.id,
          amount: Math.abs(Number(tx.amount)),
          is_draft: !!tx.is_draft,
          deleted_at: tx.deleted_at ?? null,
          statement_hash: tx.statement_hash ?? null,
          is_debt_return: !!tx.is_debt_return,
          account_id: tx.account_id,
        });
      }
    }

    const accountIds = [
      ...new Set([
        ...entries.map((e) => e.account_id),
        ...[...live.values()].map((t) => t.account_id),
      ]),
    ];
    const accountTypes = new Map<string, AccountType>();
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, type")
        .eq("user_id", user.id)
        .in("id", accountIds);
      for (const a of accounts || []) {
        accountTypes.set(a.id, a.type as AccountType);
      }
    }

    // ── 4. Decide everything before writing anything ───────────────────────
    const { plans, deltas, counts } = planRevert(entries, live, accountTypes);

    // ── 5. Apply, row by row, each guarded on the state it planned against ─
    const appliedDeltas: Record<string, number> = {};
    const revertedEntryIds: string[] = [];
    const skippedEntries: Array<{ id: string; note: string }> = [];

    // Entries a previous revert already settled keep their original note.
    const alreadySettled = new Set(
      entries.filter((e) => e.reverted_at).map((e) => e.id),
    );

    for (const plan of plans) {
      if (plan.note !== "reverted") {
        if (!alreadySettled.has(plan.entry_id)) {
          skippedEntries.push({ id: plan.entry_id, note: plan.note });
        }
        continue;
      }

      // A household transfer lives in `transfers`, not `transactions`, and is
      // undone by soft-deleting the row rather than editing columns. Its two
      // balance legs are already in `deltas`.
      if (plan.action === "create_transfer") {
        const transferId = plan.guard.id as string;
        const fromAccountId = plan.guard.from_account_id as string;
        const toAccountId = plan.guard.to_account_id as string | null;
        const { data: removed, error: removeError } = await supabase
          .from("transfers")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", transferId)
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .select("id")
          .maybeSingle();

        if (removeError || !removed) {
          skippedEntries.push({ id: plan.entry_id, note: "drifted" });
          counts.drifted++;
          counts.transfers_deleted--;
          // Both legs were planned but never applied — take them back out so
          // the balance write below reflects only what actually happened.
          deltas[fromAccountId] = (deltas[fromAccountId] || 0) - plan.delta;
          if (toAccountId) {
            deltas[toAccountId] =
              (deltas[toAccountId] || 0) + plan.delta;
          }
          continue;
        }

        revertedEntryIds.push(plan.entry_id);
        continue;
      }

      let update = supabase
        .from("transactions")
        .update(plan.update)
        .eq("user_id", user.id);
      for (const [column, value] of Object.entries(plan.guard)) {
        update = value === null ? update.is(column, null) : update.eq(column, value);
      }

      const { data: updated, error: updateError } = await update
        .select("id")
        .maybeSingle();

      if (updateError || !updated) {
        // The guard matched nothing → the row moved under us between the plan
        // and the write. Leave it and say so; never retry blind.
        skippedEntries.push({ id: plan.entry_id, note: "drifted" });
        counts.drifted++;
        if (plan.action === "create") counts.deleted--;
        else if (plan.action === "stamp") counts.unstamped--;
        else if (plan.action === "rekey") counts.rekeyed--;
        else counts.redrafted--;
        if (plan.editedSince && plan.action === "create") {
          counts.removed_after_edit--;
        }
        // Its delta was planned but never applied — take it back out.
        if (plan.delta !== 0 && plan.transaction_id) {
          const accountId = live.get(plan.transaction_id)!.account_id;
          deltas[accountId] = (deltas[accountId] || 0) - plan.delta;
        }
        continue;
      }

      revertedEntryIds.push(plan.entry_id);
    }

    // ── 6. One balance write per affected account ──────────────────────────
    for (const [accountId, delta] of Object.entries(deltas)) {
      if (delta === 0) continue;
      appliedDeltas[accountId] = delta;
      await adjustAccountBalance(accountId, delta, "statement_import_revert", {
        userId: user.id,
        reason: `Reverted statement import: ${record.file_name}`,
      });
    }

    // ── 7. Stamp the ledger so a second run is a no-op ─────────────────────
    const now = new Date().toISOString();
    if (revertedEntryIds.length > 0) {
      await supabase
        .from("statement_import_entries")
        .update({ reverted_at: now, revert_note: "reverted" })
        .eq("user_id", user.id)
        .in("id", revertedEntryIds);
    }
    for (const skipped of skippedEntries) {
      await supabase
        .from("statement_import_entries")
        .update({ revert_note: skipped.note })
        .eq("user_id", user.id)
        .eq("id", skipped.id);
    }

    // ── 8. Put the merchant map back the way it stood ──────────────────────
    let mappingsRestored = 0;
    let mappingsDeleted = 0;
    if (revert_mappings) {
      const learned = (record.learned_mappings || []) as Array<{
        pattern: string;
        previous: {
          merchant_name: string;
          category_id: string | null;
          subcategory_id: string | null;
          account_id: string | null;
        } | null;
      }>;

      for (const entry of learned) {
        if (entry.previous) {
          const { error } = await supabase
            .from("merchant_mappings")
            .update({
              merchant_name: entry.previous.merchant_name,
              category_id: entry.previous.category_id,
              subcategory_id: entry.previous.subcategory_id,
              account_id: entry.previous.account_id,
            })
            .eq("user_id", user.id)
            .eq("merchant_pattern", entry.pattern);
          if (!error) mappingsRestored++;
        } else {
          // Nothing stood here before the import — the mapping is entirely
          // this import's doing, so it goes with it.
          const { error } = await supabase
            .from("merchant_mappings")
            .delete()
            .eq("user_id", user.id)
            .eq("merchant_pattern", entry.pattern);
          if (!error) mappingsDeleted++;
        }
      }
    }

    // ── 9. Close the import ────────────────────────────────────────────────
    const anythingLeft = plans.some(
      (p) => p.note === "drifted" || p.note === "gone",
    );
    const status = anythingLeft ? "partially_reverted" : "reverted";

    await supabase
      .from("statement_imports")
      .update({ status, reverted_at: now })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        success: true,
        status,
        deleted: counts.deleted,
        unstamped: counts.unstamped,
        rekeyed: counts.rekeyed,
        transfers_deleted: counts.transfers_deleted,
        redrafted: counts.redrafted,
        skipped: {
          gone: counts.gone,
          drifted: counts.drifted,
          already_undone: counts.already_undone,
        },
        removed_after_edit: counts.removed_after_edit,
        mappings_restored: mappingsRestored,
        mappings_deleted: mappingsDeleted,
        balance_deltas: appliedDeltas,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to revert statement import" },
      { status: 500 },
    );
  }
}
