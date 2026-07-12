import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GIT_BAN_TEXT,
  buildBuildingPrompt,
  buildDiscoveryPrompt,
  buildPlanPrompt,
  buildSelfReviewPrompt,
  buildUatPrompt,
  renderOwnerMessages,
} from "../../scripts/delivery/prompts.mjs";

const packet = { sessionId: "s-1", item: { text: "Fix rounding drift" } };

describe("GIT_BAN_TEXT", () => {
  it("never contains alternate-checkout terminology (grep-clean invariant, doc 6 §2)", () => {
    expect(GIT_BAN_TEXT.toLowerCase()).not.toContain("worktree");
  });

  it("bans state-changing git operations and allows read-only ones", () => {
    expect(GIT_BAN_TEXT).toMatch(/never run any git command that changes repository state/i);
    expect(GIT_BAN_TEXT).toMatch(/status, diff, log, show, rev-parse, for-each-ref/);
  });
});

describe("renderOwnerMessages", () => {
  it("renders nothing for an empty list", () => {
    expect(renderOwnerMessages([])).toBe("");
    expect(renderOwnerMessages()).toBe("");
  });

  it("renders a heading + bullet per message", () => {
    const out = renderOwnerMessages(["do X first", "watch out for Y"]);
    expect(out).toContain("Owner guidance (mid-session)");
    expect(out).toContain("- do X first");
    expect(out).toContain("- watch out for Y");
  });

  it("accepts {text} objects as well as raw strings", () => {
    const out = renderOwnerMessages([{ text: "structured message" }]);
    expect(out).toContain("- structured message");
  });
});

describe("buildDiscoveryPrompt", () => {
  it("names the DISCOVERY phase, the spec artifact path, and includes the git ban", () => {
    const p = buildDiscoveryPrompt({ packet, campaignFilePaths: ["Budget/1 - Feature State.md"] });
    expect(p).toContain("Phase: DISCOVERY");
    expect(p).toContain("artifacts/spec.md");
    expect(p).toContain("Budget/1 - Feature State.md");
    expect(p).toContain(GIT_BAN_TEXT);
  });

  it("references skill files by path only, never inlining their body", () => {
    const p = buildDiscoveryPrompt({ packet, skillPaths: [".claude/skills/money-rules/SKILL.md"] });
    expect(p).toContain(".claude/skills/money-rules/SKILL.md");
    // The module never reads any file (zero-dependency, no fs import) — grep-provable.
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "delivery", "prompts.mjs"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']node:fs["']/);
  });

  it("omits the owner-guidance section when there are no messages", () => {
    const p = buildDiscoveryPrompt({ packet });
    expect(p).not.toContain("Owner guidance");
  });

  it("renders owner guidance when messages are present", () => {
    const p = buildDiscoveryPrompt({ packet, ownerMessages: ["scope note"] });
    expect(p).toContain("Owner guidance (mid-session)");
    expect(p).toContain("scope note");
  });
});

describe("buildPlanPrompt", () => {
  it("references the spec path and the plan artifact target", () => {
    const p = buildPlanPrompt({ packet, approvalNote: "looks good" });
    expect(p).toContain("Phase: PLAN");
    expect(p).toContain("artifacts/spec.md");
    expect(p).toContain("artifacts/plan.md");
    expect(p).toContain("looks good");
    expect(p).toContain(GIT_BAN_TEXT);
  });
});

describe("buildBuildingPrompt", () => {
  it("requires stepId", () => {
    const missingStepId = { packet } as unknown as Parameters<typeof buildBuildingPrompt>[0];
    expect(() => buildBuildingPrompt(missingStepId)).toThrow(/stepId/);
  });

  it("names the plan path, the step, and includes a prior validation excerpt when given", () => {
    const p = buildBuildingPrompt({
      packet,
      stepId: "step-1",
      priorValidationExcerpt: "TypeError: boom",
    });
    expect(p).toContain("Phase: BUILDING");
    expect(p).toContain("artifacts/plan.md");
    expect(p).toContain('step "step-1"');
    expect(p).toContain("TypeError: boom");
    expect(p).toContain(GIT_BAN_TEXT);
  });
});

describe("buildSelfReviewPrompt", () => {
  it("references the finish-task DoD skill path and the VERDICT contract", () => {
    const p = buildSelfReviewPrompt({ packet });
    expect(p).toContain(".claude/skills/finish-task/SKILL.md");
    expect(p).toMatch(/VERDICT: PASS/);
    expect(p).toContain(GIT_BAN_TEXT);
  });
});

describe("buildUatPrompt", () => {
  it("lists prior artifact paths and targets artifacts/uat/**", () => {
    const p = buildUatPrompt({ packet, priorArtifactPaths: ["artifacts/spec.md", "artifacts/plan.md"] });
    expect(p).toContain("Phase: UAT PREP");
    expect(p).toContain("artifacts/spec.md");
    expect(p).toContain("artifacts/plan.md");
    expect(p).toContain("artifacts/uat/");
    expect(p).toContain(GIT_BAN_TEXT);
  });
});
