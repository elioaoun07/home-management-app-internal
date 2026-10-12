"use client";

// HUB-113 — ERA's typing memory (src/lib/era/captureMemory.ts), fetched once
// the composer is in use and shared by every keystroke. A failed or offline
// read is just an empty memory: the composer still parses and asks.

import { useQuery } from "@tanstack/react-query";
import {
  EMPTY_CAPTURE_MEMORY,
  type CaptureMemory,
} from "@/lib/era/captureMemory";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { eraKeys } from "./queryKeys";

export function useEraCaptureMemory(enabled: boolean): CaptureMemory {
  const { data } = useQuery({
    queryKey: eraKeys.captureMemory(),
    queryFn: async (): Promise<CaptureMemory> => {
      const res = await safeFetch("/api/era/capture-memory");
      if (!res.ok) throw new Error((await res.text()) || "Memory unavailable");
      return (await res.json()) as CaptureMemory;
    },
    enabled,
    staleTime: CACHE_TIMES.CAPTURE_MEMORY,
    retry: false,
  });
  return data ?? EMPTY_CAPTURE_MEMORY;
}
