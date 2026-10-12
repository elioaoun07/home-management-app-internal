"use client";

// ERA AI Usage tab data — one local month of model calls, bucketed by day.
// See aiUsage.ts for what counts.

import { safeFetch } from "@/lib/safeFetch";
import { useQuery } from "@tanstack/react-query";
import { type AiUsageResponse, aggregateAiUsage, monthBounds } from "./aiUsage";
import { eraKeys } from "./queryKeys";

export function useEraAiUsage(monthKey: string) {
  return useQuery({
    queryKey: eraKeys.aiUsage(monthKey),
    queryFn: async () => {
      const { from, to } = monthBounds(monthKey);
      const res = await safeFetch(
        `/api/era/ai-usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { timeoutMs: 8_000 },
      );
      if (!res.ok) throw new Error("Failed to load AI usage");
      return aggregateAiUsage((await res.json()) as AiUsageResponse);
    },
    staleTime: 30_000,
  });
}
