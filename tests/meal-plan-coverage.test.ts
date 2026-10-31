import { describe, expect, it } from "vitest";
import { getMealActiveDates, mealCoversDate } from "@/lib/mealPlanCoverage";
import type { MealPlan } from "@/types/recipe";

type Facts = Pick<MealPlan, "planned_date" | "eats_through_date" | "status" | "for_user_id" | "meal_type">;
const meal = (overrides: Partial<Facts> = {}): Facts => ({
  planned_date: "2026-09-04",
  eats_through_date: "2026-09-07",
  status: "cooked",
  for_user_id: null,
  meal_type: "lunch",
  ...overrides,
});

describe("getMealActiveDates — calendar display", () => {
  it.each([
    ["leftovers inclusive", meal(), ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"]],
    ["no leftovers", meal({ eats_through_date: null }), ["2026-09-04"]],
    ["end before start shows the planned day only", meal({ eats_through_date: "2026-09-01" }), ["2026-09-04"]],
    ["skipped meals still show", meal({ status: "skipped" }), ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"]],
    ["leap day", meal({ planned_date: "2024-02-28", eats_through_date: "2024-03-01" }), ["2024-02-28", "2024-02-29", "2024-03-01"]],
    ["year boundary", meal({ planned_date: "2026-12-31", eats_through_date: "2027-01-02" }), ["2026-12-31", "2027-01-01", "2027-01-02"]],
    ["spring DST", meal({ planned_date: "2026-03-28", eats_through_date: "2026-03-30" }), ["2026-03-28", "2026-03-29", "2026-03-30"]],
    ["autumn DST", meal({ planned_date: "2026-10-24", eats_through_date: "2026-10-26" }), ["2026-10-24", "2026-10-25", "2026-10-26"]],
  ])("%s", (_, plan, expected) => {
    expect(getMealActiveDates(plan)).toEqual(expected);
  });
});

describe("mealCoversDate — who is fed on a day", () => {
  it.each([
    ["cooked leftovers cover a later day", meal(), "2026-09-06", "owner", undefined, true],
    ["planned leftovers cover", meal({ status: "planned" }), "2026-09-06", "owner", undefined, true],
    ["shopping-added meals are still planned", meal({ status: "shopping_added" }), "2026-09-06", "owner", undefined, true],
    ["skipped feeds nobody", meal({ status: "skipped" }), "2026-09-06", "owner", undefined, false],
    ["shared meals cover the partner", meal(), "2026-09-06", "partner", undefined, true],
    ["partner-only excludes the owner", meal({ for_user_id: "partner" }), "2026-09-06", "owner", undefined, false],
    ["partner-only covers the partner", meal({ for_user_id: "partner" }), "2026-09-06", "partner", undefined, true],
    ["day before the interval", meal(), "2026-09-03", "owner", undefined, false],
    ["day after the interval", meal(), "2026-09-08", "owner", undefined, false],
    ["matching slot", meal(), "2026-09-06", "owner", "lunch", true],
    ["other slot", meal(), "2026-09-06", "owner", "dinner", false],
  ] as const)("%s", (_, plan, day, viewer, slot, expected) => {
    expect(mealCoversDate(plan, day, viewer, slot)).toBe(expected);
  });

  it("leftovers older than two weeks still cover", () => {
    expect(mealCoversDate(meal({ planned_date: "2026-08-01", eats_through_date: "2026-09-07" }), "2026-09-06", "owner")).toBe(true);
  });

  it("does not mutate the meal", () => {
    const plan = Object.freeze(meal());
    getMealActiveDates(plan);
    mealCoversDate(plan, "2026-09-06", "owner");
    expect(plan).toEqual(meal());
  });
});
