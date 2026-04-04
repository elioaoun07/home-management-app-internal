"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
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
    if (!isReallyOnline()) return;
    hasPrefetched.current = true;

    // Tier 1 — critical data needed for the expense form first step.
    // Fire immediately, but non-blocking (fire-and-forget).
    Promise.allSettled([
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
        queryKey: qk.sectionOrder(),
        queryFn: async () => {
          const res = await fetch("/api/user-preferences");
          if (!res.ok) return null;
          const data = await res.json();
          return data?.section_order ?? null;
        },
        staleTime: 1000 * 60 * 30,
      }),
    ]).catch(() => {});

    // Tier 2 — secondary data not needed until the user interacts with edit
    // mode or opens the drafts list. Delayed 3s to avoid bandwidth contention
    // with the critical tier on 3G connections.
    setTimeout(() => {
      if (!isReallyOnline()) return;
      Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ["accounts", { own: true, includeHidden: true }],
          queryFn: async () => {
            const res = await fetch("/api/accounts?own=true&includeHidden=true");
            if (!res.ok) return [];
            return res.json();
          },
          staleTime: 1000 * 60 * 5,
        }),
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
      ]).catch(() => {});
    }, 3000);
  }, [queryClient]);

  return null;
}
