import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appendUnderHeading } from "../../scripts/pm/mutations.mjs";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";

const inboxRaw = readFileSync(
  join(__dirname, "../../ERA Notes/10 - Project Management/0 - Inbox.md"),
  "utf8",
);

describe("PM Idea Inbox", () => {
  it("appends a captured entry inside ## New, before ## Processed", () => {
    const line = "- [ ] 2026-07-22 — bug while transferring to partner account";
    const out = appendUnderHeading(inboxRaw, /^#{1,6}\s+New/i, line);
    const newIdx = out.indexOf("## New");
    const lineIdx = out.indexOf(line);
    const processedIdx = out.indexOf("## Processed");
    expect(newIdx).toBeGreaterThan(-1);
    expect(lineIdx).toBeGreaterThan(newIdx);
    expect(lineIdx).toBeLessThan(processedIdx);
  });

  it("parses New entries as chip-less untriaged tasks", () => {
    const raw = `## New\n- [ ] 2026-07-22 — remove AI Chatbot button from Outfits page\n\n## Processed\n`;
    const tasks = fileTasks(raw);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].idChip).toBeNull();
    expect(tasks[0].severity).toBeNull();
    expect(tasks[0].state).toBe("open");
  });

  it("yields no task for a processed plain bullet", () => {
    const raw = `## New\n\n## Processed\n- 2026-07-22 — original text → **BUD-15** in [Budget/4](<Budget/4 - Checklist.md>) (triaged 2026-07-22)\n`;
    expect(fileTasks(raw)).toHaveLength(0);
  });

  it("starter inbox file has both sections and no leftover tasks", () => {
    expect(inboxRaw).toContain("## New");
    expect(inboxRaw).toContain("## Processed");
  });
});
