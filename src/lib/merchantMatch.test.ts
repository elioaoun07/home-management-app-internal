import { describe, expect, it } from "vitest";
import { matchMerchantMapping, resolveCategoryRef } from "./merchantMatch";

const mappings = [
  { merchant_pattern: "SPINNEYS", category_id: "cat-groceries" },
  { merchant_pattern: "UBER", category_id: "cat-transport" },
  { merchant_pattern: "NETFLIX", category_id: "cat-entertainment" },
];

describe("matchMerchantMapping", () => {
  it("matches an exact pattern (case-insensitive)", () => {
    expect(matchMerchantMapping("spinneys", mappings)?.category_id).toBe(
      "cat-groceries",
    );
  });

  it("matches when the typed text contains the pattern", () => {
    expect(
      matchMerchantMapping("Spinneys Dbayeh Metn", mappings)?.category_id,
    ).toBe("cat-groceries");
  });

  it("matches when the pattern contains the typed text", () => {
    // Guards against a user typing a longer/prefixed merchant pattern than
    // what's stored (e.g. mapping saved as "UBER TRIP")
    const longerPattern = [
      { merchant_pattern: "UBER TRIP", category_id: "cat-transport" },
    ];
    expect(matchMerchantMapping("UBER TRIP", longerPattern)?.category_id).toBe(
      "cat-transport",
    );
  });

  it("returns null when nothing matches", () => {
    expect(matchMerchantMapping("Random Merchant", mappings)).toBeNull();
  });

  it("returns null for empty/whitespace-only text", () => {
    expect(matchMerchantMapping("   ", mappings)).toBeNull();
  });

  it("prefers the first match when multiple patterns could apply", () => {
    // Mirrors the statement-import parser's use_count-desc ordering — the
    // caller is expected to pass mappings pre-sorted by relevance.
    const overlapping = [
      { merchant_pattern: "UBER EATS", category_id: "cat-food" },
      { merchant_pattern: "UBER", category_id: "cat-transport" },
    ];
    expect(matchMerchantMapping("UBER EATS EXPRESS", overlapping)?.category_id).toBe(
      "cat-food",
    );
  });
});

describe("resolveCategoryRef", () => {
  const categories = [
    { id: "own-shopping", name: "Shopping", slug: "shopping" },
    { id: "own-food", name: "Food & Dining", slug: "food-dining" },
    { id: "own-noslug", name: "Gifts" },
  ];

  it("resolves by exact id when the mapping is same-user same-account", () => {
    expect(
      resolveCategoryRef({ id: "own-food" }, categories)?.id,
    ).toBe("own-food");
  });

  it("falls back to slug when the id belongs to another account/user", () => {
    // Mapping created on the partner's (or another account's) Shopping —
    // different uuid, same slug.
    expect(
      resolveCategoryRef(
        { id: "partner-shopping", slug: "shopping", name: "Shopping" },
        categories,
      )?.id,
    ).toBe("own-shopping");
  });

  it("falls back to case-insensitive name when there is no slug match", () => {
    expect(
      resolveCategoryRef(
        { id: "partner-gifts", slug: "gifts-charity", name: "gifts" },
        categories,
      )?.id,
    ).toBe("own-noslug");
  });

  it("returns null when nothing resolves (caller skips silently)", () => {
    expect(
      resolveCategoryRef(
        { id: "partner-health", slug: "health", name: "Health" },
        categories,
      ),
    ).toBeNull();
  });
});
