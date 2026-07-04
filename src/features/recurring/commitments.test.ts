import { describe, expect, it } from "vitest";
import {
  advanceRecurringPastDate,
  findRecurringTransactionMatches,
  getCustomBillingPeriod,
  getRecurringCommitmentStatus,
  type RecurringCommitmentPayment,
} from "./commitments";

const payment: RecurringCommitmentPayment = {
  id: "rec-1",
  name: "Internet Bill",
  amount: 35,
  account_id: "wallet",
  category_id: "bills",
  subcategory_id: null,
  recurrence_type: "monthly",
  recurrence_day: 15,
  next_due_date: "2026-07-15",
  last_processed_date: null,
  payment_method: "manual",
};

describe("recurring commitment billing periods", () => {
  it("builds a custom month around the configured start day", () => {
    expect(getCustomBillingPeriod("2026-07-03", 25)).toEqual({
      start: "2026-06-25",
      end: "2026-07-24",
    });
  });

  it("keeps monthly manual commitments due, not missed, inside the same billing period", () => {
    const status = getRecurringCommitmentStatus({
      payment: { ...payment, next_due_date: "2026-07-01", recurrence_day: 1 },
      today: "2026-07-03",
      monthStartDay: 1,
    });

    expect(status.status).toBe("due_this_period");
    expect(status.label).toBe("Due this period");
  });

  it("marks an old uncovered monthly commitment missed only after its billing period closes", () => {
    const status = getRecurringCommitmentStatus({
      payment: { ...payment, next_due_date: "2026-06-01", recurrence_day: 1 },
      today: "2026-07-03",
      monthStartDay: 1,
    });

    expect(status.status).toBe("missed");
  });

  it("treats a processed date inside the current custom period as covered", () => {
    const status = getRecurringCommitmentStatus({
      payment: { ...payment, last_processed_date: "2026-07-02" },
      today: "2026-07-03",
      monthStartDay: 1,
    });

    expect(status.status).toBe("covered");
    expect(status.coveredDate).toBe("2026-07-02");
  });

  it("surfaces a matching transaction as matched before confirmation", () => {
    const status = getRecurringCommitmentStatus({
      payment,
      today: "2026-07-03",
      monthStartDay: 1,
      matchedDate: "2026-07-02",
    });

    expect(status.status).toBe("matched");
  });
});

describe("advanceRecurringPastDate", () => {
  it("advances once for an early monthly payment", () => {
    expect(
      advanceRecurringPastDate({
        currentDueDate: "2026-07-15",
        recurrenceType: "monthly",
        recurrenceDay: 15,
        paidDate: "2026-07-03",
      }),
    ).toBe("2026-08-15");
  });

  it("advances past late and stale payments", () => {
    expect(
      advanceRecurringPastDate({
        currentDueDate: "2026-05-01",
        recurrenceType: "monthly",
        recurrenceDay: 1,
        paidDate: "2026-07-20",
      }),
    ).toBe("2026-08-01");
  });

  it("advances weekly payments past the paid date", () => {
    expect(
      advanceRecurringPastDate({
        currentDueDate: "2026-07-03",
        recurrenceType: "weekly",
        recurrenceDay: 5,
        paidDate: "2026-07-17",
      }),
    ).toBe("2026-07-24");
  });
});

describe("findRecurringTransactionMatches", () => {
  const period = { start: "2026-07-01", end: "2026-07-31" };

  it("matches by name, amount, account, and category", () => {
    const [match] = findRecurringTransactionMatches({
      payment,
      period,
      transactions: [
        {
          id: "tx-1",
          date: "2026-07-02",
          amount: 35,
          description: "Internet bill paid cash",
          account_id: "wallet",
          category_id: "bills",
          subcategory_id: null,
        },
      ],
    });

    expect(match.transaction.id).toBe("tx-1");
    expect(match.score).toBeGreaterThanOrEqual(55);
    expect(match.reasons).toContain("amount");
  });

  it("allows moderate amount drift when the text and category agree", () => {
    const [match] = findRecurringTransactionMatches({
      payment,
      period,
      transactions: [
        {
          id: "tx-1",
          date: "2026-07-02",
          amount: 40,
          description: "Internet",
          account_id: "wallet",
          category_id: "bills",
          subcategory_id: null,
        },
      ],
    });

    expect(match.transaction.id).toBe("tx-1");
    expect(match.reasons).toContain("near amount");
  });

  it("rejects weak matches with only category overlap", () => {
    const matches = findRecurringTransactionMatches({
      payment,
      period,
      transactions: [
        {
          id: "tx-1",
          date: "2026-07-02",
          amount: 90,
          description: "Groceries",
          account_id: "wallet",
          category_id: "bills",
          subcategory_id: null,
        },
      ],
    });

    expect(matches).toEqual([]);
  });

  it("sorts multiple candidates by confidence then recency", () => {
    const matches = findRecurringTransactionMatches({
      payment,
      period,
      transactions: [
        {
          id: "lower",
          date: "2026-07-04",
          amount: 37,
          description: "Internet",
          account_id: "wallet",
          category_id: "other",
          subcategory_id: null,
        },
        {
          id: "higher",
          date: "2026-07-02",
          amount: 35,
          description: "Internet Bill",
          account_id: "wallet",
          category_id: "bills",
          subcategory_id: null,
        },
      ],
    });

    expect(matches.map((m) => m.transaction.id)).toEqual(["higher", "lower"]);
  });
});
