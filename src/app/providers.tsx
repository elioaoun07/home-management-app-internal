// src/app/providers.tsx
"use client";

import { AppModeProvider } from "@/contexts/AppModeContext";
import { PrivacyBlurProvider } from "@/contexts/PrivacyBlurContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { TabProvider } from "@/contexts/TabContext";
import { ThemeProvider as ColorThemeProvider } from "@/contexts/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useMemo } from "react";
import { ThemeProvider } from "../components/theme-provider";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

const RQ_PERSIST_KEY = "hm-rq-cache-v3"; // Bumped version for new caching strategy
const STABLE_KEYS = new Set([
  "accounts",
  "categories",
  "section-order",
  "templates",
  "user-categories",
  "subcategories",
  // OPTIMIZED: Now persisting account-balance for instant UI
  // Balance is only invalidated after user mutations
  "account-balance",
  "transactions",
  "dashboard-stats",
  "user-preferences",
  "onboarding",
  "recurring-payments",
]); // Enhanced caching for all stable data

// Create persister at module level (only runs on client)
const persister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: RQ_PERSIST_KEY,
        throttleTime: 1000,
      })
    : undefined;

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // OPTIMIZED: Longer staleTime for instant tab switching
            staleTime: 1000 * 60 * 5, // 5 minutes default (most queries override this)
            gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection
            refetchOnWindowFocus: false, // Don't refetch on focus for better mobile UX
            refetchOnReconnect: true,
            refetchOnMount: false, // CRITICAL: Don't refetch on mount - use cache
            retry: (failureCount) => {
              // Don't retry when offline — fail silently, use cached data
              if (typeof navigator !== "undefined" && !navigator.onLine)
                return false;
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: 1,
            // Optimistic updates for better perceived performance
          },
        },
      }),
    [],
  );

  // Persist options for PersistQueryClientProvider
  // This ensures cache is restored from localStorage BEFORE any queries fire
  const persistOptions = useMemo(
    () =>
      persister
        ? {
            persister,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days for better offline support
            buster: "hm-v2",
            dehydrateOptions: {
              // only persist successful stable keys
              shouldDehydrateQuery: (q: {
                state: { status: string };
                queryKey?: readonly unknown[];
              }) =>
                q.state.status === "success" &&
                typeof q.queryKey?.[0] === "string" &&
                STABLE_KEYS.has(q.queryKey[0] as string),
            },
          }
        : null,
    [],
  );

  // Clear ONLY the persisted RQ cache on Supabase user switch
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cleanup: (() => void) | undefined;
    (async () => {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      );

      let currentUserId: string | null = null;
      const { data } = await supabase.auth.getUser();
      currentUserId = data.user?.id ?? null;

      const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
        const nextUserId = sess?.user?.id ?? null;
        if (nextUserId !== currentUserId) {
          try {
            localStorage.removeItem(RQ_PERSIST_KEY);
            // Clear local user preferences and theme on user switch
            localStorage.removeItem("user_preferences");
            localStorage.removeItem("hm-theme");
            // Clear all balance caches on user switch
            Object.keys(localStorage)
              .filter((key) => key.startsWith("balance_cache_"))
              .forEach((key) => localStorage.removeItem(key));
          } catch {}
          queryClient.clear();
          currentUserId = nextUserId;
        }
      });

      cleanup = () => sub.subscription.unsubscribe();
    })();

    return () => cleanup?.();
  }, [queryClient]);

  const inner = (
    <SyncProvider>
      <ColorThemeProvider>
        <PrivacyBlurProvider>
          <AppModeProvider>
            <TabProvider>
              {children}
              <ReactQueryDevtools
                initialIsOpen={false}
                buttonPosition="bottom-right"
              />
            </TabProvider>
          </AppModeProvider>
        </PrivacyBlurProvider>
      </ColorThemeProvider>
    </SyncProvider>
  );

  // PersistQueryClientProvider restores the cache from localStorage
  // BEFORE any child queries fire — fixes the "empty cache on cold start" bug.
  // When offline + cold start, queries see the restored cache instead of empty state.
  if (persistOptions) {
    return (
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          {inner}
        </PersistQueryClientProvider>
      </ThemeProvider>
    );
  }

  // SSR fallback (persister not available server-side)
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{inner}</QueryClientProvider>
    </ThemeProvider>
  );
}
