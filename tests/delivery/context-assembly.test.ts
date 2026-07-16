import { describe, expect, it } from "vitest";
import { buildContextPackage, buildMechanicalDigest, estimateTokens } from "../../scripts/delivery/context-assembly.mjs";
import { applyDecision, applyQuestionRaised, applyAnswer, applySpec, emptyLedger } from "../../scripts/delivery/memory.mjs";

const FIXED_NOW = () => new Date("2026-07-16T12:00:00.000Z");
const PACKET = { agent: "claude", agentConfig: { model: "claude-sonnet-5" }, constraints: { forbiddenPaths: ["src/components/ui/**"], gitPolicy: "read-only", maxFixLoops: 3 } };

// buildContextPackage's packet/ledger params are required with no JSDoc
// default, so TS infers them as non-optional — same workaround the other
// delivery tests use (see run-session.test.ts's asPacketArgs comment) for
// deliberately-invalid-input tests.
type BuildContextPackageArgs = Parameters<typeof buildContextPackage>[0];
function asArgs(partial: object): BuildContextPackageArgs {
  return partial as unknown as BuildContextPackageArgs;
}

describe("estimateTokens", () => {
  it("is roughly chars/4", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
  it("returns 0 for empty/whitespace text", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("   ")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });
});

describe("buildContextPackage", () => {
  it("requires packet and ledger", () => {
    expect(() => buildContextPackage(asArgs({ ledger: emptyLedger() }))).toThrow();
    expect(() => buildContextPackage(asArgs({ packet: PACKET }))).toThrow();
  });

  it("drops empty layers and only includes ones with content", () => {
    const result = buildContextPackage({ packet: PACKET, ledger: emptyLedger() });
    // constraints layer has content (packet.constraints), everything else empty on a fresh ledger
    expect(result.layers.map((l) => l.name)).toEqual(["packet", "constraints"]);
  });

  it("includes objective, requirements, decisions, and questions from a populated ledger", () => {
    let ledger = applySpec(
      emptyLedger(),
      { problem: "p", proposedBehavior: "pb", acceptanceCriteria: [{ id: "AC1", text: "works" }], openQuestions: [] },
      { itemText: "Fix drift", now: FIXED_NOW },
    ).ledger;
    ledger = applyDecision(ledger, { id: "d-1", gate: "spec", decision: "approve", note: "go" }, { now: FIXED_NOW });
    ledger = applyQuestionRaised(ledger, { id: "q-1", source: "agent", text: "cover LBP too?", kind: "blocking" }, { now: FIXED_NOW });
    ledger = applyAnswer(ledger, { questionId: "q-1", text: "yes" }, { now: FIXED_NOW });

    const result = buildContextPackage({ packet: PACKET, ledger, modeFraming: "You are the orchestrator." });
    const byName = Object.fromEntries(result.layers.map((l) => [l.name, l.text]));
    expect(byName.instructions).toContain("You are the orchestrator.");
    expect(byName.objective).toContain("Fix drift");
    expect(byName.objective).toContain("Problem: p");
    expect(byName.constraints).toContain("requirement AC1");
    expect(byName.decisions).toContain("[spec] approve — go");
    expect(byName.questions).toContain("A: yes");
  });

  it("never includes an unanswered question as if it were resolved", () => {
    const ledger = applyQuestionRaised(emptyLedger(), { id: "q-1", source: "owner", text: "why not X?", kind: "advisory" }, { now: FIXED_NOW });
    const result = buildContextPackage({ packet: PACKET, ledger });
    const questionsLayer = result.layers.find((l) => l.name === "questions")!;
    expect(questionsLayer.text).toContain("OPEN — unanswered");
  });

  it("renders artifact paths, never pasted bodies (artifact-first doctrine)", () => {
    const result = buildContextPackage({ packet: PACKET, ledger: emptyLedger(), artifactPaths: ["artifacts/spec.md", "artifacts/plan.md"] });
    const artifactsLayer = result.layers.find((l) => l.name === "artifacts")!;
    expect(artifactsLayer.text).toBe("- artifacts/spec.md\n- artifacts/plan.md");
  });

  it("renders digests, pins, recent tail, and workspace delta layers", () => {
    const result = buildContextPackage({
      packet: PACKET,
      ledger: emptyLedger(),
      digests: [{ summaryMd: "Phase DISCOVERY completed: found the rounding bug." }],
      pins: [{ turnId: "0003", note: "the exact error text", text: "TypeError: x is not a function" }],
      recentTurns: [{ turnId: "0007", phase: "BUILDING", finalText: "Implemented the fix." }],
      workspaceDelta: { baseHead: "abc123", changedFiles: ["src/lib/balance.ts"] },
      nextAction: "Run VALIDATING.",
    });
    const byName = Object.fromEntries(result.layers.map((l) => [l.name, l.text]));
    expect(byName.digests).toContain("rounding bug");
    expect(byName.pins).toContain("TypeError");
    expect(byName.recentTail).toContain("Implemented the fix");
    expect(byName.workspaceDelta).toContain("src/lib/balance.ts");
    expect(byName.nextAction).toBe("Run VALIDATING.");
  });

  it("computes a total tokenEstimate as the sum of layer estimates", () => {
    const result = buildContextPackage({ packet: PACKET, ledger: emptyLedger() });
    const sum = result.layers.reduce((s, l) => s + l.tokensEst, 0);
    expect(result.tokenEstimate).toBe(sum);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("renderedMd concatenates each non-empty layer under its own heading", () => {
    const result = buildContextPackage({ packet: PACKET, ledger: emptyLedger(), nextAction: "next" });
    expect(result.renderedMd).toContain("## packet");
    expect(result.renderedMd).toContain("## nextAction\nnext");
  });

  it("evidence lists every layer's name + token estimate", () => {
    const result = buildContextPackage({ packet: PACKET, ledger: emptyLedger() });
    expect(result.evidence).toEqual(result.layers.map((l) => ({ name: l.name, tokensEst: l.tokensEst })));
  });
});

describe("buildMechanicalDigest", () => {
  it("summarizes turn count, result, strategy, and usage without any agent call", () => {
    const digest = buildMechanicalDigest({
      phase: "DISCOVERY",
      turns: [{ turnId: "0001", result: "ok", strategy: "start", usage: { input: 100, output: 40 } }],
    });
    expect(digest).toContain("Phase DISCOVERY — 1 turn.");
    expect(digest).toContain("turn 0001 (ok, start): 100 in / 40 out");
  });

  it("pluralizes turn count and appends an artifact summary line when given", () => {
    const digest = buildMechanicalDigest({
      phase: "BUILDING",
      turns: [{ turnId: "0001", result: "ok", strategy: "start" }, { turnId: "0002", result: "failed", strategy: "resume-native" }],
      artifactSummary: "Produced build-log.md with 2 entries.",
    });
    expect(digest).toContain("2 turns.");
    expect(digest).toContain("turn 0002 (failed, resume-native): no usage recorded");
    expect(digest).toContain("Produced build-log.md with 2 entries.");
  });

  it("handles zero turns", () => {
    expect(buildMechanicalDigest({ phase: "PLAN", turns: [] })).toBe("Phase PLAN — 0 turns.");
  });
});
