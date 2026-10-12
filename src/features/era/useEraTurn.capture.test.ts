import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { useEraTurn } from "./useEraTurn";
import { useEraStore } from "./useEraStore";
import type { ExpenseCapture } from "./capture";
import { recordEraArtifacts } from "./recordArtifacts";

const fixture = vi.hoisted(() => ({
  qc: null as unknown,
  submit: vi.fn(),
  ask: vi.fn(),
  message: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => fixture.qc,
}));
vi.mock("./useEraBudgetSubmit", () => ({
  useEraBudgetSubmit: () => ({ submit: fixture.submit, ready: true }),
}));
vi.mock("./useEraAskAI", () => ({
  useEraAskAI: () => ({ askAI: fixture.ask }),
}));
vi.mock("./templates/useEraTemplates", () => ({ useEraTemplates: () => ({}) }));
vi.mock("./useEraLexicon", () => ({ useEraLexicon: () => ({}) }));
vi.mock("./recordArtifacts", () => ({ recordEraArtifacts: vi.fn() }));
vi.mock("./useEraConversation", () => ({
  useActiveEraConversation: () => ({ data: { id: "chat" } }),
  useCreateEraMessage: () => ({ mutateAsync: fixture.message }),
  useEraMessages: () => ({}),
  eraConversationTarget: () => ({ id: "chat", ensure: undefined }),
}));
let hook: ReturnType<typeof useEraTurn>;
function Capture() {
  hook = useEraTurn();
  return null;
}
const capture: ExpenseCapture = {
  kind: "expense",
  accountId: "wallet",
  amount: 5,
  categoryId: "events",
  subcategoryId: "",
  description: "Event ticket",
  date: "2026-10-12",
};
const result = {
  ok: true,
  draftId: "11111111-1111-4111-8111-111111111111",
  accountId: "wallet",
  currency: "USD",
  parsed: { amount: 5, categoryId: "events", categoryName: "Events" },
};
beforeEach(() => {
  vi.clearAllMocks();
  fixture.qc = new QueryClient();
  fixture.submit.mockResolvedValue(result);
  fixture.message.mockResolvedValue({ message: { id: "message" } });
  useEraStore.setState({
    explicitConversation: "chat",
    activeFaceKey: "schedule",
    pendingTurn: null,
    activeRunId: null,
    askingAI: false,
    turnInFlight: false,
    focusEntities: [],
    activeProposal: null,
  });
  renderToString(createElement(Capture));
});
describe("typed native capture uses the shared turn handler", () => {
  it("overrides an incidental event keyword and a stale reminder question without AI", async () => {
    useEraStore.setState({
      pendingTurn: {
        kind: "draftReminder",
        title: "Old reminder",
        priority: "normal",
        rawText: "Remind me",
        createdAt: Date.now(),
      },
    });
    const r = await hook.runTurn("I paid for event 5$", { capture });
    expect(r.intent.kind).toBe("draftTransaction");
    expect(r.outcome?.status).toBe("drafted");
    expect(fixture.submit).toHaveBeenCalledExactlyOnceWith(
      "I paid for event 5$",
      capture,
    );
    expect(fixture.ask).not.toHaveBeenCalled();
    expect(useEraStore.getState().pendingTurn).toBeNull();
    expect(recordEraArtifacts).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entity: "draft", id: result.draftId }),
      ]),
      fixture.qc,
    );
    expect(fixture.message).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        intent_kind: "draftTransaction",
        intent_payload: expect.objectContaining({ capture }),
      }),
    );
  });
  it("does not hand a selected native helper to the compound-request model path", async () => {
    await hook.runTurn("Add an event and add milk to the shopping list", {
      capture,
    });
    expect(fixture.submit).toHaveBeenCalledOnce();
    expect(fixture.ask).not.toHaveBeenCalled();
  });
  it("shares the dispatch lock with a second submit", async () => {
    let finish!: (value: typeof result) => void;
    fixture.submit.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = hook.runTurn("I paid", { capture });
    const second = await hook.runTurn("I paid", { capture });
    expect(second.keepInput).toBe(true);
    expect(fixture.submit).toHaveBeenCalledOnce();
    finish(result);
    await first;
    expect(useEraStore.getState().turnInFlight).toBe(false);
  });
});
