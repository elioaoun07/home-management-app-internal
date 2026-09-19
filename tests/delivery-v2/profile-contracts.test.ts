import { describe, expect, it } from "vitest";

import { recommendWorkProfile, WORK_PROFILE_CONTRACTS } from "../../scripts/delivery-v2/policy.mjs";

describe("Delivery V2 work profiles", () => {
  it("recommends Focused only for a narrow, declared item", () => {
    const recommendation = recommendWorkProfile({
      outcome: "Correct one link",
      acceptance: "The item opens its history.",
      declared: ["scripts/pm/app/Work.tsx"],
      dependencyIds: [],
    });
    expect(recommendation.profile).toBe("focused");
    expect(recommendation.contract).toEqual(WORK_PROFILE_CONTRACTS.focused);
    expect(recommendation.reasons).toEqual(["Narrow declared scope and acceptance"]);
  });

  it("escalates risk or an unknown scope to Investigate without a model call", () => {
    const risky = recommendWorkProfile({
      outcome: "Repair RLS permission policy",
      acceptance: "The partner can see the shared record.",
      declared: ["src/app/api/accounts/route.ts"],
    });
    const unknown = recommendWorkProfile({ outcome: "Make this work", declared: null });
    expect(risky.profile).toBe("investigate");
    expect(unknown.profile).toBe("investigate");
    expect(risky.source.risky).toBe(true);
  });
});
