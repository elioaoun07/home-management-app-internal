// src/hooks/useHouseholdAllergens.ts
//
// Shared hook: the household allergen feed for recipe warnings. Lives in
// src/hooks (not the healthcare feature dir) so Recipes components can use it
// without a standalone→standalone import.
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import type { HouseholdAllergen } from "@/lib/health/allergenMatch";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { useQuery } from "@tanstack/react-query";

// Top-level key is allowlisted in STABLE_KEYS (src/app/providers.tsx) so the
// feed persists to localStorage — warnings keep working offline after restart.
export const householdAllergenKeys = {
  all: ["household-allergens"] as const,
};

async function fetchHouseholdAllergens(): Promise<HouseholdAllergen[]> {
  if (!isReallyOnline()) throw new Error("Offline");
  const res = await fetch("/api/healthcare/allergens");
  if (!res.ok) throw new Error("Failed to fetch allergens");
  const data = await res.json();
  return data.allergens ?? [];
}

export function useHouseholdAllergens() {
  return useQuery({
    queryKey: householdAllergenKeys.all,
    queryFn: fetchHouseholdAllergens,
    staleTime: CACHE_TIMES.ACCOUNTS, // 1h — allergies rarely change
    gcTime: CACHE_TIMES.PERMANENT,
    retry: (failureCount, error) =>
      error?.message === "Offline" ? false : failureCount < 2,
  });
}
