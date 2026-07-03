import { describe, it, expect } from "vitest";
import {
  scanCheckboxes,
  toggleCheckbox,
  stripNumPrefix,
  isNumbered,
  nextPrefix,
  computeRenumber,
  sanitizeBaseName,
  resolveInside,
  appendUnderHeading,
} from "../scripts/pm/mutations.mjs";

const FENCED = [
  "---",
  "type: checklist",
  "tags:",
  "  - pm/checklist",
  "---",
  "",
  "# Title",
  "",
  "- [ ] first real",
  "- [x] second real done",
  "",
  "```md",
  "- [ ] fenced fake (must be ignored)",
  "- [x] fenced fake done (must be ignored)",
  "```",
  "",
  "1. [ ] ordered real",
  "  - [x] nested real done",
].join("\n");

describe("scanCheckboxes", () => {
  it("skips frontmatter and fenced code, keeps document order with absolute lines", () => {
    const boxes = scanCheckboxes(FENCED);
    expect(boxes).toEqual([
      { line: 8, state: "open" },
      { line: 9, state: "done" },
      { line: 16, state: "open" },
      { line: 17, state: "done" },
    ]);
  });

  it("returns empty for content with no checkboxes", () => {
    expect(scanCheckboxes("# Heading\n\nJust prose.")).toEqual([]);
  });
});

describe("toggleCheckbox", () => {
  it("flips the targeted real checkbox and leaves fenced/other lines untouched", () => {
    const r = toggleCheckbox(FENCED, 0); // first real -> done
    expect(r.ok).toBe(true);
    const lines = r.raw.split("\n");
    expect(lines[8]).toBe("- [x] first real");
    expect(lines[12]).toBe("- [ ] fenced fake (must be ignored)"); // unchanged
    expect(r.state).toBe("done");
  });

  it("toggles done back to open", () => {
    const r = toggleCheckbox(FENCED, 1); // second real done -> open
    expect(r.ok).toBe(true);
    expect(r.raw.split("\n")[9]).toBe("- [ ] second real done");
    expect(r.state).toBe("open");
  });

  it("preserves indentation and bullet style on nested items", () => {
    const r = toggleCheckbox(FENCED, 3); // nested done -> open
    expect(r.ok).toBe(true);
    expect(r.raw.split("\n")[17]).toBe("  - [ ] nested real done");
  });

  it("rejects an out-of-range ordinal", () => {
    expect(toggleCheckbox(FENCED, 99)).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("rejects a stale expected state (drift guard)", () => {
    // cbidx 0 is currently open; claiming it was done means the file drifted
    expect(toggleCheckbox(FENCED, 0, "done")).toEqual({ ok: false, reason: "drift" });
  });

  it("round-trips: toggling twice restores the original text", () => {
    const once = toggleCheckbox(FENCED, 2);
    const twice = toggleCheckbox(once.raw, 2);
    expect(twice.raw).toBe(FENCED);
  });
});

describe("prefix helpers", () => {
  it("stripNumPrefix removes the numeric prefix", () => {
    expect(stripNumPrefix("3 - Action Plan")).toBe("Action Plan");
    expect(stripNumPrefix("_index")).toBe("_index");
  });

  it("isNumbered detects the prefix", () => {
    expect(isNumbered("1 - Feature State.md")).toBe(true);
    expect(isNumbered("_index.md")).toBe(false);
  });

  it("nextPrefix returns max+1", () => {
    expect(nextPrefix(["1 - A.md", "2 - B.md", "_index.md"])).toBe(3);
    expect(nextPrefix([])).toBe(1);
  });
});

describe("computeRenumber", () => {
  it("renumbers to match the new order, only emitting changed files", () => {
    const ops = computeRenumber([
      "2 - Vision & Roadmap.md", // now position 1
      "1 - Feature State.md", // now position 2
    ]);
    expect(ops).toEqual([
      { from: "2 - Vision & Roadmap.md", to: "1 - Vision & Roadmap.md" },
      { from: "1 - Feature State.md", to: "2 - Feature State.md" },
    ]);
  });

  it("is a no-op when already in order", () => {
    expect(computeRenumber(["1 - A.md", "2 - B.md"])).toEqual([]);
  });

  it("adds a prefix to a previously unnumbered file", () => {
    expect(computeRenumber(["Notes.md"])).toEqual([
      { from: "Notes.md", to: "1 - Notes.md" },
    ]);
  });
});

describe("sanitizeBaseName", () => {
  it("strips path separators and illegal characters", () => {
    expect(sanitizeBaseName("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeBaseName("a:b*c?.md")).toBe("abc.md");
    expect(sanitizeBaseName("  ..hidden  ")).toBe("hidden");
  });
});

describe("resolveInside", () => {
  const root = process.platform === "win32" ? "C:/pm" : "/pm";
  it("resolves a child path", () => {
    expect(resolveInside(root, "Budget/4 - Checklist.md").replace(/\\/g, "/")).toBe(
      root + "/Budget/4 - Checklist.md",
    );
  });
  it("throws on traversal", () => {
    expect(() => resolveInside(root, "../secret.md")).toThrow(/escapes/);
    expect(() => resolveInside(root, "Budget/../../secret.md")).toThrow(/escapes/);
  });
});

describe("appendUnderHeading", () => {
  const doc = "# Doc\n\n## Now\n\n- [ ] existing\n\n## Next\n\n- [ ] later\n";
  it("inserts at the end of the matched section", () => {
    const out = appendUnderHeading(doc, /^##\s+Now\b/i, "- [ ] fresh");
    const lines = out.split("\n");
    expect(lines.indexOf("- [ ] fresh")).toBeGreaterThan(lines.indexOf("- [ ] existing"));
    expect(lines.indexOf("- [ ] fresh")).toBeLessThan(lines.indexOf("## Next"));
  });
  it("falls back to EOF when the heading is absent", () => {
    const out = appendUnderHeading(doc, /^##\s+Nonexistent\b/i, "- [ ] tail");
    expect(out.trimEnd().endsWith("- [ ] tail")).toBe(true);
  });
});
