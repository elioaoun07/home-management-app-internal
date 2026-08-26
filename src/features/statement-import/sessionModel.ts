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
import { isPersonTransfer } from "@/lib/statement-reconcile";
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
export type Bucket =
  | "matched"
  | "imported"
  | "review"
  | "transfers"
  | "skipped";

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
 * Has the owner brought this row back from a standing skip?
 *
 * `restored` is the durable answer. The legacy `resolution: "undecided"` is
 * still honoured so a session already sitting in IndexedDB when this shipped
 * resumes with its restores intact — but it can no longer be the ONLY signal,
 * because the owner's next action overwrites `resolution` and used to bounce
 * the row back onto the Skipped tab the instant they answered it.
 */
export function isRestored(decision: RowDecision | undefined): boolean {
  return decision?.restored === true || decision?.resolution === "undecided";
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

  const bucket = bucketForStatus(classification, decision);

  // A standing skip from a previous import is a FLAG on the row's real
  // classification, not a status of its own (see the RowClassification doc
  // comment in statement-reconcile.ts) — so it can only suppress a row that
  // still NEEDS an answer, and it stays suppressed until the owner restores it.
  //
  // It must never outrank the row's own verdict. A bank line already in the
  // ledger is `imported`, and one the owner hand-logged is `matched`, whether
  // or not it also carries an old skip — there is nothing to suppress, because
  // there is nothing left to do. Checking the flag FIRST is what made a
  // re-import of an already-imported statement report "Imported 12" with every
  // other recognised row buried on the Skipped tab.
  if (
    (bucket === "review" || bucket === "transfers") &&
    classification.skipped_before &&
    !isRestored(decision)
  ) {
    return "skipped";
  }

  return bucket;
}

/** The row's REAL bucket, before any standing-skip suppression. */
function bucketForStatus(
  classification: RowClassification,
  decision: RowDecision | undefined,
): Bucket {
  switch (classification.status) {
    case "transfer":
      // An own-account CURRENCY EXCHANGE is the one own-account move that is
      // not noise: the destination account gains a DIFFERENT number than the
      // one on the statement (200.00 USD out, 170.40 EUR in at 0.852), so
      // skipping it leaves that account permanently short. Only the OUT leg is
      // offered — the identical bank line appears on both statements and the
      // two rows hash differently, so acting on both would write the movement
      // twice (see RowClassification.exchange).
      if (classification.exchange?.direction === "out") return "transfers";
      // Every other own-account move nets to zero in a single currency. The
      // matcher re-derives these on every run and buildCommitActions never
      // records a standing skip for them (below), so there is no Restore path
      // — they simply reappear here every time.
      return "skipped";
    case "already_imported":
      // Imported is an exact statement-key ledger. Fuzzy/legacy matches stay
      // separate so the owner can tell certainty from a heuristic guess.
      return classification.reason === "probable_duplicate"
        ? "matched"
        : "imported";
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
    // A person-to-person transfer — partner or not, sent or received — lives
    // on the Transfers tab until it is recorded (a household `transfers`
    // row, an ordinary transaction, or standing-skipped). Already recorded
    // by whichever side sent it needs nothing further.
    case "person_transfer":
      return classification.existing_transfer_id ? "matched" : "transfers";
    case "unmatched":
      // A withdrawal is money moving, not a merchant purchase — it belongs
      // on the Transfers tab's Cash section ("to wallet" or "spent"), not a
      // category grid.
      return classification.withdrawal ? "transfers" : "review";
    case "skipped_before":
      // Legacy status carried by a session already in IndexedDB when this
      // shipped — reconcileStatementRows never emits it anymore.
      return "skipped";
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
  accounts: AccountRef[] = [],
): string {
  return (
    session.decisions[row.id]?.account_id ||
    suggestAccountForRow(row, session.account_id, accounts)
  );
}

/**
 * What a row's transaction description defaults to before the owner renames
 * it: the memo they wrote in the bank app when they sent it, or the bank's
 * raw line when there is none. Used by both the UI (input value / placeholder)
 * and `buildCommitActions`, so what is shown during review is exactly what
 * gets stored — `bank_description` still always carries the raw line
 * regardless (see `buildCommitActions` below).
 */
export function defaultDescriptionFor(
  row: ParsedTransaction,
  classification: RowClassification | undefined,
): string {
  return classification?.memo?.trim() || row.description;
}

export interface AccountRef {
  id: string;
  type: "expense" | "income" | "saving";
  is_default?: boolean;
  /** Needed to decide whether a quoted FX rate applies to this account. */
  currency?: string;
}

/**
 * The destination amount of an FX move, rounded to cents ONCE.
 *
 * money-rules Invariant 8: round at the boundary, never accumulate. 200 × 0.852
 * is 170.40000000000003 in float, and that is the number that would be written
 * to `transfers.to_amount` and added to a real balance.
 */
export function convertAtRate(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function pickAccount(
  accounts: AccountRef[],
  type: AccountRef["type"],
): string | null {
  const candidates = accounts.filter((a) => a.type === type);
  if (candidates.length === 0) return null;
  return (candidates.find((a) => a.is_default) ?? candidates[0]).id;
}

/**
 * Where a row should land when the owner has not overridden it.
 *
 * Usually the statement's own account. Two cases where that is wrong:
 *
 *  1. **A money-OUT row on an income or saving account.** `getBalanceDelta()`
 *     can only ADD on those types, so a debit filed there moves the balance the
 *     WRONG WAY — importing a $400 ATM withdrawal into Salary raises it by
 *     $400. There is no encoding that fixes this; the row has to go to an
 *     expense account. A correctness fix, not a preference.
 *
 *  2. **Money IN from another person, on an expense account.** Representable
 *     (`is_debt_return` adds), but it is income rather than a refund on a card,
 *     so it belongs in an income account.
 *
 * Only ever a DEFAULT — the per-row account select still wins, and it shows
 * the resolved account so the choice is visible rather than silent.
 */
export function suggestAccountForRow(
  row: ParsedTransaction,
  statementAccountId: string,
  accounts: AccountRef[],
): string {
  if (
    row.mapping_account_id &&
    accounts.some((account) => account.id === row.mapping_account_id)
  ) {
    return row.mapping_account_id;
  }

  const statement = accounts.find((a) => a.id === statementAccountId);
  if (!statement) return statementAccountId;

  const moneyIn = row.type === "credit";

  if (!moneyIn && statement.type !== "expense") {
    return pickAccount(accounts, "expense") ?? statementAccountId;
  }

  if (moneyIn && statement.type === "expense" && isPersonTransfer(row.description)) {
    return pickAccount(accounts, "income") ?? statementAccountId;
  }

  return statementAccountId;
}

/**
 * Should this person-to-person transfer become a `transfers` row rather than a
 * categorised transaction? The owner's explicit pick wins; the name match is
 * only the default.
 */
export function treatsAsTransfer(
  classification: RowClassification | undefined,
  decision: RowDecision | undefined,
): boolean {
  if (classification?.status !== "person_transfer") return false;
  if (decision?.action_kind) return decision.action_kind === "transfer";
  return decision?.treat_as_transfer ?? classification.household_match;
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
    const classification = session.classifications[row.id];
    const decision = session.decisions[row.id];
    if (
      getBucket(classification, decision) !== "review"
    ) {
      return false;
    }
    // A row explicitly changed to Transfer is answered in its row controls,
    // not by the transaction category stepper.
    if (decision?.action_kind === "transfer") return false;
    // Rows the Categorize list itself never shows — an other_account flag or
    // an undecided probable/ambiguous match needs a different decision (move
    // vs. same-money, not-a-match vs. accept) than "pick a category". Offering
    // the stepper's category grid for one is the double-write hazard those
    // sections exist to prevent.
    if (
      classification?.status === "other_account" ||
      classification?.status === "probable" ||
      classification?.status === "ambiguous"
    ) {
      return false;
    }
    return !resolveRowCategory(row, session).category_id;
  });
}

export function countUndecided(session: StatementSession): number {
  return undecidedRows(session).length;
}

/**
 * Rows still owing ANY decision before Save can write them — the union of
 * `undecidedRows` (Review, missing a category) and the Transfers tab rows
 * that have not yet been pointed at a destination or category. Drives the
 * "N left" labels on the Save button and the resume banner. Narrower than
 * counting the whole review bucket used to be, now that Transfers rows no
 * longer live in it (see getBucket) — those labels would otherwise still
 * include rows the owner has no more decisions to make on.
 */
export function countOpen(session: StatementSession): number {
  const producedActionFor = new Set(
    buildCommitActions(session).map((a) => a.row_id),
  );
  return session.rows.filter((row) => {
    const classification = session.classifications[row.id];
    const bucket = getBucket(classification, session.decisions[row.id]);
    if (bucket !== "review" && bucket !== "transfers") return false;
    // A received household transfer waits for the SENDER's own import — the
    // transfers API requires the creator to own the from-account, so there is
    // no action the owner of this statement can take on it.
    if (
      classification?.status === "person_transfer" &&
      classification.direction === "in" &&
      treatsAsTransfer(classification, session.decisions[row.id])
    ) {
      return false;
    }
    return !producedActionFor.has(row.id);
  }).length;
}

export function bucketCounts(session: StatementSession) {
  const counts = { matched: 0, imported: 0, review: 0, transfers: 0, skipped: 0 };
  for (const row of session.rows) {
    counts[getBucket(session.classifications[row.id], session.decisions[row.id])]++;
  }
  return counts;
}

/**
 * Plain-language statement of what ONE staged action will do when Save is
 * pressed. Lives here rather than in the UI so the Ready tab and the row cards
 * can never drift from each other — or from `buildCommitActions`, which is the
 * function that actually decides.
 *
 * Deliberately verbs the owner would use, not action kind names: "Log",
 * "Move", "Send", "Match" — `confirm_draft` and `rekey` mean nothing on screen.
 */
export function describeCommitAction(
  action: CommitAction,
  accountName: (id: string) => string,
  /** Currency of an account, for naming both sides of an FX move. */
  accountCurrency: (id: string) => string | undefined = () => undefined,
): { verb: string; title: string; detail: string | null } {
  switch (action.kind) {
    case "create":
      return {
        verb: "Log",
        title: action.description,
        detail: accountName(action.account_id),
      };
    case "create_transfer": {
      const route = `${accountName(action.from_account_id)} → ${accountName(action.to_account_id)}`;
      // An FX move lands a DIFFERENT number than the one on the statement, and
      // that number is the whole point of the row — so it is named here rather
      // than left for the owner to recompute from the rate.
      const converted =
        action.to_amount === undefined
          ? null
          : `${action.to_amount.toFixed(2)} ${accountCurrency(action.to_account_id) ?? ""}`.trim();
      return {
        // "self" is the owner's own money moving (an ATM withdrawal reaching
        // the wallet, an own-account exchange); "household" leaves for the
        // partner.
        verb: action.transfer_type === "self" ? "Move" : "Send",
        title: action.description,
        detail: converted ? `${route} · ${converted}` : route,
      };
    }
    case "stamp":
      return {
        verb: "Match",
        title: action.bank_description || "Already logged",
        detail: "no money moves",
      };
    case "confirm_draft":
      return { verb: "Confirm", title: "Draft becomes real", detail: null };
    case "rekey":
      return {
        verb: "Update match",
        title: action.bank_description || "Legacy match",
        detail: "no money moves",
      };
    case "skip":
      return {
        verb: "Skip",
        title: action.description || "Row set aside",
        detail: "remembered next import",
      };
    case "unskip":
      return {
        verb: "Restore",
        title: "Row brought back",
        detail: "no longer skipped",
      };
  }
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
export function buildCommitActions(
  session: StatementSession,
  accounts: AccountRef[] = [],
): CommitAction[] {
  const actions: CommitAction[] = [];

  for (const row of session.rows) {
    const decision = session.decisions[row.id];
    const classification = session.classifications[row.id];
    const bucket = getBucket(classification, decision);

    if (bucket === "skipped") continue;
    if (!classification) continue;

    // This bank line already produced a `transfers` row on an earlier import.
    // Bail before every branch below: a transfer has nothing to re-key, stamp
    // or backfill, and the withdrawal / exchange branches key off FLAGS that
    // survive onto an already-imported row — so without this an owner who
    // re-picked a destination would write the same movement twice, which is
    // the exact duplicate the fingerprint exists to stop.
    if (
      classification.status === "already_imported" &&
      classification.reason === "transfer_hash"
    ) {
      continue;
    }

    // Household money movement → a `transfers` record, never a transaction, so
    // it stays out of every spending aggregate by construction. Only the
    // OUTGOING leg is recordable: the transfers API requires the creator to own
    // the from-account, which is also what makes a second copy impossible when
    // the partner imports their own statement.
    if (
      classification.status === "person_transfer" &&
      treatsAsTransfer(classification, decision)
    ) {
      const destination = decision?.transfer_to_account_id;
      if (
        classification.direction === "out" &&
        !classification.existing_transfer_id &&
        destination &&
        row.statement_hash
      ) {
        actions.push({
          kind: "create_transfer",
          row_id: row.id,
          statement_hash: row.statement_hash,
          date: decision?.date || row.date,
          amount: row.amount,
          description:
            decision?.description?.trim() ||
            defaultDescriptionFor(row, classification),
          from_account_id: session.account_id,
          to_account_id: destination,
          transfer_type: "household",
        });
      }
      continue;
    }

    // An own-account currency exchange → a SELF transfer carrying the
    // converted destination amount. The bank line already states everything
    // needed ("Own Account Exchange: USD to EUR at 0.852", MONEY OUT 200.00);
    // only which of the owner's accounts is the other side is unknown, so the
    // action appears the moment they pick it.
    //
    // `to_amount` is what the destination ACTUALLY receives in its own
    // currency, and it is computed only when that account's currency matches
    // the pair the bank quoted. A rate of 0.852 means nothing applied to an
    // account that is not in EUR, and silently multiplying anyway would move a
    // real balance by a fabricated number — so a mismatched destination gets a
    // plain 1:1 move and the card says which amount lands.
    if (classification.exchange?.direction === "out") {
      const destination = decision?.transfer_to_account_id;
      if (destination && row.statement_hash) {
        const toCurrency = accounts.find((a) => a.id === destination)?.currency;
        const converts = toCurrency === classification.exchange.to_currency;
        actions.push({
          kind: "create_transfer",
          row_id: row.id,
          statement_hash: row.statement_hash,
          date: decision?.date || row.date,
          amount: row.amount,
          description:
            decision?.description?.trim() ||
            defaultDescriptionFor(row, classification),
          from_account_id: session.account_id,
          to_account_id: destination,
          transfer_type: "self",
          ...(converts
            ? { to_amount: convertAtRate(row.amount, classification.exchange.rate) }
            : {}),
        });
      }
      continue;
    }

    // A cash withdrawal choosing "to wallet" → a SELF transfer, never a
    // transaction: the cash hasn't been spent yet, only moved out of the
    // statement's account. Choosing "spent" instead (or not deciding yet)
    // leaves `transfer_to_account_id` unset, so this falls through to the
    // ordinary create-a-transaction path below, gated on a category exactly
    // like any other row.
    // Any ordinary review row can be corrected to an own-account transfer.
    // The chosen type changes what is staged without making the card vanish
    // from the review pane while the owner is still editing it. Credits reverse
    // the endpoints because the statement account received the money.
    if (decision?.action_kind === "transfer") {
      const counterpart = decision.transfer_to_account_id;
      if (counterpart && row.statement_hash) {
        const incoming = row.type === "credit";
        actions.push({
          kind: "create_transfer",
          row_id: row.id,
          statement_hash: row.statement_hash,
          date: decision.date || row.date,
          amount: row.amount,
          description:
            decision.description?.trim() ||
            defaultDescriptionFor(row, classification),
          from_account_id: incoming ? counterpart : session.account_id,
          to_account_id: incoming ? session.account_id : counterpart,
          transfer_type: "self",
        });
      }
      continue;
    }

    if (classification.withdrawal) {
      const destination = decision?.transfer_to_account_id;
      if (destination && row.statement_hash) {
        actions.push({
          kind: "create_transfer",
          row_id: row.id,
          statement_hash: row.statement_hash,
          date: decision?.date || row.date,
          amount: row.amount,
          description:
            decision?.description?.trim() ||
            defaultDescriptionFor(row, classification),
          from_account_id: session.account_id,
          to_account_id: destination,
          transfer_type: "self",
        });
        continue;
      }
    }

    // Already in the ledger — creating anything would double-count it. But if
    // it was recognised by the FUZZY tier while carrying a different (older)
    // fingerprint, upgrade that fingerprint to the current formula so the next
    // import matches it by identity instead of by resemblance. Balance-neutral.
    if (classification.status === "already_imported") {
      const storedHash = classification.stored_hash;
      // Two reasons to touch an already-imported row, both balance-neutral:
      //   1. its fingerprint predates the current formula (the fuzzy tier
      //      recognised it) — upgrade so the next import matches by identity;
      //   2. it is missing the bank's wording — backfill it.
      // (2) matters on its own: a statement whose fingerprints are ALL current
      // produced no actions at all, so the Save button sat disabled at "0 rows"
      // and there was no way to fill in `bank_description` for that history.
      const staleHash =
        classification.reason === "probable_duplicate" &&
        !!storedHash &&
        !!row.statement_hash &&
        storedHash !== row.statement_hash;
      // Exact hashes are already complete. Only legacy fuzzy matches belong in
      // Ready; exposing an internal bank-text backfill made an untouched
      // Imported row look like a user decision.
      if (staleHash && row.statement_hash) {
        actions.push({
          kind: "rekey",
          row_id: row.id,
          transaction_id: classification.transaction_id,
          statement_hash: row.statement_hash,
          // Guard on what is actually stored. For a current fingerprint this is
          // the same value, so the update is a no-op on the hash and only the
          // bank wording changes.
          previous_hash: storedHash ?? row.statement_hash,
          bank_description: row.description,
        });
      }
      continue;
    }

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
          bank_description: row.description,
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
    const accountId = resolveRowAccount(row, session, accounts);

    const mappingPattern = row.normalized_key?.trim();

    actions.push({
      kind: "create",
      row_id: row.id,
      date: decision?.date || row.date,
      // The user's rename wins; next is the memo they typed in the bank app
      // ("… via Mobile - 'link bowling - for 2'"); then the bank's raw text.
      // `statement_hash` below is untouched by all three, so renaming a row
      // never lets it re-import as new next month.
      description:
        decision?.description?.trim() ||
        defaultDescriptionFor(row, classification),
      // Always the RAW statement line, never the rename or the memo: this
      // column exists to be the stable axis for reporting, and both of those
      // drift ("Spinneys" one month, "Supermarket Spinneys" the next).
      bank_description: row.description,
      amount: row.amount,
      direction: row.type,
      account_id: accountId,
      category_id,
      subcategory_id,
      statement_hash: statementHash,
      // A withdrawal's normalized_key carries the ATM/voucher reference
      // number, not a merchant — learning it would write one throwaway
      // mapping per withdrawal instead of a reusable merchant pattern.
      ...(mappingPattern &&
      mappingPattern.length >= 2 &&
      !classification.withdrawal
        ? {
            learn_mapping: {
              pattern: mappingPattern.toUpperCase(),
              name: prettyMerchantName(mappingPattern),
            },
          }
        : {}),
    });
  }

  // ── Standing skips ────────────────────────────────────────────────────────
  //
  // A skip is a decision about a BANK ROW, not about one upload, so it is
  // recorded against the fingerprint and honoured on every future import.
  // Restoring a row from the Skipped tab withdraws it again.
  for (const row of session.rows) {
    if (!row.statement_hash) continue;
    const decision = session.decisions[row.id];
    const classification = session.classifications[row.id];

    // A standing skip is recorded by fingerprint (flag `skipped_before`, or
    // the legacy status on a session already in IndexedDB) — either way,
    // already remembered server-side, so there is nothing new to write.
    const alreadyStandingSkip =
      classification?.skipped_before ||
      classification?.status === "skipped_before";

    if (decision?.resolution === "skip") {
      // Transfers are skipped by the matcher on every run, so recording them
      // would fill the table with rows that need no memory at all.
      if (classification?.status === "transfer") continue;
      if (alreadyStandingSkip) continue;
      actions.push({
        kind: "skip",
        row_id: row.id,
        statement_hash: row.statement_hash,
        description: row.description,
        amount: row.amount,
        date: row.date,
      });
      continue;
    }

    // Explicitly restored a row that a previous import had skipped.
    if (alreadyStandingSkip && isRestored(decision)) {
      actions.push({
        kind: "unskip",
        row_id: row.id,
        statement_hash: row.statement_hash,
      });
    }
  }

  return actions;
}

// ── Skipped tab ───────────────────────────────────────────────────────────────
//
// "Skipped" is not one thing. It collects three populations that arrived by
// completely different routes and that the owner needs to treat differently:
//
//   auto     — own-account moves the matcher sets aside on EVERY run. Nothing
//              was decided and nothing can be; they are noise by construction.
//   standing — a skip the owner made on an EARLIER import, remembered by
//              fingerprint. Re-deciding these each month is the exact work the
//              standing skip exists to avoid, so they must be separable.
//   session  — set aside during THIS review, and the only ones still in play.
//
// Flattening them into one list meant a 3-row decision sat inside 85 rows of
// remembered noise, and the tab could not answer "why is this here".

export type SkipGroup = "session" | "standing" | "auto";

export interface SkipReason {
  group: SkipGroup;
  /** Why the row is on the Skipped tab, in the owner's words. */
  label: string;
  /** Own-account moves are re-derived every run, so there is nothing to undo. */
  restorable: boolean;
}

/**
 * What the row actually IS, phrased as the reason it was set aside. Reads the
 * real classification underneath the skip — `skipped_before` is a flag, not a
 * status, so the row still knows whether it was an other-account twin, a
 * person transfer or plain unmatched spending.
 */
function whySkipped(
  classification: RowClassification | undefined,
  accountName: (id: string) => string,
): string {
  if (!classification) return "Set aside";
  if (classification.withdrawal) return "Cash withdrawal";

  switch (classification.status) {
    case "other_account":
      return `Also in ${accountName(classification.account_id)}`;
    case "person_transfer":
      return `Transfer · ${classification.counterparty}`;
    case "already_imported":
      return "Already imported";
    case "matched":
    case "probable":
      return "Matches a logged transaction";
    case "ambiguous":
      return "Several possible matches";
    case "transfer":
      // The in leg of an exchange: the movement is recorded from the paying
      // side, so this row has nothing left to do — but "Own-account move"
      // would not explain why the EUR arriving here needs no action.
      return classification.exchange
        ? "Other side of an exchange"
        : "Own-account move";
    case "skipped_before":
    case "unmatched":
      return "Set aside";
  }
}

export function skipReason(
  classification: RowClassification | undefined,
  decision: RowDecision | undefined,
  accountName: (id: string) => string = () => "another account",
): SkipReason {
  if (classification?.status === "transfer") {
    return {
      group: "auto",
      label: classification.exchange
        ? "Other side of an exchange"
        : "Own-account move",
      restorable: false,
    };
  }

  // A standing skip is the stronger fact even when the owner also skipped it
  // again this session: the point of the Previously-skipped section is "you
  // already answered this in an earlier import", and that stays true.
  const standing =
    !!classification?.skipped_before ||
    classification?.status === "skipped_before";

  return {
    group: standing ? "standing" : "session",
    label: whySkipped(classification, accountName),
    restorable: true,
  };
}

/** Skipped rows split into the three populations, in tab order. */
export function skippedGroupCounts(
  session: StatementSession,
): Record<SkipGroup, number> {
  const counts: Record<SkipGroup, number> = {
    session: 0,
    standing: 0,
    auto: 0,
  };
  for (const row of session.rows) {
    const classification = session.classifications[row.id];
    const decision = session.decisions[row.id];
    if (getBucket(classification, decision) !== "skipped") continue;
    counts[skipReason(classification, decision).group]++;
  }
  return counts;
}

// ── Ready tab ─────────────────────────────────────────────────────────────────

/**
 * Which lane a staged action belongs to on the Ready tab.
 *
 * The tab used to be one flat list where a "Log" (real money, new transaction)
 * sat next to a "Restore" (a standing skip being withdrawn — nothing written to
 * the ledger at all) with no way to tell that they are not the same class of
 * thing. Save is a bulk money write, so the last screen before it has to say
 * which rows move money and which do not.
 *
 *   money  — the balance changes. create, create_transfer, and confirm_draft
 *            (a draft was never counted in the stored balance, so confirming
 *            applies the delta once — see the commit route).
 *   match  — an existing transaction is stamped with the bank's fingerprint.
 *   memory — only what the NEXT import will remember: a refreshed fingerprint,
 *            a standing skip, or a standing skip withdrawn.
 */
export type ActionLane = "money" | "match" | "memory";

export function actionLane(action: CommitAction): ActionLane {
  switch (action.kind) {
    case "create":
    case "create_transfer":
    case "confirm_draft":
      return "money";
    case "stamp":
      return "match";
    case "rekey":
    case "skip":
    case "unskip":
      return "memory";
  }
}

/**
 * Net effect on the ledger of everything staged, as a signed amount: credits
 * add, debits subtract. Transfers are excluded — they move money between two
 * accounts the owner already has, so they net to zero and including them would
 * make the headline number mean nothing.
 */
export function stagedNetAmount(actions: CommitAction[]): number {
  let net = 0;
  for (const action of actions) {
    if (action.kind === "create") {
      net += action.direction === "credit" ? action.amount : -action.amount;
    } else if (action.kind === "confirm_draft" && action.amount !== undefined) {
      net -= action.amount;
    }
  }
  return net;
}
