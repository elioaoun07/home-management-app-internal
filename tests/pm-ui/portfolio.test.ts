import { describe, expect, it } from "vitest";
import { acceptanceStatements, buildPortfolio, localReturn, matchesPerspective, projectPath, topicMatches, workIds } from "../../scripts/pm/src/lib/portfolio.js";
import { deriveCampaigns } from "../../scripts/pm/src/lib/product.js";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";
import { parseRoute } from "../../scripts/pm/src/app/router.js";

function fixture() {
  const raw = "## Now\n- [ ] **HUB-39** Proactive household briefing _(blocker - M)_\n- [ ] **HUB-42** Offline cache recovery _(friction - M)_\n- [ ] **HUB-51** Native notification tap _(friction - M)_\n- [ ] **HUB-5** Plain styling _(annoyance - S)_\n";
  const file = { relPath: "Hub & ERA/4 - Checklist.md", raw, module: "Hub & ERA" };
  const tasks = fileTasks(raw).map((task) => ({ ...task, file: file.relPath, module: file.module, key: `${file.relPath}::${task.cbidx}` }));
  const book = { module: file.module, relPath: "Hub & ERA/Hub & ERA — Master Book.md", raw: "## Acceptance Criteria Index\n### HUB-39\n**Outcome:** Household briefing.\n- **Depends on:** HUB-42/51.\n**Provenance:** See HUB-999.\n### HUB-42\n**Outcome:** Offline recovery.\n- **Depends on:** HUB-2, HUB-3.\n### HUB-51\n**Outcome:** Native push.\n- **Dependencies:** blocks HUB-5.\n### HUB-5\n**Outcome:** Plain styling.\n**Retained contract:** Verify AI, mobile, household and offline behavior.\n## Shipped Log\n- ✅ 2026-09-08 — **HUB-2** Completed.\n" };
  return deriveCampaigns([file, book], tasks, "## Hub & ERA\n- ❌ 2026-09-09 — **HUB-3** Removed.\n");
}

describe("project perspectives", () => {
  it("expands shorthand without ID-prefix collisions", () => {
    expect(workIds("HUB-39/42/51, NOTIF-5.4, R5/R51, R55, HUB-39")).toEqual(["HUB-39", "HUB-42", "HUB-51", "NOTIF-5.4", "R5", "R51", "R55"]);
  });
  it("keeps decision relationships exact, including shorthand and dotted identities", () => {
    const { items } = buildPortfolio(fixture(), [{ id: "DEC-01", constraint: "HUB-39/42/51", text: "Choose" }]);
    expect(items.filter((item) => item.decisionIds.includes("DEC-01")).map((item) => item.idChip)).toEqual(["HUB-39", "HUB-42", "HUB-51"]);
    expect(items.find((item) => item.idChip === "HUB-5")?.decisionIds).toEqual([]);
  });
  it("uses explicit dependencies and keeps cancellation distinct from shipment", () => {
    const { items } = buildPortfolio(fixture());
    expect(items[0].dependencies.map((dep) => dep.status)).toEqual(["Open", "Open"]);
    expect(items[0].dependencyIds).toEqual(["HUB-42", "HUB-51"]);
    expect(items[0].relatedIds).not.toContain("HUB-999");
    expect(items[1].dependencies.map((dep) => dep.status)).toEqual(["Shipped", "Cancelled"]);
    expect(items[1].blocked).toBe(true);
    expect(items[2].dependencies).toEqual([]);
    expect(items[2].dependentIds).toEqual(["HUB-39"]);
  });
  it("does not turn severity or a related choice into a dependency block", () => {
    const base = fixture();
    base[0].book.raw = base[0].book.raw.replace("- **Depends on:** HUB-42/51.", "- **Acceptance:** Decide DEC-01.");
    const { items } = buildPortfolio(base, [{ id: "DEC-01", constraint: "HUB-39", text: "Choose" }]);
    expect(items[0].severity).toBe("blocker");
    expect(items[0].blocked).toBe(false);
    expect(matchesPerspective(items[0], "needs-you")).toBe(true);
    expect(matchesPerspective(items[0], "blocked")).toBe(false);
  });
  it("does not treat an unresolved prerequisite as shipped", () => {
    const base = fixture();
    base[0].book.raw = base[0].book.raw.replace("HUB-2, HUB-3", "HUB-999");
    expect(buildPortfolio(base).items[1].dependencies[0].status).toBe("Unresolved reference");
  });
  it("gives overlapping topics evidence without counting verification boilerplate", () => {
    const { items, topics } = buildPortfolio(fixture());
    expect(items[0].topicIds).toEqual(["intelligence", "notifications", "household"]);
    expect(items[1].topicIds).toEqual(["reliability", "sync"]);
    expect(items[3].topicIds).toEqual(["other"]);
    expect(new Set(topics.flatMap((topic) => topic.items.map((item) => item.key))).size).toBe(items.length);
    expect(topicMatches("Set up Android push").map((topic) => topic.id)).toEqual(["mobile", "notifications"]);
  });
  it("reads product acceptance but excludes commands, test clauses and negative scope", () => {
    const evidence = acceptanceStatements("- **Acceptance:** Preserve offline edits; verify mobile fixtures. No AI change.\n- **Gate:** Test household, AI and mobile.\n**Provenance:** UI study.\n");
    expect(evidence).toEqual(["Preserve offline edits"]);
    expect(topicMatches("Capture", "", evidence).map((topic) => topic.id)).toEqual(["sync"]);
  });
  it("keeps topic history separate from open work", () => {
    const base = fixture();
    base[0].shipped[0].text = "HUB-2 Offline retries shipped";
    const model = buildPortfolio(base);
    expect(model.topics.find((topic) => topic.id === "sync")?.outcomes[0].id).toBe("HUB-2");
    expect(model.items).toHaveLength(4);
    expect(model.items.some((item) => item.idChip === "HUB-2")).toBe(false);
  });
  it("ties Delivery perspectives to actual active runs by stable identity", () => {
    const item = buildPortfolio(fixture()).items[0];
    const run = { sessionId: "s", state: "BUILDING", item: { id: item.idChip, campaign: item.module, cbidx: 999 }, awaiting: { gate: "question" } };
    expect(matchesPerspective(item, "delivery", [run])).toBe(true);
    expect(matchesPerspective(item, "needs-you", [run])).toBe(true);
    expect(matchesPerspective(item, "delivery", [{ ...run, state: "SHIPPED" }])).toBe(false);
    expect(matchesPerspective({ ...item, postponed: true }, "now")).toBe(false);
  });
  it("roundtrips perspective, selection and preview with safe return navigation", () => {
    const path = projectPath({ lens: "topics", selection: "household", state: "blocked", item: "HUB-39" });
    const parsed = parseRoute(`#${path}`);
    expect(Object.fromEntries(parsed.query)).toEqual({ lens: "topics", select: "household", state: "blocked", item: "HUB-39" });
    expect(localReturn(path)).toBe(path);
    expect(localReturn("//example.com")).toBe("/");
    expect(localReturn("javascript:alert(1)")).toBe("/");
  });
});
