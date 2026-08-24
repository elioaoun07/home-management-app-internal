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

function tx(overrides: Partial<CandidateTx> = {}): CandidateTx {
  return {
    id: "tx-1",
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
      transfers: 1,
      unmatched: 1,
    });
  });
});
