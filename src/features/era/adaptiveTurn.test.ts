import { describe, expect, it } from "vitest";
import { hasRecentDialogue, privateAskHistory } from "./adaptiveTurn";
import { classifyMiss } from "./missTracking";
import { FOCUS_TTL_MS } from "./focusMemory";

const now = Date.parse("2026-10-10T12:00:00Z");
const reply = {
  conversation_id: "chat",
  role: "assistant",
  created_at: new Date(now - 1000).toISOString(),
  intent_payload: { outcome: { status: "done", capability: "shopping.add" } },
};
describe("contextual misses", () => {
  it("never sends a partner, anonymous optimistic or different-conversation cached row as the speaker's history", () => {
    const own = { ...reply, user_id: "speaker" };
    expect(
      privateAskHistory(
        [
          own,
          { ...own, user_id: "partner" },
          { ...own, user_id: "optimistic" },
          { ...own, role: "system" },
          { ...own, conversation_id: "other" },
        ],
        "speaker",
        "chat",
      ),
    ).toEqual([own]);
  });
  it("an unrecognized follow-up can use dialogue instead of requiring another domain keyword", () => {
    expect(classifyMiss("same again").missKind).toBe("capability-gap");
    expect(hasRecentDialogue([reply], "chat", now)).toBe(true);
  });
  it("New chat and the existing idle boundary do not inherit the old conversation", () => {
    expect(hasRecentDialogue([reply], "new", now)).toBe(false);
    expect(hasRecentDialogue([reply], "chat", now + FOCUS_TTL_MS)).toBe(false);
    expect(
      hasRecentDialogue([{ ...reply, created_at: "invalid" }], "chat", now),
    ).toBe(false);
    expect(
      hasRecentDialogue(
        [{ ...reply, created_at: new Date(now + 1000).toISOString() }],
        "chat",
        now,
      ),
    ).toBe(false);
  });
  it("failed/pending/uncertain writes do not masquerade as a completed conversation result", () => {
    for (const status of [
      "failed",
      "uncertain",
      "awaiting_confirm",
      "needs_input",
    ]) {
      expect(
        hasRecentDialogue(
          [{ ...reply, intent_payload: { outcome: { status } } }],
          "chat",
          now,
        ),
      ).toBe(false);
    }
    expect(
      hasRecentDialogue(
        [{ ...reply, intent_payload: { aiKind: "prose" } }],
        "chat",
        now,
      ),
    ).toBe(true);
  });
});
