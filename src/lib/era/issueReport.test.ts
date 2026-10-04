import { describe, expect, it } from "vitest";
import {
  ISSUE_TRANSCRIPT_MAX,
  buildIssueSnapshot,
  issueRowContent,
  issueWindowStart,
  type IssueMessageLike,
} from "./issueReport";

const base = Date.parse("2026-10-03T15:00:00.000Z");
const iso = (minute: number) => new Date(base + minute * 60_000).toISOString();

function m(id: string, role: string, minute: number, content: string, extra: Partial<IssueMessageLike> = {}): IssueMessageLike {
  return { id, role, content, intent_kind: null, intent_face: null, intent_payload: null, created_at: iso(minute), ...extra };
}

const thread: IssueMessageLike[] = [
  m("u1", "user", 0, "remind me to call mom tomorrow", { intent_kind: "draftReminder" }),
  m("a1", "assistant", 0, "Call mom · Sun 12:00pm", {
    intent_kind: "draftReminder",
    intent_face: "schedule",
    intent_payload: { outcome: { status: "done", capability: "reminder.create", entityIds: ["item-1"] } },
  }),
  m("s1", "system", 1, "handoff consumed", { intent_kind: "handoff_consumed" }),
  m("u2", "user", 2, "add a recurring reminder on Saturday at 6 PM", { intent_kind: "unknown" }),
  m("a2", "assistant", 2, "I didn't catch that.", { intent_kind: "unknown", intent_payload: { missKind: "capability-gap" } }),
  m("u3", "user", 3, "thanks"),
];

describe("buildIssueSnapshot", () => {
  it("records the reported request, ERA's answer and the turns up to it", () => {
    const s = buildIssueSnapshot({
      conversationId: "c1",
      messageId: "a2",
      kind: "missed",
      note: "  should create a weekly reminder  ",
      messages: thread,
      actions: [],
      now: new Date(iso(5)),
    });
    expect(s.request).toBe("add a recurring reminder on Saturday at 6 PM");
    expect(s.reply).toBe("I didn't catch that.");
    expect(s.note).toBe("should create a weekly reminder");
    expect(s.transcript.map((t) => t.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(s.transcript[1]).toMatchObject({ outcome: "done", capability: "reminder.create", entityIds: ["item-1"] });
    expect(s.reportedAt).toBe(iso(5));
  });

  it("reports the whole conversation when no message is named", () => {
    const s = buildIssueSnapshot({ conversationId: "c1", messageId: null, kind: "wrong", messages: thread, actions: [] });
    expect(s.request).toBe("thanks");
    expect(s.reply).toBeNull();
    expect(s.transcript).toHaveLength(5);
    expect(s.note).toBeNull();
  });

  it("keeps ERA actions from the reported window only", () => {
    const actions = [
      { action: "created", entity_type: "reminder", entity_id: "old", title: "Old", route: "/reminders", created_at: iso(-10) },
      { action: "created", entity_type: "reminder", entity_id: "item-1", title: "Call mom", route: "/reminders?openId=item-1", created_at: iso(0) },
    ];
    const s = buildIssueSnapshot({ conversationId: "c1", messageId: "a2", kind: "wrong", messages: thread, actions });
    expect(s.actions.map((a) => a.entityId)).toEqual(["item-1"]);
    expect(issueWindowStart(thread, "a2")).toBe(iso(-1));
  });

  it("bounds the transcript and clips long text", () => {
    const many = Array.from({ length: 40 }, (_, i) => m(`x${i}`, i % 2 ? "assistant" : "user", i, "word ".repeat(200)));
    const s = buildIssueSnapshot({ conversationId: "c1", messageId: null, kind: "missed", messages: many, actions: [] });
    expect(s.transcript).toHaveLength(ISSUE_TRANSCRIPT_MAX);
    expect(s.transcript[0].text.length).toBeLessThanOrEqual(400);
    expect(issueRowContent(s).length).toBeLessThanOrEqual(300);
  });
});
