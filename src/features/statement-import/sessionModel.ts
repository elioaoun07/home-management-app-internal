// src/features/statement-import/sessionModel.ts
//
// Pure logic for a statement review session: which bucket each row belongs to,
// what category applies to it, and what the commit endpoint should be told.
// No React, no IO — so the rules that decide whether money gets written are
// testable on their own.

import type { CommitAction } from "@/features/statement-import/hooks";
import type {
  GroupCategory,
  RowDecision,
  StatementSession,
} from "@/lib/statementImportSession";
import type { ParsedTransaction, RowClassification } from "@/types/statement";

/**
 * `imported` and `matched` are deliberately SEPARATE buckets even though both
 * are no-ops at commit time, because they answer different questions and carry
 * very different trust:
 *
 *   imported — the statement fingerprint already exists in the ledger. Machine
 *              certain, nothing to check, and the owner never audits it.
 *   matched  — the matcher believes this bank row is a transaction the owner
 *              logged by hand. A judgement call on amount/date/text, and the
 *              one place a human eye is worth anything.
 *
 * Merging them (as the single "matched" bucket used to) buried a handful of
 * fuzzy guesses inside a pile of certainties, so the guesses were never read.
 */
export type Bucket = "matched" | "imported" | "review" | "skipped";

export interface MerchantGroup {
  key: string;
  label: string;
  rows: ParsedTransaction[];
}

/** Rows the user pulled out of a group get their own single-row group. */
const DETACHED_PREFIX = "__row__:";

export function groupKeyForRow(
  row: ParsedTransaction,
  decision: RowDecision | undefined,
): string {
  if (decision?.detached_from_group) return `${DETACHED_PREFIX}${row.id}`;
  return row.normalized_key || row.description.toLowerCase();
}

/**
 * Which of the three review buckets a row lands in.
 *
 * `matched` rows are done — the user logged them already and reconciliation
 * found the counterpart. `skipped` is transfers (deferred by design) and rows
 * the user explicitly set aside. Everything else needs a human.
 */
export function getBucket(
  classification: RowClassification | undefined,
  decision: RowDecision | undefined,
): Bucket {
  if (decision?.resolution === "skip") return "skipped";
  if (!classification) return "review";

  switch (classification.status) {
    case "transfer":
      return "skipped";
    case "already_imported":
      return "imported";
    case "matched":
      // Detaching a match sends it back for manual handling.
      return decision?.resolution === "create" ? "review" : "matched";
    case "probable":
    case "ambiguous":
      // One tap is enough, but it must be a deliberate tap.
      return decision?.resolution === "accept_match" ||
        decision?.resolution === "link"
        ? "matched"
        : "review";
    // A flag, not a verdict: it stays in review until the owner says whether
    // this is the same money (skip it) or genuinely belongs here too (create
    // it, possibly with a per-row account override).
    case "other_account":
      return "review";
    case "unmatched":
      return "review";
  }
}

/**
 * The category a row will be created with: an explicit per-row pick always
 * wins; otherwise the row inherits whatever its merchant group was set to.
 * (The old flow did the opposite — the group overwrote every row — which is
 * why one wrong group assignment poisoned a dozen transactions.)
 */
export function resolveRowCategory(
  row: ParsedTransaction,
  session: Pick<StatementSession, "decisions" | "group_categories">,
): GroupCategory {
  const decision = session.decisions[row.id];
  if (decision?.category_id !== undefined) {
    return {
      category_id: decision.category_id,
      subcategory_id: decision.subcategory_id ?? null,
    };
  }

  const group = session.group_categories[groupKeyForRow(row, decision)];
  if (group) return group;

  // Fall back to whatever a learned merchant mapping suggested at parse time.
  return {
    category_id: row.category_id ?? null,
    subcategory_id: row.subcategory_id ?? null,
  };
}

/**
 * The account a row will be created in: a per-row override if the user set
 * one, otherwise the account the statement belongs to.
 *
 * Never a merchant mapping's account. That was BUD-23: a mapping learned on
 * another account used to redirect the row, so the fingerprint (hashed with the
 * statement's account) guarded a different account than the transaction it
 * described. An override is a deliberate per-row act and is safe precisely
 * because it does not touch the hash.
 */
export function resolveRowAccount(
  row: ParsedTransaction,
  session: Pick<StatementSession, "decisions" | "account_id">,
): string {
  return session.decisions[row.id]?.account_id || session.account_id;
}

/** Rows still waiting on the user, grouped by normalized merchant. */
export function buildReviewGroups(session: StatementSession): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();

  for (const row of session.rows) {
    const decision = session.decisions[row.id];
    if (getBucket(session.classifications[row.id], decision) !== "review") {
      continue;
    }

    const key = groupKeyForRow(row, decision);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: row.normalized_key || row.description,
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  return [...groups.values()].sort(
    (a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label),
  );
}

/**
 * Rows still owing an answer, in statement order — the queue the review
 * stepper walks. A review row counts as "decided" once it has a category to be
 * created with; nothing else is required of it.
 */
export function undecidedRows(session: StatementSession): ParsedTransaction[] {
  return session.rows.filter((row) => {
    if (getBucket(session.classifications[row.id], session.decisions[row.id]) !==
      "review"
    ) {
      return false;
    }
    return !resolveRowCategory(row, session).category_id;
  });
}

export function countUndecided(session: StatementSession): number {
  return undecidedRows(session).length;
}

export function bucketCounts(session: StatementSession) {
  const counts = { matched: 0, imported: 0, review: 0, skipped: 0 };
  for (const row of session.rows) {
    counts[getBucket(session.classifications[row.id], session.decisions[row.id])]++;
  }
  return counts;
}

/** Title-case a normalized merchant key for display / mapping storage. */
export function prettyMerchantName(key: string): string {
  return key
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Translate the session into commit actions.
 *
 * Deliberately conservative: a row produces an action ONLY when the user's
 * intent is unambiguous. Anything skipped, already imported, or still lacking
 * a category is left out entirely rather than guessed at — this function
 * decides what touches money.
 */
export function buildCommitActions(session: StatementSession): CommitAction[] {
  const actions: CommitAction[] = [];

  for (const row of session.rows) {
    const decision = session.decisions[row.id];
    const classification = session.classifications[row.id];
    const bucket = getBucket(classification, decision);

    if (bucket === "skipped") continue;
    // Already in the ledger — writing anything would double-count it. The DB's
    // partial unique index on (user_id, statement_hash) is the hard backstop,
    // but a row that never becomes an action never reaches it.
    if (bucket === "imported") continue;
    if (!classification) continue;
    if (classification.status === "already_imported") continue;

    const statementHash = row.statement_hash;
    if (!statementHash) continue;

    if (bucket === "matched") {
      // Which existing transaction this row proves.
      let transactionId: string | undefined;
      let kind: "confirmed" | "draft" = "confirmed";

      if (classification.status === "matched" || classification.status === "probable") {
        transactionId = decision?.linked_transaction_id ?? classification.transaction_id;
        kind = classification.kind;
      } else if (classification.status === "ambiguous") {
        transactionId = decision?.linked_transaction_id;
        kind =
          classification.candidates.find(
            (c) => c.transaction_id === transactionId,
          )?.kind ?? "confirmed";
      }

      if (!transactionId) continue;

      if (kind === "draft") {
        actions.push({
          kind: "confirm_draft",
          row_id: row.id,
          transaction_id: transactionId,
          statement_hash: statementHash,
          ...(decision?.accept_amount !== undefined
            ? { amount: decision.accept_amount }
            : {}),
        });
      } else {
        actions.push({
          kind: "stamp",
          row_id: row.id,
          transaction_id: transactionId,
          statement_hash: statementHash,
          ...(decision?.accept_amount !== undefined
            ? { accept_amount: decision.accept_amount }
            : {}),
        });
      }
      continue;
    }

    // bucket === "review" → create it, but only once it has a category.
    const { category_id, subcategory_id } = resolveRowCategory(row, session);
    if (!category_id) continue;

    // A statement is a statement OF an account, so the statement's account is
    // the default for every row it contains — and it is what the row's hash v2
    // fingerprint is built from, always, override or not. This used to read the
    // merchant mapping's account and skip the row when it was null, so on a
    // first import EVERY create action was silently dropped and Commit reported
    // "0 created" with no error anywhere.
    const accountId = resolveRowAccount(row, session);

    const mappingPattern = row.normalized_key?.trim();

    actions.push({
      kind: "create",
      row_id: row.id,
      date: decision?.date || row.date,
      // The user's rename wins for what gets STORED; `statement_hash` below is
      // untouched and still fingerprints the bank's raw text, so renaming a
      // row never lets it re-import as new next month.
      description: decision?.description?.trim() || row.description,
      amount: row.amount,
      direction: row.type,
      account_id: accountId,
      category_id,
      subcategory_id,
      statement_hash: statementHash,
      ...(mappingPattern && mappingPattern.length >= 2
        ? {
            learn_mapping: {
              pattern: mappingPattern.toUpperCase(),
              name: prettyMerchantName(mappingPattern),
            },
          }
        : {}),
    });
  }

  return actions;
}
