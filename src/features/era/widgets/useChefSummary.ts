"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface CuisineSlice {
  name: string;
  count: number;
}

export interface ChefSummary {
  recipeCount: number;
  cookedCount: number;
  cuisineCount: number;
  cookedThisMonth: number;
  lastCooked: string | null;
  mostMade: { name: string; times: number } | null;
  top3Cuisines: CuisineSlice[];
}

interface RecipeRow {
  name: string;
  cuisine?: string | null;
  times_cooked?: number;
  last_cooked_at?: string | null;
}

async function fetchChefSummary(): Promise<ChefSummary> {
  const empty: ChefSummary = {
    recipeCount: 0,
    cookedCount: 0,
    cuisineCount: 0,
    cookedThisMonth: 0,
    lastCooked: null,
    mostMade: null,
    top3Cuisines: [],
  };

  try {
    const res = await safeFetch("/api/recipes?limit=200", { timeoutMs: 8_000 });
    if (!res.ok) return empty;
    const recipes: RecipeRow[] = await res.json();
    if (!Array.isArray(recipes)) return empty;

    const cooked = recipes
      .filter((r) => (r.times_cooked ?? 0) > 0 && r.last_cooked_at)
      .sort((a, b) =>
        (b.last_cooked_at ?? "").localeCompare(a.last_cooked_at ?? ""),
      );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const cookedThisMonth = recipes.filter(
      (r) => r.last_cooked_at && new Date(r.last_cooked_at) >= monthStart,
    ).length;

    const cuisineMap: Record<string, number> = {};
    for (const r of recipes) {
      const c = r.cuisine ?? "Other";
      cuisineMap[c] = (cuisineMap[c] ?? 0) + 1;
    }
    const top3Cuisines: CuisineSlice[] = Object.entries(cuisineMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const mostMadeRow = [...recipes].sort(
      (a, b) => (b.times_cooked ?? 0) - (a.times_cooked ?? 0),
    )[0];
    const mostMade =
      mostMadeRow && (mostMadeRow.times_cooked ?? 0) > 0
        ? { name: mostMadeRow.name, times: mostMadeRow.times_cooked ?? 0 }
        : null;

    return {
      recipeCount: recipes.length,
      cookedCount: cooked.length,
      cuisineCount: Object.keys(cuisineMap).length,
      cookedThisMonth,
      lastCooked: cooked[0]?.name ?? null,
      mostMade,
      top3Cuisines,
    };
  } catch {
    return empty;
  }
}

export function useChefSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.chef(),
    queryFn: fetchChefSummary,
    staleTime: CACHE_TIMES.PERMANENT,
  });
}
