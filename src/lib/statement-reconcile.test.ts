import { describe, expect, it } from "vitest";
import {
  classifyOwnExchange,
  classifyWithdrawal,
  extractStatementMemo,
  reconcileStatementRows,
  summarize,
  type CandidateTx,
  type StatementRowInput,
} from "./statement-reconcile";

function row(overrides: Partial<StatementRowInput> = {}): StatementRowInput {
  return {
    id: "row-1",
    date: "2026-08-12",
    description: "POS PURCHASE ROADSTER BEIRUT LB 3043",
    amount: 80,
    type: "debit",
    statement_hash: "hash-row-1",
    ...overrides,
  };
}

const ACCOUNT = "acct-statement";
const OTHER_ACCOUNT = "acct-other";

function tx(overrides: Partial<CandidateTx> = {}): CandidateTx {
  return {
    id: "tx-1",
    account_id: ACCOUNT,
    account_type: "expense",
    date: "2026-08-10",
    amount: 80,
    description: "Roadster",
    is_draft: false,
    is_debt_return: false,
    statement_hash: null,
    bank_description: null,
    category_id: "cat-food",
    subcategory_id: null,
    inserted_at: "2026-08-10T18:00:00.000Z",
    ...overrides,
  };
}

describe("reconcileStatementRows", () => {
  it("matches a tap logged 2 days before the bank posted it", () => {
    const results = reconcileStatementRows([row()], [tx()]);
    const result = results.get("row-1")!;

    expect(result).toMatchObject({
      status: "matched",
      transaction_id: "tx-1",
      kind: "confirmed",
      amount_diff: 0,
      date_diff: 2, // posted 2 days after the real purchase
    });
  });

  it("matches a same-day posting logged the next morning (forward window)", () => {
    const results = reconcileStatementRows(
      [row({ date: "2026-08-10" })],
      [tx({ date: "2026-08-11" })],
    );

    expect(results.get("row-1")).toMatchObject({
      status: "matched",
      date_diff: -1,
    });
  });

  it("does not match outside the window", () => {
    const tooOld = reconcileStatementRows(
      [row()],
      [tx({ date: "2026-08-01" })], // 11 days before posting
    );
    expect(tooOld.get("row-1")).toEqual({ status: "unmatched" });

    const tooNew = reconcileStatementRows(
      [row()],
      [tx({ date: "2026-08-15" })], // logged 3 days AFTER posting
    );
    expect(tooNew.get("row-1")).toEqual({ status: "unmatched" });
  });

  it("flags a near-amount match as probable (tip added after the tap)", () => {
    const results = reconcileStatementRows(
      [row({ amount: 83.6 })],
      [tx({ amount: 80 })],
    );

    expect(results.get("row-1")).toMatchObject({
      status: "probable",
      transaction_id: "tx-1",
      amount_diff: 3.6,
    });
  });

  it("leaves an amount beyond tolerance unmatched", () => {
    const results = reconcileStatementRows(
      [row({ amount: 120 })],
      [tx({ amount: 80 })],
    );
    expect(results.get("row-1")).toEqual({ status: "unmatched" });
  });

  it("uses a $1 floor tolerance for small amounts", () => {
    const results = reconcileStatementRows(
      [row({ amount: 3.5 })],
      [tx({ amount: 3 })], // 10% would be $0.30, the floor allows $1
    );
    expect(results.get("row-1")).toMatchObject({ status: "probable" });
  });

  it("reports a draft match with kind 'draft'", () => {
    const results = reconcileStatementRows(
      [row()],
      [tx({ is_draft: true })],
    );
    expect(results.get("row-1")).toMatchObject({
      status: "matched",
      kind: "draft",
    });
  });

  it("recognizes a re-uploaded statement by exact hash", () => {
    const results = reconcileStatementRows(
      [row()],
      [tx({ statement_hash: "hash-row-1" })],
    );
    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "hash",
      transaction_id: "tx-1",
      stored_hash: "hash-row-1",
      stored_bank_description: null,
    });
  });

  it("keeps a soft-deleted exact fingerprint from being re-imported", () => {
    const deletedAt = "2026-08-20T10:00:00.000Z";
    const results = reconcileStatementRows(
      [row()],
      [tx({ statement_hash: "hash-row-1", deleted_at: deletedAt })],
    );

    expect(results.get("row-1")).toMatchObject({
      status: "already_imported",
      reason: "hash",
      transaction_id: "tx-1",
      deleted_at: deletedAt,
    });
  });

  it("recognizes a re-import under an older hash formula as a probable duplicate", () => {
    const results = reconcileStatementRows(
      [row()],
      [tx({ statement_hash: "v1-old-formula-hash", date: "2026-08-12" })],
    );
    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "probable_duplicate",
      transaction_id: "tx-1",
      stored_hash: "v1-old-formula-hash",
      stored_bank_description: null,
    });
  });

  it("never claims one logged transaction for two statement rows", () => {
    const results = reconcileStatementRows(
      [
        row({ id: "row-a", date: "2026-08-12", statement_hash: "h-a" }),
        row({ id: "row-b", date: "2026-08-13", statement_hash: "h-b" }),
      ],
      [tx({ id: "tx-only", date: "2026-08-11" })],
    );

    const statuses = [
      results.get("row-a")!.status,
      results.get("row-b")!.status,
    ].sort();
    expect(statuses).toEqual(["matched", "unmatched"]);
  });

  it("pairs two same-amount rows with two same-amount transactions one-to-one", () => {
    const results = reconcileStatementRows(
      [
        row({ id: "row-a", date: "2026-08-12", statement_hash: "h-a" }),
        row({ id: "row-b", date: "2026-08-14", statement_hash: "h-b" }),
      ],
      [
        tx({ id: "tx-early", date: "2026-08-11" }),
        tx({ id: "tx-late", date: "2026-08-13" }),
      ],
    );

    // Closest-date wins for each, and neither transaction is used twice.
    expect(results.get("row-a")).toMatchObject({
      status: "matched",
      transaction_id: "tx-early",
    });
    expect(results.get("row-b")).toMatchObject({
      status: "matched",
      transaction_id: "tx-late",
    });
  });

  it("asks the user when two candidates are indistinguishable", () => {
    const results = reconcileStatementRows(
      [row()],
      [
        tx({ id: "tx-one", date: "2026-08-10", description: "Roadster" }),
        tx({ id: "tx-two", date: "2026-08-10", description: "Roadster" }),
      ],
    );

    const result = results.get("row-1")!;
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.transaction_id).sort()).toEqual([
        "tx-one",
        "tx-two",
      ]);
    }
  });

  it("prefers the better description match over an equally-dated rival", () => {
    const results = reconcileStatementRows(
      [row()],
      [
        tx({ id: "tx-other", date: "2026-08-10", description: "Pharmacy" }),
        tx({ id: "tx-right", date: "2026-08-10", description: "Roadster" }),
      ],
    );

    expect(results.get("row-1")).toMatchObject({
      status: "matched",
      transaction_id: "tx-right",
    });
  });

  it("skips own-account transfer rows before doing any matching", () => {
    const results = reconcileStatementRows(
      [row({ description: "Transfer from Own Account 501400630002" })],
      [tx()],
    );
    expect(results.get("row-1")).toEqual({ status: "transfer" });
  });

  // Regression: these rows used to fall through as ordinary debits/credits and
  // get written as real money. The two legs cancel on the balance, so the only
  // visible damage was phantom income and phantom spend in analytics.
  it("treats own-account FX legs as transfers, not spend or income", () => {
    const legs = [
      "Own Account Exchange: USD to EUR at 0.852 - from 501400630004 -",
      "Own Account Exchange: EUR to USD at 1.140 - to 501400630004 -",
      "Account Exchange: USD to EUR at 0.852",
      "Internal Transfer between own accounts",
    ];

    for (const description of legs) {
      const results = reconcileStatementRows([row({ description })], [tx()]);
      expect(results.get("row-1"), description).toMatchObject({
        status: "transfer",
      });
    }
  });

  // Own money on both sides -> skip. Money to or from another PERSON is real
  // spending or real income and must reach the ledger; a blanket
  // /transfer (from|to)/ rule used to swallow both.
  it("skips own-account transfers but imports person-to-person ones", () => {
    const own = [
      "Transfer from Own Account 501400630002 - toters",
      "Transfer to Own Account 501400630002 - readjust",
    ];
    for (const description of own) {
      const results = reconcileStatementRows([row({ description })], []);
      expect(results.get("row-1"), description).toMatchObject({
        status: "transfer",
      });
    }

    const people = [
      "Transfer from SALIM IBRAHIM SAADEH via Mobile -",
      "Transfer to RACHA SAMIR TOUMA via Mobile - Car",
    ];
    // Surfaced for a decision rather than swallowed — the owner says whether
    // each is household money or real spending.
    for (const description of people) {
      const results = reconcileStatementRows([row({ description })], []);
      expect(results.get("row-1"), description).toMatchObject({
        status: "person_transfer",
      });
    }
  });

  // Money between household members nets to zero across the household, so it
  // must never be written as spending — it belongs in `transfers`.
  it("separates a household transfer from a payment to an outsider", () => {
    const members = [
      { user_id: "u-elio", full_name: "Elio Aoun" },
      { user_id: "u-racha", full_name: "Racha Touma" },
    ];

    const household = reconcileStatementRows(
      [row({ description: "Transfer to RACHA SAMIR TOUMA via Mobile - Car" })],
      [],
      [],
      new Set(),
      members,
    );
    expect(household.get("row-1")).toMatchObject({
      status: "person_transfer",
      counterparty: "RACHA SAMIR TOUMA",
      direction: "out",
      household_match: true,
      existing_transfer_id: null,
      memo: "Car",
    });

    // An outsider is real spending: still surfaced, but NOT pre-selected as a
    // household movement, so it flows to the categorize list.
    const outsider = reconcileStatementRows(
      [row({ description: "Transfer to SALIM IBRAHIM SAADEH via Mobile -" })],
      [],
      [],
      new Set(),
      members,
    );
    expect(outsider.get("row-1")).toMatchObject({
      status: "person_transfer",
      household_match: false,
    });
  });

  // Transfers are the only money this feature writes outside `transactions`,
  // so before they were fingerprinted a re-imported statement re-offered every
  // one of them as brand new and the owner could move both balances twice.
  describe("transfers already created by a previous import", () => {
    const imported = [{ id: "tr-1", statement_hash: "hash-row-1" }];

    it("recognises a household transfer instead of offering it again", () => {
      const results = reconcileStatementRows(
        [row({ description: "Transfer to RACHA SAMIR TOUMA via Mobile - Car" })],
        [],
        [],
        new Set(),
        [{ user_id: "u-racha", full_name: "Racha Touma" }],
        [],
        imported,
      );

      expect(results.get("row-1")).toMatchObject({
        status: "already_imported",
        reason: "transfer_hash",
        transfer_id: "tr-1",
      });
    });

    it("recognises a cash withdrawal already moved to the wallet", () => {
      const results = reconcileStatementRows(
        [row({ description: "ATM CASH WITHDRAWAL BLOM HAMRA" })],
        [],
        [],
        new Set(),
        [],
        [],
        imported,
      );

      const result = results.get("row-1")!;
      expect(result).toMatchObject({
        status: "already_imported",
        reason: "transfer_hash",
      });
      // The flag still rides along (pass 5 stamps every row) — what changed is
      // the status underneath it, which is what decides whether an action is
      // offered.
      expect(result.withdrawal).toBeTruthy();
    });

    it("recognises the out leg of an own-account exchange", () => {
      const results = reconcileStatementRows(
        [
          row({
            description:
              "Own Account Exchange: USD to EUR at 0.852 - from 501400630004 -",
          }),
        ],
        [],
        [],
        new Set(),
        [],
        [],
        imported,
      );

      expect(results.get("row-1")).toMatchObject({
        status: "already_imported",
        reason: "transfer_hash",
      });
    });

    it("leaves a row alone when a DIFFERENT fingerprint was imported", () => {
      const results = reconcileStatementRows(
        [row({ description: "Transfer to RACHA SAMIR TOUMA via Mobile - Car" })],
        [],
        [],
        new Set(),
        [],
        [],
        [{ id: "tr-9", statement_hash: "hash-some-other-row" }],
      );

      expect(results.get("row-1")).toMatchObject({ status: "person_transfer" });
    });

    // A transaction and a transfer can never be the same money event, but if a
    // fingerprint somehow landed on both, the transaction arm wins — it is the
    // one carrying a re-key/backfill path.
    it("prefers the transaction arm when both carry the fingerprint", () => {
      const results = reconcileStatementRows(
        [row()],
        [tx({ statement_hash: "hash-row-1" })],
        [],
        new Set(),
        [],
        [],
        imported,
      );

      expect(results.get("row-1")).toMatchObject({
        status: "already_imported",
        reason: "hash",
        transaction_id: "tx-1",
      });
    });
  });

  it("reads direction from the money column, not the wording", () => {
    const members = [{ user_id: "u-elio", full_name: "Elio Aoun" }];
    const results = reconcileStatementRows(
      [
        row({
          type: "credit",
          description: "Transfer from ELIO ANTOINE AOUN via Mobile -",
        }),
      ],
      [],
      [],
      new Set(),
      members,
    );
    expect(results.get("row-1")).toMatchObject({
      status: "person_transfer",
      direction: "in",
    });
  });

  it("recognises a household movement the other side already logged", () => {
    const members = [{ user_id: "u-racha", full_name: "Racha Touma" }];
    const results = reconcileStatementRows(
      [row({ amount: 500, description: "Transfer to RACHA SAMIR TOUMA via Mobile" })],
      [],
      [],
      new Set(),
      members,
      [{ id: "tr-1", date: "2026-08-11", amount: 500 }],
    );
    expect(results.get("row-1")).toMatchObject({
      status: "person_transfer",
      existing_transfer_id: "tr-1",
    });
  });

  it("requires every name word to match before hinting household money", () => {
    // A false positive would erase real spending from every total, so a partial
    // name hit must NOT pre-select the transfer path.
    const members = [{ user_id: "u-racha", full_name: "Racha Touma" }];
    const results = reconcileStatementRows(
      [row({ description: "Transfer to RACHA SAMIR KHOURY via Mobile" })],
      [],
      [],
      new Set(),
      members,
    );
    expect(results.get("row-1")).toMatchObject({ household_match: false });
  });

  // The whole feature used to silently do nothing when `profiles` was empty.
  it("still surfaces person transfers with no household names configured", () => {
    const results = reconcileStatementRows(
      [row({ description: "Transfer to RACHA SAMIR TOUMA via Mobile - Car" })],
      [],
    );
    expect(results.get("row-1")).toMatchObject({
      status: "person_transfer",
      counterparty: "RACHA SAMIR TOUMA",
      household_match: false,
    });
  });

  it("does not mistake a real merchant for an own-account move", () => {
    // The failure that matters most: a false positive silently DROPS a real
    // expense. Bare "exchange" must never be enough on its own.
    for (const description of [
      "POS PURCHASE CURRENCY EXCHANGE HAMRA LB 3043",
      "POS PURCHASE THE EXCHANGE BOOKSHOP BEIRUT LB 1122",
    ]) {
      const results = reconcileStatementRows(
        [row({ description, amount: 999 })],
        [],
      );
      expect(results.get("row-1"), description).toEqual({ status: "unmatched" });
    }
  });

  it("reports an already-imported transfer as imported, not as a transfer", () => {
    // Hash wins over the transfer rule so phantom transfer rows written by the
    // pre-fix importer stay visible instead of hiding in the skipped bucket.
    const results = reconcileStatementRows(
      [
        row({
          description: "Own Account Exchange: USD to EUR at 0.852",
          statement_hash: "h-fx",
        }),
      ],
      [tx({ id: "tx-phantom", statement_hash: "h-fx" })],
    );

    // The `exchange` flag rides along on the REAL status, like every other
    // cross-cutting flag — an already-imported exchange is still
    // `already_imported`, so it produces no second transfer.
    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "hash",
      transaction_id: "tx-phantom",
      stored_hash: "h-fx",
      stored_bank_description: null,
      exchange: {
        from_currency: "USD",
        to_currency: "EUR",
        rate: 0.852,
        counterparty_account: null,
        direction: "out",
      },
    });
  });

  // Regression, found live on the owner's August 2025 Salary statement: a
  // $2,524 salary deposit already in the ledger came back as `unmatched` and
  // was offered as a NEW transaction. The stored row had `is_debt_return =
  // false` (what the old import route wrote for income) while the statement row
  // read as a credit, so the raw-flag comparison called it a direction
  // conflict. On an income account both encodings mean "money in" — getBalanceDelta
  // adds either way — so this must match.
  it("matches an income-account deposit whatever is_debt_return says", () => {
    for (const isDebtReturn of [false, true]) {
      const results = reconcileStatementRows(
        [row({ type: "credit", amount: 2524, description: "Incoming Payments" })],
        [
          tx({
            account_type: "income",
            is_debt_return: isDebtReturn,
            amount: 2524,
            description: "Incoming Payments",
          }),
        ],
      );
      expect(results.get("row-1"), `is_debt_return=${isDebtReturn}`).toMatchObject(
        { status: "matched", transaction_id: "tx-1" },
      );
    }
  });

  it("still refuses to match a debit row against income-account money in", () => {
    // The fix must not collapse direction entirely: an income account only ever
    // adds, so a money-OUT statement row has no counterpart there.
    const results = reconcileStatementRows(
      [row({ type: "debit", amount: 750, description: "ATM Cash Withdrawal" })],
      [
        tx({
          account_type: "income",
          is_debt_return: false,
          amount: 750,
          description: "ATM Cash Withdrawal",
        }),
      ],
    );
    expect(results.get("row-1")).toMatchObject({ status: "unmatched" });
  });

  it("recognises an income re-import by the fuzzy tier so it can be re-keyed", () => {
    const results = reconcileStatementRows(
      [row({ type: "credit", amount: 2524, statement_hash: "v2-new" })],
      [
        tx({
          account_type: "income",
          is_debt_return: false,
          amount: 2524,
          date: "2026-08-12",
          statement_hash: "v1-old",
        }),
      ],
    );
    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "probable_duplicate",
      transaction_id: "tx-1",
      stored_hash: "v1-old",
      stored_bank_description: null,
    });
  });

  it("keeps credits and debits apart", () => {
    const results = reconcileStatementRows(
      [row({ type: "credit" })],
      [tx({ is_debt_return: false })], // a normal expense, not a refund
    );
    expect(results.get("row-1")).toEqual({ status: "unmatched" });

    const refundMatched = reconcileStatementRows(
      [row({ type: "credit" })],
      [tx({ is_debt_return: true })],
    );
    expect(refundMatched.get("row-1")).toMatchObject({ status: "matched" });
  });

  it("flags a row that already exists under a different account", () => {
    const results = reconcileStatementRows(
      [row()],
      [], // nothing in the statement's own account
      [tx({ id: "tx-elsewhere", account_id: OTHER_ACCOUNT, date: "2026-08-12" })],
    );

    expect(results.get("row-1")).toEqual({
      status: "other_account",
      transaction_id: "tx-elsewhere",
      account_id: OTHER_ACCOUNT,
      description: "Roadster",
      date: "2026-08-12",
      amount: 80,
    });
  });

  it("flags on date + amount even when the wording is the owner's own", () => {
    // The mis-filing worth catching is usually hand-typed, so its description
    // is nothing like the bank's. Wording must not gate the flag.
    const results = reconcileStatementRows(
      [row()],
      [],
      [
        tx({
          id: "tx-typed",
          account_id: OTHER_ACCOUNT,
          date: "2026-08-12",
          description: "lunch with sara",
        }),
      ],
    );
    expect(results.get("row-1")).toMatchObject({
      status: "other_account",
      transaction_id: "tx-typed",
    });
  });

  it("does not flag a different-account row on a different date", () => {
    // The posting window is for same-account matching. Here the date must be
    // exact, or every recurring charge would flag against every other account.
    const results = reconcileStatementRows(
      [row()],
      [],
      [tx({ id: "tx-other-day", account_id: OTHER_ACCOUNT, date: "2026-08-09" })],
    );
    expect(results.get("row-1")).toEqual({ status: "unmatched" });
  });

  it("shows the closest-worded twin when several share date and amount", () => {
    const results = reconcileStatementRows(
      [row()],
      [],
      [
        tx({ id: "tx-far", account_id: OTHER_ACCOUNT, date: "2026-08-12", description: "pharmacy" }),
        tx({ id: "tx-near", account_id: OTHER_ACCOUNT, date: "2026-08-12", description: "Roadster Beirut" }),
      ],
    );
    expect(results.get("row-1")).toMatchObject({ transaction_id: "tx-near" });
  });

  it("recognises a row imported into another account by its fingerprint", () => {
    // The per-row account override sends a row elsewhere while the hash stays
    // keyed to the STATEMENT's account. Without a cross-account hash lookup the
    // row would come back as brand new on every future import.
    const results = reconcileStatementRows(
      [row({ statement_hash: "h-fee" })],
      [],
      [
        tx({
          id: "tx-fee",
          account_id: OTHER_ACCOUNT,
          statement_hash: "h-fee",
        }),
      ],
    );

    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "hash",
      transaction_id: "tx-fee",
      stored_hash: "h-fee",
      stored_bank_description: null,
    });
  });

  it("never lets a cross-account row be claimed as a match", () => {
    // Cross-account rows inform; they are not candidates. Matching one would
    // stamp a transaction in the wrong account with this statement's hash.
    // Date 2026-08-10 is inside the posting window but not the exact date, so
    // it is neither flagged nor matched — it is simply invisible to matching.
    const results = reconcileStatementRows(
      [row()],
      [],
      [tx({ id: "tx-elsewhere", account_id: OTHER_ACCOUNT })],
    );
    expect(results.get("row-1")).toEqual({ status: "unmatched" });
  });

  // Regression for the tier that has no one-to-one guarantee. The owner's data
  // has eight months of an identical $1.99 subscription; with `find()` a second
  // statement row would resolve to the SAME already-imported transaction and be
  // dropped as a duplicate when it is genuinely new — a missing transaction.
  it("never lets two rows claim the same already-imported transaction", () => {
    const results = reconcileStatementRows(
      [
        row({ id: "r1", statement_hash: "h1", date: "2026-08-12" }),
        row({ id: "r2", statement_hash: "h2", date: "2026-08-12" }),
      ],
      // Only ONE prior import exists for this pair of identical charges.
      [tx({ id: "tx-imported", statement_hash: "v1-hash", date: "2026-08-12" })],
    );

    expect(results.get("r1")).toMatchObject({
      status: "already_imported",
      transaction_id: "tx-imported",
    });
    // The second must NOT also resolve to tx-imported.
    expect(results.get("r2")).toEqual({ status: "unmatched" });
  });

  it("claims the closest-dated twin when several could be the duplicate", () => {
    const results = reconcileStatementRows(
      [row({ id: "r1", statement_hash: "h1", date: "2026-08-12" })],
      [
        tx({ id: "tx-far", statement_hash: "v1-a", date: "2026-08-06" }),
        tx({ id: "tx-near", statement_hash: "v1-b", date: "2026-08-11" }),
      ],
    );

    expect(results.get("r1")).toMatchObject({
      status: "already_imported",
      transaction_id: "tx-near",
      stored_hash: "v1-b",
      stored_bank_description: null,
    });
  });

  it("carries the stored fingerprint so the commit step can upgrade it", () => {
    const results = reconcileStatementRows(
      [row({ statement_hash: "v2-hash" })],
      [tx({ id: "tx-old", statement_hash: "v1-hash" })],
    );

    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "probable_duplicate",
      transaction_id: "tx-old",
      stored_hash: "v1-hash",
      stored_bank_description: null,
    });
  });

  it("summarizes a mixed batch", () => {
    const results = reconcileStatementRows(
      [
        row({ id: "r1", statement_hash: "h1" }),
        row({ id: "r2", statement_hash: "h2", amount: 999 }),
        row({
          id: "r3",
          statement_hash: "h3",
          description: "Transfer to Own Account 501400630002",
        }),
      ],
      [tx()],
    );

    expect(summarize(results)).toEqual({
      matched: 1,
      probable: 0,
      ambiguous: 0,
      already_imported: 0,
      other_account: 0,
      transfers: 1,
      person_transfers: 0,
      skipped_before: 0,
      unmatched: 1,
    });
  });

  // BUD: withdrawals were previously unhandled anywhere — they fell through
  // as an ordinary unmatched merchant row.
  it("classifies ATM and voucher withdrawals, with their real memo carried along", () => {
    const results = reconcileStatementRows(
      [
        row({
          id: "atm",
          statement_hash: "h-atm",
          description:
            "Audi ATM Cash withdrawal 05606305 BANK AUDI HOLCOM-5 BEIRUT LB 7121",
        }),
        row({
          id: "voucher",
          statement_hash: "h-voucher",
          description:
            "Voucher ATM Cash Withdrawal at BANK AUDI MANSOURIEH-6 MANSOURIEH LB for Voucher No 6755430378 - Car Insurance",
        }),
      ],
      [],
    );

    expect(results.get("atm")).toEqual({
      status: "unmatched",
      withdrawal: { kind: "atm" },
    });
    expect(results.get("voucher")).toEqual({
      status: "unmatched",
      withdrawal: { kind: "voucher" },
      memo: "Car Insurance",
    });
  });

  // A withdrawal is still whatever it really is — the flag never hides an
  // already-logged or already-imported row from its true status.
  it("keeps a withdrawal's real status when it is already imported", () => {
    const results = reconcileStatementRows(
      [
        row({
          statement_hash: "h-atm",
          description: "Audi ATM Cash withdrawal 05606305 BEIRUT LB 7121",
        }),
      ],
      [tx({ statement_hash: "h-atm" })],
    );
    expect(results.get("row-1")).toMatchObject({
      status: "already_imported",
      withdrawal: { kind: "atm" },
    });
  });

  // The bug this fixed: `skipped_before` used to BE the status, so a restored
  // row had no real classification left to route it anywhere — it stayed
  // stuck on the Skipped tab forever. Now it is a flag on top of whatever the
  // row actually is.
  it("carries skipped_before as a flag on the row's real status, not a status of its own", () => {
    const results = reconcileStatementRows(
      [row({ statement_hash: "h-skip" })],
      [tx()],
      [],
      new Set(["h-skip"]),
    );
    expect(results.get("row-1")).toMatchObject({
      status: "matched",
      transaction_id: "tx-1",
      skipped_before: true,
    });
  });
});

describe("extractStatementMemo", () => {
  it("extracts the owner's own note from the bank line", () => {
    const cases: Array<[string, string | null]> = [
      [
        "Transfer to ELIE JOSEPH AZAR via Mobile - 'link bowling - mkalles - for 2'",
        "link bowling - mkalles - for 2",
      ],
      ["Transfer to RACHA SAMIR TOUMA via Mobile - Car", "Car"],
      ["Transfer from SALIM IBRAHIM SAADEH via Mobile -", null],
      [
        "Voucher ATM Cash Withdrawal at BANK AUDI MANSOURIEH-6 MANSOURIEH LB for Voucher No 6755430378 - Car Insurance",
        "Car Insurance",
      ],
      [
        "Audi ATM Cash withdrawal 05606305 BANK AUDI HOLCOM-5 BEIRUT LB 7121",
        null,
      ],
    ];
    for (const [description, expected] of cases) {
      expect(extractStatementMemo(description), description).toBe(expected);
    }
  });
});

describe("classifyWithdrawal", () => {
  it("tells ATM and voucher withdrawals apart", () => {
    expect(
      classifyWithdrawal(
        "Audi ATM Cash withdrawal 05606305 BANK AUDI HOLCOM-5 BEIRUT LB 7121",
      ),
    ).toEqual({ kind: "atm" });
    expect(
      classifyWithdrawal(
        "Voucher ATM Cash Withdrawal at BANK AUDI MANSOURIEH-6 MANSOURIEH LB for Voucher No 6755430378 - Car Insurance",
      ),
    ).toEqual({ kind: "voucher" });
    expect(classifyWithdrawal("POS Purchase ROADSTER BEIRUT LB 3043")).toBeNull();
  });
});

describe("classifyOwnExchange", () => {
  // Verbatim from the owner's August statement (the trailing " -" is the empty
  // MONEY IN column the PDF carries through).
  const LINE = "Own Account Exchange: USD to EUR at 0.852 - to 501400630005 -";

  it("reads both currencies, the rate and the counterparty account", () => {
    expect(classifyOwnExchange(LINE, "debit")).toEqual({
      from_currency: "USD",
      to_currency: "EUR",
      rate: 0.852,
      counterparty_account: "501400630005",
      direction: "out",
    });
  });

  it("takes direction from the money column, never the wording", () => {
    // The SAME line appears on the EUR statement, as money IN. Only the column
    // distinguishes the two legs, which is why the wording cannot be trusted
    // for it — and why only the out leg is ever acted on.
    expect(classifyOwnExchange(LINE, "credit")?.direction).toBe("in");
    expect(classifyOwnExchange(LINE, "debit")?.direction).toBe("out");
  });

  it("handles the line without the account reference", () => {
    expect(
      classifyOwnExchange("Own Account Exchange: EUR to USD at 1.1735", "debit"),
    ).toMatchObject({
      from_currency: "EUR",
      to_currency: "USD",
      rate: 1.1735,
      counterparty_account: null,
    });
  });

  it("does not fire on a merchant that merely says exchange", () => {
    // The pair-and-rate shape must follow the word itself.
    expect(classifyOwnExchange("POS PURCHASE CURRENCY EXCHANGE HAMRA", "debit"))
      .toBeNull();
    expect(classifyOwnExchange("The Exchange Bookshop", "debit")).toBeNull();
    expect(
      classifyOwnExchange("Own Account Exchange: USD to EUR", "debit"),
    ).toBeNull();
  });

  it("rejects a nonsense rate rather than converting by it", () => {
    expect(
      classifyOwnExchange("Own Account Exchange: USD to EUR at 0", "debit"),
    ).toBeNull();
  });

  it("leaves a same-currency own-account move alone", () => {
    expect(
      classifyOwnExchange("Internal Transfer - to 501400630005", "debit"),
    ).toBeNull();
  });
});
