// src/lib/health/allergenMatch.ts
//
// Pure allergen ↔ ingredient matching for recipe warnings. Lives in src/lib
// so the Recipes standalone can use it without importing from the healthcare
// feature dir (standalone-import rule).
//
// Matching contract: recipe ingredients are FREE TEXT (recipes.ingredients
// jsonb — no normalized ingredient table exists), so this is keyword matching
// with an over-warn bias. It is a warning aid, never a safety guarantee —
// keywords are stored per allergy row and user-editable to fix false
// positives/negatives.

export type AllergySeverity = "mild" | "moderate" | "severe" | "anaphylaxis";

/** Minimal shape returned by the get_household_allergens() RPC. */
export interface HouseholdAllergen {
  id: string;
  profile_id: string;
  profile_name: string;
  allergen: string;
  severity: AllergySeverity;
  keywords: string[];
}

export interface AllergenHit {
  allergen: HouseholdAllergen;
  /** The keyword that matched, for explainability in the UI. */
  term: string;
}

export const SEVERITY_RANK: Record<AllergySeverity, number> = {
  mild: 0,
  moderate: 1,
  severe: 2,
  anaphylaxis: 3,
};

// Seed synonym map — includes Lebanese kitchen staples. Used once at allergy
// creation to seed the row's editable keywords[]; matching always runs on the
// stored keywords, never on this map, so user edits always win.
export const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanut: ["peanut", "peanuts", "peanut butter", "groundnut"],
  "tree nut": [
    "almond", "walnut", "cashew", "pistachio", "hazelnut", "pecan",
    "pine nut", "snobar", "mixed nuts",
  ],
  dairy: [
    "milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "labneh",
    "laban", "ghee", "kashkaval", "halloumi", "akkawi", "mozzarella",
    "ricotta", "whey", "milk powder",
  ],
  egg: ["egg", "eggs", "egg white", "egg yolk", "mayonnaise", "mayo"],
  gluten: [
    "wheat", "flour", "bulgur", "burghul", "freekeh", "semolina", "bread",
    "breadcrumbs", "pasta", "couscous", "barley", "kaak", "markouk", "pita",
    "vermicelli",
  ],
  sesame: ["sesame", "tahini", "tahina", "halva", "halawa", "zaatar", "za'atar"],
  shellfish: [
    "shrimp", "prawn", "crab", "lobster", "squid", "calamari", "octopus",
    "mussel", "clam", "oyster",
  ],
  fish: ["fish", "tuna", "salmon", "sardine", "anchovy", "cod", "sea bass", "hamour"],
  soy: ["soy", "soya", "tofu", "soy sauce", "edamame"],
  mustard: ["mustard"],
};

// Aliases so "milk", "nuts", "wheat" as the typed allergen name resolve to
// the right synonym group.
const GROUP_ALIASES: Record<string, string> = {
  milk: "dairy",
  lactose: "dairy",
  nut: "tree nut",
  nuts: "tree nut",
  "tree nuts": "tree nut",
  wheat: "gluten",
  peanuts: "peanut",
  eggs: "egg",
  seafood: "shellfish",
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Default match keywords for a newly created allergy. Falls back to the
 * allergen name itself when it isn't a known group.
 */
export function deriveDefaultKeywords(allergen: string): string[] {
  const n = normalize(allergen);
  const group = ALLERGEN_SYNONYMS[n] ? n : GROUP_ALIASES[n];
  const base = group ? ALLERGEN_SYNONYMS[group] : null;
  const keywords = new Set(base ?? []);
  keywords.add(n);
  return [...keywords];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary match with optional plural, so "nut" never fires on "nutmeg"
// or "coconut" but "egg" fires on "eggs". Cached per term — the matcher runs
// per ingredient per allergen on recipe lists.
const termRegexCache = new Map<string, RegExp>();
function termRegex(term: string): RegExp {
  let re = termRegexCache.get(term);
  if (!re) {
    re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(term)}(e?s)?($|[^\\p{L}])`, "iu");
    termRegexCache.set(term, re);
  }
  return re;
}

/** All allergens whose keywords match one free-text ingredient name. */
export function matchIngredient(
  ingredientName: string,
  allergens: HouseholdAllergen[],
): AllergenHit[] {
  const name = normalize(ingredientName);
  if (!name) return [];
  const hits: AllergenHit[] = [];
  for (const allergen of allergens) {
    const terms = allergen.keywords.length
      ? allergen.keywords
      : [allergen.allergen];
    const matched = terms.find((t) => {
      const term = normalize(t);
      return term.length > 0 && termRegex(term).test(name);
    });
    if (matched !== undefined) hits.push({ allergen, term: normalize(matched) });
  }
  return hits;
}

export interface RecipeAllergenResult {
  /** Aligned with the input ingredients array. */
  perIngredient: AllergenHit[][];
  /** Unique allergens hit anywhere in the recipe, most severe first. */
  recipeHits: HouseholdAllergen[];
}

/** Match a whole recipe's ingredient list against the household's allergens. */
export function matchRecipeIngredients(
  ingredients: Array<{ name: string }>,
  allergens: HouseholdAllergen[],
): RecipeAllergenResult {
  const perIngredient = ingredients.map((ing) =>
    matchIngredient(ing.name, allergens),
  );
  const seen = new Map<string, HouseholdAllergen>();
  for (const hits of perIngredient) {
    for (const hit of hits) seen.set(hit.allergen.id, hit.allergen);
  }
  const recipeHits = [...seen.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
  return { perIngredient, recipeHits };
}
