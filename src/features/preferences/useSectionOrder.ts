// src/features/preferences/useSectionOrder.ts
"use client";

import { qk } from "@/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const DEFAULT_ORDER = ["account", "category", "subcategory", "amount"] as const;

export type SectionKey = (typeof DEFAULT_ORDER)[number];

function getLocalSectionOrder(): SectionKey[] {
  try {
    if (typeof window === "undefined") return [...DEFAULT_ORDER];
    const raw = localStorage.getItem("user_preferences");
    const parsed = raw ? JSON.parse(raw) : {};
    const arr = Array.isArray(parsed?.section_order)
      ? (parsed.section_order as string[])
      : [...DEFAULT_ORDER];
    const known = new Set(DEFAULT_ORDER);
    const filtered = arr.filter((k): k is SectionKey => known.has(k as any));
    const missing = DEFAULT_ORDER.filter((k) => !filtered.includes(k));
    const result = [...filtered, ...missing];
    // Ensure persisted for next time
    const merged = { ...parsed, section_order: result };
    localStorage.setItem("user_preferences", JSON.stringify(merged));
    return result;
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export function useSectionOrder(
  userId?: string,
  options?: { sync?: boolean; enabled?: boolean }
) {
  const qc = useQueryClient();
  const syncEnabled = options?.sync === true && (options?.enabled ?? true);

  // After mount on the client, load local order and update cache
  useEffect(() => {
    if (typeof window === "undefined") return;
    const local = getLocalSectionOrder();
    qc.setQueryData(qk.sectionOrder(userId), local);
  }, [qc, userId]);

  return useQuery({
    queryKey: qk.sectionOrder(userId),
    queryFn: async (): Promise<SectionKey[]> => {
      // Only called when syncEnabled = true
      const res = await fetch("/api/user-preferences", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch section order");
      const data = await res.json();
      const arr = Array.isArray(data?.section_order)
        ? (data.section_order as string[])
        : DEFAULT_ORDER.slice();
      const known = new Set(DEFAULT_ORDER);
      const filtered = arr.filter((k): k is SectionKey => known.has(k as any));
      const missing = DEFAULT_ORDER.filter((k) => !filtered.includes(k));
      const result = [...filtered, ...missing];
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
    initialData: DEFAULT_ORDER.slice(),
    enabled: syncEnabled,
    // rely on global defaults for other options
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
