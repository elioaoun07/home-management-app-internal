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
    }
  | ({ status: "matched" } & MatchCandidate)
  | ({ status: "probable" } & MatchCandidate)
  | { status: "ambiguous"; candidates: MatchCandidate[] }
  | { status: "transfer" }
  | { status: "unmatched" };

export interface ReconcileSummary {
  matched: number;
  probable: number;
  ambiguous: number;
  already_imported: number;
  transfers: number;
  unmatched: number;
}

/** Transfer rows are skipped for now (importing them as transfers is deferred). */
export function isTransferDescription(description: string): boolean {
  return /transfer\s+(from|to)\b/i.test(description);
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
): Map<string, RowClassification> {
  const results = new Map<string, RowClassification>();

  const byHash = new Map<string, CandidateTx>();
  for (const tx of candidates) {
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

  for (const row of rows) {
    if (isTransferDescription(row.description)) {
      results.set(row.id, { status: "transfer" });
      continue;
    }

    const hashHit = byHash.get(row.statement_hash);
    if (hashHit) {
      results.set(row.id, {
        status: "already_imported",
        reason: "hash",
        transaction_id: hashHit.id,
      });
      continue;
    }

    // A row already imported under an older hash formula (or from a re-issued
    // statement whose running balance changed) still carries SOME hash. Same
    // amount inside the window means it is the same money event.
    const dupe = candidates.find((tx) => {
      if (!tx.statement_hash) return false;
      if (!amountsEqual(tx.amount, row.amount)) return false;
      if (tx.is_debt_return !== (row.type === "credit")) return false;
      const diff = dayDiff(row.date, tx.date);
      return diff >= -MATCH_WINDOW_FORWARD_DAYS && diff <= MATCH_WINDOW_BACK_DAYS;
    });
    if (dupe) {
      results.set(row.id, {
        status: "already_imported",
        reason: "probable_duplicate",
        transaction_id: dupe.id,
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
      if (tx.is_debt_return !== (row.type === "credit")) continue;

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
