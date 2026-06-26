import { describe, expect, it } from "vitest";
import {
  aggregateCleanMonthlyByCategory,
  buildStatisticalSuggestion,
  computeCategoryBaselines,
  softClampSuggestions,
  type ForecastCategory,
  type ForecastTransaction,
} from "./budgetForecast";
import type { AiCategorySuggestion } from "@/types/budgetAllocation";

/** Established "Groceries" history: ~$50/mo over 4 months, plus one $2000 spike. */
function groceriesHistory(): ForecastTransaction[] {
  const txs: ForecastTransaction[] = [];
  let i = 0;
  for (const m of ["2026-01", "2026-02", "2026-03", "2026-04"]) {
    for (const amt of [22, 28]) {
      txs.push({
        id: `g${i++}`,
        amount: amt,
        category: "Groceries",
        description: "Corner Market",
        date: `${m}-05`,
      });
    }
  }
  txs.push({
    id: "spike",
    amount: 2000,
    category: "Groceries",
    description: "Appliance Store",
    date: "2026-04-20",
  });
  return txs;
}

const GROCERIES: ForecastCategory[] = [
  { name: "Groceries", primaryId: "cat-g", subcategories: [] },
];

describe("aggregateCleanMonthlyByCategory", () => {
  it("excludes a one-off spike from the monthly baseline", () => {
    const { monthly, excludedIds, excludedCount } =
      aggregateCleanMonthlyByCategory(groceriesHistory());

    expect(excludedCount).toBeGreaterThanOrEqual(1);
    expect(excludedIds.has("spike")).toBe(true);
    // April should reflect only the two everyday charges, not the $2000 spike.
    expect(monthly["2026-04"].Groceries).toBeCloseTo(50, 1);
  });

  it("keeps everyday charges intact", () => {
    const { monthly } = aggregateCleanMonthlyByCategory(groceriesHistory());
    expect(monthly["2026-01"].Groceries).toBeCloseTo(50, 1);
    expect(Object.keys(monthly)).toHaveLength(4);
  });
});

describe("buildStatisticalSuggestion", () => {
  it("sets each category to its typical (outlier-free) median spend", () => {
    const { monthly } = aggregateCleanMonthlyByCategory(groceriesHistory());
    const res = buildStatisticalSuggestion(GROCERIES, monthly, 1000);

    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].suggested_budget).toBeCloseTo(50, 1);
    expect(res.total_suggested).toBeCloseTo(50, 1);
  });

  it("scales the plan down to fit the wallet balance", () => {
    const { monthly } = aggregateCleanMonthlyByCategory(groceriesHistory());
    const res = buildStatisticalSuggestion(GROCERIES, monthly, 30);
    expect(res.suggestions[0].suggested_budget).toBeCloseTo(30, 1);
  });

  it("distributes a category budget across subcategories by spend share", () => {
    const txs: ForecastTransaction[] = [
      { id: "a", amount: 80, category: "Produce", description: "x", date: "2026-01-01" },
      { id: "b", amount: 20, category: "Snacks", description: "y", date: "2026-01-02" },
    ];
    const cats: ForecastCategory[] = [
      {
        name: "Groceries",
        primaryId: "cat-g",
        subcategories: [
          { name: "Produce", primaryId: "sub-p" },
          { name: "Snacks", primaryId: "sub-s" },
        ],
      },
    ];
    const { monthly } = aggregateCleanMonthlyByCategory(txs);
    const res = buildStatisticalSuggestion(cats, monthly, 1000);
    const subs = res.suggestions[0].subcategories!;
    const produce = subs.find((s) => s.subcategory_id === "sub-p")!;
    expect(produce.percentage).toBe(80);
  });
});

describe("computeCategoryBaselines", () => {
  it("returns the median monthly spend keyed by category id", () => {
    const { monthly } = aggregateCleanMonthlyByCategory(groceriesHistory());
    const baselines = computeCategoryBaselines(GROCERIES, monthly);
    expect(baselines["cat-g"]).toBeCloseTo(50, 1);
  });
});

describe("softClampSuggestions", () => {
  it("caps an inflated AI value at factor x baseline", () => {
    const sugg: AiCategorySuggestion[] = [
      { category_id: "cat-g", category_name: "Groceries", suggested_budget: 500, reasoning: "" },
    ];
    const clamped = softClampSuggestions(sugg, { "cat-g": 50 }, 2.5);
    expect(clamped[0].suggested_budget).toBeCloseTo(125, 1);
  });

  it("leaves novel categories (no baseline) untouched", () => {
    const sugg: AiCategorySuggestion[] = [
      { category_id: "cat-novel", category_name: "Gym", suggested_budget: 300, reasoning: "" },
    ];
    const clamped = softClampSuggestions(sugg, { "cat-novel": 0 }, 2.5);
    expect(clamped[0].suggested_budget).toBe(300);
  });

  it("scales subcategory amounts down with their parent", () => {
    const sugg: AiCategorySuggestion[] = [
      {
        category_id: "cat-g",
        category_name: "Groceries",
        suggested_budget: 500,
        reasoning: "",
        subcategories: [
          { subcategory_id: "s1", subcategory_name: "Produce", percentage: 100, suggested_amount: 500 },
        ],
      },
    ];
    const clamped = softClampSuggestions(sugg, { "cat-g": 50 }, 2.5);
    expect(clamped[0].subcategories![0].suggested_amount).toBeCloseTo(125, 1);
  });
});
