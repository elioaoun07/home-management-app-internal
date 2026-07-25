// tests/pm-live-query.test.ts
// The /pm/live board and the desktop `pnpm pm` board must filter identically —
// a `m:Budget s:blocker` link sent from the laptop has to mean the same thing
// on the phone. These tests pin the TS port against the JS original for the
// five shared keys, then cover the two keys this surface adds (lane, e).
import { describe, expect, it } from "vitest";

import { matchesFilters, parseQuery, stringifyQuery, type QueryFilters } from "../src/features/pm-live/query";
import { matchesFilters as matchesFiltersJs, parseQuery as parseQueryJs } from "../scripts/pm/src/features/search/queryLang.js";
import type { PmTask } from "../src/features/pm-live/types";

function task(overrides: Partial<PmTask> = {}): PmTask {
  return {
    idChip: "BUD-12",
    text: "Fix rounding drift in allocation splits",
    severity: "blocker",
    effort: "S",
    state: "open",
    section: "Now",
    sectionRank: 0,
    cbidx: 3,
    file: "Budget/4 - Checklist.md",
    module: "Budget",
    textHash: "abc123",
    lineText: "- [ ] **BUD-12** Fix rounding drift _(blocker - S)_",
    ...overrides,
  };
}

describe("parseQuery parity with the desktop board", () => {
  const cases = [
    "",
    "rounding",
    "m:Budget",
    "m:Budget s:blocker is:open",
    'f:"4 - Checklist" drift',
    "t:task m:Schedule",
    'm:"Hub & ERA" some free text',
    "s:friction  extra   spaces",
  ];

  it.each(cases)("parses %j the same way", (input) => {
    const ours = parseQuery(input);
    const theirs = parseQueryJs(input);
    expect(ours.text).toBe(theirs.text);
    // Ours knows two extra keys; for these inputs the filter maps must match.
    expect(ours.filters).toEqual(theirs.filters);
  });

  it("matches the same tasks as the original for the five shared keys", () => {
    const subject = task();
    for (const input of cases) {
      const ours = matchesFilters(subject, parseQuery(input).filters);
      const theirs = matchesFiltersJs({ ...subject, type: "task" }, parseQueryJs(input).filters);
      expect({ input, ours }).toEqual({ input, ours: theirs });
    }
  });
});

describe("parseQuery", () => {
  it("keeps unknown prefixes as free text rather than swallowing them", () => {
    // `src/lib/x.ts:42` must stay searchable, not become a bogus `src:` filter.
    expect(parseQuery("src/lib/x.ts:42")).toEqual({ filters: {}, text: "src/lib/x.ts:42" });
  });

  it("supports quoted values and lowercases only the key", () => {
    expect(parseQuery('m:"Hub & ERA"').filters).toEqual({ m: "Hub & ERA" });
    expect(parseQuery("M:Budget").filters).toEqual({ m: "Budget" });
  });

  it("round-trips through stringifyQuery", () => {
    const input = 'm:"Hub & ERA" s:blocker lane:Now drift';
    expect(parseQuery(stringifyQuery(parseQuery(input)))).toEqual(parseQuery(input));
  });
});

describe("matchesFilters", () => {
  const cases: [string, QueryFilters, Partial<PmTask>, boolean][] = [
    ["campaign substring, case-insensitive", { m: "budg" }, {}, true],
    ["campaign mismatch", { m: "Kitchen" }, {}, false],
    ["severity is exact, not substring", { s: "block" }, {}, false],
    ["severity exact match", { s: "BLOCKER" }, {}, true],
    ["state open", { is: "open" }, {}, true],
    ["state done excludes an open task", { is: "done" }, {}, false],
    ["file substring", { f: "4 - Checklist" }, {}, true],
    ["lane match", { lane: "now" }, {}, true],
    ["lane mismatch", { lane: "Later" }, {}, false],
    ["effort match", { e: "s" }, {}, true],
    ["effort mismatch", { e: "L" }, {}, false],
    ["unrated severity never matches a severity filter", { s: "blocker" }, { severity: null }, false],
    ["unsized effort never matches an effort filter", { e: "S" }, { effort: null }, false],
    ["filters combine with AND", { m: "Budget", s: "friction" }, {}, false],
  ];

  it.each(cases)("%s", (_label, filters, overrides, expected) => {
    expect(matchesFilters(task(overrides), filters)).toBe(expected);
  });
});
