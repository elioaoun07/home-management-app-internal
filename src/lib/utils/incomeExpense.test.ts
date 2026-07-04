import { describe, expect, it } from "vitest";
import type { Account } from "@/types/domain";
import {
  calculateIncomeExpenseSummary,
  calculateSavingsRate,
  getExpenseTransactions,
  getIncomeTransactions,
  getSavingTransactions,
  getSpendingTransactions,
  groupExpensesByCategory,
  spendAmount,
  sumSpending,
} from "./incomeExpense";

const accounts = [
  { id: "wallet", name: "Wallet", type: "expense" },
  { id: "salary", name: "Salary", type: "income" },
  { id: "savings", name: "Our Savings", type: "saving" },
] as Account[];

const tx = (
  id: string,
  amount: number,
  account_id: string,
  date: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  amount,
  account_id,
  date,
  category: extra.category as string | undefined,
  ...extra,
});

describe("income/expense account filtering", () => {
  it("keeps income, expense, and saving transactions in their own lanes", () => {
    const transactions = [
      tx("groceries", 35, "wallet", "2026-07-01"),
      tx("paycheck", 1200, "salary", "2026-07-01"),
      tx("stash", 200, "savings", "2026-07-01"),
    ];

    expect(
      getExpenseTransactions(transactions, accounts).map((t) => t.id),
    ).toEqual(["groceries"]);
    expect(
      getIncomeTransactions(transactions, accounts).map((t) => t.id),
    ).toEqual(["paycheck"]);
    expect(
      getSavingTransactions(transactions, accounts).map((t) => t.id),
    ).toEqual(["stash"]);
  });

  it("calculates income, expense, net, and savings rate without treating debt returns as income", () => {
    const transactions = [
      tx("paycheck", 1000, "salary", "2026-07-01"),
      tx("debt-return", 100, "salary", "2026-07-02", {
        is_debt_return: true,
      }),
      tx("food", 250, "wallet", "2026-07-02"),
      tx("shared-cost", 80, "wallet", "2026-07-03", {
        debt_id: "debt-1",
        debt_net_cost: 35,
      }),
    ];

    expect(calculateIncomeExpenseSummary(transactions, accounts)).toMatchObject(
      {
        totalIncome: 1000,
        totalExpense: 285,
        netBalance: 715,
      },
    );
    expect(calculateSavingsRate(transactions, accounts)).toBe(71.5);
  });

  it("groups only expense-account transactions by category", () => {
    const grouped = groupExpensesByCategory(
      [
        tx("groceries", 35, "wallet", "2026-07-01", { category: "Food" }),
        tx("salary-food", 999, "salary", "2026-07-01", {
          category: "Food",
        }),
        tx("misc", 10, "wallet", "2026-07-02"),
      ],
      accounts,
    );

    expect(grouped).toEqual({
      Food: {
        amount: 35,
        count: 1,
        transactions: [expect.objectContaining({ id: "groceries" })],
      },
      Uncategorized: {
        amount: 10,
        count: 1,
        transactions: [expect.objectContaining({ id: "misc" })],
      },
    });
  });
});

describe("canonical spending totals", () => {
  it("excludes income, saving, drafts, debt returns, and rows outside the inclusive window", () => {
    const transactions = [
      tx("in-window", 20, "wallet", "2026-07-03T18:30:00Z"),
      tx("negative-refund-shaped-row", -7, "wallet", "2026-07-04"),
      tx("draft", 999, "wallet", "2026-07-04", { is_draft: true }),
      tx("debt-return", 999, "wallet", "2026-07-04", {
        is_debt_return: true,
      }),
      tx("income", 999, "salary", "2026-07-04"),
      tx("saving", 999, "savings", "2026-07-04"),
      tx("before-window", 999, "wallet", "2026-07-02"),
      tx("after-window", 999, "wallet", "2026-07-05"),
    ];

    expect(
      getSpendingTransactions(transactions, accounts, {
        start: "2026-07-03",
        end: "2026-07-04",
      }).map((t) => t.id),
    ).toEqual(["in-window", "negative-refund-shaped-row"]);

    expect(
      sumSpending(transactions, accounts, {
        start: "2026-07-03",
        end: "2026-07-04",
      }),
    ).toBe(27);
  });

  it("normalizes every counted spend row to an absolute amount", () => {
    expect(spendAmount(tx("negative", -42.75, "wallet", "2026-07-03"))).toBe(
      42.75,
    );
    expect(spendAmount(tx("bad", Number.NaN, "wallet", "2026-07-03"))).toBe(0);
  });
});
