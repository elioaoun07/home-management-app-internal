// src/app/api/statement-import/commit/route.ts
//
// Write the outcome of a reviewed statement session.
//
// MONEY INVARIANTS (money-rules) — every action type is deliberate about the
// balance, because the same real-world purchase must hit the balance EXACTLY
// ONCE across its whole lifetime:
//
//   create        → the bank saw money the user never logged. New transaction,
//                   balance moves once. Credits (refunds/reversals) are stored
//                   positive with is_debt_return=true so the balance goes UP.
//   stamp         → the user already logged it; we only tag the existing row
//                   with the statement fingerprint. BALANCE-NEUTRAL. The user's
//                   own date is kept — the bank's posting date is noise.
//                   accept_amount is the one exception: it reverses the old
//                   amount and applies the bank's.
//   confirm_draft → a pending draft is now proven by the bank. Draft rows were
//                   never counted in the stored balance, so confirming applies
//                   the delta once, exactly like the drafts API does.
//
// Every write is guarded so a retry (double-tap, refresh, flaky network) is a
// no-op rather than double-counting: hash uniqueness for creates,
// `statement_hash IS NULL` for stamps, `is_draft = true` for confirms.
//
// REVERSIBILITY — a bulk write the user cannot walk back is the real hazard
// here, so this route refuses to move money it cannot undo. It opens a
// `statement_imports` record first, writes one `statement_import_entries` row
// per transaction it touches (carrying BOTH the state it found and the state
// it wrote), and only then applies balances. If either the record or the
// ledger cannot be written the route returns 503 having changed nothing.
// POST .../imports/[id]/revert replays that ledger backwards.

import { adjustAccountBalance } from "@/lib/balance";
import type { AccountType } from "@/lib/balance-utils";
import { getBalanceDelta, getTransferDeltas } from "@/lib/balance-utils";
import { getErrorCode } from "@/lib/errors";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const money = z.number().positive().finite();

const createAction = z.object({
  kind: z.literal("create"),
  row_id: z.string().min(1).max(120),
  date: isoDate,
  description: z.string().max(500),
  /** The statement line as the BANK wrote it — stable across imports, so it is
   *  what reporting groups on. `description` is the user's own wording. */
  bank_description: z.string().max(500).nullable().optional(),
  amount: money,
  direction: z.enum(["debit", "credit"]),
  account_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  subcategory_id: z.string().uuid().nullable(),
  statement_hash: z.string().min(1).max(200),
  learn_mapping: z
    .object({
      pattern: z.string().trim().min(2).max(120),
      name: z.string().trim().min(1).max(120),
    })
    .optional(),
});

const stampAction = z.object({
  kind: z.literal("stamp"),
  row_id: z.string().min(1).max(120),
  transaction_id: z.string().uuid(),
  statement_hash: z.string().min(1).max(200),
  bank_description: z.string().max(500).nullable().optional(),
  accept_amount: money.optional(),
});

const confirmDraftAction = z.object({
  kind: z.literal("confirm_draft"),
  row_id: z.string().min(1).max(120),
  transaction_id: z.string().uuid(),
  statement_hash: z.string().min(1).max(200),
  amount: money.optional(),
  category_id: z.string().uuid().nullable().optional(),
  subcategory_id: z.string().uuid().nullable().optional(),
});

const rekeyAction = z.object({
  kind: z.literal("rekey"),
  row_id: z.string().min(1).max(120),
  transaction_id: z.string().uuid(),
  statement_hash: z.string().min(1).max(200),
  previous_hash: z.string().min(1).max(200),
  bank_description: z.string().max(500).nullable().optional(),
});

const skipAction = z.object({
  kind: z.literal("skip"),
  row_id: z.string().min(1).max(120),
  statement_hash: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  amount: z.number().finite().optional(),
  date: isoDate.optional(),
});

const unskipAction = z.object({
  kind: z.literal("unskip"),
  row_id: z.string().min(1).max(120),
  statement_hash: z.string().min(1).max(200),
});

const createTransferAction = z.object({
  kind: z.literal("create_transfer"),
  row_id: z.string().min(1).max(120),
  statement_hash: z.string().min(1).max(200),
  date: isoDate,
  amount: money,
  description: z.string().max(500),
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  transfer_type: z.enum(["self", "household"]).default("household"),
  /**
   * What the DESTINATION receives in its own currency, for an own-account FX
   * exchange ("Own Account Exchange: USD to EUR at 0.852" — 200.00 out, 170.40
   * in). Absent for a same-currency move, where the destination gains exactly
   * `amount`. `exchange_rate` is DERIVED from `to_amount / amount` here rather
   * than accepted from the client, so the stored rate can never disagree with
   * the two amounts it is supposed to relate — the same rule
   * POST /api/transfers follows.
   */
  to_amount: money.optional(),
});

const commitSchema = z.object({
  statement_id: z.string().min(8).max(200),
  file_name: z.string().max(200).default("Statement"),
  account_id: z.string().uuid(),
  actions: z
    .array(
      z.discriminatedUnion("kind", [
        createAction,
        stampAction,
        confirmDraftAction,
        rekeyAction,
        skipAction,
        unskipAction,
        createTransferAction,
      ]),
    )
    .min(1)
    .max(1000),
});

type CommitAction = z.infer<typeof commitSchema>["actions"][number];
type RowStatus = "ok" | "skipped_duplicate" | "error";

interface RowResult {
  row_id: string;
  status: RowStatus;
  error?: string;
  transaction_id?: string;
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
    const parsed = commitSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const {
      actions,
      file_name,
      statement_id,
      account_id: sessionAccountId,
    } = parsed.data;

    // ── Ownership: every account touched must belong to the caller ──────────
    const accountIds = [
      ...new Set([
        sessionAccountId,
        ...actions.flatMap((a) => (a.kind === "create" ? [a.account_id] : [])),
        ...actions.flatMap((a) =>
          a.kind === "create_transfer" ? [a.from_account_id] : [],
        ),
        // The household leg's to_account_id is the PARTNER's account and must
        // NOT be checked against the caller's ownership here — that would
        // reject every household transfer. Only the self leg's destination
        // (the owner's own wallet) needs the same ownership guarantee as any
        // other account this route writes to.
        ...actions.flatMap((a) =>
          a.kind === "create_transfer" && a.transfer_type === "self"
            ? [a.to_account_id]
            : [],
        ),
      ]),
    ];
    const { data: ownedAccounts } = await supabase
      .from("accounts")
      .select("id, type")
      .eq("user_id", user.id)
      .in("id", accountIds);

    const accountTypes = new Map<string, AccountType>();
    for (const acc of ownedAccounts || []) {
      accountTypes.set(acc.id, acc.type as AccountType);
    }
    if (accountIds.some((id) => !accountTypes.has(id))) {
      return NextResponse.json(
        { error: "Account not found or not owned by you" },
        { status: 403 },
      );
    }

    // ── The import record is opened BEFORE anything is written ─────────────
    //
    // Order matters for hygiene: the batch is only allowed to touch money once
    // there is a durable record to reverse it with. If the route dies halfway,
    // the import is left `processing` with the entries written so far — still
    // fully revertible — rather than leaving unrecorded rows in the ledger's
    // blind spot. A failure to open the record is fatal on purpose: an
    // unrevertible bulk write is exactly what this feature exists to prevent.
    const { data: importRecord, error: importError } = await supabase
      .from("statement_imports")
      .insert({
        user_id: user.id,
        file_name,
        statement_id,
        account_id: sessionAccountId,
        status: "processing",
      })
      .select("id")
      .single();

    if (importError || !importRecord) {
      return NextResponse.json(
        {
          error:
            "Could not open an import record, so nothing was written. Run migrations/2026-08-19_statement-import-rollback.sql, then retry.",
          details: importError?.message,
        },
        { status: 503 },
      );
    }
    const importId = importRecord.id as string;

    // One ledger row per transaction touched, carrying both the state we found
    // and the state we wrote — that pair is what makes an exact revert
    // possible and lets it refuse rows edited since.
    interface LedgerEntry {
      import_id: string;
      user_id: string;
      row_id: string;
      action: "create" | "stamp" | "confirm_draft" | "rekey" | "create_transfer";
      transaction_id: string | null;
      transfer_id?: string | null;
      account_id: string;
      statement_hash: string;
      applied_delta: number;
      previous: Record<string, unknown>;
      applied: Record<string, unknown>;
    }
    const ledger: LedgerEntry[] = [];

    // ── Category ↔ account validation (per-row, non-fatal) ──────────────────
    const categoryIds = [
      ...new Set(
        actions.flatMap((a) =>
          a.kind === "create" || a.kind === "confirm_draft"
            ? [a.category_id, a.subcategory_id].filter(
                (id): id is string => !!id,
              )
            : [],
        ),
      ),
    ];
    const categories = new Map<
      string,
      { account_id: string; parent_id: string | null }
    >();
    if (categoryIds.length > 0) {
      const { data: rows } = await supabase
        .from("user_categories")
        .select("id, account_id, parent_id")
        .eq("user_id", user.id)
        .in("id", categoryIds);
      for (const c of rows || []) {
        categories.set(c.id, { account_id: c.account_id, parent_id: c.parent_id });
      }
    }

    function categoryError(
      accountId: string,
      categoryId: string | null | undefined,
      subcategoryId: string | null | undefined,
    ): string | null {
      if (categoryId) {
        const cat = categories.get(categoryId);
        if (!cat) return "Category not found";
        if (cat.account_id !== accountId)
          return "Category belongs to a different account";
      }
      if (subcategoryId) {
        const sub = categories.get(subcategoryId);
        if (!sub) return "Subcategory not found";
        if (sub.account_id !== accountId)
          return "Subcategory belongs to a different account";
        if (!categoryId || sub.parent_id !== categoryId)
          return "Subcategory does not belong to the selected category";
      }
      return null;
    }

    const results: RowResult[] = [];
    // Signed balance delta per account, applied once at the end.
    const deltas: Record<string, number> = {};
    const addDelta = (accountId: string, delta: number) => {
      deltas[accountId] = (deltas[accountId] || 0) + delta;
    };

    // ── 1. Creates — one batch insert, per-row fallback on conflict ─────────
    const creates = actions.filter(
      (a): a is Extract<CommitAction, { kind: "create" }> => a.kind === "create",
    );
    const validCreates = creates.filter((a) => {
      const error = categoryError(a.account_id, a.category_id, a.subcategory_id);
      if (error) {
        results.push({ row_id: a.row_id, status: "error", error });
        return false;
      }
      return true;
    });

    const buildInsert = (a: Extract<CommitAction, { kind: "create" }>) => ({
      user_id: user.id,
      date: a.date,
      amount: a.amount,
      description: a.description,
      bank_description: a.bank_description ?? null,
      account_id: a.account_id,
      category_id: a.category_id,
      subcategory_id: a.subcategory_id,
      is_draft: false,
      is_imported: true,
      is_debt_return: a.direction === "credit",
      statement_hash: a.statement_hash,
    });

    const recordCreate = (
      a: Extract<CommitAction, { kind: "create" }>,
      transactionId: string | undefined,
    ) => {
      const isDebtReturn = a.direction === "credit";
      const delta = getBalanceDelta(
        a.amount,
        accountTypes.get(a.account_id)!,
        isDebtReturn,
        "create",
      );
      addDelta(a.account_id, delta);
      ledger.push({
        import_id: importId,
        user_id: user.id,
        row_id: a.row_id,
        action: "create",
        transaction_id: transactionId ?? null,
        account_id: a.account_id,
        statement_hash: a.statement_hash,
        applied_delta: delta,
        // Nothing existed before — the revert deletes rather than restores.
        previous: {},
        applied: { amount: a.amount, is_debt_return: isDebtReturn },
      });
    };

    if (validCreates.length > 0) {
      const { data: inserted, error: batchError } = await supabase
        .from("transactions")
        .insert(validCreates.map(buildInsert))
        .select("id, statement_hash");

      if (!batchError) {
        const idByHash = new Map(
          (inserted || []).map((r) => [r.statement_hash, r.id]),
        );
        for (const a of validCreates) {
          const transactionId = idByHash.get(a.statement_hash);
          results.push({
            row_id: a.row_id,
            status: "ok",
            transaction_id: transactionId,
          });
          recordCreate(a, transactionId);
        }
      } else {
        // The batch is atomic, so one duplicate rejects everything. Retry row
        // by row to isolate which rows were already imported.
        for (const a of validCreates) {
          const { data: row, error } = await supabase
            .from("transactions")
            .insert(buildInsert(a))
            .select("id")
            .single();

          if (error) {
            if (getErrorCode(error) === "23505") {
              results.push({ row_id: a.row_id, status: "skipped_duplicate" });
            } else {
              results.push({
                row_id: a.row_id,
                status: "error",
                error: error.message || "Failed to create transaction",
              });
            }
            continue;
          }

          results.push({ row_id: a.row_id, status: "ok", transaction_id: row.id });
          recordCreate(a, row.id);
        }
      }
    }

    // ── 2. Stamps — balance-neutral unless the bank's amount is accepted ────
    for (const a of actions) {
      if (a.kind !== "stamp") continue;

      const { data: existing, error: readError } = await supabase
        .from("transactions")
        .select("id, amount, account_id, is_debt_return, statement_hash, bank_description")
        .eq("id", a.transaction_id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (readError || !existing) {
        results.push({
          row_id: a.row_id,
          status: "error",
          error: "Transaction not found",
        });
        continue;
      }
      if (existing.statement_hash) {
        // Already reconciled by an earlier run — retry-safe no-op.
        results.push({ row_id: a.row_id, status: "skipped_duplicate" });
        continue;
      }

      const oldAmount = Math.abs(Number(existing.amount));
      const update: Record<string, unknown> = { statement_hash: a.statement_hash };
      if (a.accept_amount !== undefined && a.accept_amount !== oldAmount) {
        update.amount = a.accept_amount;
      }
      // The bank's own wording for a row the user logged by hand. Their
      // `description` is left exactly as they typed it — this only fills in the
      // stable machine text alongside it, which is what reporting groups on.
      if (a.bank_description !== undefined) {
        update.bank_description = a.bank_description;
      }

      const { data: updated, error: updateError } = await supabase
        .from("transactions")
        .update(update)
        .eq("id", a.transaction_id)
        .eq("user_id", user.id)
        .is("statement_hash", null)
        .select("id")
        .maybeSingle();

      if (updateError) {
        results.push({
          row_id: a.row_id,
          status:
            getErrorCode(updateError) === "23505" ? "skipped_duplicate" : "error",
          error:
            getErrorCode(updateError) === "23505"
              ? undefined
              : updateError.message,
        });
        continue;
      }
      if (!updated) {
        // Guard matched nothing → another run claimed it first.
        results.push({ row_id: a.row_id, status: "skipped_duplicate" });
        continue;
      }

      let stampDelta = 0;
      if (update.amount !== undefined) {
        const accountType = accountTypes.get(existing.account_id);
        if (accountType) {
          const isCredit = !!existing.is_debt_return;
          stampDelta =
            getBalanceDelta(oldAmount, accountType, isCredit, "delete") +
            getBalanceDelta(a.accept_amount!, accountType, isCredit, "create");
          addDelta(existing.account_id, stampDelta);
        }
      }

      ledger.push({
        import_id: importId,
        user_id: user.id,
        row_id: a.row_id,
        action: "stamp",
        transaction_id: a.transaction_id,
        account_id: existing.account_id,
        statement_hash: a.statement_hash,
        applied_delta: stampDelta,
        // The row existed and was unhashed — that is the state to walk back to.
        previous: {
          amount: oldAmount,
          statement_hash: null,
          bank_description: existing.bank_description ?? null,
        },
        applied: {
          amount: update.amount !== undefined ? a.accept_amount! : oldAmount,
          statement_hash: a.statement_hash,
          ...(update.bank_description !== undefined
            ? { bank_description: update.bank_description }
            : {}),
        },
      });

      results.push({
        row_id: a.row_id,
        status: "ok",
        transaction_id: a.transaction_id,
      });
    }

    // ── 3. Draft confirms — the draft's amount lands on the balance once ────
    for (const a of actions) {
      if (a.kind !== "confirm_draft") continue;

      const { data: draft } = await supabase
        .from("transactions")
        .select("id, amount, account_id, category_id, subcategory_id, is_debt_return")
        .eq("id", a.transaction_id)
        .eq("user_id", user.id)
        .eq("is_draft", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (!draft) {
        // Not a draft anymore (already confirmed) → retry-safe no-op.
        results.push({ row_id: a.row_id, status: "skipped_duplicate" });
        continue;
      }

      const finalCategory =
        a.category_id !== undefined ? a.category_id : draft.category_id;
      const finalSubcategory =
        a.subcategory_id !== undefined ? a.subcategory_id : draft.subcategory_id;
      const invalid = categoryError(
        draft.account_id,
        finalCategory,
        finalSubcategory,
      );
      if (invalid) {
        results.push({ row_id: a.row_id, status: "error", error: invalid });
        continue;
      }

      const finalAmount = a.amount ?? Math.abs(Number(draft.amount));

      const { data: confirmed, error: confirmError } = await supabase
        .from("transactions")
        .update({
          is_draft: false,
          amount: finalAmount,
          category_id: finalCategory,
          subcategory_id: finalSubcategory,
          statement_hash: a.statement_hash,
        })
        .eq("id", a.transaction_id)
        .eq("user_id", user.id)
        .eq("is_draft", true)
        .select("id")
        .maybeSingle();

      if (confirmError) {
        results.push({
          row_id: a.row_id,
          status:
            getErrorCode(confirmError) === "23505"
              ? "skipped_duplicate"
              : "error",
          error:
            getErrorCode(confirmError) === "23505"
              ? undefined
              : confirmError.message,
        });
        continue;
      }
      if (!confirmed) {
        results.push({ row_id: a.row_id, status: "skipped_duplicate" });
        continue;
      }

      const accountType = accountTypes.get(draft.account_id);
      let confirmDelta = 0;
      if (accountType) {
        confirmDelta = getBalanceDelta(
          finalAmount,
          accountType,
          !!draft.is_debt_return,
          "create",
        );
        addDelta(draft.account_id, confirmDelta);
      }

      ledger.push({
        import_id: importId,
        user_id: user.id,
        row_id: a.row_id,
        action: "confirm_draft",
        transaction_id: a.transaction_id,
        account_id: draft.account_id,
        statement_hash: a.statement_hash,
        applied_delta: confirmDelta,
        // A draft never counted toward the balance — restoring it is what makes
        // the reverted confirm balance-neutral again.
        previous: {
          amount: Math.abs(Number(draft.amount)),
          is_draft: true,
          category_id: draft.category_id,
          subcategory_id: draft.subcategory_id,
          statement_hash: null,
        },
        applied: {
          amount: finalAmount,
          is_draft: false,
          category_id: finalCategory,
          subcategory_id: finalSubcategory,
          statement_hash: a.statement_hash,
        },
      });

      results.push({
        row_id: a.row_id,
        status: "ok",
        transaction_id: a.transaction_id,
      });
    }

    // ── 3b. Re-key — swap an outdated fingerprint for the current one ───────
    //
    // BALANCE-NEUTRAL by construction: `statement_hash` is the only column
    // written. This is the self-healing half of a fingerprint-formula change —
    // rows recognised by the fuzzy tier get upgraded so the NEXT import matches
    // them by identity. Guarded on the previous hash so a row edited or
    // re-keyed by a concurrent run is left alone rather than clobbered.
    for (const a of actions) {
      if (a.kind !== "rekey") continue;

      const { data: existing } = await supabase
        .from("transactions")
        .select("id, account_id, statement_hash, bank_description")
        .eq("id", a.transaction_id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!existing) {
        results.push({
          row_id: a.row_id,
          status: "error",
          error: "Transaction not found",
        });
        continue;
      }
      const hashUnchanged = existing.statement_hash === a.statement_hash;
      const bankUnchanged =
        a.bank_description === undefined ||
        existing.bank_description === a.bank_description;
      if (hashUnchanged && bankUnchanged) {
        // Nothing left to write — retry-safe no-op. Checking BOTH fields is
        // what lets a statement with current fingerprints still backfill the
        // bank wording; hash-only would have reported "nothing to do" and left
        // `bank_description` empty forever.
        results.push({ row_id: a.row_id, status: "skipped_duplicate" });
        continue;
      }

      const rekeyUpdate: Record<string, unknown> = {
        statement_hash: a.statement_hash,
      };
      if (a.bank_description !== undefined) {
        rekeyUpdate.bank_description = a.bank_description;
      }

      const { data: rekeyed, error: rekeyError } = await supabase
        .from("transactions")
        .update(rekeyUpdate)
        .eq("id", a.transaction_id)
        .eq("user_id", user.id)
        .eq("statement_hash", a.previous_hash)
        .select("id")
        .maybeSingle();

      if (rekeyError) {
        // 23505 = the new fingerprint is already on some OTHER row, so this one
        // is a genuine duplicate rather than an outdated key. Leave it as-is.
        results.push({
          row_id: a.row_id,
          status:
            getErrorCode(rekeyError) === "23505" ? "skipped_duplicate" : "error",
          error:
            getErrorCode(rekeyError) === "23505" ? undefined : rekeyError.message,
        });
        continue;
      }
      if (!rekeyed) {
        results.push({ row_id: a.row_id, status: "skipped_duplicate" });
        continue;
      }

      ledger.push({
        import_id: importId,
        user_id: user.id,
        row_id: a.row_id,
        action: "rekey",
        transaction_id: a.transaction_id,
        account_id: existing.account_id,
        statement_hash: a.statement_hash,
        applied_delta: 0,
        previous: {
          statement_hash: a.previous_hash,
          bank_description: existing.bank_description ?? null,
        },
        applied: {
          statement_hash: a.statement_hash,
          ...(rekeyUpdate.bank_description !== undefined
            ? { bank_description: rekeyUpdate.bank_description }
            : {}),
        },
      });

      results.push({
        row_id: a.row_id,
        status: "ok",
        transaction_id: a.transaction_id,
      });
    }

    // ── 3b-bis. Transfers — money, but never spending ───────────────────────
    //
    // Written to `transfers`, not `transactions`: neither leg is spending, and
    // living in a different table keeps both out of every spending aggregate
    // by construction rather than by a flag.
    //
    // Two shapes: "household" is real money moving between the owner and their
    // partner — the partner must own the destination, the same rule
    // POST /api/transfers enforces, which is also why the receiving side can
    // never create a second copy of the movement. "self" is a cash withdrawal
    // moving into the owner's OWN wallet account — nobody else involved, no
    // household link needed.
    const transferRows = actions.filter(
      (a): a is Extract<CommitAction, { kind: "create_transfer" }> =>
        a.kind === "create_transfer",
    );
    if (transferRows.length > 0) {
      let link: {
        id: string;
        owner_user_id: string;
        partner_user_id: string;
      } | null = null;
      if (transferRows.some((a) => a.transfer_type === "household")) {
        const { data } = await supabase
          .from("household_links")
          .select("id, owner_user_id, partner_user_id")
          .eq("active", true)
          .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
          .maybeSingle();
        link = data;
      }
      const partnerId = link
        ? link.owner_user_id === user.id
          ? link.partner_user_id
          : link.owner_user_id
        : null;

      for (const a of transferRows) {
        const isHousehold = a.transfer_type === "household";

        if (isHousehold && (!link || !partnerId)) {
          results.push({
            row_id: a.row_id,
            status: "error",
            error: "No active household link",
          });
          continue;
        }

        const { data: destination } = await supabase
          .from("accounts")
          .select("id, user_id, name")
          .eq("id", a.to_account_id)
          .maybeSingle();

        const expectedOwner = isHousehold ? partnerId : user.id;
        if (!destination || destination.user_id !== expectedOwner) {
          results.push({
            row_id: a.row_id,
            status: "error",
            error: isHousehold
              ? "Destination must be your household partner's account"
              : "Destination must be one of your own accounts",
          });
          continue;
        }

        // Conversion composes only with a plain SELF transfer: the fee /
        // returned-amount math on a household transfer assumes one currency,
        // which is the same restriction POST /api/transfers enforces.
        const toAmount = !isHousehold ? a.to_amount : undefined;

        const { data: transfer, error: transferError } = await supabase
          .from("transfers")
          .insert({
            user_id: user.id,
            from_account_id: a.from_account_id,
            to_account_id: a.to_account_id,
            amount: a.amount,
            description: a.description,
            date: a.date,
            transfer_type: a.transfer_type,
            recipient_user_id: isHousehold ? partnerId : null,
            household_link_id: isHousehold ? link!.id : null,
            to_amount: toAmount ?? null,
            exchange_rate: toAmount !== undefined ? toAmount / a.amount : null,
            // The same identity backstop `transactions` has carried since this
            // feature shipped. Without it a re-imported statement re-offered
            // every transfer row as new and the owner could move both balances
            // a second time; the unique index on (user_id, statement_hash)
            // catches whatever slips past the reconciler.
            statement_hash: a.statement_hash,
          })
          .select("id")
          .single();

        if (transferError || !transfer) {
          // 23505 = this bank line already has a live transfer. Not an error:
          // the row is already recorded, which is exactly what was wanted.
          if (getErrorCode(transferError) === "23505") {
            results.push({ row_id: a.row_id, status: "skipped_duplicate" });
            continue;
          }
          results.push({
            row_id: a.row_id,
            status: "error",
            error: transferError?.message || "Failed to create transfer",
          });
          continue;
        }

        const { fromDelta, toDelta } = getTransferDeltas(
          a.amount,
          0,
          a.transfer_type,
          toAmount,
        );
        addDelta(a.from_account_id, fromDelta);
        addDelta(a.to_account_id, toDelta);

        ledger.push({
          import_id: importId,
          user_id: user.id,
          row_id: a.row_id,
          action: "create_transfer",
          transaction_id: null,
          transfer_id: transfer.id,
          account_id: a.from_account_id,
          statement_hash: a.statement_hash,
          // Both legs of one movement. The revert deletes the transfer and puts
          // BOTH balances back, so it is recorded as the net effect on the
          // from-account with the to-account leg carried in `applied`.
          applied_delta: fromDelta,
          previous: {},
          applied: {
            amount: a.amount,
            to_account_id: a.to_account_id,
            to_delta: toDelta,
          },
        });

        results.push({ row_id: a.row_id, status: "ok" });
      }
    }

    // ── 3c. Standing skips — a decision about a bank ROW, not about money ───
    //
    // No balance, no ledger entry: nothing was written to `transactions`, so
    // there is nothing for a revert to walk back. Deliberately kept out of the
    // import ledger so reverting an import does not silently un-skip rows the
    // owner ruled on separately.
    const skipRows = actions.filter(
      (a): a is Extract<CommitAction, { kind: "skip" }> => a.kind === "skip",
    );
    if (skipRows.length > 0) {
      const { error: skipError } = await supabase
        .from("statement_skipped_rows")
        .upsert(
          skipRows.map((a) => ({
            user_id: user.id,
            statement_hash: a.statement_hash,
            account_id: sessionAccountId,
            description: a.description ?? null,
            amount: a.amount ?? null,
            row_date: a.date ?? null,
          })),
          { onConflict: "user_id,statement_hash" },
        );
      for (const a of skipRows) {
        results.push({
          row_id: a.row_id,
          status: skipError ? "error" : "ok",
          error: skipError?.message,
        });
      }
    }

    const unskipRows = actions.filter(
      (a): a is Extract<CommitAction, { kind: "unskip" }> => a.kind === "unskip",
    );
    if (unskipRows.length > 0) {
      const { error: unskipError } = await supabase
        .from("statement_skipped_rows")
        .delete()
        .eq("user_id", user.id)
        .in(
          "statement_hash",
          unskipRows.map((a) => a.statement_hash),
        );
      for (const a of unskipRows) {
        results.push({
          row_id: a.row_id,
          status: unskipError ? "error" : "ok",
          error: unskipError?.message,
        });
      }
    }

    // ── 4. Persist the ledger BEFORE the balance moves ──────────────────────
    //
    // If the process dies between these two steps the worst case is a ledger
    // entry whose balance was never applied — the revert recomputes deltas from
    // live row state, so it corrects that by itself. The reverse order would
    // lose the record of a balance that DID move, which nothing can correct.
    if (ledger.length > 0) {
      const { error: ledgerError } = await supabase
        .from("statement_import_entries")
        .upsert(ledger, { onConflict: "import_id,row_id" });

      if (ledgerError) {
        await supabase
          .from("statement_imports")
          .update({ status: "failed" })
          .eq("id", importId)
          .eq("user_id", user.id);
        return NextResponse.json(
          {
            error:
              "Could not record what this import would change, so no money was moved. Nothing was written.",
            details: ledgerError.message,
          },
          { status: 503 },
        );
      }
    }

    // ── 5. One balance write per affected account ───────────────────────────
    for (const [accountId, delta] of Object.entries(deltas)) {
      if (delta === 0) continue;
      await adjustAccountBalance(accountId, delta, "statement_import", {
        userId: user.id,
        reason: `Statement import: ${file_name}`,
      });
    }

    // ── 6. Learn merchant mappings from rows the user categorized ───────────
    //
    // Each upsert may overwrite a mapping the user already had, so the prior
    // value is snapshotted first: reverting the import puts the merchant map
    // back exactly as it stood, instead of leaving the import's guesses behind.
    const mappings = new Map<string, Record<string, unknown>>();
    for (const a of validCreates) {
      if (!a.learn_mapping || !a.category_id) continue;
      const ok = results.find(
        (r) => r.row_id === a.row_id && r.status === "ok",
      );
      if (!ok) continue;
      mappings.set(a.learn_mapping.pattern.toUpperCase(), {
        user_id: user.id,
        merchant_pattern: a.learn_mapping.pattern.toUpperCase(),
        merchant_name: a.learn_mapping.name,
        category_id: a.category_id,
        subcategory_id: a.subcategory_id,
        account_id: a.account_id,
      });
    }

    const learnedMappings: Array<Record<string, unknown>> = [];
    if (mappings.size > 0) {
      const patterns = [...mappings.keys()];
      const { data: priorMappings } = await supabase
        .from("merchant_mappings")
        .select("merchant_pattern, merchant_name, category_id, subcategory_id, account_id")
        .eq("user_id", user.id)
        .in("merchant_pattern", patterns);

      const priorByPattern = new Map(
        (priorMappings || []).map((m) => [m.merchant_pattern, m]),
      );

      for (const [pattern, mapping] of mappings) {
        const prior = priorByPattern.get(pattern);
        learnedMappings.push({
          pattern,
          applied: {
            merchant_name: mapping.merchant_name,
            category_id: mapping.category_id,
            subcategory_id: mapping.subcategory_id,
            account_id: mapping.account_id,
          },
          previous: prior
            ? {
                merchant_name: prior.merchant_name,
                category_id: prior.category_id,
                subcategory_id: prior.subcategory_id,
                account_id: prior.account_id,
              }
            : null,
        });
        await supabase
          .from("merchant_mappings")
          .upsert(mapping, { onConflict: "user_id,merchant_pattern" });
      }
    }

    const created = results.filter(
      (r) => r.status === "ok" && creates.some((c) => c.row_id === r.row_id),
    ).length;
    const stamped = results.filter(
      (r) =>
        r.status === "ok" &&
        actions.some((a) => a.kind === "stamp" && a.row_id === r.row_id),
    ).length;
    const draftsConfirmed = results.filter(
      (r) =>
        r.status === "ok" &&
        actions.some((a) => a.kind === "confirm_draft" && a.row_id === r.row_id),
    ).length;

    const rekeyed = results.filter(
      (r) =>
        r.status === "ok" &&
        actions.some((a) => a.kind === "rekey" && a.row_id === r.row_id),
    ).length;

    const transfersCreated = results.filter(
      (r) =>
        r.status === "ok" && transferRows.some((a) => a.row_id === r.row_id),
    ).length;

    const skipsRecorded = results.filter(
      (r) =>
        r.status === "ok" &&
        skipRows.some((a) => a.row_id === r.row_id),
    ).length;
    const skipsRemoved = results.filter(
      (r) =>
        r.status === "ok" &&
        unskipRows.some((a) => a.row_id === r.row_id),
    ).length;

    const skipped = results.filter(
      (r) => r.status === "skipped_duplicate",
    ).length;
    const errorCount = results.filter((r) => r.status === "error").length;

    // ── 7. Close the record — this is what the history list reads ───────────
    await supabase
      .from("statement_imports")
      .update({
        transactions_count: created + stamped + draftsConfirmed,
        created_count: created,
        stamped_count: stamped,
        drafts_confirmed_count: draftsConfirmed,
        skipped_count: skipped,
        error_count: errorCount,
        balance_deltas: deltas,
        learned_mappings: learnedMappings,
        status: "completed",
      })
      .eq("id", importId)
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        success: true,
        import_id: importId,
        created,
        stamped,
        drafts_confirmed: draftsConfirmed,
        // Fingerprints upgraded to the current formula. Balance-neutral, and
        // not counted in transactions_count — no money moved.
        rekeyed,
        transfers_created: transfersCreated,
        skips_recorded: skipsRecorded,
        skips_removed: skipsRemoved,
        skipped,
        errors: errorCount,
        mappings_saved: mappings.size,
        balance_deltas: deltas,
        results,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to commit statement" },
      { status: 500 },
    );
  }
}
