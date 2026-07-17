// src/lib/health/allergenMatch.test.ts
import { describe, expect, it } from "vitest";
import {
  deriveDefaultKeywords,
  matchIngredient,
  matchRecipeIngredients,
  type HouseholdAllergen,
} from "./allergenMatch";

function allergen(overrides: Partial<HouseholdAllergen>): HouseholdAllergen {
  return {
    id: "a1",
    profile_id: "p1",
    profile_name: "Elio",
    allergen: "peanut",
    severity: "severe",
    keywords: ["peanut", "peanuts", "peanut butter", "groundnut"],
    ...overrides,
  };
}

describe("deriveDefaultKeywords", () => {
  it("expands a known group", () => {
    const kw = deriveDefaultKeywords("dairy");
    expect(kw).toContain("labneh");
    expect(kw).toContain("halloumi");
    expect(kw).toContain("dairy");
  });

  it("resolves aliases to groups", () => {
    expect(deriveDefaultKeywords("milk")).toContain("labneh");
    expect(deriveDefaultKeywords("Wheat")).toContain("bulgur");
    expect(deriveDefaultKeywords("nuts")).toContain("pistachio");
  });

  it("falls back to the allergen itself for unknown terms", () => {
    expect(deriveDefaultKeywords("Strawberry")).toEqual(["strawberry"]);
  });
});

describe("matchIngredient", () => {
  const peanut = allergen({});

  it("matches inside compound ingredient names", () => {
    expect(matchIngredient("Peanut butter", [peanut])).toHaveLength(1);
    expect(matchIngredient("crushed peanuts", [peanut])).toHaveLength(1);
  });

  it("reports which term matched", () => {
    const hits = matchIngredient("smooth peanut butter", [peanut]);
    expect(hits[0]?.term).toBe("peanut");
  });

  it("does not fire on substrings inside other words", () => {
    const nut = allergen({ id: "a2", allergen: "tree nut", keywords: ["nut"] });
    expect(matchIngredient("nutmeg", [nut])).toHaveLength(0);
    expect(matchIngredient("coconut milk", [nut])).toHaveLength(0);
    expect(matchIngredient("pine nut", [nut])).toHaveLength(1);
  });

  it("matches simple plurals", () => {
    const egg = allergen({ id: "a3", allergen: "egg", keywords: ["egg"] });
    expect(matchIngredient("3 eggs", [egg])).toHaveLength(1);
  });

  it("matches Lebanese staples through seeded keywords", () => {
    const dairy = allergen({
      id: "a4",
      allergen: "dairy",
      keywords: deriveDefaultKeywords("dairy"),
    });
    expect(matchIngredient("Labneh", [dairy])).toHaveLength(1);
    const sesame = allergen({
      id: "a5",
      allergen: "sesame",
      keywords: deriveDefaultKeywords("sesame"),
    });
    expect(matchIngredient("2 tbsp tahini", [sesame])).toHaveLength(1);
  });

  it("falls back to the allergen name when keywords are empty", () => {
    const kiwi = allergen({ id: "a6", allergen: "kiwi", keywords: [] });
    expect(matchIngredient("kiwi slices", [kiwi])).toHaveLength(1);
  });

  it("ignores empty ingredient names", () => {
    expect(matchIngredient("", [peanut])).toHaveLength(0);
  });
});

describe("matchRecipeIngredients", () => {
  it("aligns per-ingredient hits and dedupes recipe-level hits", () => {
    const peanut = allergen({ id: "a1", severity: "moderate" });
    const dairy = allergen({
      id: "a2",
      allergen: "dairy",
      severity: "anaphylaxis",
      keywords: ["milk", "butter", "labneh"],
    });
    const result = matchRecipeIngredients(
      [
        { name: "peanut butter" }, // hits both (peanut + butter)
        { name: "flour" },
        { name: "milk" },
      ],
      [peanut, dairy],
    );
    expect(result.perIngredient[0]).toHaveLength(2);
    expect(result.perIngredient[1]).toHaveLength(0);
    expect(result.perIngredient[2]).toHaveLength(1);
    // deduped and sorted most-severe first
    expect(result.recipeHits.map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("returns empty results when the household has no allergies", () => {
    const result = matchRecipeIngredients([{ name: "milk" }], []);
    expect(result.recipeHits).toHaveLength(0);
  });
});
