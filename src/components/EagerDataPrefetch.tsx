"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Eagerly prefetch critical data on app startup
 * This runs immediately to minimize perceived loading time
 * Data is cached and reused across tabs
 */
export function EagerDataPrefetch() {
  const queryClient = useQueryClient();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    // Prefetch in parallel for faster startup
    const prefetchCriticalData = async () => {
      try {
        // These are the most critical APIs for the expense form
        const criticalPrefetches = [
          // Accounts - needed for expense form
          queryClient.prefetchQuery({
            queryKey: ["accounts"],
            queryFn: async () => {
              const res = await fetch("/api/accounts");
              if (!res.ok) return [];
              return res.json();
            },
            staleTime: 1000 * 60 * 5, // 5 minutes
          }),
          // Accounts with hidden - needed for account selection
          queryClient.prefetchQuery({
            queryKey: ["accounts", { own: true, includeHidden: true }],
            queryFn: async () => {
              const res = await fetch(
                "/api/accounts?own=true&includeHidden=true"
              );
              if (!res.ok) return [];
              return res.json();
            },
            staleTime: 1000 * 60 * 5,
          }),
          // Section order - needed for expense form step flow (from user-preferences API)
          queryClient.prefetchQuery({
            queryKey: ["section-order"],
            queryFn: async () => {
              const res = await fetch("/api/user-preferences");
              if (!res.ok) return null;
              const data = await res.json();
              return data?.section_order ?? null;
            },
            staleTime: 1000 * 60 * 30, // 30 minutes - rarely changes
          }),
        ];

        // Execute critical prefetches first
        await Promise.allSettled(criticalPrefetches);

        // Then prefetch secondary data with lower priority
        const secondaryPrefetches = [
          // Drafts - for expense tab badge
          queryClient.prefetchQuery({
            queryKey: ["drafts"],
            queryFn: async () => {
              const res = await fetch("/api/drafts");
              if (!res.ok) return [];
              return res.json();
            },
            staleTime: 1000 * 60 * 2, // 2 minutes
          }),
          // Onboarding - for first-time users
          queryClient.prefetchQuery({
            queryKey: ["onboarding"],
            queryFn: async () => {
              const res = await fetch("/api/onboarding");
              if (!res.ok) return null;
              return res.json();
            },
            staleTime: 1000 * 60 * 60, // 1 hour
          }),
        ];

        // Execute secondary prefetches (non-blocking)
        Promise.allSettled(secondaryPrefetches);
      } catch (error) {
        // Silent fail - data will be fetched on-demand
        console.debug("[EagerDataPrefetch] Prefetch failed:", error);
      }
    };

    // Start prefetch immediately
    prefetchCriticalData();
  }, [queryClient]);

  // This component renders nothing
  return null;
}
