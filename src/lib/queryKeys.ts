// src/lib/queryKeys.ts
export const qk = {
  // Per-user: keep userId in the key
  accounts: (userId?: string) => ["accounts", { userId }] as const,

  // Per-account categories (so each account caches separately)
  categories: (accountId?: string) => ["categories", { accountId }] as const,

  // Optional: explicit subcategory list under a parent (if you ever use it)
  subcategories: (parentId: string) =>
    ["categories", { parentId }, "subcategories"] as const,

  // User-scoped preferences
  sectionOrder: (userId?: string) => ["section-order", { userId }] as const,

  // User-scoped templates
  templates: (userId?: string) => ["templates", { userId }] as const,

  // Draft transactions
  drafts: () => ["drafts"] as const,
};
