// R77 — submitted UAT feedback becomes one linked work item on the next `pnpm pm`.
// Temp PM corpora and a temp UAT store only: no provider, Apply, Git write or
// database, and the real corpus is never touched.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lintChecklist } from "../scripts/pm/lint.mjs";
import { applyUatFeedbackImport, highestNumber, importedMarkers, planThreads, readJournal } from "../scripts/pm/uat-feedback.mjs";
import { bindRun, freezeHandover, readImportStatus, readUat, submitFeedback, withdrawFeedback, dispositionFeedback } from "../scripts/delivery-v2/uat.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const T0 = "2026-10-25T10:00:00.000Z";
const at = (minutes: number) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();

const CHECKLIST = (name: string) => `---
created: 2026-09-10
updated: 2026-09-27
type: checklist
status: active
owner: Elio
---

# ${name} — Checklist

## Now

- [ ] **BUD-80** Existing now item — [criteria](<${name} — Master Book.md#bud-80>) _(blocker - S)_

## Next

- [ ] **BUD-81** Existing next item — [criteria](<${name} — Master Book.md#bud-81>) _(friction - M)_

Next paragraph stays below the list.

## Later
`;
const BOOK = (name: string) => `---
created: 2026-09-10
updated: 2026-09-27
type: master-book
status: active
owner: Elio
---

# ${name} — Master Book

## Pain Inventory

🟠 **BUD-81** Something already known.

## Acceptance Criteria Index

### BUD-81

**Outcome:** Existing outcome.
`;

let root: string;
let pm: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "era-uat-fb-"));
  pm = join(root, "ERA Notes", "10 - Project Management");
  for (const name of ["Budget", "Delivery", "PM Tooling"]) {
    mkdirSync(join(pm, name), { recursive: true });
    writeFileSync(join(pm, name, "4 - Checklist.md"), CHECKLIST(name));
    writeFileSync(join(pm, name, `${name} — Master Book.md`), BOOK(name));
  }
  mkdirSync(join(pm, "_Archive"), { recursive: true });
  writeFileSync(join(pm, "_Archive", "Cancelled Log.md"), "- BUD-90 cancelled long ago. Also R70 and DLV-30.\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const CONTENT = {
  summary: "Split removal",
  scenarios: [{ id: "M1", title: "Remove the tag", criteria: ["AC-1"], steps: [{ action: "Open Activity.", expected: "The list appears." }, { action: "Uncheck Split.", expected: "An Undo toast shows." }] }],
};
let seq = 0;
function handover(subject: Loose = { run_id: "r-aaaaaaaaaaaa", work_id: "BUD-83", campaign: "Budget", title: "Remove a pending split" }) {
  const frozen: Loose = freezeHandover({ root, subject, binding: bindRun({ candidate_id: "cand-1", generation: "g1", result_version: 1 }), environment: { target: "local", build: "b1" }, content: CONTENT, ready: true, now: T0 });
  return frozen.handover;
}
function feedback(h: Loose, extra: Loose = {}) {
  const sent: Loose = submitFeedback({ root, handover_id: h.handover_id, revision: h.revision, scenario_id: "M1", step: 2, classification: "bug", observation: "No Undo toast appeared", device: "Pixel", command_id: `fb-cmd-${++seq}`, actor: "owner", now: at(1), ...extra });
  expect(sent.ok).toBe(true);
  return sent.feedback;
}
const run = (minutes: number, extra: Loose = {}) => applyUatFeedbackImport({ root, pmDir: pm, now: at(minutes), ...extra });
const read = (campaign: string, file: string) => readFileSync(join(pm, campaign, file), "utf8");
const checklist = (campaign = "Budget") => read(campaign, "4 - Checklist.md");
const book = (campaign = "Budget") => read(campaign, `${campaign} — Master Book.md`);
const lintErrors = (campaign = "Budget") => (lintChecklist(checklist(campaign), { campaign }) as Loose[]).filter((finding) => finding.level === "error");

describe("one Needs-changes thread becomes one correctly owned work item", () => {
  it("creates the checklist row, book section and Pain Inventory line above every used ID, with the feedback verbatim", () => {
    const thread = feedback(handover());
    const result: Loose = run(5);
    expect(result.imported).toEqual([expect.objectContaining({ thread_id: thread.thread_id, workId: "BUD-91", campaign: "Budget", kind: "bug", severity: "friction" })]);
    expect(checklist()).toContain("- [ ] **BUD-91** Remove the tag: No Undo toast appeared — [criteria](<Budget — Master Book.md#bud-91>) _(friction - S)_");
    // Default lane is Next, after BUD-81's row and above the paragraph.
    expect(checklist().indexOf("BUD-91")).toBeGreaterThan(checklist().indexOf("BUD-81"));
    expect(checklist().indexOf("BUD-91")).toBeLessThan(checklist().indexOf("Next paragraph"));
    expect(checklist().indexOf("BUD-91")).toBeLessThan(checklist().indexOf("## Later"));
    const section = book().slice(book().indexOf("### BUD-91"), book().indexOf("### BUD-81"));
    expect(section).toContain("**Kind:** bug");
    expect(section).toContain(`**Source:** UAT feedback ${thread.thread_id}`);
    expect(section).toContain("- **Observed:** No Undo toast appeared");
    expect(section).toContain("- **Scenario:** Remove the tag (M1) step 2 — Open Activity.".replace("Open Activity.", "Uncheck Split."));
    expect(section).toContain("- **Expected:** An Undo toast shows.");
    expect(section).toContain("Pixel");
    expect(section).toContain("[BUD-83](#bud-83)");
    expect(section).toContain("handover `" + thread.handover_id + "` revision 1");
    expect(book()).toMatch(/## Pain Inventory\n\n🟠 \*\*BUD-91\*\*/u);
    expect(lintErrors()).toEqual([]);
    expect(checklist()).toContain("updated: 2026-10-25");
    expect(readImportStatus({ root })[thread.thread_id]).toMatchObject({ status: "imported", workId: "BUD-91", campaign: "Budget" });
  });

  it("an explicit Now urgency lands in Now; a change is a feature and a scenario-less report an investigation, neither with a Pain line", () => {
    const h = handover();
    feedback(h, { urgency: "now" });
    feedback(h, { classification: "change", scenario_id: null, step: null, observation: "Let me tag two at once" });
    feedback(h, { scenario_id: null, step: null, observation: "Something is off here" });
    run(5);
    expect(checklist().indexOf("BUD-91")).toBeLessThan(checklist().indexOf("## Next"));
    expect(checklist().indexOf("BUD-92")).toBeGreaterThan(checklist().indexOf("## Next"));
    expect(book()).toContain("### BUD-92\n\n**Outcome:** Remove a pending split: Let me tag two at once.\n**Kind:** feature");
    expect(book()).toContain("### BUD-93\n\n**Outcome:** Remove a pending split: Something is off here.\n**Kind:** investigation");
    expect(book().match(/🟠 \*\*BUD-9\d\*\*/gu)).toHaveLength(1);
    expect(lintErrors()).toEqual([]);
  });

  it("allocates above archived IDs, per campaign, including PM Tooling's hyphenless R numbers", () => {
    feedback(handover({ run_id: "r-bbbbbbbbbbbb", work_id: "R75", campaign: "PM Tooling", title: "Find each delivery once" }));
    feedback(handover({ run_id: "r-cccccccccccc", work_id: "DLV-143", campaign: "Delivery", title: "Failed Start" }));
    const result: Loose = run(5);
    expect(result.imported.map((item: Loose) => item.workId).sort()).toEqual(["DLV-31", "R71"]);
    expect(checklist("PM Tooling")).toContain("**R71**");
    expect(highestNumber(["see R70 and R7"], "R")).toBe(70);
    expect(highestNumber(["BUD-9 BUD-12.3 XBUD-99"], "BUD")).toBe(12);
  });

  it("neutralizes Markdown and withholds credential-shaped text", () => {
    const h = handover();
    feedback(h, { observation: "Broke `now`\n- [ ] **BUD-999** injected [click](javascript:alert(1)) sk-secret-123", details: "<b>bold</b> #heading | table" });
    run(5, { isSecret: (text: string) => text.includes("sk-secret") });
    expect(checklist()).not.toContain("BUD-999");
    expect(book()).not.toMatch(/^- \[ \] \*\*BUD-999/mu);
    expect(book()).toContain("[withheld]");
    expect(book()).not.toContain("javascript:alert");
    expect(lintErrors()).toEqual([]);
  });
});

describe("what creates nothing", () => {
  it("a comment, a withdrawn report, a resolved disposition and a report still inside the Undo window", () => {
    const h = handover();
    feedback(h, { classification: "comment", observation: "Looks nice" });
    const withdrawn = feedback(h, { observation: "Changed my mind" });
    withdrawFeedback({ root, thread_id: withdrawn.thread_id, command_id: "w-1", actor: "owner", now: at(2) });
    const resolved = feedback(h, { observation: "Fixed already" });
    dispositionFeedback({ root, thread_id: resolved.thread_id, kind: "resolved", reason: "Verified on the retest", command_id: "d-1", actor: "owner", now: at(2) });
    feedback(h, { observation: "Too fresh", now: at(10) });
    const before = [checklist(), book()];
    const result: Loose = run(11);
    expect(result.imported).toEqual([]);
    expect(result.waiting).toBe(1);
    expect([checklist(), book()]).toEqual(before);
    expect(readJournal(root)).toEqual([]);
    // Once its window ends, only that report is imported.
    expect((run(13) as Loose).imported).toHaveLength(1);
  });

  it("a follow-up disposition is still imported as work with its reason", () => {
    const h = handover();
    const thread = feedback(h);
    dispositionFeedback({ root, thread_id: thread.thread_id, kind: "follow-up", reason: "Separate polish", work_id: "BUD-95", command_id: "d-2", actor: "owner", now: at(2) });
    run(5);
    expect(book()).toContain("**Owner disposition:** separate follow-up — Separate polish");
  });

  it("an unresolvable delivery stays visibly blocked and is never routed elsewhere", () => {
    const h = handover({ delivery_ref: "docs/x.md#cancelled", title: "Several attempts" });
    const thread = feedback(h);
    const before = [checklist(), book(), checklist("Delivery"), checklist("PM Tooling")];
    const result: Loose = run(5);
    expect(result.blocked).toEqual([{ thread_id: thread.thread_id, cause: "no owning campaign for this delivery" }]);
    expect([checklist(), book(), checklist("Delivery"), checklist("PM Tooling")]).toEqual(before);
    expect(readImportStatus({ root })[thread.thread_id]).toMatchObject({ status: "blocked", cause: "no owning campaign for this delivery" });
    run(6);
    expect(readJournal(root).filter((row: Loose) => row.state === "blocked")).toHaveLength(1);
  });
});

describe("exactly once", () => {
  it("repeated startups, a double submit and a lost reply produce one item", () => {
    const h = handover();
    const first = feedback(h, { command_id: "same-command" });
    const again: Loose = submitFeedback({ root, handover_id: h.handover_id, revision: 1, scenario_id: "M1", step: 2, classification: "bug", observation: "No Undo toast appeared", command_id: "same-command", actor: "owner", now: at(1) });
    expect(again.repeated).toBe(true);
    run(5);
    const snapshot = [checklist(), book(), readJournal(root).length];
    run(6);
    run(60);
    expect([checklist(), book(), readJournal(root).length]).toEqual(snapshot);
    expect(checklist().match(/\*\*BUD-91\*\*/gu)).toHaveLength(1);
    expect(book().match(new RegExp(first.thread_id, "gu"))).toHaveLength(1);
  });

  it("an amended report updates the same item and allocates nothing new", () => {
    const h = handover();
    const first = feedback(h);
    run(5);
    const idsBefore = checklist().match(/\*\*BUD-\d+\*\*/gu);
    feedback(h, { thread_id: first.thread_id, observation: "Only after a reload", now: at(20) });
    expect((run(21) as Loose).amended).toEqual([]); // inside the Undo window
    const result: Loose = run(30);
    expect(result.amended).toEqual([expect.objectContaining({ workId: "BUD-91" })]);
    expect(result.imported).toEqual([]);
    expect(checklist().match(/\*\*BUD-\d+\*\*/gu)).toEqual(idsBefore);
    expect(book()).toMatch(/- \*\*Update \(rev 2, 2026-10-25\) · fb-[0-9a-f]+:\*\* Only after a reload/u);
    const stable = book();
    run(60);
    expect(book()).toBe(stable);
  });

  it("withdrawing after import keeps the item and records it for the owner, once", () => {
    const h = handover();
    const thread = feedback(h);
    run(5);
    withdrawFeedback({ root, thread_id: thread.thread_id, command_id: "w-2", actor: "owner", now: at(8) });
    const stable = [checklist(), book()];
    run(10);
    run(11);
    expect([checklist(), book()]).toEqual(stable);
    expect(readJournal(root).filter((row: Loose) => row.state === "withdrawn-after-import")).toHaveLength(1);
    expect(readImportStatus({ root })[thread.thread_id]).toMatchObject({ status: "imported", withdrawn: true });
  });

  it("a lost journal converges on the marker already in the corpus", () => {
    const h = handover();
    const thread = feedback(h);
    run(5);
    rmSync(join(root, ".pm", "uat-import.jsonl"));
    const stable = [checklist(), book()];
    run(6);
    expect([checklist(), book()]).toEqual(stable);
    expect(importedMarkers([book()]).get(thread.thread_id)).toBe("BUD-91");
    expect(readJournal(root).some((row: Loose) => row.state === "committed" && row.workId === "BUD-91")).toBe(true);
  });
});

describe("interruption and concurrent edits", () => {
  const journalLines = () => readFileSync(join(root, ".pm", "uat-import.jsonl"), "utf8").split("\n").filter(Boolean);
  const snapshotFiles = () => ({ checklist: checklist(), book: book() });
  const restore = (files: { checklist: string; book: string }) => {
    writeFileSync(join(pm, "Budget", "4 - Checklist.md"), files.checklist);
    writeFileSync(join(pm, "Budget", "Budget — Master Book.md"), files.book);
  };

  it("a crash after the intent only: the same ID is finished", () => {
    const h = handover();
    feedback(h);
    const original = snapshotFiles();
    run(5);
    const [intent] = journalLines();
    writeFileSync(join(root, ".pm", "uat-import.jsonl"), intent + "\n");
    restore(original);
    run(6);
    expect(checklist().match(/\*\*BUD-91\*\*/gu)).toHaveLength(1);
    expect(checklist()).not.toContain("BUD-92");
    expect(readJournal(root).map((row: Loose) => row.state)).toEqual(["intent", "committed"]);
  });

  it("a crash after the checklist write only: the book is completed, the checkbox is not repeated", () => {
    const h = handover();
    feedback(h);
    const original = snapshotFiles();
    run(5);
    const written = snapshotFiles();
    writeFileSync(join(root, ".pm", "uat-import.jsonl"), journalLines()[0] + "\n");
    restore({ checklist: written.checklist, book: original.book });
    run(6);
    expect(checklist()).toBe(written.checklist);
    expect(book()).toContain("### BUD-91");
    expect(book().match(/\*\*Source:\*\* UAT feedback/gu)).toHaveLength(1);
  });

  it("a crash after the book write only: the checklist row is added once", () => {
    const h = handover();
    feedback(h);
    const original = snapshotFiles();
    run(5);
    const written = snapshotFiles();
    writeFileSync(join(root, ".pm", "uat-import.jsonl"), journalLines()[0] + "\n");
    restore({ checklist: original.checklist, book: written.book });
    run(6);
    expect(checklist().match(/\*\*BUD-91\*\*/gu)).toHaveLength(1);
    expect(book()).toBe(written.book);
  });

  it("a crash after both writes, before committed: only the receipt is written", () => {
    const h = handover();
    feedback(h);
    run(5);
    const written = snapshotFiles();
    writeFileSync(join(root, ".pm", "uat-import.jsonl"), journalLines()[0] + "\n");
    run(6);
    expect(snapshotFiles()).toEqual(written);
    expect(readJournal(root).map((row: Loose) => row.state)).toEqual(["intent", "committed"]);
  });

  it("an edit that lands between planning and writing is never overwritten; the feedback stays pending and later imports", () => {
    const h = handover();
    const thread = feedback(h);
    let edited = false;
    const edit = () => {
      if (edited) return;
      edited = true;
      writeFileSync(join(pm, "Budget", "4 - Checklist.md"), checklist() + "\n<!-- owner edit -->\n");
    };
    const result: Loose = run(5, { isSecret: () => { edit(); return false; } });
    expect(result.imported).toEqual([]);
    expect(result.blocked).toEqual([{ thread_id: thread.thread_id, cause: "the checklist changed while importing" }]);
    expect(checklist()).toContain("<!-- owner edit -->");
    expect(checklist()).not.toContain("BUD-91");
    expect(readImportStatus({ root })[thread.thread_id]).toMatchObject({ status: "blocked" });
    const later: Loose = run(6);
    expect(later.imported).toEqual([expect.objectContaining({ workId: "BUD-91" })]);
    expect(checklist()).toContain("<!-- owner edit -->");
    expect(checklist().match(/\*\*BUD-91\*\*/gu)).toHaveLength(1);
  });

  it("another importer holds the lock: nothing is written", () => {
    feedback(handover());
    mkdirSync(join(root, ".pm"), { recursive: true });
    writeFileSync(join(root, ".pm", "uat-import.lock"), "");
    const before = [checklist(), book()];
    const result: Loose = run(5);
    expect(result).toMatchObject({ ok: false, error: "another PM process is importing UAT feedback" });
    expect([checklist(), book()]).toEqual(before);
    expect(existsSync(join(root, ".pm", "uat-import.jsonl"))).toBe(false);
  });

  it("an archive that moved the book's text away does not reuse its ID", () => {
    feedback(handover());
    run(5);
    // Simulate a monthly sweep: the row leaves the checklist and the book moves it into a Shipped Log.
    writeFileSync(join(pm, "Budget", "4 - Checklist.md"), CHECKLIST("Budget"));
    writeFileSync(join(pm, "Budget", "Budget — Master Book.md"), BOOK("Budget") + "\n## Shipped Log\n- ✅ 2026-10-25 — **BUD-91** done (fb)\n");
    feedback(handover(), { observation: "A second, different problem" });
    const result: Loose = run(30);
    expect(result.imported.map((item: Loose) => item.workId)).toEqual(["BUD-92"]);
  });
});

describe("planning is pure", () => {
  it("reserves IDs from the journal even before any file shows them", () => {
    const h = handover();
    const thread = feedback(h);
    const rows = readUat({ root }).feedback;
    const journal = [{ state: "intent", thread_id: "fb-other", revision: 1, workId: "BUD-91", campaign: "Budget", action: "create" }];
    const plan = planThreads({ rows, journal, markers: new Map(), texts: ["BUD-81"], now: at(5) }) as Loose[];
    expect(plan).toEqual([expect.objectContaining({ action: "create", workId: "BUD-92" })]);
    expect(plan[0].thread.thread_id).toBe(thread.thread_id);
  });

  it("the real repository copy of the corpus parses with the real ID allocator", () => {
    const real = join(__dirname, "..", "ERA Notes", "10 - Project Management");
    if (!existsSync(real)) return;
    const copy = join(root, "real");
    mkdirSync(copy, { recursive: true });
    cpSync(join(real, "Delivery"), join(copy, "Delivery"), { recursive: true });
    const texts = [readFileSync(join(copy, "Delivery", "4 - Checklist.md"), "utf8"), readFileSync(join(copy, "Delivery", "Delivery — Master Book.md"), "utf8")];
    expect(highestNumber(texts, "DLV")).toBeGreaterThanOrEqual(146);
  });
});

describe("allocation avoids anchor collisions", () => {
  it("skips a number whose heading slug an existing decimal ID already owns", () => {
    const h = handover({ run_id: "r-dddddddddddd", work_id: "SCH-20", campaign: "Schedule", title: "Chores" });
    const thread = feedback(h);
    const rows = readUat({ root }).feedback;
    // SCH-30 is the highest number; SCH-3.1 owns the slug "sch-31", so the next ID is SCH-32.
    const plan = planThreads({ rows, journal: [], markers: new Map(), texts: ["### SCH-3.1\n SCH-30 done"], now: at(5) }) as Loose[];
    expect(plan).toEqual([expect.objectContaining({ action: "create", workId: "SCH-32" })]);
    expect(plan[0].thread.thread_id).toBe(thread.thread_id);
    // Without the decimal ID, SCH-31 is free.
    expect((planThreads({ rows, journal: [], markers: new Map(), texts: ["SCH-30"], now: at(5) }) as Loose[])[0].workId).toBe("SCH-31");
  });
});
