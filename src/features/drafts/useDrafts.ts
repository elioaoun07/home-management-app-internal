"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

type DraftTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  voice_transcript: string | null;
  confidence_score: number | null;
  inserted_at: string;
  account_id: string;
  accounts: { name: string };
  category?: { name: string; icon: string } | null;
  subcategory?: { name: string } | null;
};

async function fetchDrafts(): Promise<DraftTransaction[]> {
  const res = await fetch("/api/drafts");
  if (!res.ok) {
    throw new Error("Failed to fetch drafts");
  }
  const data = await res.json();
  return data.drafts || [];
}

/**
 * OPTIMIZED: Drafts with smart caching
 * - 1 minute staleTime (may be added frequently)
 * - Refetch on window focus (user might add from another device)
 */
export function useDrafts() {
  return useQuery({
    queryKey: qk.drafts(),
    queryFn: fetchDrafts,
    staleTime: CACHE_TIMES.DRAFTS, // 1 minute
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Don't refetch on mount - use cache
  });
}

export function useDraftCount() {
  const { data: drafts = [] } = useDrafts();
  return drafts.length;
}
