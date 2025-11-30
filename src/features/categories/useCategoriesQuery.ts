"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

// Import the DB (flat) category shape
import type { Category as DbCategory } from "@/types/domain";

/** UI category type - only DB categories (flat with parent_id) */
export type UICategory = DbCategory;

async function fetchCategories(accountId: string): Promise<UICategory[]> {
  const qs = new URLSearchParams({ accountId });
  const res = await fetch(`/api/categories?${qs.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to fetch categories`);
  }

  const data = (await res.json()) as unknown;

  // Return DB categories only - DO NOT fall back to DEFAULT_CATEGORIES
  // Default categories have non-UUID IDs (like "cat-home-rent") that will fail
  // when used in transactions. If no categories exist, return empty array.
  return (data as UICategory[]) || [];
}

/**
 * OPTIMIZED: Categories with smart caching
 * - 1 hour staleTime (categories rarely change)
 * - No refetch on mount
 */
export function useCategories(accountId?: string) {
  return useQuery({
    queryKey: qk.categories(accountId),
    queryFn: () => fetchCategories(accountId as string),
    enabled: !!accountId,
    staleTime: CACHE_TIMES.CATEGORIES, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
