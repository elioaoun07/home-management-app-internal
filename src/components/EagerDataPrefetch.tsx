"use client";

import { qk } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Eagerly prefetch critical data on app startup.
 * Uses the SAME query keys as the hooks so the cache is shared.
 * Skips entirely when offline — persisted cache is used instead.
 */
export function EagerDataPrefetch() {
  const queryClient = useQueryClient();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (hasPrefetched.current) return;
    // Don't prefetch when offline — use persisted cache
    if (!navigator.onLine) return;
    hasPrefetched.current = true;

    const prefetchCriticalData = async () => {
      try {
        // Critical: use SAME queryKeys as hooks (qk.accounts() etc.)
        const criticalPrefetches = [
          queryClient.prefetchQuery({
            queryKey: qk.accounts(),
            queryFn: async () => {
              const res = await fetch("/api/accounts");
              if (!res.ok) return [];
              return res.json();
            },
            staleTime: 1000 * 60 * 5,
          }),
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
          queryClient.prefetchQuery({
            queryKey: qk.sectionOrder(),
            queryFn: async () => {
              const res = await fetch("/api/user-preferences");
              if (!res.ok) return null;
              const data = await res.json();
              return data?.section_order ?? null;
            },
            staleTime: 1000 * 60 * 30,
          }),
        ];

        await Promise.allSettled(criticalPrefetches);

        // Secondary prefetches (non-blocking)
        Promise.allSettled([
          queryClient.prefetchQuery({
            queryKey: qk.drafts(),
            queryFn: async () => {
              const res = await fetch("/api/drafts");
              if (!res.ok) return [];
              return res.json();
            },
            staleTime: 1000 * 60 * 2,
          }),
          queryClient.prefetchQuery({
            queryKey: ["onboarding"],
            queryFn: async () => {
              const res = await fetch("/api/onboarding");
              if (!res.ok) return null;
              return res.json();
            },
            staleTime: 1000 * 60 * 60,
          }),
        ]);
      } catch (error) {
        console.debug("[EagerDataPrefetch] Prefetch failed:", error);
      }
    };

    prefetchCriticalData();
  }, [queryClient]);

  return null;
}
