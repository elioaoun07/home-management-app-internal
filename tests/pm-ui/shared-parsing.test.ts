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

  it("resolves angle links and slugs", () => {
    expect(resolveRelativeMd("Budget/4 - Checklist.md", "<1 - Feature State.md>")).toEqual({ relPath: "Budget/1 - Feature State.md", anchor: null });
    expect(extractLinks("[State](<1 - Feature State.md>)", "Budget/_index.md")[0].resolved?.relPath).toBe("Budget/1 - Feature State.md");
    expect(slugify("Now & Next")).toBe("now-next");
  });

  it("parses filters, routes, and fuzzy matches", () => {
    expect(parseQuery("m:Budget is:open N4")).toEqual({ filters: { m: "Budget", is: "open" }, text: "N4" });
    expect(parseRoute("#/doc/Budget/4%20-%20Checklist.md?cb=2")).toMatchObject({ name: "doc", relPath: "Budget/4 - Checklist.md" });
    expect(legacyRouteToHash('{"type":"file","relPath":"Budget/4 - Checklist.md"}')).toBe("#/doc/Budget/4%20-%20Checklist.md");
    expect(fuzzyScore("n4", "Budget N4 task")).toBeGreaterThan(fuzzyScore("n4", "Budget next task"));
  });
});
