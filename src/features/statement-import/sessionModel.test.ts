import { describe, expect, it } from "vitest";
import type { StatementSession } from "@/lib/statementImportSession";
import type { ParsedTransaction } from "@/types/statement";
import {
  actionLane,
  bucketCounts,
  buildCommitActions,
  convertAtRate,
  buildReviewGroups,
  countOpen,
  countUndecided,
  describeCommitAction,
  getBucket,
  resolveRowCategory,
  skippedGroupCounts,
  skipReason,
  stagedNetAmount,
  suggestAccountForRow,
  undecidedRows,
  type AccountRef,
} from "./sessionModel";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const CAT_FOOD = "22222222-2222-4222-8222-222222222222";
const CAT_TRAVEL = "33333333-3333-4333-8333-333333333333";

function row(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    id: "row-1",
    date: "2026-08-12",
    description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
    amount: 80,
    type: "debit",
    matched: false,
    selected: true,
    normalized_key: "le gray",
    account_id: ACCOUNT,
    statement_hash: "hash-1",
    ...overrides,
  };
}

function session(overrides: Partial<StatementSession> = {}): StatementSession {
  return {
    id: "statement-1",
    file_name: "july.pdf",
    account_id: ACCOUNT,
    account_name: "Trip - Italy",
    account_currency: "EUR",
    created_at: 0,
    updated_at: 0,
    rows: [row()],
    classifications: { "row-1": { status: "unmatched" } },
    decisions: {},
    group_categories: {},
    ...overrides,
  };
}

describe("getBucket", () => {
  it("treats an auto-matched row as done", () => {
    expect(
      getBucket(
        {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 2,
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
        undefined,
      ),
    ).toBe("matched");
  });

  it("keeps a probable match in review until the user accepts it", () => {
    const probable = {
      status: "probable" as const,
      transaction_id: "tx-1",
      kind: "confirmed" as const,
      amount_diff: 3.6,
      date_diff: 1,
      description: "Le Gray",
      date: "2026-08-11",
      amount: 76.4,
    };
    expect(getBucket(probable, undefined)).toBe("review");
    expect(getBucket(probable, { resolution: "accept_match" })).toBe("matched");
  });

  it("sends transfers and explicit skips to the skipped bucket", () => {
    expect(getBucket({ status: "transfer" }, undefined)).toBe("skipped");
    expect(getBucket({ status: "unmatched" }, { resolution: "skip" })).toBe(
      "skipped",
    );
  });

  it("separates an already-imported row from a match against a manual log", () => {
    // Both are no-ops at commit time, but they are different claims: one is a
    // fingerprint hit, the other is the matcher's judgement. Merging them hid
    // the judgements inside the certainties.
    expect(
      getBucket(
        {
          status: "already_imported",
          reason: "hash",
          transaction_id: "tx-old",
          stored_hash: "hash-1",
          stored_bank_description: null,
        },
        undefined,
      ),
    ).toBe("imported");

    expect(
      getBucket(
        {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
        undefined,
      ),
    ).toBe("matched");
  });

  it("returns a detached match to review", () => {
    expect(
      getBucket(
        {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 0,
          description: "x",
          date: "2026-08-12",
          amount: 80,
        },
        { resolution: "create" },
      ),
    ).toBe("review");
  });

  // A person transfer never shares the review bucket — Review N and Transfers
  // N used to overlap because every person_transfer row also counted as
  // "review" while ALSO rendering on the Transfers tab.
  it("routes every person transfer, partner or not, to the transfers bucket", () => {
    const sent = {
      status: "person_transfer" as const,
      counterparty: "RACHA SAMIR TOUMA",
      direction: "out" as const,
      household_match: true,
      existing_transfer_id: null,
    };
    expect(getBucket(sent, undefined)).toBe("transfers");
    expect(getBucket({ ...sent, household_match: false }, undefined)).toBe(
      "transfers",
    );
    // Already recorded by the sender — nothing left to decide.
    expect(
      getBucket({ ...sent, existing_transfer_id: "tr-1" }, undefined),
    ).toBe("imported");
  });

  it("routes an unmatched withdrawal to transfers, not the merchant list", () => {
    expect(
      getBucket(
        { status: "unmatched", withdrawal: { kind: "atm" } },
        undefined,
      ),
    ).toBe("transfers");
    // An ordinary unmatched row (no withdrawal flag) is unaffected.
    expect(getBucket({ status: "unmatched" }, undefined)).toBe("review");
  });

  // The bug this fixed: `skipped_before` used to BE the classification, so a
  // restored row had no real status left to route it anywhere — Restore
  // raised the Save count but the row stayed stuck on the Skipped tab with no
  // visible change anywhere else.
  it("restores a standing-skipped row to its REAL bucket, not a dead end", () => {
    const matched = {
      status: "matched" as const,
      transaction_id: "tx-1",
      kind: "confirmed" as const,
      amount_diff: 0,
      date_diff: 0,
      description: "Le Gray",
      date: "2026-08-10",
      amount: 80,
    };
    // A standing skip can only suppress a row that still needs an answer. This
    // one is already in the ledger, so it reports `matched` with or without the
    // flag — burying a recognised row on Skipped is what made a re-import read
    // "Imported 12" with everything else invisible.
    const stillSkipped = { ...matched, skipped_before: true };
    expect(getBucket(stillSkipped, undefined)).toBe("matched");
    expect(getBucket(stillSkipped, { resolution: "undecided" })).toBe(
      "matched",
    );

    // Same for a bank line a previous import already wrote.
    const importedAndSkipped = {
      status: "already_imported" as const,
      reason: "hash" as const,
      transaction_id: "tx-9",
      stored_hash: "hash-9",
      stored_bank_description: "SALARY",
      skipped_before: true,
    };
    expect(getBucket(importedAndSkipped, undefined)).toBe("imported");

    const restoredTransfer = {
      status: "person_transfer" as const,
      counterparty: "SALIM",
      direction: "in" as const,
      household_match: false,
      existing_transfer_id: null,
      skipped_before: true,
    };
    expect(getBucket(restoredTransfer, undefined)).toBe("skipped");
    expect(getBucket(restoredTransfer, { resolution: "undecided" })).toBe(
      "transfers",
    );

    // Legacy sessions already sitting in IndexedDB carried skipped_before as
    // a STATUS — those still resolve sanely (Skipped, no Restore button;
    // handled at the UI layer since there is no real status to fall back to).
    expect(getBucket({ status: "skipped_before" }, undefined)).toBe(
      "skipped",
    );
  });
});

describe("resolveRowCategory", () => {
  it("prefers a per-row category over the group's", () => {
    const s = session({
      decisions: { "row-1": { resolution: "create", category_id: CAT_TRAVEL } },
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(resolveRowCategory(s.rows[0], s)).toEqual({
      category_id: CAT_TRAVEL,
      subcategory_id: null,
    });
  });

  it("inherits the group's category when the row has none", () => {
    const s = session({
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(resolveRowCategory(s.rows[0], s)).toEqual({
      category_id: CAT_FOOD,
      subcategory_id: null,
    });
  });

  it("honors an explicit per-row clear (null) over the group", () => {
    const s = session({
      decisions: { "row-1": { resolution: "create", category_id: null } },
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(resolveRowCategory(s.rows[0], s).category_id).toBeNull();
  });
});

describe("buildReviewGroups", () => {
  it("keeps different merchants apart even when the first word matches", () => {
    const s = session({
      rows: [
        row({ id: "a", normalized_key: "le gray", statement_hash: "h-a" }),
        row({ id: "b", normalized_key: "le mall", statement_hash: "h-b" }),
        row({ id: "c", normalized_key: "le gray", statement_hash: "h-c" }),
      ],
      classifications: {
        a: { status: "unmatched" },
        b: { status: "unmatched" },
        c: { status: "unmatched" },
      },
    });

    const groups = buildReviewGroups(s);
    expect(groups.map((g) => g.key)).toEqual(["le gray", "le mall"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("gives a detached row its own group", () => {
    const s = session({
      rows: [
        row({ id: "a", statement_hash: "h-a" }),
        row({ id: "b", statement_hash: "h-b" }),
      ],
      classifications: {
        a: { status: "unmatched" },
        b: { status: "unmatched" },
      },
      decisions: { b: { resolution: "create", detached_from_group: true } },
    });

    const groups = buildReviewGroups(s);
    expect(groups).toHaveLength(2);
    expect(groups.some((g) => g.key.startsWith("__row__:b"))).toBe(true);
  });
});

const SALARY = "44444444-4444-4444-8444-444444444444";
const WALLET = "55555555-5555-4555-8555-555555555555";

const ACCOUNTS: AccountRef[] = [
  { id: ACCOUNT, type: "expense" },
  { id: SALARY, type: "income" },
  { id: WALLET, type: "expense", is_default: true },
];

describe("suggestAccountForRow", () => {
  // An income account can only ADD (getBalanceDelta), so a debit filed there
  // moves the balance the wrong way — a $400 ATM withdrawal would RAISE Salary
  // by $400. No encoding fixes that; the row has to go somewhere that subtracts.
  it("moves a money-out row off an income account", () => {
    expect(
      suggestAccountForRow(
        row({ type: "debit", description: "Audi ATM Cash withdrawal" }),
        SALARY,
        ACCOUNTS,
      ),
    ).toBe(WALLET); // the default expense account
  });

  it("leaves a money-out row on an expense account alone", () => {
    expect(
      suggestAccountForRow(row({ type: "debit" }), ACCOUNT, ACCOUNTS),
    ).toBe(ACCOUNT);
  });

  it("sends money received from a person to an income account", () => {
    expect(
      suggestAccountForRow(
        row({ type: "credit", description: "Transfer from SALIM IBRAHIM SAADEH via Mobile -" }),
        ACCOUNT,
        ACCOUNTS,
      ),
    ).toBe(SALARY);
  });

  it("leaves an ordinary refund on the card it was refunded to", () => {
    // Money in on an expense account IS representable (is_debt_return adds), so
    // only person transfers are re-homed — a merchant refund stays put.
    expect(
      suggestAccountForRow(
        row({ type: "credit", description: "Reversal POS PURCHASE SPINNEYS" }),
        ACCOUNT,
        ACCOUNTS,
      ),
    ).toBe(ACCOUNT);
  });

  it("falls back to the statement account when no candidate exists", () => {
    expect(
      suggestAccountForRow(row({ type: "debit" }), SALARY, [
        { id: SALARY, type: "income" },
      ]),
    ).toBe(SALARY);
  });
});

describe("buildCommitActions", () => {
  it("stamps an auto-matched row without creating anything", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 2,
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "stamp",
        row_id: "row-1",
        transaction_id: "tx-1",
        statement_hash: "hash-1",
        bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
      },
    ]);
  });

  it("confirms a matched draft instead of stamping it", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "matched",
          transaction_id: "tx-draft",
          kind: "draft",
          amount_diff: 0,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-11",
          amount: 80,
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "confirm_draft",
      transaction_id: "tx-draft",
    });
  });

  it("passes the accepted bank amount through on a probable match", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "probable",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 3.6,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-11",
          amount: 76.4,
        },
      },
      decisions: {
        "row-1": { resolution: "accept_match", accept_amount: 80 },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "stamp",
      accept_amount: 80,
    });
  });

  it("creates an unmatched row once it has a category, and learns the merchant", () => {
    const s = session({
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "create",
        row_id: "row-1",
        date: "2026-08-12",
        description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        amount: 80,
        direction: "debit",
        account_id: ACCOUNT,
        category_id: CAT_FOOD,
        subcategory_id: null,
        statement_hash: "hash-1",
        learn_mapping: { pattern: "LE GRAY", name: "Le Gray" },
      },
    ]);
  });

  // Regression: the create action used to take its account from the row's
  // merchant mapping and skip the row when there wasn't one. On a first import
  // nothing has been learned yet, so EVERY row was silently dropped and Commit
  // reported "0 created" with no error. A statement belongs to one account —
  // the session's — and that is also the account baked into the row's hash.
  // The rename is the whole point of this pair: the ledger gets the owner's
  // words, the fingerprint keeps the bank's, so next month's import of the same
  // statement still reads as already-imported.
  it("stores the user's rename but fingerprints the bank's raw text", () => {
    const s = session({
      rows: [
        row({
          description: "PrePaid",
          statement_hash: "hash-prepaid",
        }),
      ],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          description: "ALFA Prepaid Phone",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      description: "ALFA Prepaid Phone",
      statement_hash: "hash-prepaid",
    });
  });

  // A transfer this statement already produced must never produce a second
  // one. The withdrawal / exchange flags survive onto an already-imported row
  // (pass 5 stamps every row), so a stale destination pick used to be enough
  // to write the same movement twice — both balances, no trace.
  it("emits nothing for a transfer a previous import already created", () => {
    const s = session({
      rows: [row({ description: "ATM CASH WITHDRAWAL BLOM HAMRA" })],
      classifications: {
        "row-1": {
          status: "already_imported",
          reason: "transfer_hash",
          transfer_id: "tr-1",
          withdrawal: { kind: "atm" },
        },
      },
      decisions: {
        "row-1": { resolution: "create", transfer_to_account_id: CAT_TRAVEL },
      },
    });

    expect(buildCommitActions(s)).toEqual([]);
    expect(getBucket(s.classifications["row-1"], undefined)).toBe("imported");
  });

  // `description` is the owner's wording and drifts between imports;
  // `bank_description` is the machine text and is what reporting groups on. A
  // rename must never leak into it.
  it("keeps the bank's own wording alongside a rename", () => {
    const s = session({
      rows: [row({ description: "POS Purchase SPINNEYS MTAYLEB LB 7121" })],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          description: "Spinneys",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      description: "Spinneys",
      bank_description: "POS Purchase SPINNEYS MTAYLEB LB 7121",
    });
  });

  it("sends the bank wording on a stamp so a hand-logged row gains it too", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 2,
          description: "Spinneys",
          date: "2026-08-10",
          amount: 80,
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "stamp",
      bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
    });
  });

  it("falls back to the bank text when a rename is blank", () => {
    const s = session({
      rows: [row({ description: "PrePaid" })],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          description: "   ",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({ description: "PrePaid" });
  });

  // Bank fees riding along on a salary statement belong to the expenses
  // account, not to salary. The override moves the transaction; it must NOT
  // move the fingerprint, which stays keyed to the statement's account.
  it("honours a per-row account override without touching the hash", () => {
    const s = session({
      rows: [row({ statement_hash: "hash-fee" })],
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          account_id: "22222222-2222-4222-8222-222222222222",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "create",
      account_id: "22222222-2222-4222-8222-222222222222",
      statement_hash: "hash-fee",
    });
  });

  it("falls back to the statement account when no override is set", () => {
    const s = session({
      rows: [row()],
      decisions: { "row-1": { resolution: "create", category_id: CAT_FOOD } },
    });
    expect(buildCommitActions(s)[0]).toMatchObject({ account_id: ACCOUNT });
  });

  it("creates into the session account when no mapping supplied one", () => {
    const s = session({
      rows: [row({ account_id: null })],
      decisions: {
        "row-1": { resolution: "create", category_id: CAT_FOOD },
      },
    });

    expect(buildCommitActions(s)).toHaveLength(1);
    expect(buildCommitActions(s)[0]).toMatchObject({
      kind: "create",
      account_id: ACCOUNT,
    });
  });

  it("ignores a mapping that points at a different account", () => {
    // Otherwise the fingerprint (hashed with the session account) would guard a
    // transaction written to another account entirely.
    const s = session({
      rows: [row({ account_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })],
      decisions: {
        "row-1": { resolution: "create", category_id: CAT_FOOD },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({ account_id: ACCOUNT });
  });

  it("uses an edited date when the user corrected the posting lag", () => {
    const s = session({
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          date: "2026-08-10",
        },
      },
    });

    expect(buildCommitActions(s)[0]).toMatchObject({ date: "2026-08-10" });
  });

  it("writes no MONEY for rows that are skipped, transfers, already imported, or uncategorized", () => {
    const s = session({
      rows: [
        row({ id: "skip", statement_hash: "h-1" }),
        row({ id: "xfer", statement_hash: "h-2" }),
        row({ id: "dupe", statement_hash: "h-3" }),
        row({ id: "blank", statement_hash: "h-4" }),
      ],
      classifications: {
        skip: { status: "unmatched" },
        xfer: { status: "transfer" },
        dupe: {
          status: "already_imported",
          reason: "hash",
          transaction_id: "tx-old",
          stored_hash: "hash-1",
          stored_bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        },
        blank: { status: "unmatched" },
      },
      decisions: { skip: { resolution: "skip", category_id: CAT_FOOD } },
    });

    // A manual skip DOES produce a standing-skip record (so the next import
    // does not ask again), but it touches no transaction and no balance — which
    // is what this test is actually guarding.
    const moneyActions = buildCommitActions(s).filter(
      (a) => a.kind !== "skip" && a.kind !== "unskip",
    );
    expect(moneyActions).toEqual([]);
  });

  // Self-healing half of a fingerprint-formula change: a row the FUZZY tier
  // recognised gets its stored hash upgraded, so the next import matches it by
  // identity instead of by resemblance. Balance-neutral.
  it("re-keys a row recognised by the fuzzy tier under an older fingerprint", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "already_imported",
          reason: "probable_duplicate",
          transaction_id: "tx-v1",
          stored_hash: "v1-era-hash",
          stored_bank_description: null,
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "rekey",
        row_id: "row-1",
        transaction_id: "tx-v1",
        statement_hash: "hash-1",
        previous_hash: "v1-era-hash",
        bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
      },
    ]);
  });

  it("writes nothing when the fingerprint AND the bank wording are current", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "already_imported",
          reason: "probable_duplicate",
          transaction_id: "tx-current",
          stored_hash: "hash-1", // identical to the row's own hash
          stored_bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([]);
  });

  // Regression: a statement whose fingerprints were ALL current produced no
  // actions at all, so Save sat disabled at "0 rows" and there was no way to
  // fill in `bank_description` for that history.
  it("re-imports purely to backfill the bank wording when it is missing", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "already_imported",
          reason: "hash",
          transaction_id: "tx-current",
          stored_hash: "hash-1", // fingerprint is already current
          stored_bank_description: null, // …but the bank text was never stored
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "rekey",
        row_id: "row-1",
        transaction_id: "tx-current",
        statement_hash: "hash-1",
        // Guards on the CURRENT hash, so the write is a no-op on the
        // fingerprint and only the bank wording lands.
        previous_hash: "hash-1",
        bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
      },
    ]);
  });

  it("records a manual skip as a standing decision, keyed by fingerprint", () => {
    const s = session({
      decisions: { "row-1": { resolution: "skip" } },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "skip",
        row_id: "row-1",
        statement_hash: "hash-1",
        description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        amount: 80,
        date: "2026-08-12",
      },
    ]);
  });

  it("does not record a skip for a transfer or an already-remembered row", () => {
    // The matcher skips transfers on every run, so remembering them would fill
    // the table with rows that need no memory at all.
    const transfers = session({
      classifications: { "row-1": { status: "transfer" } },
      decisions: { "row-1": { resolution: "skip" } },
    });
    expect(buildCommitActions(transfers)).toEqual([]);

    const remembered = session({
      classifications: { "row-1": { status: "skipped_before" } },
      decisions: { "row-1": { resolution: "skip" } },
    });
    expect(buildCommitActions(remembered)).toEqual([]);
  });

  it("withdraws a standing skip when the row is restored", () => {
    const s = session({
      classifications: { "row-1": { status: "skipped_before" } },
      decisions: { "row-1": { resolution: "undecided" } },
    });

    expect(buildCommitActions(s)).toEqual([
      { kind: "unskip", row_id: "row-1", statement_hash: "hash-1" },
    ]);
  });

  it("does not re-key an exact-hash hit — there is nothing to upgrade", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "already_imported",
          reason: "hash",
          transaction_id: "tx-old",
          stored_hash: "hash-1",
          stored_bank_description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([]);
  });

  it("requires a chosen candidate before committing an ambiguous row", () => {
    const ambiguous = {
      status: "ambiguous" as const,
      candidates: [
        {
          transaction_id: "tx-a",
          kind: "confirmed" as const,
          amount_diff: 0,
          date_diff: 1,
          description: "a",
          date: "2026-08-11",
          amount: 80,
        },
        {
          transaction_id: "tx-b",
          kind: "confirmed" as const,
          amount_diff: 0,
          date_diff: 1,
          description: "b",
          date: "2026-08-11",
          amount: 80,
        },
      ],
    };

    const undecided = session({ classifications: { "row-1": ambiguous } });
    expect(buildCommitActions(undecided)).toEqual([]);

    const picked = session({
      classifications: { "row-1": ambiguous },
      decisions: {
        "row-1": { resolution: "link", linked_transaction_id: "tx-b" },
      },
    });
    expect(buildCommitActions(picked)[0]).toMatchObject({
      kind: "stamp",
      transaction_id: "tx-b",
    });
  });

  // "Not partner" flips a person_transfer into an ordinary transaction — the
  // memo the owner typed in the bank app becomes the default description
  // (never touching statement_hash), and the raw bank line stays the
  // reporting axis regardless.
  it("creates a non-partner transfer as a transaction, defaulting its description to the memo", () => {
    const s = session({
      rows: [
        row({
          description:
            "Transfer to ELIE JOSEPH AZAR via Mobile - 'link bowling - mkalles - for 2'",
        }),
      ],
      classifications: {
        "row-1": {
          status: "person_transfer",
          counterparty: "ELIE JOSEPH AZAR",
          direction: "out",
          household_match: false,
          existing_transfer_id: null,
          memo: "link bowling - mkalles - for 2",
        },
      },
      decisions: {
        "row-1": {
          resolution: "create",
          category_id: CAT_FOOD,
          treat_as_transfer: false,
        },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "create",
        row_id: "row-1",
        date: "2026-08-12",
        description: "link bowling - mkalles - for 2",
        bank_description:
          "Transfer to ELIE JOSEPH AZAR via Mobile - 'link bowling - mkalles - for 2'",
        amount: 80,
        direction: "debit",
        account_id: ACCOUNT,
        category_id: CAT_FOOD,
        subcategory_id: null,
        statement_hash: "hash-1",
        learn_mapping: { pattern: "LE GRAY", name: "Le Gray" },
      },
    ]);
  });

  // An ATM withdrawal choosing "to wallet" is cash moving, not spending — a
  // SELF transfer, never a transaction.
  it("moves a withdrawal chosen 'to wallet' as a self transfer", () => {
    const WALLET = "44444444-4444-4444-8444-444444444444";
    const s = session({
      classifications: {
        "row-1": { status: "unmatched", withdrawal: { kind: "atm" } },
      },
      decisions: {
        "row-1": { resolution: "create", transfer_to_account_id: WALLET },
      },
    });

    expect(buildCommitActions(s)).toEqual([
      {
        kind: "create_transfer",
        row_id: "row-1",
        statement_hash: "hash-1",
        date: "2026-08-12",
        amount: 80,
        description: "POS PURCHASE LE GRAY BEIRUT LB 3043",
        from_account_id: ACCOUNT,
        to_account_id: WALLET,
        transfer_type: "self",
      },
    ]);
  });

  // A voucher withdrawal chosen "spent" is a real transaction — but its
  // reference-number normalized_key must never be learned as a merchant
  // mapping (it is not a reusable merchant pattern).
  it("creates a spent voucher withdrawal without learning a merchant mapping", () => {
    const s = session({
      rows: [
        row({
          description:
            "Voucher ATM Cash Withdrawal at BANK AUDI MANSOURIEH-6 MANSOURIEH LB for Voucher No 6755430378 - Car Insurance",
          normalized_key: "voucher atm cash withdrawal",
        }),
      ],
      classifications: {
        "row-1": {
          status: "unmatched",
          withdrawal: { kind: "voucher" },
          memo: "Car Insurance",
        },
      },
      decisions: { "row-1": { resolution: "create", category_id: CAT_FOOD } },
    });

    const actions = buildCommitActions(s);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "create",
      description: "Car Insurance",
    });
    expect(actions[0]).not.toHaveProperty("learn_mapping");
  });
});

// The Ready tab renders these, so a wrong verb here is a promise the commit
// does not keep. Pinned per action kind.
describe("describeCommitAction", () => {
  const names: Record<string, string> = {
    [ACCOUNT]: "Debit Card - NEO",
    "acc-wallet": "Wallet",
    "acc-partner": "Racha's Wallet",
  };
  const nameOf = (id: string) => names[id] ?? "Account";

  it("says what a created transaction will do", () => {
    const s = session({
      group_categories: {
        "le gray": { category_id: CAT_FOOD, subcategory_id: null },
      },
    });
    const [action] = buildCommitActions(s);
    expect(describeCommitAction(action, nameOf)).toEqual({
      verb: "Log",
      title: "POS PURCHASE LE GRAY BEIRUT LB 3043",
      detail: "Debit Card - NEO",
    });
  });

  // A self transfer is the owner's own money moving — "Move", and the from →
  // to has to be on screen, since "To wallet" never said from where.
  it("names both ends of a self transfer", () => {
    const s = session({
      classifications: {
        "row-1": { status: "unmatched", withdrawal: { kind: "atm" } },
      },
      decisions: {
        "row-1": { resolution: "create", transfer_to_account_id: "acc-wallet" },
      },
    });
    const [action] = buildCommitActions(s);
    expect(describeCommitAction(action, nameOf)).toMatchObject({
      verb: "Move",
      detail: "Debit Card - NEO → Wallet",
    });
  });

  it("distinguishes a household transfer from a self one", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "person_transfer",
          counterparty: "RACHA SAMIR TOUMA",
          direction: "out",
          household_match: true,
          existing_transfer_id: null,
        },
      },
      decisions: {
        "row-1": {
          resolution: "create",
          treat_as_transfer: true,
          transfer_to_account_id: "acc-partner",
        },
      },
    });
    const [action] = buildCommitActions(s);
    expect(describeCommitAction(action, nameOf)).toMatchObject({
      verb: "Send",
      detail: "Debit Card - NEO → Racha's Wallet",
    });
  });

  it("marks the balance-neutral actions as moving no money", () => {
    const s = session({
      classifications: {
        "row-1": {
          status: "matched",
          transaction_id: "tx-1",
          kind: "confirmed",
          amount_diff: 0,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-11",
          amount: 80,
        },
      },
    });
    const [action] = buildCommitActions(s);
    expect(describeCommitAction(action, nameOf)).toMatchObject({
      verb: "Match",
      detail: "no money moves",
    });
  });

  it("describes a standing skip", () => {
    const s = session({ decisions: { "row-1": { resolution: "skip" } } });
    const [action] = buildCommitActions(s);
    expect(describeCommitAction(action, nameOf)).toMatchObject({
      verb: "Skip",
      detail: "remembered next import",
    });
  });
});

describe("counters", () => {
  it("counts only review rows still missing a category", () => {
    const s = session({
      rows: [
        row({ id: "needs", statement_hash: "h-1" }),
        row({ id: "done", statement_hash: "h-2" }),
      ],
      classifications: {
        needs: { status: "unmatched" },
        done: { status: "unmatched" },
      },
      decisions: { done: { resolution: "create", category_id: CAT_FOOD } },
    });

    expect(countUndecided(s)).toBe(1);
    expect(bucketCounts(s)).toEqual({
      matched: 0,
      imported: 0,
      review: 2,
      transfers: 0,
      skipped: 0,
    });
  });

  // Regression: "Review N one at a time" used to walk transfer/other-account
  // rows the Categorize list never shows, because undecidedRows only checked
  // the review bucket and not what kind of decision the row actually needs.
  it("excludes other-account and undecided probable/ambiguous rows from the stepper queue", () => {
    const s = session({
      rows: [
        row({ id: "plain", statement_hash: "h-1" }),
        row({ id: "other", statement_hash: "h-2" }),
        row({ id: "maybe", statement_hash: "h-3" }),
        row({ id: "xfer", statement_hash: "h-4" }),
      ],
      classifications: {
        plain: { status: "unmatched" },
        other: {
          status: "other_account",
          transaction_id: "tx-1",
          account_id: "acct-other",
          description: "Le Gray",
          date: "2026-08-10",
          amount: 80,
        },
        maybe: {
          status: "probable",
          transaction_id: "tx-2",
          kind: "confirmed",
          amount_diff: 3,
          date_diff: 1,
          description: "Le Gray",
          date: "2026-08-11",
          amount: 77,
        },
        xfer: {
          status: "person_transfer",
          counterparty: "SALIM",
          direction: "in",
          household_match: false,
          existing_transfer_id: null,
        },
      },
    });

    const queue = undecidedRows(s).map((r) => r.id);
    expect(queue).toEqual(["plain"]);
  });

  // The Save button and resume banner need the WIDER "anything still owed"
  // count once transfers no longer live in the review bucket — narrower than
  // that would undercount and let the owner think they were done.
  it("counts open Transfers-tab rows alongside undecided review rows", () => {
    const s = session({
      rows: [
        row({ id: "review-row", statement_hash: "h-1" }),
        row({ id: "sent", statement_hash: "h-2" }),
        row({ id: "received-waiting", statement_hash: "h-3" }),
      ],
      classifications: {
        "review-row": { status: "unmatched" },
        sent: {
          status: "person_transfer",
          counterparty: "RACHA",
          direction: "out",
          household_match: true,
          existing_transfer_id: null,
        },
        // Waiting on the SENDER's own import — nothing this owner can do.
        "received-waiting": {
          status: "person_transfer",
          counterparty: "RACHA",
          direction: "in",
          household_match: true,
          existing_transfer_id: null,
        },
      },
    });

    expect(countOpen(s)).toBe(2); // review-row (no category) + sent (no destination yet)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A restored row must STAY restored.
//
// The regression this locks down: Restore used to be encoded as
// `resolution: "undecided"`, and the owner's very next action overwrites
// `resolution` ("create" when they pick a category or a transfer destination).
// getBucket then saw `skipped_before && resolution !== "undecided"` and threw
// the row back onto Skipped — so answering a restored row made it vanish from
// the tab it was answered on, at the moment it was answered.
// ─────────────────────────────────────────────────────────────────────────────
describe("restore is durable", () => {
  it("keeps a restored merchant row in Review after a category is picked", () => {
    const classification = { status: "unmatched", skipped_before: true } as const;

    expect(getBucket(classification, { resolution: "skip" })).toBe("skipped");
    expect(
      getBucket(classification, { resolution: "undecided", restored: true }),
    ).toBe("review");
    // The decisive case: a category pick promotes resolution to "create".
    expect(
      getBucket(classification, {
        resolution: "create",
        restored: true,
        category_id: CAT_FOOD,
      }),
    ).toBe("review");
  });

  it("keeps a restored person transfer on Transfers after a destination is picked", () => {
    const classification = {
      status: "person_transfer",
      counterparty: "RACHA SAMIR TOUMA",
      direction: "out",
      household_match: true,
      existing_transfer_id: null,
      skipped_before: true,
    } as const;

    expect(
      getBucket(classification, {
        resolution: "create",
        restored: true,
        transfer_to_account_id: "acc-partner",
        treat_as_transfer: true,
      }),
    ).toBe("transfers");
  });

  it("keeps a restored cash withdrawal on Transfers after it is answered", () => {
    const classification = {
      status: "unmatched",
      withdrawal: { kind: "atm" },
      skipped_before: true,
    } as const;

    expect(
      getBucket(classification, {
        resolution: "create",
        restored: true,
        transfer_to_account_id: "acc-wallet",
      }),
    ).toBe("transfers");
  });

  it("still emits the unskip once the row carries a real resolution", () => {
    const actions = buildCommitActions(
      session({
        classifications: {
          "row-1": { status: "unmatched", skipped_before: true },
        },
        decisions: {
          "row-1": {
            resolution: "create",
            restored: true,
            category_id: CAT_FOOD,
          },
        },
      }),
    );

    expect(actions.map((a) => a.kind).sort()).toEqual(["create", "unskip"]);
  });

  it("withdraws the restore when the row is skipped again", () => {
    const classification = { status: "unmatched", skipped_before: true } as const;
    // `restored` is cleared by updateDecision on an explicit skip; even if a
    // stale flag survived, the skip resolution wins the bucket outright.
    expect(
      getBucket(classification, { resolution: "skip", restored: true }),
    ).toBe("skipped");
  });

  it("honours a legacy session that encoded Restore as undecided", () => {
    expect(
      getBucket(
        { status: "unmatched", skipped_before: true },
        { resolution: "undecided" },
      ),
    ).toBe("review");
  });
});

describe("skipReason", () => {
  const name = (id: string) => (id === "acc-neo" ? "Debit Card - NEO" : id);

  it("files an own-account move as auto and refuses to restore it", () => {
    expect(skipReason({ status: "transfer" }, undefined, name)).toEqual({
      group: "auto",
      label: "Own-account move",
      restorable: false,
    });
  });

  it("files a standing skip separately from one made this session", () => {
    expect(
      skipReason({ status: "unmatched", skipped_before: true }, undefined, name)
        .group,
    ).toBe("standing");
    expect(
      skipReason({ status: "unmatched" }, { resolution: "skip" }, name).group,
    ).toBe("session");
  });

  it("reads the reason off the real classification under the skip", () => {
    expect(
      skipReason(
        {
          status: "other_account",
          transaction_id: "tx-1",
          account_id: "acc-neo",
          description: "Spinneys",
          date: "2026-08-01",
          amount: 20,
        },
        { resolution: "skip" },
        name,
      ).label,
    ).toBe("Also in Debit Card - NEO");

    expect(
      skipReason(
        {
          status: "person_transfer",
          counterparty: "SALIM",
          direction: "in",
          household_match: false,
          existing_transfer_id: null,
        },
        { resolution: "skip" },
        name,
      ).label,
    ).toBe("Transfer · SALIM");

    expect(
      skipReason(
        { status: "unmatched", withdrawal: { kind: "atm" } },
        { resolution: "skip" },
        name,
      ).label,
    ).toBe("Cash withdrawal");
  });

  it("counts the three populations of the Skipped tab", () => {
    const counts = skippedGroupCounts(
      session({
        rows: [
          row({ id: "a", statement_hash: "h-a" }),
          row({ id: "b", statement_hash: "h-b" }),
          row({ id: "c", statement_hash: "h-c" }),
          row({ id: "d", statement_hash: "h-d" }),
        ],
        classifications: {
          a: { status: "transfer" },
          b: { status: "unmatched", skipped_before: true },
          c: { status: "unmatched" },
          d: { status: "unmatched" },
        },
        decisions: { c: { resolution: "skip" } },
      }),
    );

    // d is still in Review, so it is not counted at all.
    expect(counts).toEqual({ auto: 1, standing: 1, session: 1 });
  });
});

describe("actionLane", () => {
  it("separates money writes from stamps and from memory-only rows", () => {
    expect(
      actionLane({
        kind: "create",
        row_id: "r",
        date: "2026-08-01",
        description: "Spinneys",
        bank_description: "SPINNEYS",
        amount: 20,
        direction: "debit",
        account_id: ACCOUNT,
        category_id: CAT_FOOD,
        subcategory_id: null,
        statement_hash: "h",
      }),
    ).toBe("money");

    expect(
      actionLane({
        kind: "create_transfer",
        row_id: "r",
        statement_hash: "h",
        date: "2026-08-01",
        amount: 100,
        description: "Cash",
        from_account_id: ACCOUNT,
        to_account_id: "acc-wallet",
        transfer_type: "self",
      }),
    ).toBe("money");

    expect(
      actionLane({
        kind: "confirm_draft",
        row_id: "r",
        transaction_id: "tx",
        statement_hash: "h",
      }),
    ).toBe("money");

    expect(
      actionLane({
        kind: "stamp",
        row_id: "r",
        transaction_id: "tx",
        statement_hash: "h",
        bank_description: "SPINNEYS",
      }),
    ).toBe("match");

    // The pair the owner could not tell apart on a flat Ready tab.
    expect(actionLane({ kind: "unskip", row_id: "r", statement_hash: "h" })).toBe(
      "memory",
    );
    expect(
      actionLane({
        kind: "skip",
        row_id: "r",
        statement_hash: "h",
        description: "X",
        amount: 1,
        date: "2026-08-01",
      }),
    ).toBe("memory");
    expect(
      actionLane({
        kind: "rekey",
        row_id: "r",
        transaction_id: "tx",
        statement_hash: "h",
        previous_hash: "old",
        bank_description: "SPINNEYS",
      }),
    ).toBe("memory");
  });
});

describe("stagedNetAmount", () => {
  it("nets credits against debits and ignores transfers", () => {
    const create = (amount: number, direction: "debit" | "credit") =>
      ({
        kind: "create",
        row_id: `r-${amount}-${direction}`,
        date: "2026-08-01",
        description: "x",
        bank_description: "X",
        amount,
        direction,
        account_id: ACCOUNT,
        category_id: CAT_FOOD,
        subcategory_id: null,
        statement_hash: `h-${amount}-${direction}`,
      }) as const;

    expect(
      stagedNetAmount([
        create(50, "debit"),
        create(20, "credit"),
        {
          kind: "create_transfer",
          row_id: "t",
          statement_hash: "h-t",
          date: "2026-08-01",
          amount: 400,
          description: "Cash",
          from_account_id: ACCOUNT,
          to_account_id: "acc-wallet",
          transfer_type: "self",
        },
        { kind: "unskip", row_id: "u", statement_hash: "h-u" },
      ]),
    ).toBe(-30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Own-account currency exchange (BUD-54).
//
// "Own Account Exchange: USD to EUR at 0.852 - to 501400630005 -", MONEY OUT
// 200.00 → a SELF transfer of 200.00 USD out of the statement account and
// 170.40 EUR into the chosen destination. Before this the row classified
// `transfer`, landed on Skipped and produced nothing, so the EUR account stayed
// permanently short.
// ─────────────────────────────────────────────────────────────────────────────
const EUR_ACCOUNT = "44444444-4444-4444-8444-444444444444";
const USD_WALLET = "55555555-5555-4555-8555-555555555555";

const FX_LINE = "Own Account Exchange: USD to EUR at 0.852 - to 501400630005 -";

const FX_ACCOUNTS: AccountRef[] = [
  { id: ACCOUNT, type: "income", currency: "USD" },
  { id: EUR_ACCOUNT, type: "expense", currency: "EUR" },
  { id: USD_WALLET, type: "expense", currency: "USD", is_default: true },
];

function fxSession(decision: Record<string, unknown> = {}) {
  return session({
    rows: [
      row({
        id: "fx-1",
        description: FX_LINE,
        amount: 200,
        type: "debit",
        normalized_key: "own account exchange",
        statement_hash: "hash-fx",
      }),
    ],
    classifications: {
      "fx-1": {
        status: "transfer",
        exchange: {
          from_currency: "USD",
          to_currency: "EUR",
          rate: 0.852,
          counterparty_account: "501400630005",
          direction: "out",
        },
      },
    },
    decisions: Object.keys(decision).length
      ? { "fx-1": decision as never }
      : {},
  });
}

describe("own-account exchange", () => {
  it("converts once, rounded to cents", () => {
    // 200 * 0.852 is 170.40000000000003 in float — the number that would
    // otherwise be written to transfers.to_amount and added to a real balance.
    expect(convertAtRate(200, 0.852)).toBe(170.4);
    // 333.33 * 0.852 = 283.99716 — rounded up, once, at the boundary.
    expect(convertAtRate(333.33, 0.852)).toBe(284);
  });

  it("offers the OUT leg on Transfers and leaves the IN leg skipped", () => {
    const out = {
      status: "transfer",
      exchange: {
        from_currency: "USD",
        to_currency: "EUR",
        rate: 0.852,
        counterparty_account: "501400630005",
        direction: "out",
      },
    } as const;
    const incoming = {
      ...out,
      exchange: { ...out.exchange, direction: "in" },
    } as const;

    expect(getBucket(out, undefined)).toBe("transfers");
    expect(getBucket(incoming, undefined)).toBe("skipped");
    // A plain own-account move is still noise.
    expect(getBucket({ status: "transfer" }, undefined)).toBe("skipped");
  });

  it("names the in leg on the Skipped tab", () => {
    expect(
      skipReason(
        {
          status: "transfer",
          exchange: {
            from_currency: "USD",
            to_currency: "EUR",
            rate: 0.852,
            counterparty_account: "501400630004",
            direction: "in",
          },
        },
        undefined,
      ),
    ).toEqual({
      group: "auto",
      label: "Other side of an exchange",
      restorable: false,
    });
  });

  it("stages nothing until a destination account is chosen", () => {
    expect(buildCommitActions(fxSession(), FX_ACCOUNTS)).toEqual([]);
  });

  it("stages a self transfer carrying the converted destination amount", () => {
    const actions = buildCommitActions(
      fxSession({ resolution: "create", transfer_to_account_id: EUR_ACCOUNT }),
      FX_ACCOUNTS,
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "create_transfer",
      transfer_type: "self",
      from_account_id: ACCOUNT,
      to_account_id: EUR_ACCOUNT,
      amount: 200,
      to_amount: 170.4,
      statement_hash: "hash-fx",
    });
  });

  it("does NOT apply the quoted rate to an account in another currency", () => {
    // 0.852 is EUR-per-USD. Multiplying a USD wallet's balance by it would
    // invent 29.60 of missing money out of nothing.
    const actions = buildCommitActions(
      fxSession({ resolution: "create", transfer_to_account_id: USD_WALLET }),
      FX_ACCOUNTS,
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "create_transfer",
      to_account_id: USD_WALLET,
      amount: 200,
    });
    expect(actions[0]).not.toHaveProperty("to_amount");
  });

  it("never stages the in leg, destination or not", () => {
    const incoming = session({
      rows: [
        row({
          id: "fx-in",
          description: FX_LINE,
          amount: 170.4,
          type: "credit",
          statement_hash: "hash-fx-in",
        }),
      ],
      classifications: {
        "fx-in": {
          status: "transfer",
          exchange: {
            from_currency: "USD",
            to_currency: "EUR",
            rate: 0.852,
            counterparty_account: "501400630004",
            direction: "in",
          },
        },
      },
      decisions: {
        "fx-in": { resolution: "create", transfer_to_account_id: EUR_ACCOUNT },
      },
    });

    expect(buildCommitActions(incoming, FX_ACCOUNTS)).toEqual([]);
  });

  it("counts an undecided exchange as open and a decided one as closed", () => {
    expect(countOpen(fxSession())).toBe(1);
    expect(
      countOpen(
        fxSession({ resolution: "create", transfer_to_account_id: EUR_ACCOUNT }),
      ),
    ).toBe(0);
  });

  it("names both legs of the conversion on the Ready tab", () => {
    const [action] = buildCommitActions(
      fxSession({ resolution: "create", transfer_to_account_id: EUR_ACCOUNT }),
      FX_ACCOUNTS,
    );

    expect(
      describeCommitAction(
        action,
        (id) => (id === EUR_ACCOUNT ? "Trip - Italy" : "Salary"),
        (id) => (id === EUR_ACCOUNT ? "EUR" : "USD"),
      ),
    ).toEqual({
      verb: "Move",
      title: FX_LINE,
      detail: "Salary → Trip - Italy · 170.40 EUR",
    });
  });

  it("keeps the exchange out of the ledger's net amount", () => {
    // A transfer moves the owner's own money — it is not spend or income
    // (money-rules Invariant 4), so the Ready headline must not move.
    const actions = buildCommitActions(
      fxSession({ resolution: "create", transfer_to_account_id: EUR_ACCOUNT }),
      FX_ACCOUNTS,
    );
    expect(stagedNetAmount(actions)).toBe(0);
    expect(actionLane(actions[0])).toBe("money");
  });
});
