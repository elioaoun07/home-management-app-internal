"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

// Import default (nested) categories used as fallback
import {
  DEFAULT_CATEGORIES,
  // If your constants file exports a type for its items, keep this alias:
  // e.g., `export type Category = { id: string; name: string; icon?: string; color?: string; subcategories?: ... }`
  Category as DefaultCategory,
} from "@/constants/defaultCategories";

// Import the DB (flat) category shape
import type { Category as DbCategory } from "@/types/domain";

/** Union for the UI: either DB-flat (with parent_id) or default-nested (with subcategories[]) */
export type UICategory = DbCategory | DefaultCategory;

async function fetchCategories(accountId: string): Promise<UICategory[]> {
  const qs = new URLSearchParams({ accountId });
  const res = await fetch(`/api/categories?${qs.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to fetch categories`);
  }

  const data = (await res.json()) as unknown;

  // If API returns an empty array, fall back to the default nested categories
  if (Array.isArray(data) && data.length === 0) {
    return DEFAULT_CATEGORIES as UICategory[];
  }

  // Otherwise it’s your DB-flat list (already filtered by account & visible=true)
  return data as UICategory[];
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
