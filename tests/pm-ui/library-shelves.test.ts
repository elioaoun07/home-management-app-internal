import { describe, expect, it } from "vitest";
import { cabinetMedium, libraryBrief, libraryCabinetCount, libraryDeliveryBlock, libraryPlanNotes, libraryShelves } from "../../scripts/pm/app/libraryShelves";
import { buildWorld } from "../../scripts/pm/app/model";
import { acceptanceMarkdown } from "../../scripts/pm/app/workAcceptance";

const { spaces: [space] } = buildWorld({
  generatedAt: "2026-11-21T12:00:00Z",
  files: [
    { relPath: "Budget/4 - Checklist.md", raw: [
      "## Now", "- [ ] **BUD-1** Restore Undo _(blocker - S)_",
      "- [ ] **BUD-2** Fix transfer _(friction - M)_",
      "## Next", "- [ ] **BUD-3** Audit rounding _(friction - M)_",
      "- [x] **BUD-4** Save allocations _(friction - S)_",
      "## Later", "- [ ] **BUD-5** Allow returns _(annoyance - M)_",
    ].join("\n") },
    { relPath: "Budget/Budget — Master Book.md", raw: [
      "## Purpose & ownership", "Budget planning.",
      "## Acceptance Criteria Index", "### BUD-2", "**Depends on:** BUD-1",
      "## Shipped Log", "- ✅ 2026-11-21 — **BUD-6** Saved history → [record](archive.md)",
      "- ✅ 2026-11-20 — **BUD-6** Earlier receipt",
      "- ✅ 2026-11-19 — **BUD-1** Reopened later",
      "- ✅ 2026-11-18 — **BUD-7** Subsequently cancelled",
      "- ✅ 2026-11-17 — **BUD-8/BUD-9** Batch receipt",
    ].join("\n") },
  ],
  cancelledLog: "## Budget\n- ❌ 2026-11-21 — **BUD-7** Retired",
});

describe("Library cabinets", () => {
  it("uses actual blockers, retains priority and keeps only current finished identities", () => {
    const items = libraryShelves(space);
    expect(Object.fromEntries(items.map(entry => [entry.id, entry.shelf]))).toEqual({
      "BUD-1": "now", "BUD-2": "waiting", "BUD-3": "next", "BUD-4": "finished",
      "BUD-5": "later", "BUD-6": "finished",
    });
    expect(libraryCabinetCount(space)).toBe(6);
    expect(items).toHaveLength(6);
    expect(items.find(entry => entry.id === "BUD-6")).toMatchObject({ title: "Saved history", receipt: { date: "2026-11-21" }, work: null });
    expect(items.find(entry => entry.id === "BUD-2")?.work?.section).toBe("Now");
  });

  it("honours explicit planning dependency blocks beyond the abbreviated checklist contract", () => {
    const readiness = { "BUD-3": {
      state: "blocked" as const, status: "open" as const, criteriaRevision: null, effort: null,
      reasons: [{ code: "dependency-open", with: "BUD-1" }], dependencies: ["BUD-1"], file: space.work[0].file,
    } };
    expect(libraryShelves(space, readiness).find(entry => entry.id === "BUD-3")?.shelf).toBe("waiting");
  });

  it("prevents delivery of owner-only rows even without an Execution declaration", () => {
    const ownerWorld = buildWorld({ generatedAt: "", files: [
      { relPath: "Kitchen/4 - Checklist.md", raw: [
        "## Next", "**Needs you**", "", "- [ ] **KIT-25** Verify on both phones _(blocker - S)_",
        "**Data integrity**", "- [ ] **KIT-10** Validate ingredients _(friction - M)_",
      ].join("\r\n") },
      { relPath: "Kitchen/Kitchen — Master Book.md", raw: "## Purpose & ownership\nKitchen.\n### KIT-25\n**Outcome:** Verify device.\n### KIT-10\n**Outcome:** Validate ingredients." },
    ] });
    expect(libraryDeliveryBlock(ownerWorld, ownerWorld.work[0])).toBe("Needs you");
    expect(libraryDeliveryBlock(ownerWorld, ownerWorld.work[1])).toBeNull();
  });

  it("keeps authored plan and acceptance on their respective pages", () => {
    const criteria = "- **Acceptance:** Every category has a total.";
    const plan = "**Plan:** Group the entries by category.";
    const raw = [criteria, plan, "**Tier:** CODEX_MID"].join("\n");
    expect(acceptanceMarkdown(raw)).toBe(criteria);
    expect(libraryPlanNotes(raw)).toBe(plan);
    expect(libraryPlanNotes("**Outcome:** Verify.\n- **Reading guide (revalidated 2026-09-26):** Read the recipe route.")).toContain("Read the recipe route.");
  });

  it("projects the actual plan steps and outcome, with readable legacy or malformed briefs", () => {
    const raw = '**Outcome:** Exact outcome.\n```delivery-plan-v1\n{"steps":["One","Two"],"acceptance":["Verified"],"outcome":"Alternative"}\n```';
    expect(libraryBrief(raw)).toEqual({ outcome: "Exact outcome.", steps: ["One", "Two"], acceptance: ["Verified"] });
    expect(libraryBrief(raw.replace('"One","Two"', '"One",3')).steps).toEqual([]);
    expect(libraryBrief(raw + "\n" + raw).steps).toEqual([]);
    expect(libraryBrief("Old notes")).toEqual({ outcome: "", steps: [], acceptance: [] });
  });

  it("binds each requested medium to its real campaign", () => {
    expect(["Budget", "Kitchen", "Hub & ERA", "Schedule"].map(cabinetMedium)).toEqual(["tablet", "book", "glass", "folio"]);
  });
});
