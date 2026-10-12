import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  eraConversationTarget,
  useCreateEraMessage,
  type CreateEraMessageInput,
  type CreateEraMessageResult,
  type EraConversation,
  type EraMessagesPage,
} from "./useEraConversation";
import { eraKeys } from "./queryKeys";
import { useEraStore } from "./useEraStore";
import { privateAskHistory } from "./adaptiveTurn";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  queryClient: null as unknown,
  options: null as unknown,
}));
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({ auth: { getSession: mock.session } }),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => mock.queryClient,
  useMutation: (options: unknown) => {
    mock.options = options;
    return {};
  },
}));
type Context = { conversationId: string | null; optimisticId: string | null };
type Options = {
  onMutate(input: CreateEraMessageInput): Promise<Context>;
  onSuccess(
    result: CreateEraMessageResult,
    input: CreateEraMessageInput,
    context: Context,
  ): void;
};
let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient();
  mock.queryClient = qc;
  mock.session.mockResolvedValue({
    data: { session: { user: { id: "speaker" } } },
  });
  useEraStore.getState().resetConversationContext();
  useEraStore.getState().setExplicitConversation(null);
});
function CaptureMutation() {
  useCreateEraMessage();
  return null;
}
function mutation() {
  renderToString(createElement(CaptureMutation));
  return mock.options as Options;
}
function start() {
  return eraConversationTarget(qc, "brain");
}
function page(id: string) {
  return qc.getQueryData<EraMessagesPage>(eraKeys.messages(id))!;
}

describe("actual conversation optimistic ownership", () => {
  it("attributes unsaved rows and the locally seeded conversation to the capture session", async () => {
    const target = start();
    await mutation().onMutate({
      conversation_id: target.id,
      role: "user",
      content: "I prefer afternoons",
    });
    expect(page(target.id).messages[0].user_id).toBe("speaker");
    expect(
      qc.getQueryData<EraConversation[]>(eraKeys.conversations())![0].user_id,
    ).toBe("speaker");
    expect(
      privateAskHistory(page(target.id).messages, "speaker", target.id),
    ).toHaveLength(1);
  });
  it("unknown offline/session attribution cannot become personal model context", async () => {
    mock.session.mockRejectedValue(new Error("session unavailable"));
    const target = start();
    await mutation().onMutate({
      conversation_id: target.id,
      role: "user",
      content: "PRIVATE_UNBOUND_TEXT",
    });
    expect(page(target.id).messages[0].user_id).toBe("optimistic");
    expect(
      privateAskHistory(page(target.id).messages, "speaker", target.id),
    ).toEqual([]);
  });
  it("a new session cannot relabel another speaker's local conversation or reuse its unsaved text", async () => {
    const target = start();
    const m = mutation();
    await m.onMutate({
      conversation_id: target.id,
      role: "user",
      content: "SPEAKER_PRIVATE_TEXT",
    });
    mock.session.mockResolvedValue({
      data: { session: { user: { id: "partner" } } },
    });
    await m.onMutate({
      conversation_id: target.id,
      role: "user",
      content: "Partner turn",
    });
    expect(
      qc.getQueryData<EraConversation[]>(eraKeys.conversations())![0].user_id,
    ).toBe("speaker");
    expect(
      privateAskHistory(page(target.id).messages, "partner", target.id).map(
        (m) => m.content,
      ),
    ).toEqual(["Partner turn"]);
  });
  it("a server receipt replaces its optimistic row and binds the real conversation owner", async () => {
    const target = start();
    const m = mutation();
    const input: CreateEraMessageInput = {
      conversation_id: target.id,
      role: "user",
      content: "Afternoons",
    };
    const context = await m.onMutate(input);
    const message = {
      ...page(target.id).messages[0],
      id: "server-message",
      user_id: "speaker",
    };
    m.onSuccess({ message, conversation_id: target.id }, input, context);
    expect(page(target.id).messages.map((m) => m.id)).toEqual([
      "server-message",
    ]);
    expect(
      qc.getQueryData<EraConversation[]>(eraKeys.conversations())![0],
    ).toMatchObject({ user_id: "speaker", local: false });
  });
});
