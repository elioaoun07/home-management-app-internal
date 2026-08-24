import { describe, expect, it } from "vitest";
import {
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

  it("skips transfer rows before doing any matching", () => {
    const results = reconcileStatementRows(
      [row({ description: "Transfer from USD account" })],
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
      expect(results.get("row-1"), description).toEqual({ status: "transfer" });
    }
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

    expect(results.get("row-1")).toEqual({
      status: "already_imported",
      reason: "hash",
      transaction_id: "tx-phantom",
      stored_hash: "h-fx",
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
    expect(results.get("row-1")).toEqual({ status: "unmatched" });
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
          description: "Transfer to Card",
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
      unmatched: 1,
    });
  });
});
