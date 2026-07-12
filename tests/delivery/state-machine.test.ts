import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATES,
  GATES,
  NON_TERMINAL_STATES,
  STATES,
  StateMachineError,
  TERMINAL_STATES,
  gateFor,
  isGate,
  isTerminal,
  next,
} from "../../scripts/delivery/state-machine.mjs";

const ALL_EVENTS = [
  "session.start",
  "baseline.captured",
  "baseline.failed",
  "spec.written",
  "decision.approve",
  "decision.reject",
  "build.step.done",
  "build.complete",
  "validation.pass",
  "validation.fail",
  "reviews.pass",
  "reviews.blocking",
  "decision.accept",
  "decision.shipped",
  "decision.answer",
  "decision.retry",
  "question.raised",
  "error.fatal",
  "decision.cancel",
  "runner.crashed",
];

// context sufficient to make an otherwise-legal event succeed without a
// throw caused by *missing context* rather than by transition illegality.
const CONTEXT_FOR_EVENT: Record<string, object> = {
  "decision.answer": { returnTo: "BUILDING" },
  "decision.retry": { returnTo: "BUILDING" },
};

const LEGAL: Record<string, string[]> = {
  SELECTED: ["baseline.captured", "baseline.failed", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  DISCOVERY: ["spec.written", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  SPEC_READY: ["decision.approve", "decision.reject", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  PLAN_READY: ["decision.approve", "decision.reject", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  BUILDING: ["build.step.done", "build.complete", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  VALIDATING: ["validation.pass", "validation.fail", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  REVIEWING: ["reviews.pass", "reviews.blocking", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  UAT_READY: ["decision.accept", "decision.reject", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  ACCEPTED: ["decision.shipped", "question.raised", "error.fatal", "decision.cancel", "runner.crashed"],
  SHIPPED: [],
  BLOCKED: ["decision.retry", "decision.cancel", "runner.crashed"],
  NEEDS_DECISION: ["decision.answer", "decision.cancel", "runner.crashed"],
  FAILED: [],
  CANCELLED: [],
};

describe("state constants", () => {
  it("every LEGAL key matches an entry in STATES", () => {
    expect(Object.keys(LEGAL).sort()).toEqual([...STATES].sort());
  });

  it("classifies terminal states", () => {
    expect(TERMINAL_STATES).toEqual(["SHIPPED", "CANCELLED", "FAILED"]);
    for (const s of TERMINAL_STATES) expect(isTerminal(s)).toBe(true);
    for (const s of ACTIVE_STATES) expect(isTerminal(s)).toBe(false);
  });

  it("ACTIVE_STATES and NON_TERMINAL_STATES exclude every terminal state", () => {
    for (const s of ACTIVE_STATES) expect(TERMINAL_STATES).not.toContain(s);
    for (const s of NON_TERMINAL_STATES) expect(TERMINAL_STATES).not.toContain(s);
  });

  it("gate helpers identify exactly the three hard-coded gates", () => {
    expect(Object.keys(GATES).sort()).toEqual(["PLAN_READY", "SPEC_READY", "UAT_READY"]);
    expect(isGate("SPEC_READY")).toBe(true);
    expect(gateFor("SPEC_READY")).toBe("spec");
    expect(gateFor("PLAN_READY")).toBe("plan");
    expect(gateFor("UAT_READY")).toBe("uat");
    expect(isGate("BUILDING")).toBe(false);
    expect(gateFor("BUILDING")).toBeNull();
  });
});

describe("session.start (the only legal event with no prior state)", () => {
  it("null + session.start -> SELECTED", () => {
    const r = next(null, "session.start");
    expect(r).toEqual({
      to: "SELECTED",
      effects: ["createPacket", "createSessionDir", "spawnRunner"],
    });
  });

  it("any other event with no session throws", () => {
    expect(() => next(null, "baseline.captured")).toThrow(StateMachineError);
    expect(() => next(null, "decision.approve")).toThrow(StateMachineError);
  });
});

describe("exhaustive legal/illegal transition matrix", () => {
  for (const state of STATES) {
    const legalSet = new Set(LEGAL[state]);
    describe(state, () => {
      for (const event of ALL_EVENTS) {
        const context = CONTEXT_FOR_EVENT[event] || {};
        const shouldBeLegal = legalSet.has(event);
        it(`${event} is ${shouldBeLegal ? "legal" : "illegal"}`, () => {
          if (shouldBeLegal) {
            expect(() => next(state, event, context)).not.toThrow();
          } else {
            expect(() => next(state, event, context)).toThrow(StateMachineError);
          }
        });
      }
    });
  }

  it("throws on a wholly unknown state string", () => {
    expect(() => next("NOT_A_REAL_STATE", "spec.written")).toThrow(/unknown state/);
  });
});

describe("gate transitions carry the documented effects", () => {
  it("DISCOVERY -> spec.written -> SPEC_READY opens the spec gate", () => {
    const r = next("DISCOVERY", "spec.written");
    expect(r.to).toBe("SPEC_READY");
    expect(r.effects).toContain("awaitGate:spec");
  });

  it("SPEC_READY -> decision.approve -> PLAN_READY opens the plan gate", () => {
    const r = next("SPEC_READY", "decision.approve");
    expect(r.to).toBe("PLAN_READY");
    expect(r.effects).toContain("awaitGate:plan");
  });

  it("SPEC_READY -> decision.reject -> DISCOVERY (revision loop)", () => {
    expect(next("SPEC_READY", "decision.reject").to).toBe("DISCOVERY");
  });

  it("REVIEWING -> reviews.pass -> UAT_READY opens the uat gate", () => {
    const r = next("REVIEWING", "reviews.pass");
    expect(r.to).toBe("UAT_READY");
    expect(r.effects).toContain("awaitGate:uat");
  });

  it("UAT_READY -> decision.accept -> ACCEPTED writes back the checkbox", () => {
    const r = next("UAT_READY", "decision.accept");
    expect(r.to).toBe("ACCEPTED");
    expect(r.effects).toContain("writebackCheckbox");
  });

  it("ACCEPTED -> decision.shipped -> SHIPPED", () => {
    expect(next("ACCEPTED", "decision.shipped").to).toBe("SHIPPED");
  });
});

describe("typed APPROVE requirement on the plan gate (doc 3 §2, doc 4 §4)", () => {
  it("approves without confirmText when there are no risk flags", () => {
    const r = next("PLAN_READY", "decision.approve", { riskFlags: [] });
    expect(r.to).toBe("BUILDING");
  });

  it("approves without confirmText when riskFlags is omitted entirely", () => {
    expect(next("PLAN_READY", "decision.approve").to).toBe("BUILDING");
  });

  it("rejects db-migration risk without typed APPROVE", () => {
    expect(() =>
      next("PLAN_READY", "decision.approve", { riskFlags: ["db-migration"] }),
    ).toThrow(StateMachineError);
    try {
      next("PLAN_READY", "decision.approve", { riskFlags: ["db-migration"] });
    } catch (err) {
      expect((err as InstanceType<typeof StateMachineError>).code).toBe("APPROVAL_TEXT_REQUIRED");
    }
  });

  it("rejects security risk with the wrong confirmText", () => {
    expect(() =>
      next("PLAN_READY", "decision.approve", {
        riskFlags: ["security"],
        confirmText: "yes please",
      }),
    ).toThrow(StateMachineError);
  });

  it("accepts db-migration risk with confirmText exactly APPROVE", () => {
    const r = next("PLAN_READY", "decision.approve", {
      riskFlags: ["db-migration"],
      confirmText: "APPROVE",
    });
    expect(r.to).toBe("BUILDING");
  });

  it("is unaffected by unrelated risk flags", () => {
    const r = next("PLAN_READY", "decision.approve", { riskFlags: ["some-other-flag"] });
    expect(r.to).toBe("BUILDING");
  });
});

describe("fix-loop bound on VALIDATING and REVIEWING", () => {
  it("validation.fail loops back to BUILDING under the max", () => {
    const r = next("VALIDATING", "validation.fail", { loopCount: 1, maxFixLoops: 3 });
    expect(r.to).toBe("BUILDING");
    expect(r.effects).toContain("incrementFixLoop");
  });

  it("validation.fail blocks at the max", () => {
    const r = next("VALIDATING", "validation.fail", { loopCount: 3, maxFixLoops: 3 });
    expect(r.to).toBe("BLOCKED");
  });

  it("validation.fail defaults to maxFixLoops:3 when context omits it", () => {
    expect(next("VALIDATING", "validation.fail", { loopCount: 2 }).to).toBe("BUILDING");
    expect(next("VALIDATING", "validation.fail", { loopCount: 3 }).to).toBe("BLOCKED");
  });

  it("reviews.blocking loops back to BUILDING under the max, blocks at the max", () => {
    expect(next("REVIEWING", "reviews.blocking", { loopCount: 0, maxFixLoops: 3 }).to).toBe(
      "BUILDING",
    );
    expect(next("REVIEWING", "reviews.blocking", { loopCount: 3, maxFixLoops: 3 }).to).toBe(
      "BLOCKED",
    );
  });
});

describe("NEEDS_DECISION / BLOCKED return-to semantics", () => {
  it("question.raised captures the originating state as returnTo (via context on the pure call site)", () => {
    const r = next("BUILDING", "question.raised");
    expect(r.to).toBe("NEEDS_DECISION");
  });

  it("decision.answer requires context.returnTo and lands there", () => {
    expect(() => next("NEEDS_DECISION", "decision.answer")).toThrow(/returnTo/);
    expect(next("NEEDS_DECISION", "decision.answer", { returnTo: "PLAN_READY" }).to).toBe(
      "PLAN_READY",
    );
  });

  it("decision.answer rejects a returnTo that isn't a real state", () => {
    expect(() =>
      next("NEEDS_DECISION", "decision.answer", { returnTo: "NOT_A_STATE" }),
    ).toThrow(StateMachineError);
  });

  it("decision.retry requires context.returnTo and lands there", () => {
    expect(() => next("BLOCKED", "decision.retry")).toThrow(/returnTo/);
    expect(next("BLOCKED", "decision.retry", { returnTo: "VALIDATING" }).to).toBe("VALIDATING");
  });
});

describe("decision.cancel is terminal and audited, never auto-reverts", () => {
  it("cancels from a variety of non-terminal states", () => {
    for (const state of ["SELECTED", "DISCOVERY", "BUILDING", "BLOCKED", "NEEDS_DECISION", "ACCEPTED"]) {
      const r = next(state, "decision.cancel");
      expect(r.to).toBe("CANCELLED");
      expect(r.effects).toContain("showRevertInstructions");
    }
  });

  it("cannot cancel a terminal state", () => {
    for (const state of TERMINAL_STATES) {
      expect(() => next(state, "decision.cancel")).toThrow(StateMachineError);
    }
  });
});

describe("runner.crashed keeps the current state (UI-only stale badge)", () => {
  it("returns the same state with a staleBadge effect", () => {
    const r = next("BUILDING", "runner.crashed");
    expect(r).toEqual({ to: "BUILDING", effects: ["staleBadge"] });
  });

  it("is illegal from a terminal state", () => {
    expect(() => next("SHIPPED", "runner.crashed")).toThrow(StateMachineError);
  });
});
