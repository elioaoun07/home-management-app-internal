// src/app/providers.tsx
"use client";

import { AppModeProvider } from "@/contexts/AppModeContext";
import { PrivacyBlurProvider } from "@/contexts/PrivacyBlurContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { TabProvider } from "@/contexts/TabContext";
import { ThemeProvider as ColorThemeProvider } from "@/contexts/ThemeContext";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "../components/theme-provider";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const RQ_PERSIST_KEY = "hm-rq-cache-v3";
const STABLE_KEYS = new Set([
  "accounts",
  "categories",
  "section-order",
  "templates",
  "user-categories",
  "subcategories",
  "account-balance",
  // NOTE: "transactions" and "dashboard-stats" intentionally excluded
  // — they can be large and blow the localStorage 5MB quota,
  //   which silently destroys ALL persisted cache.
  "user-preferences",
  "onboarding",
  "recurring-payments",
]);

/**
 * Create a safe persister that wraps localStorage with error handling.
 * If JSON.stringify produces data exceeding the 5MB quota,
 * the write fails silently instead of corrupting the entire cache.
 */
function createSafePersister(): Persister {
  const inner = createSyncStoragePersister({
    storage: window.localStorage,
    key: RQ_PERSIST_KEY,
    throttleTime: 1000,
    // Custom serialize with quota-safe handling
    serialize: (data) => {
      try {
        return JSON.stringify(data);
      } catch {
        console.warn("[RQ Persist] Failed to serialize cache");
        return "{}";
      }
    },
  });

  return {
    persistClient: (client: PersistedClient) => {
      try {
        inner.persistClient(client);
      } catch (e) {
        // QuotaExceededError — localStorage full
        console.warn("[RQ Persist] Failed to persist (quota?)", e);
      }
    },
    restoreClient: () => {
      try {
        return inner.restoreClient();
      } catch (e) {
        console.warn("[RQ Persist] Failed to restore cache", e);
        // Remove corrupted cache
        try {
          localStorage.removeItem(RQ_PERSIST_KEY);
        } catch {}
        return undefined as unknown as PersistedClient;
      }
    },
    removeClient: () => {
      try {
        inner.removeClient();
      } catch {}
    },
  };
}

/** No-op persister for SSR (server has no localStorage) */
const NOOP_PERSISTER: Persister = {
  persistClient: () => {},
  restoreClient: () => undefined as unknown as PersistedClient,
  removeClient: () => {},
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: false, // Use cache, don't refetch on mount
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
          },
        },
      }),
    [],
  );

  // Create the persister lazily on the client (avoids SSR/client mismatch)
  const [persister] = useState<Persister>(() => {
    if (typeof window === "undefined") return NOOP_PERSISTER;
    return createSafePersister();
  });

  const persistOptions = useMemo(
    () => ({
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      buster: "hm-v2",
      dehydrateOptions: {
        shouldDehydrateQuery: (q: {
          state: { status: string };
          queryKey?: readonly unknown[];
        }) =>
          q.state.status === "success" &&
          typeof q.queryKey?.[0] === "string" &&
          STABLE_KEYS.has(q.queryKey[0] as string),
      },
    }),
    [persister],
  );

  // Clear persisted RQ cache on Supabase user switch
  // IMPORTANT: Use getSession() instead of getUser() — getSession() reads from
  // localStorage (cached JWT) and works offline. getUser() makes a network call
  // that fails offline and returns null, causing a false "user switched" detection
  // that wipes the entire cache.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cleanup: (() => void) | undefined;
    (async () => {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      );

      // getSession() reads the cached JWT from localStorage — works offline
      let currentUserId: string | null = null;
      const { data } = await supabase.auth.getSession();
      currentUserId = data.session?.user?.id ?? null;

      const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
        const nextUserId = sess?.user?.id ?? null;
        // Only clear cache on genuine user switch (both IDs must be non-null
        // and different, OR the user explicitly signed out → nextUserId is null)
        if (
          currentUserId !== null &&
          nextUserId !== currentUserId
        ) {
          try {
            localStorage.removeItem(RQ_PERSIST_KEY);
            localStorage.removeItem("user_preferences");
            localStorage.removeItem("hm-theme");
            Object.keys(localStorage)
              .filter((key) => key.startsWith("balance_cache_"))
              .forEach((key) => localStorage.removeItem(key));
          } catch {}
          queryClient.clear();
        }
        currentUserId = nextUserId;
      });

      cleanup = () => sub.subscription.unsubscribe();
    })();

    return () => cleanup?.();
  }, [queryClient]);

  // ALWAYS render PersistQueryClientProvider — no conditional branching.
  // This avoids SSR/client hydration mismatch.
  // On SSR the NOOP_PERSISTER does nothing; on client it restores from localStorage.
  // PersistQueryClientProvider internally blocks child queries via isRestoring
  // until the cache is fully rehydrated from localStorage.
  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
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
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
