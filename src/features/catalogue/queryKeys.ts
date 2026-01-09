// src/features/catalogue/queryKeys.ts
export const catalogueKeys = {
  all: ["catalogue"] as const,

  // Modules
  modules: () => [...catalogueKeys.all, "modules"] as const,
  module: (id: string) => [...catalogueKeys.modules(), id] as const,

  // Categories
  categories: () => [...catalogueKeys.all, "categories"] as const,
  categoriesByModule: (moduleId: string) =>
    [...catalogueKeys.categories(), { moduleId }] as const,
  category: (id: string) => [...catalogueKeys.categories(), id] as const,

  // Items
  items: () => [...catalogueKeys.all, "items"] as const,
  itemsByModule: (moduleId: string) =>
    [...catalogueKeys.items(), { moduleId }] as const,
  itemsByCategory: (categoryId: string) =>
    [...catalogueKeys.items(), { categoryId }] as const,
  item: (id: string) => [...catalogueKeys.items(), id] as const,

  // Sub-items
  subItems: (itemId: string) =>
    [...catalogueKeys.all, "sub-items", { itemId }] as const,
};
