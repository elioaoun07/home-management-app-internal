"use client";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";
import { useEraHousehold } from "../useEraHousehold";
import { DURABLE_EXECUTION, type EraRun } from "./state";

export function useEraRuns(conversationId: string | null) {
  const { data: household } = useEraHousehold();
  return useQuery({
    queryKey: eraKeys.runs(conversationId, household?.userId),
    enabled: DURABLE_EXECUTION && Boolean(conversationId && household?.userId),
    queryFn: async (): Promise<EraRun[]> => {
      const res = await fetch(
        `/api/era/runs?conversationId=${encodeURIComponent(conversationId!)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Couldn't load unfinished work.");
      return res.json();
    },
    staleTime: 0,
    // Poll only while this surface is mounted; this discovers another device's
    // progress without a new Realtime subscription/publication or cron worker.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
