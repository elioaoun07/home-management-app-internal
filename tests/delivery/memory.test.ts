import { describe, expect, it } from "vitest";
import {
  MemoryError,
  applyAnswer,
  applyConfigChange,
  applyDecision,
  applyPlan,
  applyQuestionRaised,
  applyQuestionStatus,
  applySpec,
  emptyLedger,
  renderLedgerMd,
  splitOpenQuestions,
} from "../../scripts/delivery/memory.mjs";

const FIXED_NOW = () => new Date("2026-07-16T12:00:00.000Z");

describe("emptyLedger", () => {
  it("starts at rev 0 with empty collections", () => {
    const ledger = emptyLedger();
    expect(ledger.rev).toBe(0);
    expect(ledger.updatedAt).toBeNull();
    expect(ledger.requirements).toEqual([]);
    expect(ledger.questions).toEqual([]);
  });
});

describe("applySpec", () => {
  it("seeds the objective + requirements and bumps rev", () => {
    const { ledger } = applySpec(
      emptyLedger(),
      { problem: "p", proposedBehavior: "pb", acceptanceCriteria: [{ id: "AC1", text: "works" }], openQuestions: [] },
      { itemText: "Fix rounding drift", now: FIXED_NOW },
    );
    expect(ledger.rev).toBe(1);
    expect(ledger.updatedAt).toBe("2026-07-16T12:00:00.000Z");
    expect(ledger.objective).toEqual({ itemText: "Fix rounding drift", problem: "p", proposedBehavior: "pb" });
    expect(ledger.requirements).toEqual([{ id: "AC1", text: "works", source: { artifact: "spec.json" } }]);
  });

  it("raises a blocking question per openQuestions entry with a deterministic id", () => {
    const { ledger, questionIds } = applySpec(
      emptyLedger(),
      { acceptanceCriteria: [], openQuestions: [{ text: "Should X or Y?" }] },
      { turnId: "0001", now: FIXED_NOW },
    );
    expect(questionIds).toEqual(["q-0001-0"]);
    expect(ledger.questions).toHaveLength(1);
    expect(ledger.questions[0]).toMatchObject({
      id: "q-0001-0", text: "Should X or Y?", kind: "blocking", source: "agent", status: "open", phase: "DISCOVERY",
      evidence: { turnId: "0001", seq: null },
    });
  });

  it("does not overwrite an already-set objective field with a missing one", () => {
    let ledger = applySpec(emptyLedger(), { problem: "p1" }, { now: FIXED_NOW }).ledger;
    ledger = applySpec(ledger, {}, { now: FIXED_NOW }).ledger; // re-applied without problem
    expect(ledger.objective.problem).toBe("p1");
  });
});

describe("applyPlan", () => {
  it("records risk flags as open risks", () => {
    const ledger = applyPlan(emptyLedger(), { riskFlags: ["db-migration", "security"] }, { now: FIXED_NOW });
    expect(ledger.risks).toEqual([{ flag: "db-migration", status: "open" }, { flag: "security", status: "open" }]);
  });
});

describe("applyDecision", () => {
  it("appends a decision record with sane defaults", () => {
    const ledger = applyDecision(emptyLedger(), { id: "d-1", gate: "spec", decision: "approve" }, { now: FIXED_NOW });
    expect(ledger.decisions).toEqual([
      { id: "d-1", at: "2026-07-16T12:00:00.000Z", gate: "spec", decision: "approve", note: null, typed: false, source: null, phase: null },
    ]);
  });

  it("requires gate and decision", () => {
    expect(() => applyDecision(emptyLedger(), { id: "d-1" } as unknown as Parameters<typeof applyDecision>[1])).toThrow(MemoryError);
  });
});

describe("applyConfigChange", () => {
  it("appends a configHistory entry", () => {
    const ledger = applyConfigChange(
      emptyLedger(),
      { from: { model: "a" }, to: { model: "b" }, via: "controls/0001-set-config.json" },
      { now: FIXED_NOW },
    );
    expect(ledger.configHistory).toEqual([
      { at: "2026-07-16T12:00:00.000Z", from: { model: "a" }, to: { model: "b" }, via: "controls/0001-set-config.json" },
    ]);
  });
});

describe("applyQuestionRaised / applyAnswer / applyQuestionStatus", () => {
  it("raises an advisory question from the owner", () => {
    const ledger = applyQuestionRaised(
      emptyLedger(),
      { id: "q-1", source: "owner", text: "why not X?", kind: "advisory" },
      { now: FIXED_NOW },
    );
    expect(ledger.questions[0]).toMatchObject({ id: "q-1", source: "owner", kind: "advisory", status: "open" });
  });

  it("rejects an unknown source or kind", () => {
    expect(() => applyQuestionRaised(emptyLedger(), { id: "q-1", source: "bot", text: "x", kind: "advisory" } as unknown as Parameters<typeof applyQuestionRaised>[1])).toThrow(MemoryError);
    expect(() => applyQuestionRaised(emptyLedger(), { id: "q-1", source: "owner", text: "x", kind: "bogus" } as unknown as Parameters<typeof applyQuestionRaised>[1])).toThrow(MemoryError);
  });

  it("answers a question by id, marking it answered", () => {
    let ledger = applyQuestionRaised(emptyLedger(), { id: "q-1", source: "agent", text: "x?", kind: "blocking" }, { now: FIXED_NOW });
    ledger = applyAnswer(ledger, { questionId: "q-1", text: "yes", via: "decision:0001" }, { now: FIXED_NOW });
    expect(ledger.questions[0].status).toBe("answered");
    expect(ledger.questions[0].answer).toEqual({ text: "yes", at: "2026-07-16T12:00:00.000Z", via: "decision:0001" });
  });

  it("throws answering an unknown question id", () => {
    expect(() => applyAnswer(emptyLedger(), { questionId: "missing", text: "x" })).toThrow(MemoryError);
  });

  it("throws re-answering an already-answered question (immutable answers)", () => {
    let ledger = applyQuestionRaised(emptyLedger(), { id: "q-1", source: "agent", text: "x?", kind: "blocking" }, { now: FIXED_NOW });
    ledger = applyAnswer(ledger, { questionId: "q-1", text: "yes" }, { now: FIXED_NOW });
    expect(() => applyAnswer(ledger, { questionId: "q-1", text: "actually no" })).toThrow(MemoryError);
  });

  it("applyQuestionStatus marks dismissed/superseded without an answer", () => {
    let ledger = applyQuestionRaised(emptyLedger(), { id: "q-1", source: "owner", text: "x?", kind: "advisory" }, { now: FIXED_NOW });
    ledger = applyQuestionStatus(ledger, { questionId: "q-1", status: "dismissed" }, { now: FIXED_NOW });
    expect(ledger.questions[0].status).toBe("dismissed");
    expect(ledger.questions[0].answer).toBeNull();
  });

  it("applyQuestionStatus rejects an unknown status", () => {
    const ledger = applyQuestionRaised(emptyLedger(), { id: "q-1", source: "owner", text: "x?", kind: "advisory" }, { now: FIXED_NOW });
    expect(() => applyQuestionStatus(ledger, { questionId: "q-1", status: "bogus" })).toThrow(MemoryError);
  });
});

describe("splitOpenQuestions", () => {
  it("splits open questions by kind, excluding answered/dismissed ones", () => {
    let ledger = emptyLedger();
    ledger = applyQuestionRaised(ledger, { id: "q-1", source: "agent", text: "blocking one", kind: "blocking" }, { now: FIXED_NOW });
    ledger = applyQuestionRaised(ledger, { id: "q-2", source: "owner", text: "advisory one", kind: "advisory" }, { now: FIXED_NOW });
    ledger = applyQuestionRaised(ledger, { id: "q-3", source: "agent", text: "answered blocking", kind: "blocking" }, { now: FIXED_NOW });
    ledger = applyAnswer(ledger, { questionId: "q-3", text: "done" }, { now: FIXED_NOW });

    const { blocking, advisory } = splitOpenQuestions(ledger);
    expect(blocking.map((q) => q.id)).toEqual(["q-1"]);
    expect(advisory.map((q) => q.id)).toEqual(["q-2"]);
  });
});

describe("renderLedgerMd", () => {
  it("renders objective, requirements, decisions, and answered questions", () => {
    let ledger = emptyLedger();
    ledger = applySpec(ledger, { problem: "p", proposedBehavior: "pb", acceptanceCriteria: [{ id: "AC1", text: "works" }] }, { now: FIXED_NOW }).ledger;
    ledger = applyDecision(ledger, { id: "d-1", gate: "spec", decision: "approve", note: "looks good" }, { now: FIXED_NOW });
    ledger = applyQuestionRaised(ledger, { id: "q-1", source: "agent", text: "x?", kind: "blocking" }, { now: FIXED_NOW });
    ledger = applyAnswer(ledger, { questionId: "q-1", text: "yes" }, { now: FIXED_NOW });

    const md = renderLedgerMd(ledger);
    expect(md).toContain("Problem: p");
    expect(md).toContain("AC1: works");
    expect(md).toContain("[spec] approve — looks good");
    expect(md).toContain("Q: x?");
    expect(md).toContain("A: yes");
  });

  it("renders an empty ledger without throwing", () => {
    expect(renderLedgerMd(emptyLedger())).toBe("");
  });
});
