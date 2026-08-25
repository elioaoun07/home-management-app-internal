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
  /** Bank wording already stored on the row, if any. */
  bank_description: string | null;
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

export type RowStatus =
  /**
   * This bank line already produced a `transfers` row on an earlier import.
   *
   * A separate arm from the transaction one because a transfer is not a
   * transaction: there is nothing to re-key, nothing to stamp, and no
   * `bank_description` to backfill — the only honest thing to do with the row
   * is show it as done. Recognised by fingerprint alone (no fuzzy tier): the
   * hash is written to `transfers.statement_hash` at commit time and guarded
   * by a unique index, so identity is the whole story.
   */
  | {
      status: "already_imported";
      reason: "transfer_hash";
      transfer_id: string;
    }
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
      /**
       * Bank wording already on that transaction. When it is missing (or has
       * drifted) the commit step fills it in, which is what lets a statement
       * whose fingerprints are ALL current still be re-imported to backfill
       * `bank_description` — otherwise such a statement produced no actions at
       * all and the Save button sat disabled at "0 rows".
       */
      stored_bank_description: string | null;
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
  /**
   * Money moving between the owner and their household partner — "Transfer to
   * RACHA SAMIR TOUMA via Mobile".
   *
   * NOT spending: it nets to zero across the household, so it belongs in
   * `transfers` (a different table, therefore excluded from every spending
   * aggregate by construction) with no category at all. What the partner then
   * spends it on is a separate transaction with its own category.
   *
   * Only the SENDER can record it. `POST /api/transfers` requires the creator
   * to own the from-account and the partner to own the to-account, so an
   * incoming leg can never create a second copy of the same movement — it can
   * only recognise the one the sender already made (`existing_transfer_id`).
   */
  | {
      status: "person_transfer";
      /** The name the statement puts on the other side of the movement. */
      counterparty: string;
      /** "out" = the owner sent it, "in" = the owner received it. */
      direction: "in" | "out";
      /**
       * The counterparty name matches a household profile.
       *
       * Only a HINT that pre-selects "household transfer" in the UI — never a
       * gate. Profile names are display names ("Elio") while statements carry
       * legal ones ("ELIO ANTOINE AOUN"), and the profiles table can be empty
       * outright, so making the classification depend on a name match meant the
       * whole feature silently did nothing. The owner decides per row; this
       * only saves them a tap when it can.
       */
      household_match: boolean;
      /** A household transfer already recording this movement, if one exists. */
      existing_transfer_id: string | null;
    }
  | { status: "transfer" }
  /**
   * Legacy status kept ONLY so a session already sitting in IndexedDB (up to
   * `MAX_SESSIONS` = 3, see statementImportSession.ts) still type-checks and
   * resolves sanely on resume. `reconcileStatementRows` never emits this
   * anymore — see `RowClassification.skipped_before` below.
   */
  | { status: "skipped_before" }
  | { status: "unmatched" };

/**
 * A row's real classification, plus cross-cutting facts stamped on top.
 *
 * `skipped_before`, `memo` and `withdrawal` are FLAGS, not statuses: a row the
 * owner skipped on a previous import is still whatever it actually is
 * (`matched`, `person_transfer`, `unmatched`, …) — the flag only adds "and the
 * owner chose to skip it". Restore reads the real status to decide which tab a
 * row lands in. Before this, `skipped_before` WAS the status, so it silently
 * replaced the row's real classification and Restore had nowhere honest to
 * send it — the row stayed on the Skipped tab forever while "Save N rows"
 * quietly grew, with no visible change anywhere else.
 */
export type RowClassification = RowStatus & {
  /** A standing skip on this fingerprint (`statement_skipped_rows`). */
  skipped_before?: boolean;
  /**
   * The note the owner typed into the bank app — everything after the FIRST
   * " - " in the raw line ("Transfer to X via Mobile - 'link bowling - for 2'"
   * -> "link bowling - for 2"). Only a DEFAULT for the transaction description;
   * never touches `statement_hash`, which stays keyed to the bank's raw text.
   */
  memo?: string | null;
  /** Set when the description names an ATM or voucher cash withdrawal. */
  withdrawal?: { kind: "atm" | "voucher" };
  /**
   * Set when the description names an own-account currency exchange.
   *
   * Only the **out** leg is actionable. The identical bank line appears on BOTH
   * statements — money OUT 200.00 on the USD side, money IN 170.40 on the EUR
   * side — and the two rows hash differently because the account is part of the
   * fingerprint, so nothing would stop the second import from writing the same
   * movement twice. Recording it once, from the side that pays, is the same
   * rule `person_transfer` already follows for the same reason. The in leg
   * stays on Skipped, labelled as the other side of an exchange.
   */
  exchange?: ReturnType<typeof classifyOwnExchange>;
};

export interface ReconcileSummary {
  matched: number;
  skipped_before: number;
  probable: number;
  ambiguous: number;
  already_imported: number;
  other_account: number;
  transfers: number;
  person_transfers: number;
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
  // "Transfer from Own Account 5014…" — the owner's money on both sides.
  /\btransfer\s+(from|to)\s+own\b/i,
  // "Own Account Exchange: USD to EUR at 0.852 - from 501400630004"
  /\bown\s+account\b/i,
  // The same event on statements that drop the "Own" prefix.
  /\baccount\s+exchange\b/i,
  /\binternal\s+transfer\b/i,
  /\bbetween\s+(my|own)\s+accounts?\b/i,
];

/**
 * "Transfer to RACHA SAMIR TOUMA via Mobile" / "Transfer from SALIM … via
 * Mobile" — money moving between the owner and ANOTHER PERSON.
 *
 * That is real spending or real income and must be imported. It used to be
 * swept up by a blanket `/transfer\s+(from|to)/` rule and skipped, so paying a
 * friend simply never reached the ledger.
 */
const PERSON_TRANSFER_PATTERN = /\btransfer\s+(from|to)\b/i;

/** A household member whose name can appear as a transfer counterparty. */
export interface HouseholdMember {
  user_id: string;
  full_name: string;
}

/** An existing household transfer, for recognising a movement already logged. */
export interface HouseholdTransferRef {
  id: string;
  date: string;
  amount: number;
}

/** A live `transfers` row that a previous import fingerprinted. */
export interface ImportedTransferRef {
  id: string;
  statement_hash: string;
}

const NAME_NOISE = /[^A-Z\s]/g;

/**
 * Does this statement line name a household member?
 *
 * Requires EVERY significant word of the member's name to appear, because the
 * consequence of a false positive is severe: real spending would be recorded as
 * a household transfer, vanishing from every spending total. Banks pad names
 * with middle names ("RACHA SAMIR TOUMA" for a profile of "Racha Touma"), so
 * the check is subset-of-description, not equality.
 */
export function matchHouseholdMember(
  description: string,
  members: HouseholdMember[],
): HouseholdMember | null {
  const haystack = ` ${description.toUpperCase().replace(NAME_NOISE, " ").replace(/\s+/g, " ")} `;
  for (const member of members) {
    const words = member.full_name
      .toUpperCase()
      .replace(NAME_NOISE, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    if (words.length === 0) continue;
    if (words.every((w) => haystack.includes(` ${w} `))) return member;
  }
  return null;
}

/**
 * The name on the other side: "Transfer to RACHA SAMIR TOUMA via Mobile - Car"
 * -> "RACHA SAMIR TOUMA". Falls back to the whole line when the shape is
 * unfamiliar, so the card always has something to show.
 */
export function extractCounterparty(description: string): string {
  const match = description.match(
    /\btransfer\s+(?:from|to)\s+(.+?)(?:\s+via\b|\s+-\s|\s*$)/i,
  );
  return match?.[1]?.trim() || description;
}

export function isPersonTransfer(description: string): boolean {
  return (
    PERSON_TRANSFER_PATTERN.test(description) &&
    !OWN_ACCOUNT_PATTERNS.some((pattern) => pattern.test(description))
  );
}

const WITHDRAWAL_PATTERN = /\bwithdrawals?\b/i;

/**
 * ATM / voucher cash withdrawals — never a merchant purchase, but not a
 * no-op either: an ATM withdrawal is cash moving to the wallet (a SELF
 * transfer, no spending yet) and a voucher withdrawal is real spending whose
 * category the owner wrote into the bank line ("… for Voucher No 123 - Car
 * Insurance"). A flag, like `skipped_before`, so an already-imported or
 * hand-logged withdrawal still reports its real status.
 */
export function classifyWithdrawal(
  description: string,
): { kind: "atm" | "voucher" } | null {
  if (!WITHDRAWAL_PATTERN.test(description)) return null;
  return { kind: /\bvoucher\b/i.test(description) ? "voucher" : "atm" };
}

/**
 * An own-account CURRENCY EXCHANGE — "Own Account Exchange: USD to EUR at
 * 0.852 - to 501400630005 -".
 *
 * `isTransferDescription()` already recognises these as own-account moves, and
 * that was where it stopped: the row classified `transfer`, landed on Skipped,
 * and produced no action. But an exchange is not noise the way an internal
 * same-currency move is — it is the owner buying EUR with USD, and the
 * destination account's balance genuinely goes up by a DIFFERENT number than
 * the one on the statement. Skipping it leaves the EUR account permanently
 * short.
 *
 * Everything needed is on the line: both currencies, the rate, and the last
 * digits of the counterparty account. A flag like `withdrawal`, so an
 * already-imported or hand-logged exchange still reports its real status.
 *
 * `direction` comes from the statement's own MONEY OUT / MONEY IN column, never
 * from the wording — the SAME line appears on both statements ("USD to EUR at
 * 0.852" is written identically on the USD side and the EUR side), so the
 * wording cannot say which side you are reading. Only the OUT leg is
 * actionable; see the `exchange` field's doc comment on `RowClassification`.
 */
export function classifyOwnExchange(
  description: string,
  type: "debit" | "credit",
): {
  from_currency: string;
  to_currency: string;
  /** Units of `to_currency` per unit of `from_currency`, as the bank quotes it. */
  rate: number;
  /** Trailing digits of the other account, as printed. Null when absent. */
  counterparty_account: string | null;
  /** "out" — this statement is the FROM side. "in" — it is the TO side. */
  direction: "in" | "out";
} | null {
  if (!/\bexchange\b/i.test(description)) return null;

  // Anchored to "exchange" so a merchant called "Currency Exchange Hamra"
  // cannot match: the pair-and-rate shape has to follow the word itself.
  const pair = description.match(
    /\bexchange\b\s*:?\s*([A-Z]{3})\s+to\s+([A-Z]{3})\s+at\s+([0-9]*\.?[0-9]+)/i,
  );
  if (!pair) return null;

  const rate = Number(pair[3]);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const account = description.match(/\b(?:to|from)\s+(\d{4,})/i);

  return {
    from_currency: pair[1].toUpperCase(),
    to_currency: pair[2].toUpperCase(),
    rate,
    counterparty_account: account ? account[1] : null,
    direction: type === "debit" ? "out" : "in",
  };
}

/**
 * The note the owner typed into the bank app — everything after the FIRST
 * " - " in the raw line, unwrapped if quoted.
 *
 * FIRST, not last: "Transfer to X via Mobile - 'link bowling - mkalles - for
 * 2'" is one memo the owner wrote, not three fragments to rejoin. Guards
 * against the trailing " -" some PDF/CSV rows carry from an empty MONEY OUT
 * column ("Transfer from X via Mobile -"), which is not a memo.
 */
export function extractStatementMemo(description: string): string | null {
  const idx = description.indexOf(" - ");
  if (idx === -1) return null;
  let memo = description.slice(idx + 3).trim();
  const quoted = memo.match(/^['"](.+)['"]$/);
  if (quoted) memo = quoted[1].trim();
  return memo && memo !== "-" ? memo : null;
}

/**
 * OWN-account moves are skipped (importing them as real transfers is deferred).
 * Person-to-person transfers are NOT — see `isPersonTransfer` above. This module
 * owns the rule so the parser and the matcher cannot drift into two different
 * answers about what counts as a transfer.
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
  /** Fingerprints the owner has previously chosen to skip. */
  skippedHashes: ReadonlySet<string> = new Set(),
  /** Household members whose names can appear as a transfer counterparty. */
  householdMembers: HouseholdMember[] = [],
  /** Household transfers already recorded, for recognising a logged movement. */
  householdTransfers: HouseholdTransferRef[] = [],
  /**
   * Live transfers a previous import already created from these very rows.
   *
   * Transfers are the ONLY money this feature writes outside `transactions`,
   * so without them the hash map below is blind to a whole class of rows: a
   * household transfer, a cash withdrawal to the wallet, or an own-account FX
   * exchange came back as brand new on every re-import and the owner could
   * confirm the same movement twice.
   */
  importedTransfers: ImportedTransferRef[] = [],
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

  const transfersByHash = new Map<string, ImportedTransferRef>();
  for (const t of importedTransfers) {
    if (t.statement_hash && !transfersByHash.has(t.statement_hash)) {
      transfersByHash.set(t.statement_hash, t);
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

  // Fingerprints the owner has already chosen to skip. Recorded as a FLAG
  // stamped onto the row's REAL classification in the post-pass below, never
  // as a status of its own — see the RowClassification doc comment for why.
  const previouslySkipped = new Set<string>();

  for (const row of rows) {
    if (skippedHashes.has(row.statement_hash)) previouslySkipped.add(row.id);

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
        stored_bank_description: hashHit.bank_description,
      });
      continue;
    }

    // Same identity check, against the other table this feature writes to.
    // Runs BEFORE the transfer/person-transfer rules for the same reason the
    // transaction one does: a row that really was recorded must say so, rather
    // than being re-offered as an action the owner can take a second time.
    const transferHit = transfersByHash.get(row.statement_hash);
    if (transferHit) {
      results.set(row.id, {
        status: "already_imported",
        reason: "transfer_hash",
        transfer_id: transferHit.id,
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

    // Every person-to-person transfer is surfaced for a decision, household or
    // not. Checked before the matching passes so one can never be silently
    // paired with — or categorised as — an ordinary purchase.
    if (isPersonTransfer(row.description)) {
      const member = matchHouseholdMember(row.description, householdMembers);
      const existing = householdTransfers.find(
        (t) =>
          amountsEqual(t.amount, row.amount) &&
          Math.abs(dayDiff(row.date, t.date)) <= MATCH_WINDOW_BACK_DAYS,
      );
      results.set(row.id, {
        status: "person_transfer",
        counterparty: extractCounterparty(row.description),
        direction: row.type === "credit" ? "in" : "out",
        household_match: !!member,
        existing_transfer_id: existing?.id ?? null,
      });
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
        stored_bank_description: dupe.bank_description,
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

  // ── Pass 5: stamp cross-cutting flags onto each row's REAL status ────────
  // Every row gets this pass, regardless of which status it landed on above —
  // an already-imported withdrawal is still `already_imported`, a hand-logged
  // one is still `matched`; only an otherwise-`unmatched` withdrawal is new
  // information for the UI to act on.
  for (const row of rows) {
    const existing = results.get(row.id);
    if (!existing) continue;
    const memo = extractStatementMemo(row.description);
    const withdrawal = classifyWithdrawal(row.description);
    const exchange = classifyOwnExchange(row.description, row.type);
    results.set(row.id, {
      ...existing,
      ...(previouslySkipped.has(row.id) ? { skipped_before: true } : {}),
      // An exchange line's " - " separates FIELDS ("… at 0.852 - to
      // 501400630005 -"), it is not a note the owner typed — without this the
      // transfer's default description became "to 501400630005 -".
      ...(memo && !exchange ? { memo } : {}),
      ...(withdrawal ? { withdrawal } : {}),
      ...(exchange ? { exchange } : {}),
    });
  }

  return results;
}

export function summarize(
  results: Map<string, RowClassification>,
): ReconcileSummary {
  const summary: ReconcileSummary = {
    matched: 0,
    skipped_before: 0,
    probable: 0,
    ambiguous: 0,
    already_imported: 0,
    other_account: 0,
    transfers: 0,
    person_transfers: 0,
    unmatched: 0,
  };

  for (const result of results.values()) {
    // A flag, not a status (see RowClassification) — counted independently of
    // the switch below, which reflects the real classification.
    if (result.skipped_before) summary.skipped_before++;

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
      case "skipped_before":
        // Legacy status from a session already in IndexedDB — see RowStatus.
        summary.skipped_before++;
        break;
      case "person_transfer":
        summary.person_transfers++;
        break;
      case "unmatched":
        summary.unmatched++;
        break;
    }
  }

  return summary;
}
