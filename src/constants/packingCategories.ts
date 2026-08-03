// src/constants/packingCategories.ts
//
// The 8 built-in packing categories. These are a code constant, never stored —
// user-added categories persist on `trips.custom_packing_categories` instead
// (see Trip type in src/types/trips.ts). Visual metadata (icons/gradients) for
// these lives alongside the CategoryCard UI in src/components/trips/TripPackingList.tsx.

export const BUILTIN_PACKING_CATEGORIES = [
  "Documents",
  "Clothes",
  "Electronics",
  "Toiletries",
  "Health",
  "Money",
  "Accessories",
  "Other",
] as const;
