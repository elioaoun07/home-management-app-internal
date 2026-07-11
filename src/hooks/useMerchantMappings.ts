// src/hooks/useMerchantMappings.ts
// Shared read hook for the learned merchant -> category map (owned by the
// merchant_mappings table). Lives outside src/features/statement-import so
// other standalone modules (e.g. Transactions) can reuse the data without
// importing across standalone feature directories.
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { MerchantMapping } from "@/types/statement";
import { useQuery } from "@tanstack/react-query";

export function useMerchantMappings(options?: { household?: boolean }) {
  // household: include the active partner's mappings too (cross-user matching
  // for the expense-form suggestion glow). Default false — the Merchant
  // Mappings manager and statement import only operate on the user's own rows.
  const household = options?.household ?? false;
  return useQuery({
    queryKey: qk.merchantMappings(household),
    queryFn: async (): Promise<MerchantMapping[]> => {
      const res = await fetch(
        `/api/merchant-mappings${household ? "?household=true" : ""}`,
      );
      if (!res.ok) throw new Error("Failed to fetch merchant mappings");
      return res.json();
    },
    staleTime: CACHE_TIMES.CATEGORIES,
  });
}
