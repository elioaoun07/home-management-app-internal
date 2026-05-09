"use client";

import { safeFetch } from "@/lib/safeFetch";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface BrainSummary {
  memoryCount: number;
  lastLabel: string | null;
  lastValue: string | null;
}

async function fetchBrainSummary(): Promise<BrainSummary> {
  try {
    const res = await safeFetch("/api/memories?limit=50", { timeoutMs: 8_000 });
    if (!res.ok) return { memoryCount: 0, lastLabel: null, lastValue: null };

    const memories: Array<{ label: string; value?: string }> = await res.json();
    return {
      memoryCount: memories.length,
      lastLabel: memories[0]?.label ?? null,
      lastValue: memories[0]?.value ?? null,
    };
  } catch {
    return { memoryCount: 0, lastLabel: null, lastValue: null };
  }
}

export function useBrainSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.brain(),
    queryFn: fetchBrainSummary,
    staleTime: CACHE_TIMES.RECURRING,
  });
}
