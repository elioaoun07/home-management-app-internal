// src/lib/statement-reconcile.ts
//
// Statement reconciliation matcher — pure logic, no DB access.
//
// The model: the user logs card taps as they happen, so a bank statement is an
// AUDIT, not a data-entry source. Each parsed statement row is matched against
// transactions the user already logged; only the leftovers need review.
//
// The hard part is the posting lag: a card tap on the 10th can post on the 12th
// (or later over a weekend), and the bank's date is the only one on the
// statement. So matching uses a date WINDOW around the posting date, not
// equality, plus amount and description signals.

import type { AccountType } from "@/lib/balance-utils";
import { normalizeMerchant } from "@/lib/utils/anomalyDetection";

/** A logged tap can be up to 7 days OLDER than the statement's posting date. */
export const MATCH_WINDOW_BACK_DAYS = 7;
/** …and at most 1 day newer (same-day posting, logged the next morning). */
export const MATCH_WINDOW_FORWARD_DAYS = 1;
/** Money compare epsilon — amounts are DB numerics read back as floats. */
export const AMOUNT_EPSILON = 0.005;
/** Tolerance tier for tips added later / FX rounding: max($1, 10%). */
export const AMOUNT_TOLERANCE_MIN = 1;
export const AMOUNT_TOLERANCE_PCT = 0.1;
/** Candidates kept per row before greedy assignment (bounds the pair list). */
const MAX_POOL_PER_ROW = 8;
/** Candidates surfaced to the user when a row is ambiguous. */
const MAX_AMBIGUOUS_CANDIDATES = 3;

const DAY_MS = 86_400_000;

export interface StatementRowInput {
  /** Client-side row id, echoed back in the result. */
  id: string;
  /** Posting date from the statement (YYYY-MM-DD). */
  date: string;
  description: string;
  /** Always positive; direction lives in `type`. */
  amount: number;
  type: "debit" | "credit";
  statement_hash: string;
}

export interface CandidateTx {
  id: string;
  /** Which account this transaction actually lives in. */
  account_id: string;
  /**
   * Type of THAT account. Required because `is_debt_return` alone does not say
   * which way the money went — see `movesMoneyIn` below.
   */
  account_type: AccountType;
  /** The date the user logged it for — the REAL date, not the posting date. */
  date: string;
  /** Always positive (sign is derived from the account type). */
  amount: number;
  description: string;
  is_draft: boolean;
  is_debt_return: boolean;
  statement_hash: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  inserted_at: string;
}

export interface MatchCandidate {
  transaction_id: string;
  kind: "confirmed" | "draft";
  /** statement amount − logged amount (positive = bank charged more). */
  amount_diff: number;
  /** posting date − logged date, in days (positive = posted later). */
  date_diff: number;
  description: string;
  date: string;
  amount: number;
}

export type RowClassification =
  | {
      status: "already_imported";
      reason: "hash" | "probable_duplicate";
      transaction_id: string;
      /**
       * The fingerprint currently stored on that transaction.
       *
       * When it differs from the row's own hash the row was recognised by the
       * fuzzy tier, not by identity — i.e. the stored one was written by an
       * older formula. Carrying it here lets the commit step RE-KEY the row to
       * the current formula, so the history heals itself on re-import instead
       * of needing a backfill migration nobody remembers to write.
       */
      stored_hash: string | null;
    }
  | ({ status: "matched" } & MatchCandidate)
  | ({ status: "probable" } & MatchCandidate)
  | { status: "ambiguous"; candidates: MatchCandidate[] }
  /**
   * Same money event, but it is sitting in a DIFFERENT account than the one
   * this statement belongs to. Everything except the account matches, so this
   * is almost always one of two things: the row was deliberately routed
   * elsewhere on a previous import (a bank fee sent to the expenses account),
   * or it was filed against the wrong account by mistake and wants moving.
   *
   * Deliberately NOT treated as a duplicate — it is surfaced for a decision,
   * because auto-skipping it would hide a genuine mis-filing, and
   * auto-importing it would double-count. The owner picks.
   */
  | {
      status: "other_account";
      transaction_id: string;
      account_id: string;
      description: string;
      date: string;
      amount: number;
    }
  | { status: "transfer" }
  | { status: "unmatched" };

export interface ReconcileSummary {
  matched: number;
  probable: number;
  ambiguous: number;
  already_imported: number;
  other_account: number;
  transfers: number;
  unmatched: number;
}

/**
 * Descriptions that describe money moving between the owner's OWN accounts.
 *
 * These must never be imported as spend or income (money-rules Invariant 4):
 * an own-account move nets to zero across the household, so writing it as a
 * transaction invents phantom income on one leg and phantom expense on the
 * other. The balance still lands right — the two legs cancel — which is
 * exactly why this stayed invisible until the analytics were read.
 *
 * Deliberately CONSERVATIVE. A false positive silently drops a REAL expense,
 * which is the worse failure, so every pattern is anchored to an explicit
 * "account" / "transfer" word. Bare /exchange/ is not enough — "Currency
 * Exchange Hamra" and "The Exchange Bookshop" are real merchants.
 */
const OWN_ACCOUNT_PATTERNS: RegExp[] = [
  // "Transfer from Own Account 5014…" / "Transfer to NAME via Mobile"
  /\btransfer\s+(from|to)\b/i,
  // "Own Account Exchange: USD to EUR at 0.852 - from 501400630004"
  /\bown\s+account\b/i,
  // The same event on statements that drop the "Own" prefix.
  /\baccount\s+exchange\b/i,
  /\binternal\s+transfer\b/i,
  /\bbetween\s+(my|own)\s+accounts?\b/i,
];

/**
 * Transfer rows are skipped (importing them as real transfers is deferred).
 * This module owns the rule so the parser and the matcher cannot drift into
 * two different answers about what counts as a transfer.
 */
export function isTransferDescription(description: string): boolean {
  return OWN_ACCOUNT_PATTERNS.some((pattern) => pattern.test(description));
}

/**
 * Did this transaction ADD money to its account?
 *
 * `is_debt_return` on its own is NOT the answer, and reading it as though it
 * were is a real bug this fixed: the matcher compared
 * `tx.is_debt_return !== (row.type === "credit")` and so refused to match a
 * salary deposit — the row said credit, the stored transaction said
 * `is_debt_return = false`, and it looked like a direction conflict. It is not.
 *
 * Direction has to be derived exactly the way the BALANCE is derived
 * (`getBalanceDelta` in balance-utils.ts), because that is what the encoding
 * actually means:
 *
 *   - `is_debt_return` always adds, whatever the account type.
 *   - an income/saving account always adds — its transactions ARE money in, so
 *     `is_debt_return` is redundant there and both values encode the same fact.
 *   - only an expense account subtracts, and only when not a debt return.
 *
 * The old import route left `is_debt_return = false` on income rows while the
 * current one writes `true`; both are correct and produce the same balance, so
 * a matcher that compares the raw flag treats identical history as a conflict.
 */
function movesMoneyIn(tx: Pick<CandidateTx, "is_debt_return" | "account_type">) {
  return tx.is_debt_return || tx.account_type !== "expense";
}

function dayDiff(laterISO: string, earlierISO: string): number {
  const a = new Date(`${laterISO}T00:00:00Z`).getTime();
  const b = new Date(`${earlierISO}T00:00:00Z`).getTime();
  return Math.round((a - b) / DAY_MS);
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < AMOUNT_EPSILON;
}

function toleranceFor(amount: number): number {
  return Math.max(AMOUNT_TOLERANCE_MIN, amount * AMOUNT_TOLERANCE_PCT);
}

function tokenSet(description: string): Set<string> {
  const normalized = normalizeMerchant(description);
  return new Set(normalized.split(/\s+/).filter(Boolean));
}

/** Jaccard overlap of two token sets; 1 = identical, 0 = nothing in common. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Lexicographic score — LOWER is better:
 * [tier, |date drift|, description distance, logged-recency rank]
 */
type Score = [number, number, number, number];

function compareScores(a: Score, b: Score): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Two candidates are indistinguishable if tier, date drift and text all tie. */
function isTie(a: Score, b: Score): boolean {
  return a[0] === b[0] && a[1] === b[1] && Math.abs(a[2] - b[2]) < 1e-9;
}

function toMatchCandidate(
  row: StatementRowInput,
  tx: CandidateTx,
): MatchCandidate {
  return {
    transaction_id: tx.id,
    kind: tx.is_draft ? "draft" : "confirmed",
    amount_diff: Number((row.amount - tx.amount).toFixed(2)),
    date_diff: dayDiff(row.date, tx.date),
    description: tx.description,
    date: tx.date,
    amount: tx.amount,
  };
}

/**
 * Classify every statement row against the user's existing transactions.
 *
 * Candidates must already be scoped to the right account and a date range that
 * covers the window; this function does no filtering by account or user.
 *
 * A transaction is claimed by at most ONE row (one-to-one), so two identical
 * $12 taps on the same day never both match the same logged transaction.
 */
export function reconcileStatementRows(
  rows: StatementRowInput[],
  candidates: CandidateTx[],
  /**
   * Transactions in the user's OTHER accounts over the same window. Never
   * matched against or claimed — used only to raise `other_account`.
   *
   * A row may legitimately live elsewhere: the per-row account override routes
   * a bank fee off a salary statement into the expenses account, and the
   * fingerprint stays keyed to the STATEMENT's account so re-imports still
   * recognise it. Passing these in is what stops such a row coming back as
   * brand new every month.
   */
  crossAccountCandidates: CandidateTx[] = [],
): Map<string, RowClassification> {
  const results = new Map<string, RowClassification>();

  // Hash identity ignores which account the row ended up in — the fingerprint
  // already encodes the statement's account, so a hit is the same statement row
  // wherever it was filed.
  const byHash = new Map<string, CandidateTx>();
  for (const tx of [...candidates, ...crossAccountCandidates]) {
    if (tx.statement_hash && !byHash.has(tx.statement_hash)) {
      byHash.set(tx.statement_hash, tx);
    }
  }

  const rowTokens = new Map<string, Set<string>>();
  const candidateTokens = new Map<string, Set<string>>();
  for (const tx of candidates) {
    candidateTokens.set(tx.id, tokenSet(tx.description));
  }

  // ── Pass 1: transfers, exact-hash re-imports, probable duplicates ─────────
  const pending: StatementRowInput[] = [];

  // One transaction can only be "the one this row already is" for a SINGLE
  // row. Without this, `find()` handed the same transaction to every matching
  // row: a statement with two identical charges on one day, where only one had
  // been imported, marked BOTH as already-imported and silently dropped the
  // genuinely-new one. A missing transaction, which is worse than a duplicate.
  // (Same-account matching got one-to-one assignment in BUD-19; this tier
  // never did — it bites hardest on repeated fixed charges like a monthly
  // subscription of identical amount.)
  const claimedAsDuplicate = new Set<string>();

  for (const row of rows) {
    // The exact-hash check runs FIRST, ahead of the transfer rule, so a row
    // that really was written to the ledger reports itself honestly instead of
    // hiding behind "transfer". That matters right after the own-account fix:
    // statements imported before it created phantom transfer transactions, and
    // "imported before" is the only signal pointing the owner at them.
    const hashHit = byHash.get(row.statement_hash);
    if (hashHit) {
      claimedAsDuplicate.add(hashHit.id);
      results.set(row.id, {
        status: "already_imported",
        reason: "hash",
        transaction_id: hashHit.id,
        stored_hash: hashHit.statement_hash,
      });
      continue;
    }

    // Ahead of the fuzzy probable-duplicate tier below, which matches on amount
    // alone and would happily claim a transfer leg is an unrelated purchase of
    // the same value.
    if (isTransferDescription(row.description)) {
      results.set(row.id, { status: "transfer" });
      continue;
    }

    // A row already imported under an older hash formula (or from a re-issued
    // statement whose running balance changed) still carries SOME hash. Same
    // amount inside the window means it is the same money event.
    const dupe = candidates
      .filter((tx) => {
        if (!tx.statement_hash) return false;
        if (claimedAsDuplicate.has(tx.id)) return false;
        if (!amountsEqual(tx.amount, row.amount)) return false;
        if (movesMoneyIn(tx) !== (row.type === "credit")) return false;
        const diff = dayDiff(row.date, tx.date);
        return (
          diff >= -MATCH_WINDOW_FORWARD_DAYS && diff <= MATCH_WINDOW_BACK_DAYS
        );
      })
      // Closest posting date wins, so the nearest twin is claimed rather than
      // whichever happened to be first in the result set. `id` breaks ties so
      // the outcome is deterministic across runs.
      .sort((a, b) => {
        const byDate =
          Math.abs(dayDiff(row.date, a.date)) -
          Math.abs(dayDiff(row.date, b.date));
        return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
      })[0];
    if (dupe) {
      claimedAsDuplicate.add(dupe.id);
      results.set(row.id, {
        status: "already_imported",
        reason: "probable_duplicate",
        transaction_id: dupe.id,
        stored_hash: dupe.statement_hash,
      });
      continue;
    }

    // Everything the fingerprint encodes EXCEPT the account agrees → flag,
    // never skip.
    //
    // Gated on exact date + exact amount + direction, not on the posting
    // window: this answers "is this row already filed under another account?",
    // not "is anything similar out there". Description is deliberately NOT a
    // gate — the mis-filing worth catching is often one the owner typed by
    // hand, so its wording is their own, not the bank's. It ranks which
    // transaction to show instead, and both descriptions are put on screen so
    // the owner makes the call.
    const elsewhere = crossAccountCandidates
      .filter(
        (tx) =>
          amountsEqual(tx.amount, row.amount) &&
          tx.date === row.date &&
          movesMoneyIn(tx) === (row.type === "credit"),
      )
      .sort((a, b) => {
        const overlap =
          jaccard(tokenSet(row.description), tokenSet(b.description)) -
          jaccard(tokenSet(row.description), tokenSet(a.description));
        return overlap !== 0 ? overlap : a.id.localeCompare(b.id);
      })[0];
    if (elsewhere) {
      results.set(row.id, {
        status: "other_account",
        transaction_id: elsewhere.id,
        account_id: elsewhere.account_id,
        description: elsewhere.description,
        date: elsewhere.date,
        amount: elsewhere.amount,
      });
      continue;
    }

    rowTokens.set(row.id, tokenSet(row.description));
    pending.push(row);
  }

  // ── Pass 2: score every (row, candidate) pair worth considering ──────────
  // Only hashless candidates can be claimed — anything carrying a hash was
  // already reconciled against some statement row.
  const claimable = candidates.filter((tx) => !tx.statement_hash);

  // Rank by how recently the row was logged; used only as a final tiebreak so
  // results stay deterministic.
  const recencyRank = new Map<string, number>();
  [...claimable]
    .sort((a, b) => {
      const t = Date.parse(b.inserted_at) - Date.parse(a.inserted_at);
      return t !== 0 ? t : a.id.localeCompare(b.id);
    })
    .forEach((tx, index) => recencyRank.set(tx.id, index));

  interface ScoredPair {
    rowId: string;
    tx: CandidateTx;
    score: Score;
  }

  const poolByRow = new Map<string, ScoredPair[]>();

  for (const row of pending) {
    const tokens = rowTokens.get(row.id)!;
    const tolerance = toleranceFor(row.amount);
    const pool: ScoredPair[] = [];

    for (const tx of claimable) {
      if (movesMoneyIn(tx) !== (row.type === "credit")) continue;

      const dateDiff = dayDiff(row.date, tx.date);
      if (dateDiff > MATCH_WINDOW_BACK_DAYS) continue;
      if (dateDiff < -MATCH_WINDOW_FORWARD_DAYS) continue;

      const amountDiff = Math.abs(row.amount - tx.amount);
      let tier: number;
      if (amountDiff < AMOUNT_EPSILON) tier = 1;
      else if (amountDiff <= tolerance) tier = 2;
      else continue;

      const overlap = jaccard(tokens, candidateTokens.get(tx.id)!);
      pool.push({
        rowId: row.id,
        tx,
        score: [
          tier,
          Math.abs(dateDiff),
          1 - overlap,
          recencyRank.get(tx.id) ?? 0,
        ],
      });
    }

    pool.sort((a, b) => compareScores(a.score, b.score));
    poolByRow.set(row.id, pool.slice(0, MAX_POOL_PER_ROW));
  }

  // ── Pass 3: greedy one-to-one assignment, best pairs first ───────────────
  const allPairs: ScoredPair[] = [];
  for (const pool of poolByRow.values()) allPairs.push(...pool);
  allPairs.sort((a, b) => {
    const byScore = compareScores(a.score, b.score);
    if (byScore !== 0) return byScore;
    return a.rowId.localeCompare(b.rowId) || a.tx.id.localeCompare(b.tx.id);
  });

  const assignedRow = new Map<string, CandidateTx>();
  const claimedTx = new Set<string>();

  for (const pair of allPairs) {
    if (assignedRow.has(pair.rowId)) continue;
    if (claimedTx.has(pair.tx.id)) continue;
    assignedRow.set(pair.rowId, pair.tx);
    claimedTx.add(pair.tx.id);
  }

  // ── Pass 4: turn assignments into classifications ────────────────────────
  for (const row of pending) {
    const assigned = assignedRow.get(row.id);
    if (!assigned) {
      results.set(row.id, { status: "unmatched" });
      continue;
    }

    const pool = poolByRow.get(row.id) ?? [];
    const assignedPair = pool.find((p) => p.tx.id === assigned.id)!;

    // Genuinely indistinguishable alternatives (still unclaimed) → let the user
    // decide rather than silently picking one.
    const rivals = pool.filter(
      (p) =>
        p.tx.id !== assigned.id &&
        !claimedTx.has(p.tx.id) &&
        isTie(p.score, assignedPair.score),
    );

    if (rivals.length > 0) {
      results.set(row.id, {
        status: "ambiguous",
        candidates: [assignedPair, ...rivals]
          .slice(0, MAX_AMBIGUOUS_CANDIDATES)
          .map((p) => toMatchCandidate(row, p.tx)),
      });
      continue;
    }

    const candidate = toMatchCandidate(row, assigned);
    results.set(row.id, {
      status: assignedPair.score[0] === 1 ? "matched" : "probable",
      ...candidate,
    });
  }

  return results;
}

export function summarize(
  results: Map<string, RowClassification>,
): ReconcileSummary {
  const summary: ReconcileSummary = {
    matched: 0,
    probable: 0,
    ambiguous: 0,
    already_imported: 0,
    other_account: 0,
    transfers: 0,
    unmatched: 0,
  };

  for (const result of results.values()) {
    switch (result.status) {
      case "matched":
        summary.matched++;
        break;
      case "probable":
        summary.probable++;
        break;
      case "ambiguous":
        summary.ambiguous++;
        break;
      case "already_imported":
        summary.already_imported++;
        break;
      case "other_account":
        summary.other_account++;
        break;
      case "transfer":
        summary.transfers++;
        break;
      case "unmatched":
        summary.unmatched++;
        break;
    }
  }

  return summary;
}
