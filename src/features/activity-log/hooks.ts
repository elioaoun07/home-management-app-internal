"use client";

import { safeFetch } from "@/lib/safeFetch";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { activityLogKeys } from "./queryKeys";
import type { ActivityFilters, ActivityPage } from "./types";

export async function fetchActivityPage(
  filters: ActivityFilters,
  before: string | null,
  signal?: AbortSignal,
): Promise<ActivityPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  if (before) params.set("before", before);
  const response = await safeFetch(`/api/activity-log?${params}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
    } | null;
    if (body?.code === "ACTIVITY_SETUP_REQUIRED")
      throw new Error("Activity log is not enabled yet");
    if (response.status === 401) throw new Error("Sign in to view activity");
    throw new Error("Couldn’t load activity");
  }
  return response.json() as Promise<ActivityPage>;
}

export function useActivityLog(userId: string, filters: ActivityFilters) {
  const client = useQueryClient();
  const [authorized, setAuthorized] = useState(true);
  const query = useInfiniteQuery({
    queryKey: activityLogKeys.feed(userId, filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchActivityPage(filters, pageParam, signal);
      if (page.viewer_id !== userId)
        throw new Error("Sign in to view activity");
      return page;
    },
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: authorized,
    // No persisted/offline copy of permission-sensitive household history.
    staleTime: 0,
    gcTime: 0,
    networkMode: "always",
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    // Existing domain mutations already flow through this shared cache.
    // Remote/system writes are refreshed by polling while the page is visible.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = client.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.mutation.state.status !== "success")
        return;
      clearTimeout(timer);
      timer = setTimeout(
        () => void client.invalidateQueries({ queryKey: activityLogKeys.all }),
        150,
      );
    });
    const { data } = supabaseBrowser().auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user.id !== userId) {
          setAuthorized(false);
          void client.cancelQueries({ queryKey: activityLogKeys.all });
          client.removeQueries({ queryKey: activityLogKeys.all });
        } else setAuthorized(true);
      },
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
      data.subscription.unsubscribe();
    };
  }, [client, userId]);
  return { ...query, authorized };
}
