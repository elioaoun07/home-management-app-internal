// src/features/preferences/useSectionOrder.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Default order matches the database default - only used as absolute fallback
const DEFAULT_ORDER = ["amount", "account", "category", "subcategory"] as const;

export type SectionKey = (typeof DEFAULT_ORDER)[number];

// Get cached section order from localStorage for instant load
function getCachedSectionOrder(): SectionKey[] | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const raw = localStorage.getItem("user_preferences");
    if (!raw) return undefined;
    const data = JSON.parse(raw);
    if (Array.isArray(data?.section_order)) {
      return data.section_order as SectionKey[];
    }
  } catch {}
  return undefined;
}

export function useSectionOrder(
  userId?: string,
  options?: { sync?: boolean; enabled?: boolean }
) {
  const qc = useQueryClient();
  // Always fetch from server by default
  const enabled = options?.enabled ?? true;

  // Get cached order for instant display
  const cachedOrder = getCachedSectionOrder();

  return useQuery({
    queryKey: qk.sectionOrder(userId),
    queryFn: async (): Promise<SectionKey[]> => {
      const res = await fetch("/api/user-preferences");
      if (!res.ok) throw new Error("Failed to fetch section order");
      const data = await res.json();

      // Read from section_order field in user_preferences
      const arr = Array.isArray(data?.section_order)
        ? (data.section_order as string[])
        : [...DEFAULT_ORDER];

      // Filter to only known keys and ensure all are present
      const known = new Set(DEFAULT_ORDER);
      const filtered = arr.filter((k): k is SectionKey => known.has(k as any));
      const missing = DEFAULT_ORDER.filter((k) => !filtered.includes(k));
      const result = [...filtered, ...missing];

      // Cache to localStorage for faster subsequent loads
      try {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("user_preferences");
          const existing = raw ? JSON.parse(raw) : {};
          const merged = { ...existing, section_order: result };
          localStorage.setItem("user_preferences", JSON.stringify(merged));
        }
      } catch {}

      return result;
    },
    enabled,
    // OPTIMIZED: Use cache, don't refetch on mount
    staleTime: CACHE_TIMES.PREFERENCES,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Use cached order for instant UI
    initialData: cachedOrder,
  });
}

export function useUpdatePreferences(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      section_order?: SectionKey[];
      theme?: string | null;
    }) => {
      const res = await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: qk.sectionOrder(userId) });
      const previous = qc.getQueryData(qk.sectionOrder(userId));
      // Apply optimistic update in cache
      if (next.section_order) {
        qc.setQueryData(qk.sectionOrder(userId), next.section_order);
      }
      // theme is handled separately; we just mirror to localStorage below
      // Persist to localStorage for offline/local persistence
      try {
        const existingRaw =
          typeof window !== "undefined"
            ? localStorage.getItem("user_preferences")
            : null;
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = {
          ...existing,
          ...(next.section_order ? { section_order: next.section_order } : {}),
          ...("theme" in next
            ? { theme: next.theme === "" ? null : next.theme }
            : {}),
        };
        if (typeof window !== "undefined")
          localStorage.setItem("user_preferences", JSON.stringify(merged));
      } catch (e) {
        // ignore
      }
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.sectionOrder(userId), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: qk.sectionOrder(userId),
        refetchType: "active",
      });
    },
  });
}

export function useUpdateSectionOrder(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (section_order: SectionKey[]) => {
      const res = await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_order }),
      });
      if (!res.ok) throw new Error("Failed to update section order");
      return res.json();
    },
    // Optimistic local update for instant UI feedback
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: qk.sectionOrder(userId) });
      const previous = qc.getQueryData<SectionKey[]>(qk.sectionOrder(userId));
      qc.setQueryData<SectionKey[]>(qk.sectionOrder(userId), next);
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.sectionOrder(userId), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: qk.sectionOrder(userId),
        refetchType: "active",
      });
    },
  });
}
