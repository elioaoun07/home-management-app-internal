import { describe, expect, it } from "vitest";
import { IMPORT_GRACE_MS, highestWorkNumber, issueTitle, mdInline, planEraIssueImport } from "../scripts/pm/era-issues.mjs";
import { lintChecklist } from "../scripts/pm/lint.mjs";
import { kindOf } from "../scripts/pm/shared/portfolio.mjs";

const CHECKLIST = `---
created: 2026-09-10
updated: 2026-09-27
type: checklist
status: active
owner: Elio
---

# Hub & ERA — Checklist

## Now

- [ ] **HUB-83** Run the era_lexicon migration — [criteria](<Hub & ERA — Master Book.md#hub-83>) _(blocker - S)_

## Next

- [ ] **HUB-44** Attribute model usage — [criteria](<Hub & ERA — Master Book.md#hub-44>) _(friction - M)_

## Later
`;

const BOOK = `---
created: 2026-09-10
updated: 2026-09-27
type: master-book
status: active
owner: Elio
---

# Hub & ERA — Master Book

## Pain Inventory

🟠 **HUB-84** A follow-up was read as a reschedule.

## Acceptance Criteria Index

### HUB-84

**Outcome:** A follow-up edits the last result.

### HUB-83

**Outcome:** The lexicon table exists.
`;

const NOW = Date.parse("2026-10-03T15:10:00.000Z");
const OWNER = "11111111-1111-4111-8111-111111111111";

function report(id: string, minutesAgo: number, issue: Record<string, unknown>, user = OWNER) {
  return {
    id,
    user_id: user,
    created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
    issue: {
      v: 1,
      kind: "missed",
      note: null,
      conversationId: "c",
      messageId: "a2",
      request: "add a recurring reminder on Saturday at 6 PM",
      reply: "I didn't catch that.",
      transcript: [
        { id: "u2", role: "user", text: "add a recurring reminder on Saturday at 6 PM", at: "2026-10-03T15:00:00.000Z", intent: "unknown", outcome: null },
        { id: "a2", role: "assistant", text: "I didn't catch that.", at: "2026-10-03T15:00:01.000Z", intent: "unknown", outcome: null },
      ],
      actions: [],
      reportedAt: "2026-10-03T15:01:00.000Z",
      ...issue,
    },
  };
}

const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const R2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const R3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("planEraIssueImport", () => {
  it("files a missed request as a Now defect with criteria, pain and transcript", () => {
    const plan = planEraIssueImport({ reports: [report(R1, 9, {})], checklistRaw: CHECKLIST, bookRaw: BOOK, ownerUserId: OWNER, now: NOW });
    expect(plan.imported).toEqual([
      { reportId: R1, workId: "HUB-85", title: 'ERA handles "add a recurring reminder on Saturday at 6 PM"', severity: "friction" },
    ]);
    const now = plan.checklistRaw.slice(plan.checklistRaw.indexOf("## Now"), plan.checklistRaw.indexOf("## Next"));
    expect(now).toContain("**ERA reports**");
    expect(now).toContain(
      '- [ ] **HUB-85** ERA handles "add a recurring reminder on Saturday at 6 PM" — [criteria](<Hub & ERA — Master Book.md#hub-85>) _(friction - S)_',
    );
    expect(plan.checklistRaw).toMatch(/^updated: 2026-10-03$/m);

    const section = plan.bookRaw.slice(plan.bookRaw.indexOf("### HUB-85"), plan.bookRaw.indexOf("### HUB-84"));
    expect(kindOf(section)).toBe("bug");
    expect(section).toContain(`**Source:** ERA report ${R1} · missed · owner · 2026-10-03 18:01 (Asia/Beirut)`);
    expect(section).toContain("- You · 18:00 — add a recurring reminder on Saturday at 6 PM _(unknown)_");
    expect(section).toContain("- ERA · 18:00 — I didn't catch that. _(unknown)_ ← reported");
    expect(plan.bookRaw).toContain('🟠 **HUB-85** ERA missed "add a recurring reminder on Saturday at 6 PM" (ERA report, 2026-10-03). See [acceptance](<#hub-85>).');
  });

  it("keeps the checklist grammar valid", () => {
    const plan = planEraIssueImport({
      reports: [report(R1, 9, {}), report(R2, 8, { kind: "wrong", request: "move it to 6 PM" })],
      checklistRaw: CHECKLIST,
      bookRaw: BOOK,
      now: NOW,
    });
    const errors = lintChecklist(plan.checklistRaw, { campaign: "Hub & ERA" }).filter((f: { level: string }) => f.level === "error");
    expect(errors).toEqual([]);
    expect(plan.checklistRaw.match(/\*\*ERA reports\*\*/g)).toHaveLength(1);
  });

  it("files a wrong action as a blocker hotfix", () => {
    const plan = planEraIssueImport({
      reports: [report(R2, 5, { kind: "wrong", request: "move it to 6 PM" }, "22222222-2222-4222-8222-222222222222")],
      checklistRaw: CHECKLIST,
      bookRaw: BOOK,
      ownerUserId: OWNER,
      now: NOW,
    });
    expect(plan.imported[0]).toMatchObject({ workId: "HUB-85", severity: "blocker", title: 'ERA gets "move it to 6 PM" right' });
    expect(plan.bookRaw).toContain("· wrong · partner ·");
    expect(plan.bookRaw).toContain('🔴 **HUB-85** ERA did the wrong thing with "move it to 6 PM"');
  });

  it("imports each report once and waits out the Undo window", () => {
    const first = planEraIssueImport({ reports: [report(R1, 9, {})], checklistRaw: CHECKLIST, bookRaw: BOOK, now: NOW });
    const again = planEraIssueImport({
      reports: [report(R1, 9, {}), report(R3, 1, {})],
      checklistRaw: first.checklistRaw,
      bookRaw: first.bookRaw,
      now: NOW,
    });
    expect(again.imported).toEqual([]);
    expect(1 * 60_000).toBeLessThan(IMPORT_GRACE_MS);

    const journaled = planEraIssueImport({ reports: [report(R1, 9, {})], checklistRaw: CHECKLIST, bookRaw: BOOK, journalIds: [R1], now: NOW });
    expect(journaled.imported).toEqual([]);
  });

  it("allocates above every ID the corpus has used", () => {
    const plan = planEraIssueImport({
      reports: [report(R1, 9, {})],
      checklistRaw: CHECKLIST,
      bookRaw: BOOK,
      corpusTexts: ["Archived: HUB-91 merged into HUB-92."],
      now: NOW,
    });
    expect(plan.imported[0].workId).toBe("HUB-93");
    expect(highestWorkNumber(["HUB-7 and HUB-12"])).toBe(12);
  });

  it("neutralises Markdown in reported text and withholds secrets", () => {
    const plan = planEraIssueImport({
      reports: [
        report(R1, 9, {
          request: "## heading [link](x) `code` <b>",
          note: "token sk-ant-abcdefghijklmnopqrstuvwxyz",
        }),
      ],
      checklistRaw: CHECKLIST,
      bookRaw: BOOK,
      now: NOW,
      isSecret: (text: string) => text.includes("sk-ant-"),
    });
    expect(plan.bookRaw).not.toContain("[link](x)");
    expect(plan.bookRaw).toContain("- **Comment:** [withheld]");
    expect(mdInline("a\nb `c` [d]")).toBe("a b 'c' \\[d\\]");
    expect(issueTitle({ kind: "missed", request: 'say "hi"' })).toBe(`ERA handles "say 'hi'"`);
  });
});
