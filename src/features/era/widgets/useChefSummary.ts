"use client";

import { safeFetch } from "@/lib/safeFetch";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface ChefSummary {
  recipeCount: number;
  lastCooked: string | null;
  cuisineCount: number;
  cookedCount: number;
}

async function fetchChefSummary(): Promise<ChefSummary> {
  try {
    const res = await safeFetch("/api/recipes?limit=200", { timeoutMs: 8_000 });
    if (!res.ok) return { recipeCount: 0, lastCooked: null, cuisineCount: 0, cookedCount: 0 };

    const recipes: Array<{ name: string; cuisine?: string | null; times_cooked?: number; last_cooked_at?: string | null }> = await res.json();

    const recipeCount = recipes.length;
    const cooked = recipes
      .filter((r) => (r.times_cooked ?? 0) > 0 && r.last_cooked_at)
      .sort((a, b) => (b.last_cooked_at ?? "").localeCompare(a.last_cooked_at ?? ""));
    const cookedCount = cooked.length;

    const cuisines = new Set(recipes.map((r) => r.cuisine).filter(Boolean));
    const cuisineCount = cuisines.size;

    return { recipeCount, lastCooked: cooked[0]?.name ?? null, cuisineCount, cookedCount };
  } catch {
    return { recipeCount: 0, lastCooked: null, cuisineCount: 0, cookedCount: 0 };
  }
}

export function useChefSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.chef(),
    queryFn: fetchChefSummary,
    staleTime: CACHE_TIMES.PERMANENT,
  });
}
