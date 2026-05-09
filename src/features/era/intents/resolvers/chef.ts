// Chef resolver — searches recipes by dish name
import { safeFetch } from "@/lib/safeFetch";
import {
  formatChefError,
  formatRecipeFound,
  formatRecipeNotFound,
} from "../formatters/chef";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export async function resolveRecipeSearch(dish: string): Promise<ResolveResult> {
  try {
    const res = await safeFetch(
      `/api/recipes?search=${encodeURIComponent(dish)}&limit=1`,
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return { text: formatChefError() };

    const recipes: Array<{
      id: string;
      name: string;
      prep_time_minutes?: number | null;
      cook_time_minutes?: number | null;
      times_cooked?: number;
    }> = await res.json();

    if (!recipes.length) {
      return {
        text: formatRecipeNotFound(dish),
        metadata: { found: false, dish },
      };
    }

    const recipe = recipes[0];
    const totalMinutes =
      (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0) || null;

    return {
      text: formatRecipeFound({
        name: recipe.name,
        totalMinutes,
        timesCooked: recipe.times_cooked ?? 0,
      }),
      metadata: { found: true, recipeId: recipe.id, dish },
    };
  } catch {
    return { text: formatChefError() };
  }
}
