import type { TripDocument } from "@/types/trips";
import { queryOptions } from "@tanstack/react-query";
import { tripKeys } from "./queryKeys";

async function fetchTripDocuments(tripId: string): Promise<TripDocument[]> {
  const res = await fetch(`/api/trips/${tripId}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

/**
 * Trip documents are shared household state. The bundle primes this cache for
 * fast tab changes, but that snapshot must not suppress a fresh read when the
 * Docs tab mounts on the other household member's device.
 */
export function tripDocumentsQueryOptions(tripId: string) {
  return queryOptions({
    queryKey: tripKeys.documents(tripId),
    queryFn: () => fetchTripDocuments(tripId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    enabled: !!tripId,
  });
}
