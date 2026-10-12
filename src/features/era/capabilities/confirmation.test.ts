import { beforeEach, expect, it } from "vitest";
import { useEraStore } from "../useEraStore";
import { takeProposalForConfirmation } from "./confirmation";

beforeEach(() => useEraStore.getState().reset());
it("consumes a proposal once across multiple card/voice callers", () => {
  const proposal = {
    kind: "propose_plan" as const,
    text: "Add milk",
    sourceText: "Add milk",
    plan: {
      steps: [
        {
          id: "add",
          label: "Add milk",
          capabilityId: "shopping.add",
          slots: { items: ["Milk"] },
        },
      ],
    },
  };
  useEraStore.getState().setActiveProposal(proposal);
  expect(takeProposalForConfirmation()).toBe(proposal);
  expect(takeProposalForConfirmation()).toBeNull();
  expect(useEraStore.getState().turnInFlight).toBe(true);
});
it("does not consume a card during another turn or model request", () => {
  const proposal = { kind: "handoff" as const, text: "Open", open: () => {} };
  useEraStore.setState({ activeProposal: proposal, askingAI: true });
  expect(takeProposalForConfirmation()).toBeNull();
  expect(useEraStore.getState().activeProposal).toBe(proposal);
});
