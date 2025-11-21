"use client";

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
  const res = await fetch("/api/drafts", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch drafts");
  }
  const data = await res.json();
  return data.drafts || [];
}

export function useDrafts() {
  return useQuery({
    queryKey: qk.drafts(),
    queryFn: fetchDrafts,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useDraftCount() {
  const { data: drafts = [] } = useDrafts();
  return drafts.length;
}
