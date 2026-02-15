// src/features/items/useFocusInsights.ts
// Hook for AI-powered focus insights with smart caching

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

// Types
export interface FocusItem {
  id: string;
  type: "reminder" | "event" | "task";
  title: string;
  description?: string;
  dueAt?: string;
  priority: string;
  isCompleted: boolean;
  isOverdue: boolean;
}

export interface PriorityInsight {
  itemId: string | null;
  reason: string;
  suggestedAction?: string;
}

export interface FocusInsight {
  id: string;
  greeting: string;
  summary: string;
  focusTip: string | null;
  priorityInsights: PriorityInsight[];
  patternObservations: string | null;
  encouragement: string | null;
  generatedAt: string;
  expiresAt: string;
  itemCountAtGeneration: number;
  isStale: boolean;
  newItemsSinceGeneration: number;
}

interface InsightResponse {
  insight: FocusInsight | null;
  cached: boolean;
  shouldRefresh: boolean;
  error?: string;
  retryAfterHours?: number;
}

// Query keys
export const focusInsightsKeys = {
  all: ["focus-insights"] as const,
  current: () => [...focusInsightsKeys.all, "current"] as const,
};

// Fetch cached insight
async function fetchCachedInsight(): Promise<InsightResponse> {
  const response = await fetch("/api/focus-insights", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch insights");
  }

  return response.json();
}

// Generate new insight
async function generateInsight(
  items: FocusItem[],
  forceRefresh: boolean = false,
): Promise<InsightResponse> {
  const response = await fetch("/api/focus-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, forceRefresh }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      return {
        insight: null,
        cached: false,
        shouldRefresh: false,
        error: data.error,
        retryAfterHours: data.retryAfterHours,
      };
    }
    throw new Error(data.error || "Failed to generate insights");
  }

  return data;
}

/**
 * Hook for managing AI focus insights with smart caching
 * - Fetches cached insight first
 * - Only generates new insight if cache is expired
 * - Provides manual refresh capability
 */
export function useFocusInsights(currentItems: FocusItem[]) {
  const queryClient = useQueryClient();
  const [hasTriedGeneration, setHasTriedGeneration] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Fetch cached insight
  const {
    data: cachedResponse,
    isLoading: isFetchingCache,
    error: cacheError,
  } = useQuery({
    queryKey: focusInsightsKeys.current(),
    queryFn: fetchCachedInsight,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  // Mutation for generating new insights
  const generateMutation = useMutation({
    mutationFn: ({
      items,
      forceRefresh,
    }: {
      items: FocusItem[];
      forceRefresh?: boolean;
    }) => generateInsight(items, forceRefresh),
    onSuccess: (data) => {
      if (data.insight) {
        queryClient.setQueryData(focusInsightsKeys.current(), data);
        setGenerationError(null);
      } else if (data.error) {
        setGenerationError(data.error);
      }
      setHasTriedGeneration(true);
    },
    onError: (error: Error) => {
      setGenerationError(error.message);
      setHasTriedGeneration(true);
    },
  });

  // Auto-generate if needed (only once per session)
  useEffect(() => {
    if (
      !isFetchingCache &&
      cachedResponse &&
      cachedResponse.shouldRefresh &&
      !cachedResponse.insight &&
      !hasTriedGeneration &&
      !generateMutation.isPending &&
      currentItems.length > 0
    ) {
      generateMutation.mutate({ items: currentItems });
    }
  }, [
    isFetchingCache,
    cachedResponse,
    hasTriedGeneration,
    generateMutation.isPending,
    currentItems,
    generateMutation.mutate,
  ]);

  // Manual refresh function
  const refresh = useCallback(
    (force: boolean = false) => {
      if (generateMutation.isPending) return;
      setGenerationError(null);
      generateMutation.mutate({ items: currentItems, forceRefresh: force });
    },
    [currentItems, generateMutation],
  );

  // Current insight (cached or newly generated)
  const insight = useMemo(() => {
    return cachedResponse?.insight || null;
  }, [cachedResponse]);

  // Calculate dynamic stats based on current items
  const dynamicStats = useMemo(() => {
    if (!insight) return null;

    const newItemCount = currentItems.length;
    const newItemsSince = Math.max(
      0,
      newItemCount - insight.itemCountAtGeneration,
    );

    return {
      ...insight,
      newItemsSinceGeneration: newItemsSince,
      currentItemCount: newItemCount,
    };
  }, [insight, currentItems]);

  return {
    insight: dynamicStats,
    isLoading: isFetchingCache || generateMutation.isPending,
    isFetchingCache,
    isGenerating: generateMutation.isPending,
    error: cacheError?.message || generationError,
    isStale: insight?.isStale || false,
    shouldRefresh: cachedResponse?.shouldRefresh || false,
    refresh,
    canRefresh: !generateMutation.isPending,
  };
}

/**
 * Generate fallback insights when AI is unavailable
 * These are deterministic based on current data
 */
export function generateFallbackInsights(
  items: FocusItem[],
  completedCount: number,
  overdueCount: number,
): Omit<
  FocusInsight,
  | "id"
  | "generatedAt"
  | "expiresAt"
  | "itemCountAtGeneration"
  | "isStale"
  | "newItemsSinceGeneration"
> {
  const hour = new Date().getHours();
  const upcomingCount = items.filter(
    (i) => !i.isCompleted && !i.isOverdue,
  ).length;

  // Time-based greeting
  let greeting: string;
  if (hour < 5) {
    greeting = "Burning the midnight oil? Let's make it count.";
  } else if (hour < 9) {
    greeting = "Good morning! Fresh start, fresh focus.";
  } else if (hour < 12) {
    greeting = "Mid-morning check-in. How's the flow?";
  } else if (hour < 14) {
    greeting = "Lunch break? Quick review of what's ahead.";
  } else if (hour < 17) {
    greeting = "Afternoon push! You've got this.";
  } else if (hour < 21) {
    greeting = "Evening wind-down. Let's wrap up strong.";
  } else {
    greeting = "Night owl mode. What's on your mind?";
  }

  // Context-aware summary
  let summary: string;
  if (overdueCount > 0 && upcomingCount > 0) {
    summary = `You have ${upcomingCount} upcoming item${upcomingCount !== 1 ? "s" : ""} and ${overdueCount} overdue item${overdueCount !== 1 ? "s" : ""} that need attention.`;
  } else if (overdueCount > 0) {
    summary = `${overdueCount} item${overdueCount !== 1 ? "s are" : " is"} overdue. Let's tackle ${overdueCount !== 1 ? "them" : "it"} first.`;
  } else if (upcomingCount > 0) {
    summary = `${upcomingCount} item${upcomingCount !== 1 ? "s" : ""} ahead of you. One step at a time!`;
  } else if (completedCount > 0) {
    summary = `All clear! You've completed ${completedCount} item${completedCount !== 1 ? "s" : ""} this week.`;
  } else {
    summary = "Your canvas is blank. What will you create today?";
  }

  // Focus tip based on situation
  let focusTip: string | null = null;
  if (overdueCount > 3) {
    focusTip =
      "Consider grouping similar overdue tasks and tackling them in batches.";
  } else if (overdueCount > 0) {
    focusTip = "Clear the overdue items first to lighten your mental load.";
  } else if (upcomingCount > 5) {
    focusTip = "Prioritize ruthlessly - not everything is equally important.";
  }

  // Encouragement based on progress
  let encouragement: string | null = null;
  if (completedCount > 5) {
    encouragement = `Impressive! ${completedCount} items crushed this week. Keep that momentum!`;
  } else if (completedCount > 0) {
    encouragement = `${completedCount} down, you're making progress!`;
  } else if (upcomingCount === 0 && overdueCount === 0) {
    encouragement =
      "Enjoy the clarity! Plan ahead or take a well-deserved break.";
  }

  return {
    greeting,
    summary,
    focusTip,
    priorityInsights: [],
    patternObservations: null,
    encouragement,
  };
}
