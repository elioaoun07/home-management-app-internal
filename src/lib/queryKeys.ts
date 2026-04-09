// src/lib/queryKeys.ts
export const qk = {
  // Per-user: keep userId in the key
  accounts: (userId?: string) => ["accounts", { userId }] as const,

  // Only current user's accounts (for transaction forms)
  myAccounts: () => ["my-accounts"] as const,

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

  // NFC tags
  nfcTags: () => ["nfc-tags"] as const,
  nfcTag: (slug: string) => ["nfc-tags", { slug }] as const,
  nfcHistory: (slug: string) => ["nfc-history", { slug }] as const,
  nfcTagItems: (slug: string) => ["nfc-tag-items", { slug }] as const,
  nfcChecklist: (slug: string) => ["nfc-checklist", { slug }] as const,

  // Analytics (Review v2, dashboard charts, balance summaries)
  analytics: () => ["analytics"] as const,
};
