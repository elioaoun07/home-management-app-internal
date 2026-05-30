import { describe, expect, it } from "vitest";
import {
  getTransactionDisplayAmount,
  getTransactionDisplayDescription,
  type TransactionForDisplay,
} from "./splitBill";

const completedSplit: TransactionForDisplay = {
  amount: 60,
  description: "Dinner",
  split_requested: true,
  split_completed_at: "2026-05-29T18:00:00.000Z",
  collaborator_amount: 40,
  collaborator_description: "Dinner share",
};

describe("getTransactionDisplayAmount", () => {
  it("returns the original amount for non-completed splits", () => {
    expect(
      getTransactionDisplayAmount(
        {
          amount: 60,
          description: "Dinner",
          split_requested: true,
          split_completed_at: null,
          collaborator_amount: 40,
        },
        "both",
      ),
    ).toBe(60);
  });

  it("shows the total amount for all/both filters", () => {
    expect(getTransactionDisplayAmount(completedSplit, "all")).toBe(100);
    expect(getTransactionDisplayAmount(completedSplit, "both")).toBe(100);
  });

  it("shows my share for owners and collaborators", () => {
    expect(
      getTransactionDisplayAmount(
        { ...completedSplit, is_owner: true },
        "mine",
      ),
    ).toBe(60);
    expect(
      getTransactionDisplayAmount(
        { ...completedSplit, is_collaborator: true },
        "mine",
      ),
    ).toBe(40);
  });

  it("shows the partner share from either side of the split", () => {
    expect(
      getTransactionDisplayAmount(
        { ...completedSplit, is_owner: true },
        "partner",
      ),
    ).toBe(40);
    expect(
      getTransactionDisplayAmount(
        { ...completedSplit, is_collaborator: true },
        "partner",
      ),
    ).toBe(60);
  });
});

describe("getTransactionDisplayDescription", () => {
  it("combines distinct split descriptions for both filters", () => {
    expect(getTransactionDisplayDescription(completedSplit, "both")).toBe(
      "Dinner | Dinner share",
    );
  });

  it("selects the relevant description for mine and partner filters", () => {
    expect(
      getTransactionDisplayDescription(
        { ...completedSplit, is_collaborator: true },
        "mine",
      ),
    ).toBe("Dinner share");
    expect(
      getTransactionDisplayDescription(
        { ...completedSplit, is_collaborator: true },
        "partner",
      ),
    ).toBe("Dinner");
  });
});
