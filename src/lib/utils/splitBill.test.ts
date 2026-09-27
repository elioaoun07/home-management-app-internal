import { describe, expect, it } from "vitest";
import {
  getTransactionDisplayAmount,
  getTransactionDisplayDescription,
  getSuggestedSplitAmount,
  type TransactionForDisplay,
} from "./splitBill";

describe("getSuggestedSplitAmount", () => {
  it("prefills the unpaid portion of a supplied bill total", () => {
    expect(getSuggestedSplitAmount(70, 30)).toBe(40);
    expect(getSuggestedSplitAmount(12.75, 5.25)).toBe(7.5);
    expect(getSuggestedSplitAmount(0.3, 0.1)?.toFixed(2)).toBe("0.20");
  });

  it("leaves the partner's amount open when the total is absent or invalid", () => {
    expect(getSuggestedSplitAmount(null, 30)).toBeNull();
    expect(getSuggestedSplitAmount(30, 30)).toBeNull();
    expect(getSuggestedSplitAmount(20, 30)).toBeNull();
  });
});

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
