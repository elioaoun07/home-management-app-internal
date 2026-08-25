// src/lib/statement-revert.ts
//
// Pure planner for reverting a statement import. Given the ledger written at
// commit time plus the CURRENT state of each transaction, it decides — per
// entry — what to write back and what the balance must move by. No IO, so the
// rules that un-move money are testable on their own (same split as
// statement-reconcile.ts: rules here, database access in the route).
//
// TWO PRINCIPLES DECIDE EVERY CASE BELOW:
//
//  1. **Balance deltas are computed from LIVE state, never from the stored
//     `applied_delta`.** If the user edited a transaction after importing it,
//     the balance already reflects that edit — reversing the *original* amount
//     would leave the account permanently off. Reversing what is actually
//     there always nets to zero.
//
//  2. **A newer human edit outranks the import.** Where reverting would
//     overwrite a value the user changed after the fact, the planner keeps
//     their value and flags the entry instead. The one exception is a row the
//     import CREATED: it exists only because of the import, so it goes even if
//     it was edited — the flag then tells the receipt how many such rows there
//     were.

import { getBalanceDelta, type AccountType } from "@/lib/balance-utils";

/** Why an entry was not (or need not be) undone. */
export type RevertNote = "reverted" | "gone" | "drifted" | "already_undone";

export type EntryAction =
  | "create"
  | "stamp"
  | "confirm_draft"
  | "rekey"
  | "create_transfer";

export interface LedgerEntry {
  id: string;
  action: EntryAction;
  transaction_id: string | null;
  /** Set only for `create_transfer` — the `transfers` row this import made. */
  transfer_id?: string | null;
  account_id: string;
  statement_hash: string;
  previous: {
    amount?: number;
    is_draft?: boolean;
    category_id?: string | null;
    subcategory_id?: string | null;
    statement_hash?: string | null;
    bank_description?: string | null;
  };
  applied: {
    amount?: number;
    is_draft?: boolean;
    category_id?: string | null;
    subcategory_id?: string | null;
    statement_hash?: string | null;
    is_debt_return?: boolean;
    bank_description?: string | null;
    /** create_transfer: the partner's account and the delta applied to it. */
    to_account_id?: string;
    to_delta?: number;
  };
  reverted_at: string | null;
}

/** The transaction as it stands right now. */
export interface LiveTransaction {
  id: string;
  amount: number;
  is_draft: boolean;
  deleted_at: string | null;
  statement_hash: string | null;
  is_debt_return: boolean;
  account_id: string;
}

export interface RevertPlan {
  entry_id: string;
  transaction_id: string | null;
  action: EntryAction;
  note: RevertNote;
  /** Columns to write. Empty for every note other than "reverted". */
  update: Record<string, unknown>;
  /** Equality guards the UPDATE must carry so a concurrent revert can't double-apply. */
  guard: Record<string, unknown>;
  /** Signed balance delta this revert applies, derived from live state. */
  delta: number;
  /** The row was changed after the import; see principle 2 above. */
  editedSince: boolean;
}

export interface RevertPlanResult {
  plans: RevertPlan[];
  /** account_id → summed signed delta. */
  deltas: Record<string, number>;
  counts: {
    deleted: number;
    /** Household transfers deleted, both balances put back. */
    transfers_deleted: number;
    unstamped: number;
    redrafted: number;
    /** Fingerprints put back to the formula they carried before the import. */
    rekeyed: number;
    gone: number;
    drifted: number;
    already_undone: number;
    removed_after_edit: number;
  };
}

/** Money compares to the cent; numeric round-trips through Postgres aren't exact. */
const CENT = 0.005;
const sameMoney = (a: number, b: number) => Math.abs(a - b) < CENT;

function skip(entry: LedgerEntry, note: RevertNote): RevertPlan {
  return {
    entry_id: entry.id,
    transaction_id: entry.transaction_id,
    action: entry.action,
    note,
    update: {},
    guard: {},
    delta: 0,
    editedSince: false,
  };
}

/**
 * Plan the reversal of one import.
 *
 * `live` maps transaction_id → its current row. A transaction missing from the
 * map is treated as gone (hard-purged from the Recycle Bin, most likely) —
 * reported, never guessed at.
 */
export function planRevert(
  entries: LedgerEntry[],
  live: Map<string, LiveTransaction>,
  accountTypes: Map<string, AccountType>,
  now: string = new Date().toISOString(),
): RevertPlanResult {
  const plans: RevertPlan[] = [];
  const deltas: Record<string, number> = {};
  const counts = {
    deleted: 0,
    transfers_deleted: 0,
    unstamped: 0,
    redrafted: 0,
    rekeyed: 0,
    gone: 0,
    drifted: 0,
    already_undone: 0,
    removed_after_edit: 0,
  };

  for (const entry of entries) {
    if (entry.reverted_at) {
      plans.push(skip(entry, "already_undone"));
      counts.already_undone++;
      continue;
    }

    // A transfer (household or self) has no transaction at all — it lives in
    // `transfers` and moved TWO balances, possibly the partner's. Reversing
    // both is the whole point of recording it in the ledger: a bulk write
    // across accounts with no way back is exactly what this feature exists to
    // prevent.
    if (entry.action === "create_transfer") {
      if (!entry.transfer_id) {
        plans.push(skip(entry, "gone"));
        counts.gone++;
        continue;
      }
      const amount = entry.applied.amount ?? 0;
      const toAccountId = entry.applied.to_account_id;
      const toDelta = entry.applied.to_delta ?? 0;

      deltas[entry.account_id] =
        (deltas[entry.account_id] || 0) + amount; // undo the outgoing leg
      if (toAccountId) {
        deltas[toAccountId] = (deltas[toAccountId] || 0) - toDelta;
      }

      counts.transfers_deleted++;
      plans.push({
        entry_id: entry.id,
        transaction_id: null,
        action: "create_transfer",
        note: "reverted",
        update: {},
        // `id` is the guard the route writes against; the two account ids ride
        // along so it can back both legs out of `deltas` if the write is lost.
        guard: {
          id: entry.transfer_id,
          from_account_id: entry.account_id,
          to_account_id: toAccountId ?? null,
        },
        delta: amount,
        editedSince: false,
      });
      continue;
    }

    const tx = entry.transaction_id ? live.get(entry.transaction_id) : undefined;
    if (!tx) {
      plans.push(skip(entry, "gone"));
      counts.gone++;
      continue;
    }

    const accountType = accountTypes.get(tx.account_id);
    if (!accountType) {
      // The account is unreadable (deleted, or never owned). Touching the row
      // would move a balance we cannot compute — report rather than guess.
      plans.push(skip(entry, "drifted"));
      counts.drifted++;
      continue;
    }

    const addDelta = (delta: number) => {
      if (delta === 0) return;
      deltas[tx.account_id] = (deltas[tx.account_id] || 0) + delta;
    };

    // A re-key only ever swapped `statement_hash`, so walking it back is
    // putting the old fingerprint back. Always balance-neutral: the row
    // itself was already in the ledger before this import touched it, and the
    // import neither created nor re-valued it.
    if (entry.action === "rekey") {
      const previousHash = entry.previous.statement_hash ?? null;
      if (tx.statement_hash !== entry.statement_hash) {
        // Someone (or a later import) has moved it on since — restoring a hash
        // over a newer one is exactly the clobber this planner refuses to do.
        plans.push(skip(entry, "drifted"));
        counts.drifted++;
        continue;
      }
      plans.push({
        entry_id: entry.id,
        transaction_id: tx.id,
        action: "rekey",
        note: "reverted",
        update: {
          statement_hash: previousHash,
          ...(entry.applied.bank_description !== undefined
            ? { bank_description: entry.previous.bank_description ?? null }
            : {}),
        },
        guard: { id: tx.id, statement_hash: entry.statement_hash },
        delta: 0,
        editedSince: false,
      });
      counts.rekeyed++;
      continue;
    }

    if (entry.action === "create") {
      if (tx.deleted_at) {
        // Already in the Recycle Bin — whoever deleted it reversed the balance.
        plans.push(skip(entry, "already_undone"));
        counts.already_undone++;
        continue;
      }

      const editedSince = !sameMoney(tx.amount, entry.applied.amount ?? tx.amount);
      // Reverse what the balance actually holds today, not what we wrote.
      const delta = getBalanceDelta(tx.amount, accountType, tx.is_debt_return, "delete");
      addDelta(delta);
      if (editedSince) counts.removed_after_edit++;
      counts.deleted++;

      plans.push({
        entry_id: entry.id,
        transaction_id: tx.id,
        action: "create",
        note: "reverted",
        // Soft delete, and free the fingerprint: the statement must be
        // re-importable after a revert, and a hash left behind would make every
        // row of it read as "already imported".
        update: { deleted_at: now, statement_hash: null },
        guard: { id: tx.id, deleted_at: null },
        delta,
        editedSince,
      });
      continue;
    }

    if (entry.action === "stamp") {
      if (tx.statement_hash === null) {
        plans.push(skip(entry, "already_undone"));
        counts.already_undone++;
        continue;
      }
      if (tx.statement_hash !== entry.statement_hash) {
        // Another import owns this row now — clearing it would strip their mark.
        plans.push(skip(entry, "drifted"));
        counts.drifted++;
        continue;
      }

      const appliedAmount = entry.applied.amount ?? tx.amount;
      const previousAmount = entry.previous.amount ?? tx.amount;
      const changedTheAmount = !sameMoney(appliedAmount, previousAmount);
      const editedSince = !sameMoney(tx.amount, appliedAmount);

      const update: Record<string, unknown> = { statement_hash: null };
      // Only when the import actually wrote it — otherwise a revert would
      // blank a value that was already there before this import ran.
      if (entry.applied.bank_description !== undefined) {
        update.bank_description = entry.previous.bank_description ?? null;
      }
      let delta = 0;

      if (changedTheAmount && !editedSince) {
        // The import took the bank's amount and the user has not touched it
        // since — put their own figure back and undo that one balance move.
        update.amount = previousAmount;
        delta =
          getBalanceDelta(tx.amount, accountType, tx.is_debt_return, "delete") +
          getBalanceDelta(previousAmount, accountType, tx.is_debt_return, "create");
        addDelta(delta);
      }
      // Otherwise the stamp was balance-neutral (or the user has since set
      // their own amount, which the balance already reflects) → nothing moves.

      counts.unstamped++;
      plans.push({
        entry_id: entry.id,
        transaction_id: tx.id,
        action: "stamp",
        note: "reverted",
        update,
        guard: { id: tx.id, statement_hash: entry.statement_hash },
        delta,
        editedSince,
      });
      continue;
    }

    // confirm_draft
    if (tx.is_draft) {
      plans.push(skip(entry, "already_undone"));
      counts.already_undone++;
      continue;
    }
    if (tx.statement_hash !== entry.statement_hash) {
      plans.push(skip(entry, "drifted"));
      counts.drifted++;
      continue;
    }

    const editedSince = !sameMoney(tx.amount, entry.applied.amount ?? tx.amount);
    // A draft was never counted in the stored balance, so putting it back to
    // draft has to take today's amount back out.
    const delta = getBalanceDelta(tx.amount, accountType, tx.is_debt_return, "delete");
    addDelta(delta);
    counts.redrafted++;

    const update: Record<string, unknown> = {
      is_draft: true,
      statement_hash: null,
      category_id: entry.previous.category_id ?? null,
      subcategory_id: entry.previous.subcategory_id ?? null,
    };
    // Only restore the amount if the user hasn't set their own since.
    if (!editedSince && entry.previous.amount !== undefined) {
      update.amount = entry.previous.amount;
    }

    plans.push({
      entry_id: entry.id,
      transaction_id: tx.id,
      action: "confirm_draft",
      note: "reverted",
      update,
      guard: { id: tx.id, statement_hash: entry.statement_hash, is_draft: false },
      delta,
      editedSince,
    });
  }

  return { plans, deltas, counts };
}

/**
 * Whether the live row still looks the way the import left it. Used by the
 * detail endpoint to warn before the user commits to a revert.
 */
export function hasDrifted(entry: LedgerEntry, tx: LiveTransaction): boolean {
  if (entry.action === "create") {
    return !!tx.deleted_at || !sameMoney(tx.amount, entry.applied.amount ?? tx.amount);
  }
  // A re-key claims nothing about the money, so only the fingerprint can drift.
  if (entry.action === "rekey") {
    return tx.statement_hash !== entry.statement_hash;
  }
  if (tx.statement_hash !== entry.statement_hash) return true;
  if (entry.action === "confirm_draft" && tx.is_draft) return true;
  return !sameMoney(tx.amount, entry.applied.amount ?? tx.amount);
}
