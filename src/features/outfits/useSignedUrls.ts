// src/features/outfits/useSignedUrls.ts
// One batched signed-URL request per screen per ~50 minutes — never one per image.
// Paths are deduped and sorted into the queryKey so different call sites with
// the same set share a cache entry. Server URLs expire at 60 min; the cache
// gives them up at 50 so a rendered <img> never holds a dead link.
"use client";

import { safeFetch } from "@/lib/safeFetch";
import { useQuery } from "@tanstack/react-query";
import { outfitKeys } from "./queryKeys";

const STALE_MS = 50 * 60_000;
const GC_MS = 55 * 60_000;
/** Server-side cap on paths per request (signed-urls route Zod max). */
const BATCH_LIMIT = 100;

export function useWardrobeImageUrls(rawPaths: Array<string | null | undefined>) {
  const paths = [...new Set(rawPaths.filter((p): p is string => !!p))]
    .sort()
    .slice(0, BATCH_LIMIT);

  const query = useQuery({
    queryKey: outfitKeys.signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: async (): Promise<Record<string, string>> => {
      const res = await safeFetch("/api/outfits/signed-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
        timeoutMs: 15_000,
      });
      if (!res.ok) throw new Error("Failed to sign image URLs");
      const data = await res.json();
      return data.urls ?? {};
    },
  });

  return {
    ...query,
    urls: query.data ?? {},
    getUrl: (path: string | null | undefined) =>
      path ? (query.data?.[path] ?? null) : null,
  };
}
