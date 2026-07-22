import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../scripts/pm/shared/frontmatter.mjs";
import { extractLinks, resolveRelativeMd, slugify } from "../../scripts/pm/shared/links.mjs";
import { fileTasks, parseTaskMeta } from "../../scripts/pm/shared/tasks.mjs";
import { parseMarkdown } from "../../scripts/pm/src/lib/md-parse.js";
import { fuzzyScore } from "../../scripts/pm/src/lib/fuzzy.js";
import { parseQuery } from "../../scripts/pm/src/features/search/queryLang.js";
import { legacyRouteToHash, parseRoute } from "../../scripts/pm/src/app/router.js";

describe("PM shared parsing", () => {
  it("keeps frontmatter, fences, nested checkboxes and task metadata straight", () => {
    const raw = `---\nstatus: active\ntags:\n  - pm\n---\n## Now\n- [ ] **N4** Build it _(blocker - S)_\n  - [x] nested\n\`\`\`md\n- [ ] not real\n\`\`\``;
    expect(parseFrontmatter(raw).meta).toEqual({ status: "active", tags: ["pm"] });
    expect(fileTasks(raw).map((task) => [task.cbidx, task.idChip, task.state])).toEqual([[0, "N4", "open"], [1, null, "done"]]);
    expect(parseMarkdown(raw).flatMap((block) => block.type === "list" ? block.items : []).filter((item) => item?.checkbox)).toHaveLength(2);
    expect(parseTaskMeta("**N4** Build it _(blocker - S)_").severity).toBe("blocker");
  });

  it("parses canonical prefixed / hyphenated / lettered IDs", () => {
    expect(parseTaskMeta("**BUD-3** Merchant-match voice drafts _(annoyance - S)_").idChip).toBe("BUD-3");
    expect(parseTaskMeta("**SCH-1c.1** Wire Gemini capture _(friction - M)_").idChip).toBe("SCH-1C.1");
    expect(parseTaskMeta("**NOTIF-6.6** Live-verify calendar sync _(friction - M)_").idChip).toBe("NOTIF-6.6");
    expect(parseTaskMeta("**SCH-4.3b** Engine/UI unification _(friction - L)_").idChip).toBe("SCH-4.3B");
    // legacy shapes still parse (backward compatible)
    expect(parseTaskMeta("**R8.2** Real-device check _(friction - S)_").idChip).toBe("R8.2");
    expect(parseTaskMeta("**X2a** Merchant map _(annoyance - S)_").idChip).toBe("X2A");
  });

  it("resolves angle links and slugs", () => {
    expect(resolveRelativeMd("Budget/4 - Checklist.md", "<1 - Feature State.md>")).toEqual({ relPath: "Budget/1 - Feature State.md", anchor: null });
    expect(extractLinks("[State](<1 - Feature State.md>)", "Budget/_index.md")[0].resolved?.relPath).toBe("Budget/1 - Feature State.md");
    expect(slugify("Now & Next")).toBe("now-next");
  });

  it("assigns unique anchors to duplicate headings", () => {
    const headings = parseMarkdown("## One-time setup\n\n## One-time setup")
      .filter((block) => block.type === "heading");
    expect(headings.map((heading) => heading.slug)).toEqual(["one-time-setup", "one-time-setup-2"]);
  });

  it("parses filters, routes, and fuzzy matches", () => {
    expect(parseQuery("m:Budget is:open N4")).toEqual({ filters: { m: "Budget", is: "open" }, text: "N4" });
    expect(parseRoute("#/doc/Budget/4%20-%20Checklist.md?cb=2")).toMatchObject({ name: "doc", relPath: "Budget/4 - Checklist.md" });
    expect(legacyRouteToHash('{"type":"file","relPath":"Budget/4 - Checklist.md"}')).toBe("#/doc/Budget/4%20-%20Checklist.md");
    expect(fuzzyScore("n4", "Budget N4 task")).toBeGreaterThan(fuzzyScore("n4", "Budget next task"));
  });
});
