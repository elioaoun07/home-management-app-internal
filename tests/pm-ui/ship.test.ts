import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseHistory } from "../../scripts/pm/shared/history.mjs";
import { headingAnchors } from "../../scripts/pm/shared/links.mjs";
import {
  INDEX_END,
  INDEX_START,
  compactBook,
  groupedTasks,
  pendingUat,
  refreshIndex,
  relink,
  renderIndexBlock,
  ship,
  shortTitle,
  tickById,
  undoLastShip,
} from "../../scripts/pm/ship.mjs";

const LONG = "Transfer undo now restores both legs and the balance history row in one call, with the inverse recorded for redo. Evidence: 14 route tests, typecheck clean, manual pass on both phones, and a replay of the three failing July statements against the fixed route.";

const CHECKLIST = `---
updated: 2026-11-01
status: active
---

# Budget — Checklist

## Now

- [ ] **BUD-11** Open thing — [criteria](<Budget — Master Book.md#bud-11>) _(friction - M)_
- [ ] **BUD-2.1** Dotted open thing — [criteria](<Budget — Master Book.md#bud-21>) _(friction - S)_

## Next

## Later
`;

const BOOK = `# Budget — Master Book

## Current state & evidence

**2026-11-10 — newest:** state four.

**2026-11-01 — third:** state three, see [BUD-14](#bud-14).

**Evidence:** a continuation of the third entry.

**2026-10-20 — second:** state two.

**2026-10-01 — first:** state one, see [the plan](<../Plans/Plan.md>) and [BUD-11](#bud-11).

**Verification:** a continuation of the first entry.

Base statement that always stays.

## Pain Inventory

- 🟠 **BUD-11 — hurts.** See [BUD-14](<Budget — Master Book.md#bud-14>).

## Acceptance Criteria Index

### BUD-2.1

- **Acceptance:** dotted and open.

### BUD-14

**Outcome:** Undo restores both legs.

- **Acceptance:** both balances return; depends on [BUD-11](#bud-11) and [the plan](<../Plans/Plan.md>).

\`\`\`bash
# a fenced comment is not a heading
\`\`\`

### BUD-21

- **Acceptance:** shipped; shares a slug with BUD-2.1.

### BUD-11

- **Acceptance:** still open.

### BUD-30

**Implementation:** done
**UAT:** pending

- **Acceptance:** awaiting the owner.

### BUD-31

**Execution:** owner

- **Acceptance:** owner check.

## Shipped Log

- ✅ 2026-08-01 — **BUD-14** ${LONG}
- ✅ 2026-08-02 — **BUD-21** short receipt
- ✅ 2026-08-03 — **BUD-30** implemented, acceptance pending
- ✅ 2026-08-04 — **BUD-31** owner check recorded
- ✅ 2026-08-05 — short unidentified receipt
- ✅ 2026-08-06 — An unidentified receipt whose text is long enough to move: ${LONG}

## Delivery session log
`;

const base = { campaign: "Budget", bookRel: "Budget/Budget — Master Book.md", archiveRel: "_Archive/Shipped/Budget.md", checklistRaw: CHECKLIST };

describe("tickById", () => {
  it("ticks an open row, including dotted IDs, and reports the other states", () => {
    expect(tickById(CHECKLIST, "bud-11").raw).toContain("- [x] **BUD-11** Open thing");
    expect(tickById(CHECKLIST, "BUD-2.1").state).toBe("ticked");
    expect(tickById(tickById(CHECKLIST, "BUD-11").raw, "BUD-11").state).toBe("already");
    expect(tickById(CHECKLIST, "BUD-99")).toEqual({ raw: CHECKLIST, state: "missing" });
  });
});

describe("shortTitle", () => {
  it("keeps the first sentence, drops the criteria link and never leaves an open bracket", () => {
    expect(shortTitle("Verify restore — [criteria](<Budget — Master Book.md#bud-32>)")).toBe("Verify restore");
    expect(shortTitle(LONG)).toBe("Transfer undo now restores both legs and the balance history row in one call, with the inverse recorded for redo");
    const cut = shortTitle("A title that is quite long and then opens (a parenthesis that will be cut somewhere in the middle of its very long content) end", 70);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toContain("(");
  });
});

describe("relink", () => {
  it("re-expresses relative links for a new location and leaves external ones alone", () => {
    const text = "[a](<../Plans/Plan.md#x>) [b](#bud-11) [c](https://example.com) [d](<4 - Checklist.md>)";
    expect(relink(text, "Budget/Book.md", "_Archive/Shipped/Budget.md")).toBe(
      "[a](<../../Plans/Plan.md#x>) [b](<../../Budget/Book.md#bud-11>) [c](https://example.com) [d](<../../Budget/4 - Checklist.md>)");
  });
  it("retargets a moved anchor from any file and skips fenced code", () => {
    const map = new Map([["Budget/Book.md#bud-14", { file: "_Archive/Shipped/Budget.md", anchor: "bud-14" }]]);
    expect(relink("[x](<../Budget/Book.md#bud-14>) [y](<../Budget/Book.md#bud-11>)", "Plans/P.md", "Plans/P.md", map))
      .toBe("[x](<../_Archive/Shipped/Budget.md#bud-14>) [y](<../Budget/Book.md#bud-11>)");
    const fenced = "```\n[x](<../Budget/Book.md#bud-14>)\n```";
    expect(relink(fenced, "Plans/P.md", "Plans/P.md", map)).toBe(fenced);
  });
});

describe("compactBook", () => {
  const result = compactBook({ ...base, bookRaw: BOOK });

  it("moves shipped criteria with their receipt and keeps live sections", () => {
    expect(result.stats).toMatchObject({ sections: 2, receipts: 3, stateEntries: 1 });
    for (const kept of ["### BUD-11", "### BUD-2.1", "### BUD-30", "### BUD-31"]) expect(result.book).toContain(kept);
    for (const gone of ["### BUD-14", "### BUD-21", "a fenced comment"]) expect(result.book).not.toContain(gone);
    expect(result.archive).toContain(`### BUD-14\n\n- ✅ 2026-08-01 — **BUD-14** ${LONG}\n\n**Outcome:** Undo restores both legs.`);
    expect(result.archive).toContain("# a fenced comment is not a heading");
  });

  it("leaves one dated, identifiable line per receipt in the Shipped Log", () => {
    const { records } = parseHistory(result.book, { campaign: "Budget", file: base.bookRel });
    expect(records).toHaveLength(6);
    expect(records.map((record) => record.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"]);
    expect(records.slice(0, 4).map((record) => [record.identity, record.workId])).toEqual([["exact", "BUD-14"], ["exact", "BUD-21"], ["exact", "BUD-30"], ["exact", "BUD-31"]]);
    expect(result.book).toContain("- ✅ 2026-08-01 — **BUD-14** Transfer undo now restores both legs and the balance history row in one call, with the inverse recorded for redo → [record](<../_Archive/Shipped/Budget.md#bud-14>)");
    expect(result.book).toContain("- ✅ 2026-08-03 — **BUD-30** implemented, acceptance pending\n"); // UAT pending: untouched
    expect(result.book).toContain("- ✅ 2026-08-05 — short unidentified receipt\n");
  });

  it("gives every link a live target, including anchors renumbered by the move", () => {
    // BUD-2.1 and BUD-21 both slug to `bud-21`; with BUD-21 archived, BUD-2.1 keeps `bud-21`.
    expect(result.anchorMap.get(`${base.bookRel}#bud-21-1`)).toEqual({ file: base.archiveRel, anchor: "bud-21" });
    expect(result.book).toContain("See [BUD-14](<../_Archive/Shipped/Budget.md#bud-14>).");
    expect(result.book).toContain("see [BUD-14](<../_Archive/Shipped/Budget.md#bud-14>).");
    expect(result.archive).toContain("depends on [BUD-11](<../../Budget/Budget — Master Book.md#bud-11>) and [the plan](<../../Plans/Plan.md>)");
    const bookAnchors = new Set(headingAnchors(result.book).map((entry) => entry.anchor));
    const archiveAnchors = new Set(headingAnchors(result.archive!).map((entry) => entry.anchor));
    for (const match of result.book.matchAll(/\]\(<\.\.\/_Archive\/Shipped\/Budget\.md#([^>]+)>\)/g)) expect(archiveAnchors.has(match[1])).toBe(true);
    for (const match of result.book.matchAll(/\]\(#([^)]+)\)/g)) expect(bookAnchors.has(match[1])).toBe(true);
  });

  it("keeps the newest three state entries, their continuations and the base statement", () => {
    expect(result.book).toContain("**2026-10-20 — second:** state two.\n\nBase statement that always stays.");
    expect(result.book).toContain("**Evidence:** a continuation of the third entry.");
    expect(result.archive).toContain("**2026-10-01 — first:** state one, see [the plan](<../../Plans/Plan.md>) and [BUD-11](<../../Budget/Budget — Master Book.md#bud-11>).\n\n**Verification:** a continuation of the first entry.");
  });

  it("is idempotent and appends to an existing archive", () => {
    const again = compactBook({ ...base, bookRaw: result.book, archiveRaw: result.archive });
    expect(again.book).toBe(result.book);
    expect(again.archive).toBe(result.archive);
    const later = result.book.replace("## Delivery session log", `- ✅ 2026-09-01 — **BUD-14** ${LONG} Follow-up.\n\n## Delivery session log`);
    const extended = compactBook({ ...base, bookRaw: later, archiveRaw: result.archive });
    expect(extended.archive!.match(/^### BUD-14$/gm)).toHaveLength(1);
    expect(extended.archive).toContain("Follow-up.");
  });

  it("does nothing for a book with no shipped history", () => {
    const empty = "# Book\n\n## Acceptance Criteria Index\n\n### BUD-11\n\n## Shipped Log\n";
    const untouched = compactBook({ ...base, bookRaw: empty });
    expect(untouched.book).toBe(empty);
    expect(untouched.archive).toBeNull();
  });
});

describe("generated index", () => {
  const planning = { sprints: [
    { id: "s1", name: "Week of Nov 9", goal: "Money safety", state: "active", startDate: "2026-11-09", endExclusive: "2026-11-16", members: [{ workId: "BUD-11" }, { workId: "BUD-99" }] },
    { id: "s2", name: "Week of Nov 16", goal: "", state: "draft", startDate: "2026-11-16", endExclusive: "2026-11-23", members: [{ workId: "BUD-2.1" }] },
  ] };
  const tasks = groupedTasks(CHECKLIST
    .replace("## Next\n", "## Next\n\n**Needs you**\n\n- [ ] **BUD-30** Run the migration — [criteria](<Budget — Master Book.md#bud-30>) _(blocker - S)_\n")
    .replace("## Later\n", "## Later\n\n**Parked**\n\n- [ ] **BUD-31** Someday — [criteria](<Budget — Master Book.md#bud-31>) _(parked - M)_\n"));
  const block = renderIndexBlock({ campaigns: [{ name: "Budget", tasks, bookRaw: BOOK, shipped: 6, pendingUat: pendingUat(BOOK) }], planning, today: "2026-11-11" });

  it("reads the bold group each row sits under", () => {
    expect(tasks.map((task) => [task.idChip, task.section, task.group])).toEqual([
      ["BUD-11", "Now", null], ["BUD-2.1", "Now", null], ["BUD-30", "Next", "Needs you"], ["BUD-31", "Later", "Parked"]]);
  });

  it("renders this week, what is next, what waits on the owner and the counts", () => {
    expect(block).toContain("**Week of Nov 9** · 2026-11-09 → 2026-11-15 · active · Money safety");
    expect(block).toContain("| [BUD-11](<Budget/Budget — Master Book.md#bud-11>) | Open thing | M | Now |");
    expect(block).toContain("| BUD-99 | _closed: shipped, merged or cancelled_ | | |");
    expect(block).toContain("Also in Now:\n\n- [BUD-2.1](<Budget/Budget — Master Book.md#bud-21>) Dotted open thing _(friction - S)_");
    expect(block).toContain("- **Week of Nov 16**: [BUD-2.1](<Budget/Budget — Master Book.md#bud-21>)");
    expect(block).toContain("### Needs you");
    expect(block).toContain("- [BUD-30](<Budget/Budget — Master Book.md#bud-30>) Run the migration");
    expect(block).toContain("- **Budget** (1): [BUD-30](<Budget/Budget — Master Book.md#bud-30>)");
    expect(block).toContain("| **Budget** | 2 | 1 | 1 | 6 |");
  });

  it("replaces only the marked block", () => {
    const page = `# PM\n\nintro\n\n${INDEX_START}\nold\n${INDEX_END}\n\noutro\n`;
    expect(refreshIndex(page, block)).toBe(`# PM\n\nintro\n\n${block}\n\noutro\n`);
    expect(refreshIndex("# PM\n\nno markers\n", block)).toBe("# PM\n\nno markers\n");
  });
});

describe("ship", () => {
  let dir: string | null = null;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

  function fixture() {
    dir = mkdtempSync(join(tmpdir(), "pm-ship-"));
    const pmDir = join(dir, "ERA Notes", "10 - Project Management");
    mkdirSync(join(pmDir, "Budget"), { recursive: true });
    mkdirSync(join(pmDir, "Plans"), { recursive: true });
    writeFileSync(join(pmDir, "Budget", "4 - Checklist.md"), CHECKLIST, "utf8");
    writeFileSync(join(pmDir, "Budget", "Budget — Master Book.md"), BOOK, "utf8");
    writeFileSync(join(pmDir, "Plans", "Plan.md"), "# Plan\r\n\r\nBuilds on [BUD-14](<../Budget/Budget — Master Book.md#bud-14>).\r\n", "utf8");
    writeFileSync(join(pmDir, "_index.md"), `# PM\n\n${INDEX_START}\n${INDEX_END}\n`, "utf8");
    return { pmDir, repoRoot: dir };
  }
  const read = (pmDir: string, rel: string) => readFileSync(join(pmDir, rel), "utf8");

  it("ticks, sweeps, compacts, relinks other documents and refreshes the index", () => {
    const ctx = fixture();
    const report = ship({ ...ctx, ids: ["bud-11"], note: "3 tests", date: "2026-10-24" });
    expect(report.aborted).toBe("");
    expect(report.ticked).toEqual(["BUD-11"]);
    expect(report.swept).toHaveLength(1);
    expect(read(ctx.pmDir, "Budget/4 - Checklist.md")).not.toContain("BUD-11");
    const book = read(ctx.pmDir, "Budget/Budget — Master Book.md");
    expect(book).toMatch(/- ✅ \d{4}-\d{2}-\d{2} — \*\*BUD-11\*\* Open thing → \[record\]\(<\.\.\/_Archive\/Shipped\/Budget\.md#bud-11>\)/);
    expect(book).not.toContain("### BUD-11");
    const archive = read(ctx.pmDir, "_Archive/Shipped/Budget.md");
    expect(archive).toContain("(3 tests)");
    expect(archive).toContain("### BUD-11");
    // A CRLF document keeps its line endings.
    expect(read(ctx.pmDir, "Plans/Plan.md")).toBe("# Plan\r\n\r\nBuilds on [BUD-14](<../_Archive/Shipped/Budget.md#bud-14>).\r\n");
    expect(read(ctx.pmDir, "_index.md")).toContain("| **Budget** | 1 | 0 | 0 | 7 |");
  }, 60_000);

  it("restores every touched file on undo, and removes the archive it created", () => {
    const ctx = fixture();
    ship({ ...ctx, ids: ["BUD-11"] });
    expect(undoLastShip(ctx.pmDir).ok).toBe(true);
    expect(read(ctx.pmDir, "Budget/4 - Checklist.md")).toBe(CHECKLIST);
    expect(read(ctx.pmDir, "Budget/Budget — Master Book.md")).toBe(BOOK);
    expect(existsSync(join(ctx.pmDir, "_Archive/Shipped/Budget.md"))).toBe(false);
    expect(undoLastShip(ctx.pmDir).ok).toBe(false);
  }, 60_000);

  it("changes nothing for an unknown ID or a dry run", () => {
    const ctx = fixture();
    expect(ship({ ...ctx, ids: ["BUD-11", "BUD-404"] }).aborted).toContain("BUD-404");
    expect(read(ctx.pmDir, "Budget/4 - Checklist.md")).toBe(CHECKLIST);
    const dry = ship({ ...ctx, ids: ["BUD-11"], dryRun: true });
    expect(dry.compacted[0]).toMatchObject({ campaign: "Budget", sections: 2 });
    expect(read(ctx.pmDir, "Budget/Budget — Master Book.md")).toBe(BOOK);
    expect(existsSync(join(ctx.pmDir, "_Archive"))).toBe(false);
  });
});
