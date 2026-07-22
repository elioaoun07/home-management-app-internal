import { describe, expect, it } from "vitest";
import { createSearchService } from "../../scripts/pm/src/features/search/searchIndex.js";

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
