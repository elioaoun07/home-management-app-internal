import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CANCELLED_LOG,
  archiveItem,
  campaignDirs,
  cancelledStamp,
  ensureCampaignSection,
  insertDatedStamp,
  itemBody,
  masterBookRel,
  removeLine,
  restoreSnapshots,
  shippedStamp,
  sweepAll,
} from "../../scripts/pm/archive.mjs";

const SHIPPED_RE = /^##\s+Shipped Log\s*$/i;

const CHECKLIST = `---
type: checklist
---

# Budget · 4 — Checklist

## Now

- [x] **BUD-14** Shipped thing _(annoyance - S)_
- [ ] **BUD-11** Open thing _(friction - M)_

## Later

- [x] **BUD-20** Another shipped thing _(blocker - L)_

## Definition of Done

- [x] **D1** Every money path has a test
`;

const BOOK = `# Budget — Master Book

## Shipped Log

- ✅ 2026-06-10 — **BUD-1** early win
- ✅ 2026-07-20 — **BUD-13** later win

## Pain Inventory

- 🔴 something hurts
`;

let dir: string | null = null;
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

function fixture() {
  dir = mkdtempSync(join(tmpdir(), "pm-archive-"));
  mkdirSync(join(dir, "Budget"));
  writeFileSync(join(dir, "Budget", "4 - Checklist.md"), CHECKLIST, "utf8");
  writeFileSync(join(dir, "Budget", "Budget — Master Book.md"), BOOK, "utf8");
  // repoRoot points at a non-repo temp dir on purpose: git can't answer, so
  // tickDate must fall back to today rather than throw.
  return { pmDir: dir, repoRoot: dir, pmRelFromRoot: "." };
}
const read = (rel: string) => readFileSync(join(dir!, rel), "utf8");

describe("PM archive — stamps", () => {
  it("strips the queue-triage meta suffix and keeps the ID chip", () => {
    expect(itemBody("- [x] **BUD-14** Do it _(annoyance - S)_")).toBe("**BUD-14** Do it _(annoyance - S)_");
    expect(shippedStamp("**BUD-14** Do it _(annoyance - S)_", "2026-07-04"))
      .toBe("- ✅ 2026-07-04 — **BUD-14** Do it");
    expect(cancelledStamp("**BUD-9** Drop it _(parked - L)_", "2026-08-01", "superseded by BUD-12"))
      .toBe("- ❌ 2026-08-01 — **BUD-9** Drop it _(cancelled: superseded by BUD-12)_");
    expect(cancelledStamp("**BUD-9** Drop it", "2026-08-01", "")).toBe("- ❌ 2026-08-01 — **BUD-9** Drop it _(cancelled)_");
  });
});

describe("PM archive — insertion", () => {
  it("keeps the Shipped Log in ascending date order and never leaks into the next section", () => {
    const mid = insertDatedStamp(BOOK, SHIPPED_RE, "- ✅ 2026-07-01 — **X** mid", "2026-07-01");
    expect(mid.split("\n").filter((l) => l.startsWith("- ✅")).map((l) => l.slice(4, 14)))
      .toEqual(["2026-06-10", "2026-07-01", "2026-07-20"]);
    const old = insertDatedStamp(BOOK, SHIPPED_RE, "- ✅ 2026-01-01 — **X** old", "2026-01-01");
    expect(old.split("\n").filter((l) => l.startsWith("- ✅"))[0]).toContain("2026-01-01");
    expect(old.indexOf("**X** old")).toBeLessThan(old.indexOf("## Pain Inventory"));
  });

  it("creates a missing section rather than dropping the stamp", () => {
    expect(insertDatedStamp("# B\n\ntext\n", SHIPPED_RE, "- ✅ 2026-01-01 — **X** x", "2026-01-01"))
      .toBe("# B\n\ntext\n\n## Shipped Log\n\n- ✅ 2026-01-01 — **X** x\n");
    expect(ensureCampaignSection("# Cancelled Log\n", "Budget")).toContain("\n## Budget\n");
    expect(ensureCampaignSection("# L\n\n## Budget\n\n- ❌ x\n", "Budget").match(/## Budget/g)).toHaveLength(1);
  });

  it("collapses the blank-line pair a removed line leaves behind", () => {
    expect(removeLine("## Now\n\n- [x] a\n\n## Next\n", 2)).toBe("## Now\n\n## Next\n");
  });
});

describe("PM archive — item ops", () => {
  it("ships a done item into the Shipped Log and restores it byte-for-byte on undo", () => {
    const ctx = fixture();
    const result = archiveItem({ ...ctx, file: "Budget/4 - Checklist.md", cbidx: 0, mode: "ship" });
    expect(result.idChip).toBe("BUD-14");
    expect(result.target).toBe("Budget/Budget — Master Book.md");
    expect(read("Budget/4 - Checklist.md")).not.toContain("BUD-14");
    expect(read("Budget/Budget — Master Book.md")).toContain("— **BUD-14** Shipped thing");

    restoreSnapshots(ctx.pmDir, result.undo);
    expect(read("Budget/4 - Checklist.md")).toBe(CHECKLIST);
    expect(read("Budget/Budget — Master Book.md")).toBe(BOOK);
  });

  it("refuses to ship an item that isn't ticked", () => {
    const ctx = fixture();
    expect(() => archiveItem({ ...ctx, file: "Budget/4 - Checklist.md", cbidx: 1, mode: "ship" }))
      .toThrow(/not-done/);
    expect(read("Budget/4 - Checklist.md")).toBe(CHECKLIST);
  });

  it("discards any item to the Cancelled Log, and undo removes the log it created", () => {
    const ctx = fixture();
    const result = archiveItem({ ...ctx, file: "Budget/4 - Checklist.md", cbidx: 1, mode: "discard", reason: "superseded" });
    expect(result.target).toBe(CANCELLED_LOG);
    expect(read(CANCELLED_LOG)).toContain("## Budget");
    expect(read(CANCELLED_LOG)).toContain("**BUD-11** Open thing _(cancelled: superseded)_");
    expect(read("Budget/4 - Checklist.md")).not.toContain("BUD-11");

    restoreSnapshots(ctx.pmDir, result.undo);
    expect(existsSync(join(ctx.pmDir, CANCELLED_LOG))).toBe(false);
    expect(read("Budget/4 - Checklist.md")).toBe(CHECKLIST);
  });

  it("only operates on 4 - Checklist.md, and rejects a bad ordinal", () => {
    const ctx = fixture();
    expect(() => archiveItem({ ...ctx, file: "Budget/Budget — Master Book.md", cbidx: 0, mode: "discard" }))
      .toThrow(/only 4 - Checklist\.md/);
    expect(() => archiveItem({ ...ctx, file: "Budget/4 - Checklist.md", cbidx: 99, mode: "ship" }))
      .toThrow(/out-of-range/);
  });
});

describe("PM archive — monthly sweep", () => {
  it("sweeps every ticked item but leaves Definition of Done and open items alone", () => {
    const ctx = fixture();
    expect(campaignDirs(ctx.pmDir)).toEqual(["Budget"]);
    expect(masterBookRel(ctx.pmDir, "Budget")).toBe("Budget/Budget — Master Book.md");

    const report = sweepAll(ctx);
    expect(report.errors).toEqual([]);
    expect(report.swept.map((entry) => entry.idChip)).toEqual(["BUD-14", "BUD-20"]);

    const checklist = read("Budget/4 - Checklist.md");
    expect(checklist).not.toContain("BUD-14");
    expect(checklist).not.toContain("BUD-20");
    expect(checklist).toContain("**BUD-11** Open thing"); // still open
    expect(checklist).toContain("**D1** Every money path has a test"); // acceptance criterion, not queue work

    const book = read("Budget/Budget — Master Book.md");
    expect(book).toContain("— **BUD-14** Shipped thing");
    expect(book).toContain("— **BUD-20** Another shipped thing");

    restoreSnapshots(ctx.pmDir, report.undo);
    expect(read("Budget/4 - Checklist.md")).toBe(CHECKLIST);
    expect(read("Budget/Budget — Master Book.md")).toBe(BOOK);
  });

  it("is a no-op when nothing is ticked", () => {
    const ctx = fixture();
    writeFileSync(join(ctx.pmDir, "Budget", "4 - Checklist.md"), CHECKLIST.replace(/\[x\]/g, "[ ]"), "utf8");
    const report = sweepAll(ctx);
    expect(report.swept).toEqual([]);
    expect(report.undo).toEqual([]);
  });

  it("dry-run reports without touching disk", () => {
    const ctx = fixture();
    const report = sweepAll({ ...ctx, dryRun: true });
    expect(report.swept).toHaveLength(2);
    expect(read("Budget/4 - Checklist.md")).toBe(CHECKLIST);
    expect(read("Budget/Budget — Master Book.md")).toBe(BOOK);
  });
});
