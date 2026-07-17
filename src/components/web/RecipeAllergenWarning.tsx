// src/components/web/RecipeAllergenWarning.tsx
//
// Recipe ↔ Healthcare junction surface: allergen warnings computed from the
// household allergen feed against a recipe's free-text ingredients.
// Warning aid, not a guarantee — matching is keyword-based (see
// src/lib/health/allergenMatch.ts); keywords are editable on the health page.
"use client";

import {
  matchRecipeIngredients,
  SEVERITY_RANK,
  type AllergenHit,
  type RecipeAllergenResult,
} from "@/lib/health/allergenMatch";
import { useHouseholdAllergens } from "@/hooks/useHouseholdAllergens";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

const EMPTY_RESULT: RecipeAllergenResult = { perIngredient: [], recipeHits: [] };

/** Match a recipe's ingredients against every household member's allergies. */
export function useRecipeAllergenMatches(
  ingredients: Array<{ name: string }>,
): RecipeAllergenResult {
  const { data: allergens = [] } = useHouseholdAllergens();
  return useMemo(() => {
    if (!allergens.length || !ingredients.length) return EMPTY_RESULT;
    return matchRecipeIngredients(ingredients, allergens);
  }, [ingredients, allergens]);
}

function severityLabel(hits: RecipeAllergenResult["recipeHits"]): string {
  return hits
    .map((a) => `${a.allergen} (${a.profile_name})`)
    .join(", ");
}

/**
 * Recipe-level warning banner. Amber container (warning container — red is
 * reserved for anaphylaxis, allowed on containers per Hard Rule 3).
 */
export function RecipeAllergenBanner({
  ingredients,
  className,
}: {
  ingredients: Array<{ name: string }>;
  className?: string;
}) {
  const result = useRecipeAllergenMatches(ingredients);
  if (result.recipeHits.length === 0) return null;

  const worst = result.recipeHits[0];
  const critical = SEVERITY_RANK[worst.severity] >= SEVERITY_RANK.severe;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        critical
          ? "bg-red-500/10 border-red-500/30"
          : "bg-amber-500/10 border-amber-500/30",
        className,
      )}
    >
      <AlertTriangle
        className={cn(
          "w-5 h-5 shrink-0 mt-0.5",
          critical ? "text-red-400" : "text-amber-400",
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            critical ? "text-red-300" : "text-amber-300",
          )}
        >
          Contains household allergens
        </p>
        <p className="text-sm text-white/70 mt-0.5">
          {severityLabel(result.recipeHits)}
        </p>
      </div>
    </div>
  );
}

/** Inline flag next to a matched ingredient (amber — never red on rows). */
export function IngredientAllergenFlag({ hits }: { hits: AllergenHit[] }) {
  if (!hits.length) return null;
  const names = [...new Set(hits.map((h) => h.allergen.profile_name))].join(", ");
  return (
    <span
      className="inline-flex items-center gap-1 ml-2 text-amber-400 text-xs align-middle"
      title={`Allergen for ${names}`}
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      {names}
    </span>
  );
}

/** Small dot for recipe list cards: any household allergen present. */
export function RecipeCardAllergenDot({
  ingredients,
}: {
  ingredients: Array<{ name: string }>;
}) {
  const result = useRecipeAllergenMatches(ingredients);
  if (result.recipeHits.length === 0) return null;
  return (
    <span
      className="inline-flex items-center justify-center"
      title={`Contains allergens: ${severityLabel(result.recipeHits)}`}
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
    </span>
  );
}
