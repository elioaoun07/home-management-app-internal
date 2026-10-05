import { describe, expect, it } from "vitest";
import { summarizeTripSpend, type TripSpendRow } from "./tripSpend";

const usd = { name: "USD Card", currency: "USD", type: "expense" };
const eur = { name: "Trip EUR", currency: "EUR", type: "expense" };
const row = (id: string, amount: number, account: TripSpendRow["account"], extra: Partial<TripSpendRow> = {}): TripSpendRow => ({
  id, date: "2026-12-20", amount, description: id, is_private: false, user_id: "me", account, ...extra,
});

describe("summarizeTripSpend", () => {
  it("sums per currency without converting", () => {
    // Hotel 300 USD from the USD card + 40.50 and 9.50 EUR in the trip account
    const { totals } = summarizeTripSpend([row("a", 300, usd), row("b", 40.5, eur), row("c", 9.5, eur)], "me");
    expect(totals).toEqual([
      { currency: "USD", total: 300, count: 1 },
      { currency: "EUR", total: 50, count: 2 },
    ]);
  });

  it("counts a row returned twice once", () => {
    const { totals } = summarizeTripSpend([row("a", 10, eur), row("a", 10, eur)], "me");
    expect(totals).toEqual([{ currency: "EUR", total: 10, count: 1 }]);
  });

  it("ignores income/saving accounts", () => {
    const { totals } = summarizeTripSpend([row("a", 500, { name: "Salary", currency: "USD", type: "income" })], "me");
    expect(totals).toEqual([]);
  });

  it("keeps a partner's private amount but hides its description", () => {
    const { totals, transactions } = summarizeTripSpend([row("a", 20, usd, { is_private: true, user_id: "partner", description: "gift" })], "me");
    expect(totals[0].total).toBe(20);
    expect(transactions[0].description).toBe("");
  });
});
