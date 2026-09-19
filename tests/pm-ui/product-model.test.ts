import { describe, expect, it } from "vitest";
import { deriveCampaigns, parseDecisions, parseOutcomes, section, sessionForTask, taskContext, taskHref, workTitle } from "../../scripts/pm/src/lib/product.js";
import { parseRoute } from "../../scripts/pm/src/app/router.js";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";
const raw = "# Checklist\n## Now\n- [ ] **BUD-1** Correct totals — [criteria](book.md) _(blocker - M)_\n## Next\n- [ ] **BUD-2** HELD — DEC-01 _(friction - S)_\n## Later\n";
const file = { relPath: "Budget/4 - Checklist.md", raw, module: "Budget" };
const book = { relPath: "Budget/Budget — Master Book.md", module: "Budget", raw: "# Budget\n## Purpose & ownership\nReliable totals.\n## Vision & Decisions\nHousehold rules.\n## Acceptance Criteria Index\n### BUD-1\n- **Acceptance:** Sums reconcile. Depends on BUD-2. DEC-01.\n### BUD-10\nUnrelated acceptance.\n## Shipped Log\n- ✅ 2026-09-09 — **BUD-3** Delivered with tests.\n" };
const tasks = fileTasks(raw).map(task => ({ ...task, file: file.relPath, module: file.module }));
describe("canonical product model", () => {
  it("uses campaign checklists, not plan or Inbox checkboxes, and separates historical outcomes", () => {
    const files = [file, book, {relPath:"Plans/Example.md",raw:"- [ ] Not work"}, {relPath:"_Templates/4 - Checklist.md",inFabled:true}];
    const [campaign] = deriveCampaigns(files, [...tasks,{file:"Plans/Example.md",state:"open"}], "## Budget\n- ❌ 2026-09-08 — **BUD-4** Removed.\n");
    expect(deriveCampaigns(files,tasks)).toHaveLength(1);
    expect(campaign.open).toHaveLength(2);
    expect(campaign.now).toHaveLength(1);
    expect(campaign.blockers).toHaveLength(1);
    expect(campaign.held).toHaveLength(1);
    expect(campaign.shipped[0].id).toBe("BUD-3");
    expect(campaign.cancelled[0].id).toBe("BUD-4");
    expect(campaign.purpose).toBe("Reliable totals.");
  });
  it("reads exact acceptance sections without matching an ID prefix or leaking the next item", () => {
    const context = taskContext(tasks[0], {book}, [{id:"DEC-01",constraint:"Blocks BUD-1",text:"Choose"}]);
    expect(context.raw).toContain("Sums reconcile");
    expect(context.raw).not.toContain("Unrelated");
    expect(context.refs).toEqual(["BUD-2"]);
    expect(context.decisions).toHaveLength(1);
    expect(section(book.raw,"BUD-999",3)).toBe("");
  });
  it("keeps stable work links through reorder and preserves return filters", () => {
    const link=taskHref(tasks[0],'/work?q=m%3ABudget');
    expect(taskHref({...tasks[0],cbidx:9},'/work?q=m%3ABudget')).toBe(link);
    const route=parseRoute(link);
    expect(route).toMatchObject({name:"work-item",campaign:"Budget",itemId:"BUD-1"});
    expect(route.query.get("from")).toBe('/work?q=m%3ABudget');
  });
  it("finds an active session by lifetime ID after the checkbox moves", () => {
    const sessions=[{state:"BUILDING",sessionId:"s1",item:{campaign:"Budget",id:"BUD-1",cbidx:8}}];
    expect(sessionForTask(tasks[0],sessions)?.sessionId).toBe("s1");
    expect(sessionForTask(tasks[0],[{...sessions[0],state:"SHIPPED"}])).toBeUndefined();
  });
  it("cleans presentation labels without changing mutation text", () => {
    expect(workTitle(tasks[0])).toBe("Correct totals");
    expect(tasks[0].text).toContain("BUD-1");
    expect(workTitle({text:"A scope decision"})).toBe("A scope decision");
  });
  it("reads only open decision rows and dated outcome records", () => {
    const decisions=parseDecisions("# Choices\n## Open choices\n| DEC-01 | Choose A | Blocks BUD-1 | Source |\n## Closed\n| DEC-02 | Closed | None | Source |");
    expect(decisions.map(d=>d.id)).toEqual(["DEC-01"]);
    expect(parseOutcomes("## Shipped Log\nAn unverified narrative\n", "Budget",file.relPath)).toEqual([]);
  });
});
