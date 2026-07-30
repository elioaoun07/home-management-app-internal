import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appendUnderHeading } from "../../scripts/pm/mutations.mjs";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";
import { parseInbox } from "../../scripts/pm/src/features/inbox/InboxView.jsx";

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

describe("inbox view parser", () => {
  it("splits New from Processed and keeps continuation prose with its entry", () => {
    const raw = [
      "---", "type: inbox", "---", "", "# 0 · Idea Inbox", "",
      "> Drop raw thoughts here — this blockquote is guidance, not an entry.", "",
      "## New",
      "- [ ] NFC checklist — probably its own campaign?",
      "",
      "Work on the NFC when leaving the house.",
      "The UI wasn't tested enough.",
      "- [ ] Add approval for transactions requiring both comments",
      "",
      "## Processed",
      "- 2026-07-22 — wizard skill → routed to `skill-factory` (triaged 2026-07-22)",
      "",
      "<!-- Triaged entries land here as plain bullets -->",
      "",
    ].join("\n");

    const { new: fresh, processed } = parseInbox(raw);
    expect(fresh).toHaveLength(2);
    expect(fresh[0].text).toBe("NFC checklist — probably its own campaign?");
    expect(fresh[0].detail).toEqual(["Work on the NFC when leaving the house.", "The UI wasn't tested enough."]);
    expect(fresh[1].detail).toEqual([]);
    expect(processed).toHaveLength(1);
    expect(processed[0].text).toContain("wizard skill");
  });

  it("ignores fenced blocks and comments so an example line is never an entry", () => {
    const raw = "## New\n\n```\n- [ ] not a real entry\n```\n\n- [ ] a real entry\n\n## Processed\n<!-- - 2026-01-01 — a comment -->\n";
    const { new: fresh, processed } = parseInbox(raw);
    expect(fresh.map((entry) => entry.text)).toEqual(["a real entry"]);
    expect(processed).toHaveLength(0);
  });

  it("parses the live inbox file without throwing", () => {
    const parsed = parseInbox(inboxRaw);
    expect(Array.isArray(parsed.new)).toBe(true);
    expect(Array.isArray(parsed.processed)).toBe(true);
  });
});
