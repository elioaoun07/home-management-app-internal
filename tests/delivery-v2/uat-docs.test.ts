// DLV-145 — the drafted owner wizards become draft handovers without inventing
// anything: unsplittable steps surface as validation problems.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { extractSections, handoversFromDoc, splitStep, workIdentity } from "../../scripts/delivery-v2/uat-docs.mjs";
import { applyDocImport, planDocImport } from "../../scripts/delivery-v2/uat-cli.mjs";
import { listUat, validateContent } from "../../scripts/delivery-v2/uat.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

let roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

const DOC = `# Wizard

## Before you begin

1. Open the PM tab. **Expected:** Home appears.

## V2-83 — remove a split

**Acceptance:** [BUD-83](<../x.md#bud-83>). **Type:** feature. **Prerequisite:** two accounts.

**V2-83-M1 — remove the tag and undo**

1. Open **Activity**. **Expected:** the list appears.
2. Uncheck **Split**. **Expect:** an Undo toast shows.
3. Reload the page and look at the row.

**Reset:** restore the split.

**V2-83-M2 — partner list**

1. Open the partner's list. **Expected:** one row.

## S20 — open chores

**Covers:** SCH-20 navigation. **Actual:** Pending.

1. Open /chores. Expect the Chores agenda to appear.

**Reset:** none.

| Item | Scenario |
|---|---|
| BUD-83 · \`r-83dddb67fea9\` | [V2-83](#v2-83--remove-a-split) |
`;

describe("splitStep", () => {
  it("splits on bold Expected / Expect, on a plain Expect sentence, and leaves a missing expectation empty", () => {
    expect(splitStep("Open **Delivery**. **Expected:** rows appear.")).toEqual({ action: "Open Delivery.", expected: "Rows appear." });
    expect(splitStep("Open it. **Expect:** a list.")).toEqual({ action: "Open it.", expected: "A list." });
    expect(splitStep("Tap **Save**. **Expected acceptance extension:** it stays.")).toEqual({ action: "Tap Save.", expected: "It stays." });
    expect(splitStep("Open /chores. Expect the Chores agenda.")).toEqual({ action: "Open /chores.", expected: "The Chores agenda." });
    expect(splitStep("Return to the page; expect the pill to stay dismissed.")).toEqual({ action: "Return to the page;", expected: "The pill to stay dismissed." });
    expect(splitStep("Open it. expect the list.")).toEqual({ action: "Open it.", expected: "The list." });
    expect(splitStep("Read the log.")).toEqual({ action: "Read the log.", expected: "" });
  });
});

describe("workIdentity", () => {
  it("maps an ID prefix to its campaign", () => {
    expect(workIdentity("BUD-83")).toEqual({ id: "BUD-83", campaign: "Budget" });
    expect(workIdentity("R75").campaign).toBe("PM Tooling");
    expect(workIdentity("HUB-1").campaign).toBe("Hub & ERA");
    expect(workIdentity("ZZZ-1").campaign).toBeNull();
  });
});

describe("handoversFromDoc", () => {
  it("makes one draft handover per section, carries the preface as setup and flags the step with no expectation", () => {
    const parsed: Loose = handoversFromDoc(DOC, { file: "docs/Delivery-UAT-Current-Attempts-2026-10-25.md" });
    expect(parsed.handovers.map((entry: Loose) => entry.subject.work_id)).toEqual(["BUD-83", "SCH-20"]);
    const split = parsed.handovers[0];
    expect(split.subject).toMatchObject({ run_id: "r-83dddb67fea9", campaign: "Budget", delivery_ref: "docs/Delivery-UAT-Current-Attempts-2026-10-25.md#v2-83--remove-a-split" });
    expect(split.content.setup).toContain("Open the PM tab");
    expect(split.content.scenarios.map((entry: Loose) => entry.id)).toEqual(["V2-83-M1", "V2-83-M2"]);
    expect(split.content.scenarios.every((entry: Loose) => entry.draft && entry.required)).toBe(true);
    expect(split.content.scenarios[0]).toMatchObject({ cleanup: "restore the split.", setup: "two accounts." });
    expect(split.environment.target).toBe("local");
    const check: Loose = validateContent(split.content);
    expect(check.problems).toEqual([expect.objectContaining({ code: "step-missing-expectation", scenario: "V2-83-M1", step: 3 })]);
    expect(validateContent(parsed.handovers[1].content).ok).toBe(true);
    expect(parsed.skipped.length).toBe(0);
  });

  it("ignores prose sections and a fenced block's headings", () => {
    const { sections, skipped }: Loose = extractSections("## Notes\n\nJust text.\n\n```\n## Fake\n1. Not a step\n```\n\n## Real\n\n1. Do it. **Expected:** done.\n");
    expect(sections.map((section: Loose) => section.title)).toEqual(["Real"]);
    expect(skipped).toEqual([{ title: "Notes", reason: "no numbered steps" }]);
  });
});

describe("the real drafted wizards", () => {
  const docs = join(__dirname, "..", "..", "docs");
  const present = readdirSync(docs).filter((name) => /^Delivery-UAT-(?!Scenarios)[A-Za-z-]+-2026-10-25\.md$/u.test(name));

  it("parse into draft handovers with unique IDs and bounded content", () => {
    expect(present.length).toBeGreaterThanOrEqual(6);
    const plan: Loose = planDocImport({});
    expect(plan.planned.length).toBeGreaterThan(50);
    const refs = plan.planned.map((entry: Loose) => entry.handover.source.ref);
    expect(new Set(refs).size).toBe(refs.length);
    for (const entry of plan.planned as Loose[]) {
      expect(entry.scenarios).toBeGreaterThan(0);
      expect(entry.problems, entry.handover.source.ref).toEqual([]);
    }
    const exact = (ref: string) => plan.planned.find((entry: Loose) => entry.handover.source.ref.endsWith(ref));
    expect(exact("#v2-83--remove-an-accidental-pending-split").handover.subject).toMatchObject({ work_id: "BUD-83", run_id: "r-83dddb67fea9" });
    expect(exact("#v2-83--remove-an-accidental-pending-split").scenarios).toBe(3);
    expect(exact("#v2-cancel--review-a-cancelled-attempt").handover.subject.run_id).toBeNull();
  });

  it("apply to a temp store once: draft or incomplete, never ready, and a second pass changes nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "era-uat-docs-"));
    roots.push(root);
    const plan: Loose = planDocImport({});
    const first = applyDocImport({ root, plan, now: "2026-10-25T10:00:00.000Z" });
    expect(first.every((result: Loose) => result.ok && !result.repeated)).toBe(true);
    const second = applyDocImport({ root, plan, now: "2026-10-25T11:00:00.000Z" });
    expect(second.every((result: Loose) => result.repeated)).toBe(true);
    const { handovers } = listUat({ root, now: "2026-10-25T12:00:00.000Z" });
    expect(handovers).toHaveLength(plan.planned.length);
    expect(handovers.every((view: Loose) => view.status === "draft" || view.status === "incomplete")).toBe(true);
    expect(handovers.every((view: Loose) => view.signable === false && view.acceptance.shipped === false)).toBe(true);
    expect(handovers.every((view: Loose) => view.scenarios.every((entry: Loose) => entry.result === "pending"))).toBe(true);
    expect(existsSync(join(root, ".delivery", "v2", "uat", "receipts.ndjson"))).toBe(false);
    expect(readFileSync(join(root, ".delivery", "v2", "uat", "handovers.ndjson"), "utf8").split("\n").filter(Boolean)).toHaveLength(plan.planned.length);
  });
});
