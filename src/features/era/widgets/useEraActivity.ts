"use client";

import { safeFetch } from "@/lib/safeFetch";
import { isToday } from "@/lib/utils/date";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface EraActivityItem {
  id: string;
  entity_type: "reminder" | "transaction" | "transfer" | "debt" | "meal_plan" | "memory";
  title: string;
  route: string;
  created_at: string;
}

async function fetchEraActivity(): Promise<EraActivityItem[]> {
  try {
    const res = await safeFetch("/api/era/actions", { timeoutMs: 8_000 });
    if (!res.ok) return [];

    const { actions } = (await res.json()) as { actions: EraActivityItem[] };
    // "Today" is a local-clock concept — filtered client-side against the
    // caller's own timezone, not on the server (see timezone-handling skill).
    return actions.filter((a) => isToday(new Date(a.created_at)));
  } catch {
    return [];
  }
}

export function useEraActivity() {
  return useQuery({
    queryKey: eraKeys.widgets.activity(),
    queryFn: fetchEraActivity,
    staleTime: 15_000,
  });
}
