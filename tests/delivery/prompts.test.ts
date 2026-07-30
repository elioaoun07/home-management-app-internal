import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DOCTRINE_POINTER,
  GIT_BAN_TEXT,
  buildBuildingPrompt,
  buildDiscoveryPrompt,
  buildHandoffVerificationPrompt,
  buildPlanPrompt,
  buildSelfReviewPrompt,
  buildUatPrompt,
  extractFilePointers,
  renderOwnerMessages,
  renderReadWindowGuidance,
  sessionArtifactPath,
  sessionDirRel,
} from "../../scripts/delivery/prompts.mjs";

const packet = { sessionId: "s-1", item: { text: "Fix rounding drift" } };

// A packet shaped like a real one (packet.mjs's buildPacket output), with the
// large fields DLV-8 moved out of the inline prompt — flightCheck in
// particular carried the launch preview's own context-manifest estimate,
// re-transmitted on every turn (Cost Anatomy §5).
const fullPacket = {
  sessionId: "s-2",
  item: { id: "BUD-11", text: "Fix rounding drift", campaign: "Budget", sev: "blocker", effort: "M" },
  acceptanceCriteria: [{ id: "AC1", text: "works" }],
  scopeHints: { keywords: ["rounding"], globs: ["src/features/budget/**"], modules: ["Budget"] },
  constraints: { forbiddenPaths: ["src/components/ui/**"], allowNewDeps: false },
  capabilities: [{ name: "money-rules", reason: "always-on", source: "rule", blocking: true }],
  skills: [".claude/skills/money-rules/SKILL.md"],
  workspace: { baseHead: "abc123", dirtyAtStart: false, baselineStatusHash: "x", changedFiles: [] },
  budget: { maxUsd: 2, maxTokens: 2_000_000, warnPct: 0.8, authorization: "capped" },
  flightCheck: {
    reviewed: true,
    lane: { selected: "STANDARD", recommended: "STANDARD" },
    contextManifest: { estimatedTokens: 17040, estimateMethod: "rough chars/4" },
  },
};

describe("GIT_BAN_TEXT", () => {
  it("never contains alternate-checkout terminology (grep-clean invariant, doc 6 §2)", () => {
    expect(GIT_BAN_TEXT.toLowerCase()).not.toContain("worktree");
  });

  it("bans state-changing git operations and allows read-only ones", () => {
    expect(GIT_BAN_TEXT).toMatch(/never run any git command that changes repository state/i);
    expect(GIT_BAN_TEXT).toMatch(/status, diff, log, show, rev-parse, for-each-ref/);
  });
});

describe("sessionDirRel / sessionArtifactPath (DLV-8)", () => {
  it("anchors artifact paths under the session's own directory, not the repo root", () => {
    expect(sessionDirRel(packet)).toBe(".delivery/sessions/s-1");
    expect(sessionArtifactPath(packet, "artifacts/build-log.md")).toBe(".delivery/sessions/s-1/artifacts/build-log.md");
  });
});

describe("packet-by-reference (DLV-8 / Cost Anatomy §5)", () => {
  it("DISCOVERY carries the work item inline but references the full packet by path, not inline", () => {
    const p = buildDiscoveryPrompt({ packet: fullPacket });
    // What every phase needs inline: still present.
    expect(p).toContain("BUD-11");
    expect(p).toContain("rounding");
    expect(p).toContain("forbiddenPaths");
    // What used to be re-serialized into every prompt at 96% of its bytes:
    // gone. flightCheck in particular re-transmitted its own token estimate
    // on every turn (Cost Anatomy §5 item 5) — must not recur.
    expect(p).not.toContain("contextManifest");
    expect(p).not.toContain("estimatedTokens");
    expect(p).not.toContain("baselineStatusHash");
    expect(p).not.toContain("maxTokens");
    // Referenced by path instead, same doctrine as skills/artifacts.
    expect(p).toContain(".delivery/sessions/s-2/packet.json");
  });

  it("every session-owned artifact path is anchored under the session directory, not the repo root", () => {
    const discovery = buildDiscoveryPrompt({ packet: fullPacket });
    expect(discovery).toContain(".delivery/sessions/s-2/artifacts/spec.md");

    const plan = buildPlanPrompt({ packet: fullPacket });
    expect(plan).toContain(".delivery/sessions/s-2/artifacts/spec.md"); // read
    expect(plan).toContain(".delivery/sessions/s-2/artifacts/plan.md"); // written

    const building = buildBuildingPrompt({ packet: fullPacket, stepId: "S1" });
    expect(building).toContain(".delivery/sessions/s-2/artifacts/plan.md");
    expect(building).toContain(".delivery/sessions/s-2/artifacts/build-log.md");

    const review = buildSelfReviewPrompt({ packet: fullPacket });
    expect(review).toContain(".delivery/sessions/s-2/artifacts/spec.md");
    expect(review).toContain(".delivery/sessions/s-2/artifacts/review-self.md");

    const uat = buildUatPrompt({ packet: fullPacket });
    expect(uat).toContain(".delivery/sessions/s-2/artifacts/uat/**");
    expect(uat).toContain(".delivery/sessions/s-2/artifacts/spec.md");
    expect(uat).toContain(".delivery/sessions/s-2/artifacts/plan.md");
    expect(uat).toContain(".delivery/sessions/s-2/artifacts/validation-report.md");
    expect(uat).toContain(".delivery/sessions/s-2/artifacts/review-self.md");
  });

  it("an explicit priorArtifactPaths override still wins for buildUatPrompt", () => {
    const p = buildUatPrompt({ packet: fullPacket, priorArtifactPaths: ["custom/path.md"] });
    expect(p).toContain("custom/path.md");
    expect(p).not.toContain(".delivery/sessions/s-2/artifacts/spec.md");
  });
});

describe("DOCTRINE_POINTER", () => {
  it("points at CLAUDE.md by path, never pastes its body", () => {
    expect(DOCTRINE_POINTER).toContain("CLAUDE.md");
    expect(DOCTRINE_POINTER.length).toBeLessThan(400); // compact — a pointer, not the doc itself
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
    expect(p).toContain(DOCTRINE_POINTER); // DLV-36: DISCOVERY scopes risk flags, needs house-rule awareness
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

  // DLV-45: FAST's trimmed reading list. The saving is only real if the prompt
  // also stops the agent hunting for the docs it no longer lists — a bare
  // "(none)" reads as an omission worth repairing.
  it("states the narrow scope deliberately when no campaign files are in scope (DLV-45)", () => {
    const p = buildDiscoveryPrompt({ packet, campaignFilePaths: [], includeDoctrine: false });
    expect(p).toContain("FAST-lane session");
    expect(p).toContain("Do not go looking for campaign or roadmap documents");
    expect(p).not.toContain("(none)");
    expect(p).not.toContain(DOCTRINE_POINTER);
    // The item itself is never trimmed — it is the whole basis for the phase.
    expect(p).toContain("Fix rounding drift");
    expect(p).toContain(GIT_BAN_TEXT);
  });

  it("keeps the campaign block and doctrine pointer by default (STANDARD/DEEP unchanged)", () => {
    const p = buildDiscoveryPrompt({ packet, campaignFilePaths: ["Budget/1 - Feature State.md"] });
    expect(p).toContain("Campaign context files");
    expect(p).toContain(DOCTRINE_POINTER);
    expect(p).not.toContain("FAST-lane session");
  });

  it("renders owner guidance when messages are present", () => {
    const p = buildDiscoveryPrompt({ packet, ownerMessages: ["scope note"] });
    expect(p).toContain("Owner guidance (mid-session)");
    expect(p).toContain("scope note");
  });
});

// DLV-60 — the real BUD-14 item, whose `:1144` pointer the agent had and
// ignored, reading 69,204 bytes of a 3,099-line file from line 1 instead.
const pointerItem = {
  id: "BUD-14",
  text: "[TEST] Mobile expense form quick-amount chip: replace the $25 preset with $20 → src/components/expense/MobileExpenseForm.tsx:1144",
  lineText:
    "- [ ] **BUD-14** [TEST] Mobile expense form quick-amount chip: replace the $25 preset with $20 → `src/components/expense/MobileExpenseForm.tsx:1144` _(annoyance - S)_",
};

describe("extractFilePointers (DLV-60)", () => {
  it("pulls path + line from the item's own text", () => {
    expect(extractFilePointers(pointerItem)).toEqual([
      { path: "src/components/expense/MobileExpenseForm.tsx", line: 1144 },
    ]);
  });

  it("survives the backticks the checklist grammar wraps the target in", () => {
    // text is absent here, so the match must come from lineText alone.
    expect(extractFilePointers({ lineText: "see `src/lib/balance-utils.ts:42` _(friction - S)_" })).toEqual([
      { path: "src/lib/balance-utils.ts", line: 42 },
    ]);
  });

  it("returns [] for an item with no pointer, rather than inventing one", () => {
    expect(extractFilePointers({ text: "Fix rounding drift" })).toEqual([]);
    expect(extractFilePointers(null)).toEqual([]);
    // A bare module path with no line is not a window — do not guess an offset.
    expect(extractFilePointers({ text: "touch src/features/budget/index.ts" })).toEqual([]);
  });

  it("de-duplicates the same pointer appearing in both text and lineText", () => {
    expect(extractFilePointers(pointerItem)).toHaveLength(1);
  });
});

describe("renderReadWindowGuidance (DLV-60)", () => {
  it("computes a bounded window centred on the named line", () => {
    const out = renderReadWindowGuidance({ item: pointerItem });
    // 1144 - 40 = 1104, 120 lines wide — covers 1144 and the 1463 usage is
    // reached by Grep, not by reading the file whole.
    expect(out).toContain('offset: 1104, limit: 120');
    expect(out).toContain("not at line 1");
  });

  it("clamps the offset at line 1 for a pointer near the top of a file", () => {
    const out = renderReadWindowGuidance({ item: { text: "fix src/a.ts:3" } });
    expect(out).toContain("offset: 1,");
    expect(out).not.toContain("offset: -37");
  });

  it("still states the general reading budget when the item names no location", () => {
    const out = renderReadWindowGuidance({ item: { text: "Fix rounding drift" } });
    expect(out).toContain("Grep");
    expect(out).not.toContain("offset:");
  });
});

describe("read-window guidance is wired into the cost-bearing phases (DLV-60)", () => {
  it("DISCOVERY carries the window for an item with a file:line pointer", () => {
    const p = buildDiscoveryPrompt({ packet: { sessionId: "s-3", item: pointerItem } });
    expect(p).toContain('offset: 1104, limit: 120');
  });

  it("BUILDING carries it too — it re-reads the file it is about to edit", () => {
    const p = buildBuildingPrompt({ packet: { sessionId: "s-3", item: pointerItem }, stepId: "STEP-1" });
    expect(p).toContain('offset: 1104, limit: 120');
  });

  it("applies in every lane, not only FAST (unlike DLV-45's context narrowing)", () => {
    const deep = buildDiscoveryPrompt({
      packet: { sessionId: "s-4", item: pointerItem, lanePolicy: { lane: "DEEP" } },
      campaignFilePaths: ["Budget/1 - Feature State.md"],
    });
    expect(deep).toContain('offset: 1104, limit: 120');
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
    expect(p).toContain(DOCTRINE_POINTER); // DLV-36: PLAN sets risk flags at the gate
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
    expect(p).toContain(DOCTRINE_POINTER); // DLV-36: BUILDING actually writes code
  });
});

describe("buildSelfReviewPrompt", () => {
  it("references the finish-task DoD skill path and the VERDICT contract", () => {
    const p = buildSelfReviewPrompt({ packet });
    expect(p).toContain(".claude/skills/finish-task/SKILL.md");
    expect(p).toMatch(/VERDICT: PASS/);
    expect(p).toContain(GIT_BAN_TEXT);
    // DLV-36: REVIEWING checks the diff against a narrower, skill-specific
    // checklist (finish-task) — deliberately not re-sending the full house
    // rules doc pointer here too.
    expect(p).not.toContain(DOCTRINE_POINTER);
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
    expect(p).not.toContain(DOCTRINE_POINTER); // DLV-36: assembles from already-produced artifacts, no new decisions
  });
});

describe("buildHandoffVerificationPrompt (DW-8)", () => {
  it("names both providers, embeds the context package, and never mentions the old session transferring", () => {
    const p = buildHandoffVerificationPrompt({
      packet, contextPackageMd: "## objective\nFix rounding drift.", fromProvider: "claude", toProvider: "codex",
    });
    expect(p).toContain("Phase: HANDOFF VERIFICATION");
    expect(p).toContain("running on claude");
    expect(p).toContain("switched to you (codex)");
    expect(p).toContain("## objective\nFix rounding drift.");
    expect(p).toMatch(/never transfers between providers/);
    expect(p).toContain(GIT_BAN_TEXT);
    expect(p).not.toContain(DOCTRINE_POINTER); // DLV-36: restates understanding only, makes no code/schema/UI decision
  });
});

// DLV-55: `maxPlanSteps` was a post-hoc advisory only — the runner warned after
// the plan was written and the money committed. The planner was never told a
// ceiling existed, and duly produced 6 steps for a one-line change.
describe("buildPlanPrompt: step budget (DLV-55)", () => {
  it("states the ceiling, and why fewer steps is cheaper, when a cap is supplied", () => {
    const p = buildPlanPrompt({ packet, maxPlanSteps: 5 });
    expect(p).toContain("at most 5 steps");
    expect(p).toContain("fewer is better");
    // The two failure modes actually observed on s-20260730-104900-9mfu: steps
    // that re-verify the spec, and steps describing manual browser checks.
    expect(p).toContain("validationHint");
    expect(p).toContain("UAT package");
    expect(p).toContain("A one-line change should be a one-step plan");
  });

  it("says nothing about a step budget when no cap is configured", () => {
    const p = buildPlanPrompt({ packet });
    expect(p).not.toContain("Step budget");
  });
});
