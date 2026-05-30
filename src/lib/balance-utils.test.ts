import { describe, expect, it } from "vitest";
import { getBalanceDelta, getTransferDeltas } from "./balance-utils";

describe("getBalanceDelta", () => {
  it("subtracts created transactions from expense accounts", () => {
    expect(getBalanceDelta(42.5, "expense", false, "create")).toBe(-42.5);
  });

  it("adds created transactions to income and saving accounts", () => {
    expect(getBalanceDelta(1200, "income", false, "create")).toBe(1200);
    expect(getBalanceDelta(300, "saving", false, "create")).toBe(300);
  });

  it("adds debt returns regardless of account type", () => {
    expect(getBalanceDelta(75, "expense", true, "create")).toBe(75);
    expect(getBalanceDelta(75, "income", true, "create")).toBe(75);
  });

  it("reverses the original impact when deleting a transaction", () => {
    expect(getBalanceDelta(42.5, "expense", false, "delete")).toBe(42.5);
    expect(getBalanceDelta(1200, "income", false, "delete")).toBe(-1200);
    expect(getBalanceDelta(75, "expense", true, "delete")).toBe(-75);
  });

  it("supports running balance calculations from a sequence of transactions", () => {
    const initialBalance = 500;
    const transactions = [
      getBalanceDelta(50, "expense", false, "create"),
      getBalanceDelta(25, "expense", true, "create"),
      getBalanceDelta(10, "expense", false, "delete"),
    ];

    const runningBalance = transactions.reduce(
      (balance, delta) => balance + delta,
      initialBalance,
    );

    expect(runningBalance).toBe(485);
  });
});

describe("getTransferDeltas", () => {
  it("moves the full amount for self transfers", () => {
    expect(getTransferDeltas(200)).toEqual({ fromDelta: -200, toDelta: 200 });
  });

  it("moves only the net amount for household transfers with a return", () => {
    expect(getTransferDeltas(200, 65, "household")).toEqual({
      fromDelta: -135,
      toDelta: 135,
    });
  });
});
