// src/features/healthcare/queryKeys.ts
export const healthcareKeys = {
  all: ["healthcare"] as const,
  bundle: () => [...healthcareKeys.all, "bundle"] as const,
};

// The household allergen feed key lives in the shared layer
// (src/hooks/useHouseholdAllergens.ts) so Recipes can use it without a
// standalone→standalone import.
export { householdAllergenKeys } from "@/hooks/useHouseholdAllergens";
