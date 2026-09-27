import { describe, expect, it } from "vitest";
import { extractAmount } from "./amount";
import { parseMessageForTransaction } from "./messageTransactionParser";
import { parseSpeechExpense } from "./speechExpense";

describe("extractAmount (HUB-75)", () => {
  it.each([
    ["spent 12$ on coffee", 12, "USD"],
    ["paid 300$", 300, "USD"],
    ["coffee 4$", 4, "USD"],
    ["I paid $25 on fuel", 25, "USD"],
    ["$ 20 fuel", 20, "USD"],
    ["I paid $2,000 for rent", 2000, "USD"],
    ["500k lbp groceries", 500000, "LBP"],
    ["lbp 50000 bread", 50000, "LBP"],
    ["1.5k ll taxi", 1500, "LBP"],
    ["20 euros lunch", 20, "EUR"],
    ["12,50€ croissant", 12.5, "EUR"],
    ["spent 12$ 5 times", 12, "USD"],
  ] as const)("%s → %d %s", (text, value, currency) => {
    expect(extractAmount(text)).toMatchObject({ value, currency, marked: true });
  });

  it.each([
    ["spent 40 on groceries", 40],
    ["I spent 25", 25],
    ["spent 500k on the car", 500000],
    ["I bought it for 30", 30],
  ] as const)("positional: %s → %s", (text, value) => {
    expect(extractAmount(text)?.value).toBe(value);
  });

  it("flags k shorthand without a marker", () => {
    expect(extractAmount("spent 500k on the car")).toMatchObject({
      currency: null,
      marked: false,
      kShorthand: true,
    });
  });

  it.each(["spent 2 hours studying", "I bought 2 shirts", "ran 5km", "bought 2kg rice"])(
    "no amount without a marker or money position: %s",
    (text) => {
      expect(extractAmount(text)).toBeUndefined();
    },
  );

  it("bare fallback is opt-in", () => {
    expect(extractAmount("20 fuel today")).toBeUndefined();
    expect(extractAmount("20 fuel today", { allowBare: true })?.value).toBe(20);
  });
});

describe("Hub messageTransactionParser shares the extractor", () => {
  it.each([
    ["spent 12$ on coffee", 12, "USD"],
    ["Don't forget to add 20$ as fuel today", 20, "USD"],
    ["500k lbp groceries", 500000, "LBP"],
    ["20 fuel today", 20, null],
  ] as const)("%s → %d", (text, amount, currency) => {
    const parsed = parseMessageForTransaction(text, []);
    expect(parsed.amount).toBe(amount);
    expect(parsed.currency).toBe(currency);
  });

  it("no number → null", () => {
    expect(parseMessageForTransaction("buy milk", []).amount).toBeNull();
  });
});

describe("speechExpense reads k shorthand", () => {
  it("500k lbp groceries → 500000", () => {
    expect(parseSpeechExpense("500k lbp groceries", []).amount).toBe(500000);
  });
  it("spent 12$ on coffee → 12", () => {
    expect(parseSpeechExpense("spent 12$ on coffee", []).amount).toBe(12);
  });
  // HUB-77 Gym: the draft write path split "2,000" at the comma and drafted $2.
  it("paid $2,000 for rent → 2000 (thousands comma is not a separator)", () => {
    expect(parseSpeechExpense("paid $2,000 for rent", []).amount).toBe(2000);
    expect(parseSpeechExpense("I paid $1,234,567 for the house", []).amount).toBe(1234567);
  });
  it("a list comma still separates", () => {
    expect(parseSpeechExpense("coffee, 12 dollars", []).amount).toBe(12);
  });
});
