// PM Delivery V2 — what the executor is actually told.
//
// Two of the investigated run's confirmed wastes were prompt content, not model
// behaviour (Investigation §4.5, F6/F7): the executor spent a request on `git
// diff` in a workspace with no Git metadata, and the build prompt re-sent the
// full plan JSON into a thread that already contained it. These fixtures pin
// both fixes, and — more importantly — pin the fallbacks, because a plan
// reference the model cannot resolve costs far more than the duplication.
import { describe, expect, it } from "vitest";

import {
  NO_TEST_RUNS,
  WORKSPACE_FACTS,
  handoffInstruction,
  implementationInstruction,
  investigationInstruction,
  repairInstruction,
} from "../../scripts/delivery-v2/interaction.mjs";

const CONTRACT = { outcome: "show the Split tag in transaction details" };
const PLAN = { plan_id: "plan-1", revision: 2, body: { outcome: "do the thing", steps: [{ title: "edit the route" }], scope: ["src/a.ts"] } };

describe("workspace facts", () => {
  it("tells the executor there is no Git, in every prompt that runs commands", () => {
    const prompts = [
      investigationInstruction({ contract: CONTRACT, alias: "BUD-83", acceptance: "" }),
      implementationInstruction({ plan: PLAN, contract: CONTRACT }),
      repairInstruction({ plan: PLAN, failures: [] }),
      handoffInstruction({ checkpoint: { remaining: [], findings: [], next_action: "continue" }, plan: PLAN, contract: CONTRACT }),
    ];
    for (const prompt of prompts) {
      expect(prompt).toContain(WORKSPACE_FACTS);
      expect(prompt).toMatch(/no Git metadata/u);
      expect(prompt).toMatch(/do not run them/u);
    }
  });

  it("says who does verify, so 'do not run tests' does not read as 'nothing is checked'", () => {
    expect(WORKSPACE_FACTS).toMatch(/protected checker/u);
    expect(WORKSPACE_FACTS).toMatch(/deterministic typecheck/u);
  });

  it("keeps the existing no-test-runs clause rather than replacing it", () => {
    expect(implementationInstruction({ plan: PLAN, contract: CONTRACT })).toContain(NO_TEST_RUNS);
  });
});

describe("the approved plan in a resumed thread", () => {
  it("sends the full plan JSON by default", () => {
    const prompt = implementationInstruction({ plan: PLAN, contract: CONTRACT });
    expect(prompt).toContain(JSON.stringify(PLAN.body));
  });

  it("references it instead when the thread already holds that revision", () => {
    const prompt = implementationInstruction({ plan: PLAN, contract: CONTRACT, planAlreadyInThread: true });
    expect(prompt).not.toContain(JSON.stringify(PLAN.body));
    expect(prompt).toMatch(/revision 2, the one you produced earlier in this same conversation/u);
    // The scope rule still has to be stated: the reference replaces the body,
    // not the instruction around it.
    expect(prompt).toMatch(/Stay inside its scope/u);
  });

  it("never references a plan in a handoff, where nothing carries over", () => {
    const prompt = handoffInstruction({ checkpoint: { remaining: [], findings: [], next_action: "continue" }, plan: PLAN, contract: CONTRACT });
    expect(prompt).toContain(JSON.stringify(PLAN.body));
  });
});
