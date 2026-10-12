import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandBar } from "./CommandBar";
import {
  captureSeed,
  shoppingLines,
  type CaptureKind,
  type NativeCapture,
} from "@/features/era/capture";
import { captureProgress } from "@/features/era/captureProgress";
import {
  captureGhost,
  leadInGhost,
  type AssistState,
} from "@/features/era/captureAssist";
import { EMPTY_CAPTURE_MEMORY } from "@/lib/era/captureMemory";
import type { EraCaptureHelper } from "@/features/era/useEraCapture";
import type { HubChatThread } from "@/features/hub/hooks";

const fixture = vi.hoisted(() => ({
  text: "",
  helper: null as EraCaptureHelper | null,
}));
vi.mock("@/hooks/useThemeClasses", () => ({
  useThemeClasses: () => ({ bgPage: "theme-surface" }),
}));
vi.mock("@/features/era/useEraCapture", () => ({
  useEraCapture: () => fixture.helper,
}));
vi.mock("@/features/era/useEraTurn", () => ({
  useEraTurn: () => ({ runTurn: vi.fn() }),
}));
vi.mock("@/features/era/useEraAskAI", () => ({
  useEraAskAI: () => ({ askAI: vi.fn(), askingAI: false }),
}));
vi.mock("@/features/voice-conversation", () => ({
  useEraReplyTTS: () => ({ play: vi.fn() }),
}));
vi.mock("@/features/era/useEraStore", () => ({
  useEraStore: (select: (state: object) => unknown) =>
    select({
      pendingTranscript: fixture.text,
      setPendingTranscript: vi.fn(),
      voiceReplyEnabled: false,
      setVoiceReplyEnabled: vi.fn(),
      pendingTurn: null,
      lastMissText: null,
      setLastMissText: vi.fn(),
      voiceChatEnabled: false,
      setVoiceChatEnabled: vi.fn(),
    }),
}));

function helper(
  kind: CaptureKind | null,
  text: string,
  extra: { threads?: HubChatThread[]; capture?: NativeCapture } = {},
): EraCaptureHelper {
  const fields = kind ? captureSeed(kind, text) : {};
  const step = captureProgress(kind, text, fields, { hasChildren: false });
  const items = shoppingLines(fields.items ?? "");
  const threads = extra.threads ?? [];
  const assist: AssistState | null = kind
    ? {
        kind,
        text,
        fields,
        step,
        now: new Date(),
        accounts: [],
        parents: [],
        children: [],
        threads,
        groups: [],
        items,
        memory: EMPTY_CAPTURE_MEMORY,
      }
    : null;
  return {
    kind,
    fields,
    step,
    capture: extra.capture ?? null,
    assist,
    ghost: assist ? captureGhost(assist) : leadInGhost(text),
    change: vi.fn(),
    reset: vi.fn(),
    begin: vi.fn(),
    switchKind: vi.fn(),
    dismiss: vi.fn(),
    accounts: [],
    parents: [],
    children: [],
    threads,
    groups: [],
    items,
    recurring: false,
    loading: false,
    error: false,
  };
}
function thread(index: number): HubChatThread {
  return {
    id: String(index),
    household_id: "household",
    created_by: "owner",
    title: `Weekly household shopping with everyone ${index}`,
    description: null,
    icon: "list",
    is_archived: false,
    created_at: "2026-10-12T10:00:00Z",
    updated_at: "2026-10-12T10:00:00Z",
    last_message_at: "2026-10-12T10:00:00Z",
    last_message: {
      id: "last",
      content: "A long previous shopping message that belongs in the picker",
      sender_user_id: "owner",
      created_at: "2026-10-12T10:00:00Z",
    },
    unread_count: 0,
    purpose: "shopping",
  };
}
const render = () =>
  renderToStaticMarkup(
    createElement<NonNullable<Parameters<typeof CommandBar>[0]>>(CommandBar, {
      variant: "embedded",
    }),
  );
const use = (kind: CaptureKind | null, text: string, extra = {}) => {
  fixture.text = text;
  fixture.helper = helper(kind, text, extra);
};

describe("native chatbot composer", () => {
  beforeEach(() => use("reminder", "Remind me today at 5pm"));
  it("asks for the missing title in the screenshot, using one original input", () => {
    const markup = render();
    expect(markup).toContain("What should I remind you about?");
    expect(markup).not.toContain("When should I alert you?");
    expect(markup.match(/<textarea/g)).toHaveLength(1);
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup).toContain("Change action");
    expect(markup).not.toContain(">Expense<");
    expect(markup).not.toContain(">Event<");
    expect(markup).not.toContain(">Shopping<");
  });
  it("reads the understood details back as prose instead of raw tokens", () => {
    use("reminder", "Remind me to call mom today at 5pm no alert");
    const markup = render();
    expect(markup).toMatch(/>Today<\/button><span[^>]*> at <\/span><button[^>]*>5 PM<\/button>/);
    expect(markup).toContain("No alert");
    expect(markup).toContain("Call mom");
    expect(markup).not.toContain("17:00");
    expect(markup).not.toContain("When should I alert you?");
  });
  it("keeps long list names complete and moves large previews out of the composer", () => {
    use("shopping", "Add to shopping list", {
      threads: [thread(1), thread(2), thread(3), thread(4), thread(5)],
    });
    const markup = render();
    expect(markup).toContain("Weekly household shopping with everyone 1");
    expect(markup).toContain("Weekly household shopping with everyone 2");
    expect(markup).toContain("Browse lists");
    expect(markup).not.toContain("A long previous shopping message");
    expect(markup).not.toContain("Weekly household shopping with everyone 5");
  });
  it("preserves line-separated shopping text in the chat input", () => {
    use("shopping", "Add to shopping list\nMilk\nMac and cheese");
    const markup = render();
    expect(markup).toContain(
      "Add to shopping list\nMilk\nMac and cheese</textarea>",
    );
    expect(markup.match(/<textarea/g)).toHaveLength(1);
  });
  it("tints the phrases read as data behind the sentence, never in place of it", () => {
    use("reminder", "Remind me to call mom tomorrow at 5pm");
    const markup = render();
    expect(markup).toMatch(/<mark[^>]*>tomorrow<\/mark>/);
    expect(markup).toMatch(/<mark[^>]*>at 5pm<\/mark>/);
    expect(markup).toContain("Remind me to call mom tomorrow at 5pm</textarea>");
  });
  it("shows the completion faintly after the caret and announces Tab", () => {
    use("reminder", "Remind me to call mom ");
    const markup = render();
    expect(markup).toContain(">tomorrow at 9am</span>");
    expect(markup).toContain("Press Tab to complete tomorrow at 9am");
  });
  it("finishes the lead-in before any action is recognised", () => {
    use(null, "rem");
    const markup = render();
    expect(markup).toContain(">ind me to</span>");
    expect(markup).not.toContain("suggestions");
  });
  it("lights Send only once everything needed is understood", () => {
    use("reminder", "Remind me to call mom tomorrow at 5pm");
    expect(render()).not.toContain('data-ready="true"');
    use("reminder", "Remind me to call mom tomorrow at 5pm", {
      capture: {
        kind: "reminder",
        title: "Call mom",
        date: "2026-10-13",
        time: "17:00",
        priority: "normal",
        location: "",
        alert: "0",
      },
    });
    expect(render()).toContain('data-ready="true"');
  });
});
