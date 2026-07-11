// src/lib/merchantMatch.ts
// Pure matching helper shared across modules that need to look up a learned
// merchant -> category mapping from free text (Statement Import parsing,
// Transactions manual-entry auto-suggest). No DB access — callers supply the
// already-fetched mapping list.

export interface MerchantMappingLite {
  merchant_pattern: string;
  category_id: string | null;
}

/**
 * Finds the best merchant mapping for a piece of free text. Mirrors the
 * matching rules used by the statement-import parser: an exact pattern match
 * wins outright, otherwise the first mapping whose pattern is a substring of
 * (or contains) the text wins. Callers should pass mappings pre-sorted by
 * relevance (e.g. use_count desc) since ties resolve to the first match.
 */
export function matchMerchantMapping<T extends MerchantMappingLite>(
  text: string,
  mappings: T[],
): T | null {
  const query = text.trim().toUpperCase();
  if (!query) return null;

  let partialMatch: T | null = null;
  for (const mapping of mappings) {
    const pattern = mapping.merchant_pattern.trim().toUpperCase();
    if (!pattern) continue;
    if (pattern === query) return mapping;
    if (!partialMatch && (query.includes(pattern) || pattern.includes(query))) {
      partialMatch = mapping;
    }
  }
  return partialMatch;
}

export interface CategoryRef {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
}

export interface CategoryLike {
  id: string;
  name: string;
  slug?: string | null;
}

/**
 * Resolves a category reference from a merchant mapping against a category
 * list that may belong to a DIFFERENT user or account than the mapping was
 * created for. Tries exact id first (same user + account), then slug, then
 * case-insensitive name — slug matching is the Categories module's canonical
 * cross-user pattern. Returns null when nothing matches; callers skip the
 * suggestion silently in that case.
 */
export function resolveCategoryRef<T extends CategoryLike>(
  ref: CategoryRef,
  categories: T[],
): T | null {
  if (ref.id) {
    const byId = categories.find((c) => c.id === ref.id);
    if (byId) return byId;
  }
  const slug = ref.slug?.trim().toLowerCase();
  if (slug) {
    const bySlug = categories.find(
      (c) => c.slug?.trim().toLowerCase() === slug,
    );
    if (bySlug) return bySlug;
  }
  const name = ref.name?.trim().toLowerCase();
  if (name) {
    const byName = categories.find(
      (c) => c.name.trim().toLowerCase() === name,
    );
    if (byName) return byName;
  }
  return null;
}
