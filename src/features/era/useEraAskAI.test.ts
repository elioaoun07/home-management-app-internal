import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useEraAskAI } from "./useEraAskAI";
import { useEraStore } from "./useEraStore";
import { ERA_CAPABILITIES } from "./capabilities/registry";
import { eraKeys } from "./queryKeys";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { recordEraArtifacts } from "./recordArtifacts";
import { findReminderCandidates } from "./intents/resolvers/reminderLookup";

const mock = vi.hoisted(() => ({
  user: vi.fn(),
  message: vi.fn(),
  qc: null as unknown,
}));
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ auth: { getUser: mock.user } }),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => mock.qc,
}));
vi.mock("./useEraConversation", () => ({
  useActiveEraConversation: () => ({ data: { id: "chat" } }),
  useEraMessages: () => ({}),
  useCreateEraMessage: () => ({ mutateAsync: mock.message }),
}));
vi.mock("./recordArtifacts", () => ({ recordEraArtifacts: vi.fn() }));
vi.mock("./intents/resolvers/reminderLookup", () => ({
  findReminderCandidates: vi.fn(),
}));
vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));

let qc: QueryClient;
let hook: ReturnType<typeof useEraAskAI>;
function Capture() {
  hook = useEraAskAI();
  return null;
}
const context = () => ({
  ownerId: "owner",
  conversationId: "chat",
  referenceDate: new Date().toISOString(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});
function single(
  capabilityId = "shopping.add",
  slots: Record<string, unknown> = { items: ["milk"] },
) {
  useEraStore.setState({
    activeProposal: {
      kind: "propose_action",
      text: "Add milk?",
      capabilityId,
      slots,
      sourceText: "Add milk",
      requestContext: context(),
    },
  });
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(safeFetch).mockReset();
  qc = new QueryClient();
  mock.qc = qc;
  qc.setQueryData(eraKeys.conversations(), [{ id: "chat", user_id: "owner" }]);
  mock.user.mockResolvedValue({ data: { user: { id: "owner" } } });
  mock.message.mockResolvedValue({ message: { id: "receipt" } });
  useEraStore.getState().resetConversationContext();
  useEraStore.setState({
    explicitConversation: "chat",
    askingAI: false,
    turnInFlight: false,
  });
  renderToString(createElement(Capture));
});

describe("actual Ask AI confirmation, durable execution off", () => {
  it("binds an actual model card to its authenticated request and confirms only once", async () => {
    vi.mocked(safeFetch).mockResolvedValue(
      Response.json({
        kind: "propose_action",
        text: "Add milk?",
        capabilityId: "shopping.add",
        slots: { items: ["milk"] },
      }),
    );
    const execute = vi
      .spyOn(ERA_CAPABILITIES["shopping.add"], "execute")
      .mockResolvedValue({
        text: "Milk added",
        artifacts: [
          {
            entity: "shopping_item",
            action: "created",
            id: "milk",
            title: "Milk",
          },
        ],
      });
    await hook.askAI("Add milk", {
      skipUserMessage: true,
      conversationId: "chat",
    });
    expect(execute).not.toHaveBeenCalled();
    expect(useEraStore.getState().activeProposal?.requestContext).toMatchObject(
      { ownerId: "owner", conversationId: "chat" },
    );
    await Promise.all([hook.confirmProposal(), hook.confirmProposal()]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(useEraStore.getState().eraReply).toBe("Milk added");
  });
  it("a delayed model response cannot publish a card under a different account", async () => {
    vi.mocked(safeFetch).mockImplementation(async () => {
      mock.user.mockResolvedValue({ data: { user: { id: "partner" } } });
      return Response.json({
        kind: "propose_action",
        text: "Add milk?",
        capabilityId: "shopping.add",
        slots: { items: ["milk"] },
      });
    });
    await hook.askAI("Add milk", {
      skipUserMessage: true,
      conversationId: "chat",
    });
    expect(useEraStore.getState().activeProposal).toBeNull();
    expect(mock.message).not.toHaveBeenCalled();
  });
  it("carries the original calendar anchor into delayed confirmation", async () => {
    single("reminder.create", { rawText: "Collect milk tomorrow at 5pm" });
    const proposal = useEraStore.getState().activeProposal!;
    const original = "2026-10-10T12:00:00.000Z";
    useEraStore.setState({
      activeProposal: {
        ...proposal,
        requestContext: { ...context(), referenceDate: original },
      },
    });
    const execute = vi
      .spyOn(ERA_CAPABILITIES["reminder.create"], "execute")
      .mockResolvedValue({
        text: "When?",
        pending: {
          kind: "draftReminder",
          title: "Milk",
          priority: "normal",
          rawText: "Milk",
          createdAt: Date.now(),
        },
      });
    await hook.confirmProposal();
    expect(execute).toHaveBeenCalledWith(
      { rawText: "Collect milk tomorrow at 5pm" },
      expect.objectContaining({ referenceDate: new Date(original) }),
    );
    expect(useEraStore.getState().pendingTurn?.kind).toBe("draftReminder");
  });
  it("does not publish private read results after the account changes during execution", async () => {
    vi.mocked(safeFetch).mockResolvedValue(
      Response.json({
        kind: "propose_action",
        text: "Shopping",
        capabilityId: "shopping.list",
        slots: {},
      }),
    );
    vi.spyOn(ERA_CAPABILITIES["shopping.list"], "execute").mockImplementation(
      async () => {
        mock.user.mockResolvedValue({ data: { user: { id: "partner" } } });
        return { text: "Private shopping contents" };
      },
    );
    expect(
      await hook.askAI("Show shopping", {
        skipUserMessage: true,
        conversationId: "chat",
      }),
    ).toBe("Request suspended.");
    expect(useEraStore.getState().eraReply).not.toContain("Private shopping");
    expect(mock.message).not.toHaveBeenCalled();
  });
  it("rechecks expired focus before dispatching a single action", async () => {
    single("reminder.reschedule", {
      itemId: "dentist",
      title: "Dentist",
      whenText: "tomorrow",
    });
    useEraStore.setState({
      focusEntities: [
        { id: "dentist", title: "Dentist", type: "reminder", addedAt: 0 },
      ],
    });
    const execute = vi
      .spyOn(ERA_CAPABILITIES["reminder.reschedule"], "execute")
      .mockResolvedValue({ text: "Moved" });
    await hook.confirmProposal();
    expect(execute).not.toHaveBeenCalled();
    expect(useEraStore.getState().eraReply).toContain("no longer valid");
  });
  it("does not label a single write without an artifact as successful", async () => {
    single();
    vi.spyOn(ERA_CAPABILITIES["shopping.add"], "execute").mockResolvedValue({
      text: "Added",
      ok: true,
    });
    await hook.confirmProposal();
    expect(useEraStore.getState().eraReply).toContain("Couldn't verify");
    expect(mock.message).toHaveBeenCalledWith(
      expect.objectContaining({
        intent_payload: expect.objectContaining({
          outcome: expect.objectContaining({ status: "uncertain" }),
        }),
      }),
    );
  });
  it("rechecks a reminder that became recurring before a default-mode delete", async () => {
    single("reminder.delete", { itemId: "dentist", title: "Dentist" });
    useEraStore.setState({
      focusEntities: [
        {
          id: "dentist",
          title: "Dentist",
          type: "reminder",
          addedAt: Date.now(),
        },
      ],
    });
    vi.mocked(findReminderCandidates).mockResolvedValue([
      {
        id: "dentist",
        title: "Dentist",
        mine: true,
        recurring: true,
        dueAt: null,
      },
    ]);
    await hook.confirmProposal();
    expect(safeFetch).not.toHaveBeenCalled();
    expect(useEraStore.getState().eraReply).toContain("Reminder changed");
  });
  it("rejects confirmation after an account switch", async () => {
    single();
    mock.user.mockResolvedValue({ data: { user: { id: "partner" } } });
    const execute = vi
      .spyOn(ERA_CAPABILITIES["shopping.add"], "execute")
      .mockResolvedValue({ text: "Added" });
    await hook.confirmProposal();
    expect(execute).not.toHaveBeenCalled();
  });
  it("stops later steps and leaves the new chat alone after a dispatched write", async () => {
    useEraStore.setState({
      activeProposal: {
        kind: "propose_plan",
        text: "Add two items",
        sourceText: "Add milk then add eggs",
        requestContext: context(),
        plan: {
          steps: [
            {
              id: "milk",
              label: "Milk",
              capabilityId: "shopping.add",
              slots: { items: ["milk"] },
            },
            {
              id: "eggs",
              label: "Eggs",
              capabilityId: "shopping.add",
              slots: { items: ["eggs"] },
            },
          ],
        },
      },
    });
    const execute = vi
      .spyOn(ERA_CAPABILITIES["shopping.add"], "execute")
      .mockImplementation(async () => {
        useEraStore.getState().resetConversationContext();
        useEraStore.setState({
          explicitConversation: null,
          eraReply: "New chat",
        });
        return {
          text: "Milk added",
          artifacts: [
            {
              entity: "shopping_item",
              action: "created",
              id: "milk",
              title: "Milk",
            },
          ],
        };
      });
    await hook.confirmProposal();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(useEraStore.getState().eraReply).toBe("New chat");
    expect(recordEraArtifacts).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "milk" })]),
      qc,
    );
  });
  it("preserves a legacy parent-only reminder receipt without claiming its trigger completed", async () => {
    useEraStore.setState({
      activeProposal: {
        kind: "propose_nfc_reminder",
        text: "Set trigger?",
        reminderTitle: "Call bank",
        nfcTagId: "door",
        nfcTagLabel: "Door",
        targetState: "arriving",
        requestContext: context(),
      },
    });
    const createdId = "11111111-1111-4111-8111-111111111111";
    vi.mocked(safeFetch)
      .mockResolvedValueOnce(Response.json({ item: { id: createdId } }));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await hook.confirmProposal();
    expect(recordEraArtifacts).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: createdId })]),
      qc,
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.scheduleItems() });
    expect(useEraStore.getState().eraReply).toContain("Reminder created");
    expect(mock.message).toHaveBeenCalledWith(
      expect.objectContaining({
        intent_payload: expect.objectContaining({
          outcome: expect.objectContaining({ status: "uncertain" }),
        }),
      }),
    );
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });

  it("shows fresh effective consent and resumes a compound card without repeating completed work", async () => {
    useEraStore.setState({ activeProposal: {
      kind: "propose_plan", text: "All done", sourceText: "Save WiFi and add milk", requestContext: context(),
      plan: { steps: [
        { id: "note", label: "Nothing to save", capabilityId: "memory.save", slots: { label: "WiFi", value: "password" } },
        { id: "shopping", label: "Nothing to add", capabilityId: "shopping.add", slots: { items: ["milk"] } },
      ] },
    } });
    const memory = vi.spyOn(ERA_CAPABILITIES["memory.save"], "execute").mockResolvedValue({ text: "Saved", artifacts: [{ entity: "memory", action: "created", id: "note", title: "WiFi" }] });
    let posts = 0;
    vi.mocked(safeFetch).mockImplementation(async (url, init) => {
      if (String(url) === "/api/hub/threads") return Response.json({ threads: [{ id: "shopping-list", purpose: "shopping", is_private: false }] });
      if (init?.method === "POST") { posts++; return Response.json({ message: { id: "milk" } }); }
      throw new Error(String(url));
    });
    await hook.confirmProposal();
    const card = useEraStore.getState().activeProposal;
    expect(card, useEraStore.getState().eraReply ?? undefined).toMatchObject({ kind: "propose_plan", sourceText: "Save WiFi and add milk", consent: { shopping: { values: { items: ["milk"], threadId: "shopping-list" } } }, resume: [{ id: "note", status: "done" }] });
    expect(posts).toBe(0);
    await hook.confirmProposal();
    expect(posts).toBe(1); expect(memory).toHaveBeenCalledTimes(1);
    expect(useEraStore.getState().activeProposal).toBeNull();
    expect(mock.message).toHaveBeenLastCalledWith(expect.objectContaining({ intent_payload: expect.objectContaining({ outcome: expect.objectContaining({ status: "done" }) }) }));
  });

  it.each(["complete", "rolled_back"])("NFC source %s uses one atomic request and reports the actual outcome", async status => {
    useEraStore.setState({ activeProposal: { kind: "propose_nfc_reminder", text: "Done", reminderTitle: "Call bank", nfcTagId: "door", nfcTagLabel: "Door", targetState: "arriving", requestContext: context() } });
    vi.mocked(safeFetch).mockResolvedValue(Response.json(status === "complete"
      ? { item: { id: "reminder" }, completion: { status } } : { completion: { status } }, { status: status === "complete" ? 201 : 500 }));
    await hook.confirmProposal();
    expect(safeFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(safeFetch).mock.calls[0][1]?.body))).toMatchObject({ prerequisites: [{ condition_config: { tag_id: "door", target_state: "arriving" } }] });
    expect(mock.message).toHaveBeenCalledWith(expect.objectContaining({ intent_payload: expect.objectContaining({ outcome: expect.objectContaining({ status: status === "complete" ? "done" : "failed" }) }) }));
  });
});
