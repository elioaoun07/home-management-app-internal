import { describe, expect, it } from "vitest";
import { acceptanceMarkdown } from "../../scripts/pm/app/workAcceptance";

describe("work acceptance display", () => {
  it("separates explicit criteria from source, tier and progress metadata", () => {
    const criterion =
      "- **Acceptance:** Undo restores the original id; the balance is unchanged.";
    expect(
      acceptanceMarkdown(
        [
          "**Outcome:** Restore the row.",
          "**Touches:** `src/example.ts`",
          "- **Source:** [Report](report.md)",
          criterion,
          "- **Tier:** CLAUDE_MID",
          "- **Reading guide:** Implementation details.",
          "- **Progress (2026-11-14):** A long implementation report.",
        ].join("\n"),
      ),
    ).toBe(criterion);
  });

  it("preserves all acceptance blocks, paragraphs, links, nested lists and checkboxes", () => {
    const first = [
      "- **Acceptance:** Complete the operation.",
      "  Continued requirement with [reference](guide.md).",
      "",
      "  - [ ] First case",
      "    - Nested edge case",
      "  - [x] Second case",
      "",
      "  A second paragraph is part of the same criterion.",
    ].join("\n");
    const second = "- **Acceptance:** Retrying makes no duplicate.";
    expect(
      acceptanceMarkdown(
        `**Outcome:** Reliable actions.\n${first}\n- **Tier:** CLAUDE_MID\n${second}\n- **Reading guide:** Source.`,
      ),
    ).toBe(`${first}\n\n${second}`);
  });

  it("keeps unindented criteria beneath a paragraph label and numbered siblings", () => {
    const criteria =
      "**Acceptance:**\n\n- [ ] First criterion\n- [ ] Second criterion\n\n1. Third criterion\n2. Fourth criterion";
    expect(
      acceptanceMarkdown(
        `**Outcome:** Work.\n${criteria}\n\n**Verify:** Run checks.`,
      ),
    ).toBe(criteria);
  });

  it("keeps deeper heading sections and fences without interpreting example labels", () => {
    const criteria = [
      "#### Acceptance",
      "- First criterion",
      "##### Phone",
      "- Touch targets are reachable.",
      "```md",
      "**Tier:** Example data, not a boundary.",
      "#### Not a real heading",
      "```",
      "- Final criterion",
    ].join("\n");
    expect(
      acceptanceMarkdown(
        `**Outcome:** Work.\n${criteria}\n#### Implementation\nLong implementation plan.`,
      ),
    ).toBe(criteria);
  });

  it("ignores fenced and nested example markers and falls back without clear criteria", () => {
    for (const raw of [
      "**Outcome:** Work.\n**Retained contract:** Keep all this context.",
      "```md\n- **Acceptance:** Example only.\n```\nRead the whole brief.",
      "- **Reading guide:** Example\n    - **Acceptance:** Nested example, not a declared criterion.",
      "**Acceptance:** First requirement.\n#### Phone\nThis could still be acceptance.",
    ])
      expect(acceptanceMarkdown(raw)).toBe(raw);
  });

  it("does not drop unfamiliar bold requirements or nested metadata-shaped criteria", () => {
    const criteria =
      "- **Acceptance:** Works offline.\n  - **Status:** Remains pending.\n- **No duplicates:** One row after retry.";
    expect(acceptanceMarkdown(`${criteria}\n- **Tier:** CLAUDE_HIGH`)).toBe(
      criteria,
    );
  });

  it("recognizes CRLF labels without changing the selected Markdown", () => {
    const criteria =
      "**Acceptance:**\r\n\r\n- One requirement\r\n- Another requirement";
    expect(
      acceptanceMarkdown(
        `**Outcome:** Work.\r\n${criteria}\r\n**Verify:** Checks.`,
      ),
    ).toBe(criteria);
  });

  it("retains reference definitions rather than breaking criteria links", () => {
    const raw =
      '- **Acceptance:** Follow [the checklist][ref].\n- **Tier:** CLAUDE_MID\n\n[ref]: guide.md\n  "Reference title"';
    expect(acceptanceMarkdown(raw)).toBe(raw);
  });
});
