import { describe, expect, it } from "vitest";
import { createSearchService } from "../../scripts/pm/src/features/search/searchIndex.js";
import { matchesFilters, parseQuery } from "../../scripts/pm/src/features/search/queryLang.js";

const file = (raw: string, mtimeMs = 1) => ({ relPath: "Budget/4 - Checklist.md", title: "Budget checklist", module: "Budget", raw, mtimeMs,
  tasks: [{ cbidx: 0, state: "open", text: raw.includes("N4") ? "N4 search target" : "R2 replacement", idChip: raw.includes("N4") ? "N4" : "R2", section: "Now", severity: "blocker" }] });

describe("PM search index", () => {
  it("builds, replaces, filters, and discards derived records", () => {
    const service = createSearchService();
    service.build([file("# Budget\n\n- [ ] **N4** search target")]);
    expect(service.search("N4").some((result) => result.type === "task")).toBe(true);
    expect(service.search("m:Budget s:blocker is:open N4")).toHaveLength(1);
    service.replace(file("# Budget\n\n- [ ] **R2** replacement", 2));
    expect(service.search("N4")).toHaveLength(0);
    expect(service.search("R2").some((result) => result.type === "task")).toBe(true);
    service.remove("Budget/4 - Checklist.md");
    expect(service.search("R2")).toHaveLength(0);
  });

  it("indexes documents with duplicate heading text", () => {
    const service = createSearchService();
    expect(() => service.build([file("# Runbook\n\n## One-time setup\n\n## One-time setup")])).not.toThrow();
    expect(service.search("one-time setup").filter((result) => result.type === "heading")).toHaveLength(2);
  });
});

describe("query language filters", () => {
  const task = (over: Record<string, unknown> = {}) => ({
    type: "task", module: "Budget", file: "Budget/4 - Checklist.md",
    idChip: "BUD-3", section: "Now", severity: "blocker", effort: "S", state: "open", ...over,
  });

  it("parses the extended field set and normalizes `effort:` to `e`", () => {
    expect(parseQuery("lane:Now e:S id:BUD-3 free text").filters).toEqual({ lane: "Now", e: "S", id: "BUD-3" });
    expect(parseQuery("effort:M").filters).toEqual({ e: "M" });
    expect(parseQuery("lane:Now some words").text).toBe("some words");
  });

  it("treats an unknown key as free text, not a filter", () => {
    const parsed = parseQuery("nope:value");
    expect(parsed.filters).toEqual({});
    expect(parsed.text).toBe("nope:value");
  });

  it("matches lane and effort exactly, case-insensitively", () => {
    expect(matchesFilters(task(), { lane: "now" })).toBe(true);
    expect(matchesFilters(task(), { lane: "next" })).toBe(false);
    expect(matchesFilters(task(), { e: "s" })).toBe(true);
    expect(matchesFilters(task(), { e: "M" })).toBe(false);
  });

  it("matches an ID chip by substring so a bare prefix narrows to a campaign", () => {
    expect(matchesFilters(task(), { id: "bud" })).toBe(true);
    expect(matchesFilters(task(), { id: "BUD-3" })).toBe(true);
    expect(matchesFilters(task(), { id: "SCH" })).toBe(false);
  });

  it("still honours the original five filters", () => {
    expect(matchesFilters(task(), { m: "budg", t: "task", s: "blocker", is: "open", f: "Checklist" })).toBe(true);
    expect(matchesFilters(task(), { is: "done" })).toBe(false);
  });
});
