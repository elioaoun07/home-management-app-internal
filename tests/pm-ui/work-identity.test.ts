import { describe, expect, it } from "vitest";
import {
  idSection,
  idSections,
  workIds,
} from "../../scripts/pm/shared/work-id.mjs";
import { headingAnchors, slugify } from "../../scripts/pm/shared/links.mjs";
import { parseTaskMeta } from "../../scripts/pm/shared/tasks.mjs";
import {
  briefPath,
  buildWorld,
  historyPath,
  sourceFile,
} from "../../scripts/pm/app/model";
import type { Snapshot } from "../../scripts/pm/app/types";

// Rows and headings copied from the Schedule campaign on 2026-09-11. Before the
// shared grammar, these four contracts projected empty and SCH-4.3b references
// collapsed to a nonexistent SCH-4.
const CHECKLIST = [
  "## Now",
  "- [ ] **SCH-4.2** Verify cross-view recurrence placement — [criteria](<Schedule — Master Book.md#sch-42>) _(friction - M)_",
  "- [ ] **SCH-4.3b** Unify recurrence expansion and occurrence actions — [criteria](<Schedule — Master Book.md#sch-43b>) _(friction - L)_",
  "## Next",
  "- [ ] **SCH-1b.4** Harden conservative recurrence extraction — [criteria](<Schedule — Master Book.md#sch-1b4>) _(friction - M)_",
  "- [ ] **SCH-1c.1** Parse one-line items through Gemini safely — [criteria](<Schedule — Master Book.md#sch-1c1>) _(friction - M)_",
  "- [ ] **SCH-1c.2** Reuse Hub reminder creation with confirmation — [criteria](<Schedule — Master Book.md#sch-1c2>) _(friction - M)_",
  "## Later",
  "- [ ] **SCH-99** No brief yet _(parked - S)_",
  "",
].join("\n");
const BOOK = [
  "## Acceptance Criteria Index",
  "### SCH-4.2",
  "**Outcome:** Verify cross-view recurrence placement.",
  "### SCH-4.3b",
  "**Outcome:** Unify recurrence expansion and occurrence actions.",
  "- **Depends on:** SCH-4.2.",
  "### SCH-1b.4",
  "**Outcome:** Harden conservative recurrence extraction.",
  "- **Acceptance:** gate behind the SCH-4.2 tests.",
  "### SCH-1c.1",
  "**Outcome:** Parse one-line items through Gemini safely.",
  "- **Depends on:** SCH-1b.4.",
  "### SCH-1c.2",
  "**Outcome:** Reuse Hub reminder creation with confirmation.",
  "- **Depends on:** SCH-1c.1, SCH-4.3b.",
  "## Shipped Log",
  "- ✅ 2026-09-01 — **SCH-4.1** Earlier recurrence slice.",
  "",
].join("\n");
const snapshot: Snapshot = {
  generatedAt: "2026-09-11T12:00:00Z",
  files: [
    { relPath: "Schedule/4 - Checklist.md", raw: CHECKLIST },
    { relPath: "Schedule/Schedule — Master Book.md", raw: BOOK },
  ],
  cancelledLog: "## Schedule\n- ❌ 2026-09-09 — **SCH-3.3** Removed.\n",
};
const FOUR = ["SCH-4.3B", "SCH-1B.4", "SCH-1C.1", "SCH-1C.2"];

describe("canonical work identity", () => {
  it("parses suffix and dotted chips while keeping the source spelling", () => {
    expect(parseTaskMeta("**SCH-1c.1** Parse _(friction - M)_")).toMatchObject({
      idChip: "SCH-1C.1",
      idLabel: "SCH-1c.1",
    });
    expect(parseTaskMeta("**SCH-1.2.3** Nested _(friction - S)_").idChip).toBe(
      "SCH-1.2.3",
    );
  });
  it("keeps suffixes in references instead of collapsing to another ID", () => {
    expect(
      workIds("Depends on SCH-4.3b and SCH-1c.1; see [x](<#sch-43b>)."),
    ).toEqual(["SCH-4.3B", "SCH-1C.1"]);
    expect(workIds("SCH-4.3bx")).toEqual([]);
    expect(workIds("HUB-39/42/51, NOTIF-5.4, R5/R51")).toEqual([
      "HUB-39",
      "HUB-42",
      "HUB-51",
      "NOTIF-5.4",
      "R5",
      "R51",
    ]);
  });
  it("finds acceptance by normalized ID and refuses to pick between duplicates", () => {
    expect(idSection(BOOK, "SCH-4.3B")).toMatchObject({
      heading: "SCH-4.3b",
      anchor: "sch-43b",
    });
    expect(idSection(BOOK, "sch-4.3b")?.body).toMatch(/Unify recurrence/);
    const twice = `${BOOK}\n### sch-4.3B\nCopy.\n`;
    expect(idSections(twice, "SCH-4.3B")).toHaveLength(2);
    expect(idSection(twice, "SCH-4.3B")).toBeNull();
  });
  it("resolves all four Schedule contracts and their dependencies", () => {
    const world = buildWorld(snapshot);
    for (const id of FOUR) {
      const work = world.work.find((item) => item.id === id);
      expect(work?.contract, id).toMatch(/Outcome/);
    }
    const last = world.work.find((item) => item.id === "SCH-1C.2")!;
    expect(last.dependencies.map((dep) => [dep.id, dep.status])).toEqual([
      ["SCH-1C.1", "Open"],
      ["SCH-4.3B", "Open"],
    ]);
    expect(
      world.work.flatMap((item) => item.dependencies.map((dep) => dep.status)),
    ).not.toContain("Unresolved reference");
    expect(
      world.work.flatMap((item) => [
        ...item.dependencies.map((dep) => dep.id),
        ...item.relatedIds,
      ]),
    ).not.toContain("SCH-4");
  });
  it("generates the anchors authored links and pm:check-docs use", () => {
    expect(slugify("SCH-4.2")).toBe("sch-42");
    expect(slugify("SCH-4.3b")).toBe("sch-43b");
    expect(
      slugify("Phase 4 — Deliver the same workflow from the phone"),
    ).toBe("phase-4--deliver-the-same-workflow-from-the-phone");
    expect(
      headingAnchors("## A\n```\n## Not a heading\n```\n## A\n").map(
        (entry) => entry.anchor,
      ),
    ).toEqual(["a", "a-1"]);
  });
  it("opens the exact acceptance heading, or the checklist when none exists", () => {
    const world = buildWorld(snapshot);
    const work = world.work.find((item) => item.id === "SCH-4.3B")!;
    expect(work.label).toBe("SCH-4.3b");
    const path = briefPath(work, world, "/explore");
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("file")).toBe("Schedule/Schedule — Master Book.md");
    expect(query.get("anchor")).toBe("sch-43b");
    expect(
      headingAnchors(BOOK).map((entry) => entry.anchor),
    ).toContain(query.get("anchor"));
    const bare = new URLSearchParams(
      briefPath(world.work.find((item) => item.id === "SCH-99")!, world).split(
        "?",
      )[1],
    );
    expect(bare.get("file")).toBe("Schedule/4 - Checklist.md");
    // No book section: the fallback still highlights this chip's own checklist row.
    expect(bare.get("anchor")).toBe("sch-99");
  });
  it("opens shipped and cancelled history through the explicit history source", () => {
    const world = buildWorld(snapshot);
    const shipped = world.history.find((entry) => entry.status === "Shipped")!;
    const cancelled = world.history.find(
      (entry) => entry.status === "Cancelled",
    )!;
    const shippedQuery = new URLSearchParams(historyPath(shipped).split("?")[1]);
    expect(shippedQuery.get("anchor")).toBe("shipped-log");
    const cancelledQuery = new URLSearchParams(
      historyPath(cancelled).split("?")[1],
    );
    expect(cancelledQuery.get("file")).toBe("_Archive/Cancelled Log.md");
    expect(cancelledQuery.get("anchor")).toBe("schedule");
    const source = sourceFile(world, "_Archive/Cancelled Log.md");
    expect(
      headingAnchors(source!.raw).map((entry) => entry.anchor),
    ).toContain("schedule");
    // Readable, but never scanned into the backlog.
    expect(world.files.map((file) => file.relPath)).not.toContain(
      "_Archive/Cancelled Log.md",
    );
    expect(world.work.map((item) => item.id)).not.toContain("SCH-3.3");
  });
});
