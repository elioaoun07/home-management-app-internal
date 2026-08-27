// Behavior lock for ERA's "Ask AI" proposal contract (Slice 4).
//
// The whole point of `parseAskAIResponse` is that a model-proposed action is
// NEVER trusted at face value — its tag id and target state must match a
// REAL row in the caller-supplied ScheduleContext, or the proposal degrades
// to plain prose. These tests pin that degradation path directly, since it's
// the one thing standing between "the model proposes" and "the model writes
// whatever it wants" (Design Doctrine Q10).
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FocusEntity } from "@/features/era/focusMemory";
import type { ScheduleContext } from "./context";

// Never let this test suite make a real Gemini call, regardless of whether
// GEMINI_API_KEY happens to be loaded from .env in this environment.
const mockGenerateContentWithFallback = vi.hoisted(() => vi.fn());
vi.mock("./gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./gemini")>();
  return { ...actual, generateContentWithFallback: mockGenerateContentWithFallback };
});

const { generateAskAIResponse, parseAskAIResponse } = await import("./eraAskProposal");

const SCHEDULE_CONTEXT: ScheduleContext = {
  upcoming: [],
  overdueCount: 0,
  nfcTags: [
    { id: "tag-front-door", label: "Front Door", states: ["leaving", "arriving"], currentState: "leaving" },
  ],
};

function json(obj: unknown): string {
  return JSON.stringify(obj);
}

describe("parseAskAIResponse", () => {
  it("returns null for missing text", () => {
    expect(parseAskAIResponse(undefined)).toBeNull();
  });

  it("returns null for malformed JSON — never throws", () => {
    expect(parseAskAIResponse("not json at all {")).toBeNull();
  });

  it("returns null when the JSON doesn't match the schema", () => {
    expect(parseAskAIResponse(json({ kind: "prose" }))).toBeNull(); // missing text
    expect(parseAskAIResponse(json({ text: "hi" }))).toBeNull(); // missing kind
    expect(parseAskAIResponse(json({ kind: "something_else", text: "hi" }))).toBeNull();
  });

  it("passes through a valid prose response unchanged", () => {
    const result = parseAskAIResponse(json({ kind: "prose", text: "Your balance is $500." }));
    expect(result).toEqual({ kind: "prose", text: "Your balance is $500." });
  });

  it("accepts a proposal whose tag id and state match real context, and enriches it with the tag's label", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_nfc_reminder",
        text: "Set that up for when you tap home to arriving?",
        reminderTitle: "Call the bank",
        nfcTagId: "tag-front-door",
        targetState: "arriving",
      }),
      SCHEDULE_CONTEXT,
    );
    expect(result).toEqual({
      kind: "propose_nfc_reminder",
      text: "Set that up for when you tap home to arriving?",
      reminderTitle: "Call the bank",
      nfcTagId: "tag-front-door",
      nfcTagLabel: "Front Door",
      targetState: "arriving",
    });
  });

  // The core safety property: a hallucinated tag id must never reach the
  // caller as a proposal — it can only ever read as prose from here on.
  it("degrades to prose when the model invents a tag id that doesn't exist", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_nfc_reminder",
        text: "Sounds good, I'll set that up.",
        reminderTitle: "Call the bank",
        nfcTagId: "tag-that-does-not-exist",
        targetState: "arriving",
      }),
      SCHEDULE_CONTEXT,
    );
    expect(result).toEqual({ kind: "prose", text: "Sounds good, I'll set that up." });
  });

  it("degrades to prose when the target state isn't one of the tag's real states", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_nfc_reminder",
        text: "Sounds good, I'll set that up.",
        reminderTitle: "Call the bank",
        nfcTagId: "tag-front-door",
        targetState: "teleporting", // not in ["leaving", "arriving"]
      }),
      SCHEDULE_CONTEXT,
    );
    expect(result).toEqual({ kind: "prose", text: "Sounds good, I'll set that up." });
  });

  it("degrades to prose when no scheduleContext was supplied at all (budget/chef/brain faces)", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_nfc_reminder",
        text: "Sounds good, I'll set that up.",
        reminderTitle: "Call the bank",
        nfcTagId: "tag-front-door",
        targetState: "arriving",
      }),
      undefined,
    );
    expect(result).toEqual({ kind: "prose", text: "Sounds good, I'll set that up." });
  });

  it("extracts JSON even when the model wraps it in markdown fences is NOT supported — plain JSON only", () => {
    // Deliberately documenting current behavior: unlike analysisReport's
    // multi-strategy parse, this contract requires bare JSON (responseSchema
    // mode should guarantee that). If Gemini ever wraps output in prose or
    // fences despite the schema, this degrades to null -> prose fallback in
    // generateAskAIResponse, never a crash.
    const fenced = "```json\n" + json({ kind: "prose", text: "hi" }) + "\n```";
    expect(parseAskAIResponse(fenced)).toBeNull();
  });
});

// Stage 3 (HUB-29) — propose_action against the real capability registry.
// Every check here is a distinct "never trust the model" gate; each test
// isolates exactly one of them so a regression in one doesn't hide behind
// another passing.
describe("parseAskAIResponse — propose_action", () => {
  const FOCUS: FocusEntity = {
    id: "item-123",
    type: "reminder",
    title: "Water the plants",
    addedAt: Date.now(),
  };

  it("degrades to prose when capabilityId doesn't name a real capability", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "I'll do that.",
        capabilityId: "reminder.teleport",
        slotsJson: json({}),
      }),
    );
    expect(result).toEqual({ kind: "prose", text: "I'll do that." });
  });

  it("degrades to prose when slotsJson isn't valid JSON", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "I'll do that.",
        capabilityId: "schedule.forDay",
        slotsJson: "not json {{{",
      }),
    );
    expect(result).toEqual({ kind: "prose", text: "I'll do that." });
  });

  it("validates a read capability with no entity reference (schedule.forDay)", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "Here's Saturday.",
        capabilityId: "schedule.forDay",
        slotsJson: json({ dateISO: "2026-08-29" }),
      }),
    );
    expect(result).toEqual({
      kind: "propose_action",
      text: "Here's Saturday.",
      capabilityId: "schedule.forDay",
      slots: { dateISO: "2026-08-29" },
    });
  });

  it("degrades to prose when the slots fail the capability's own Zod schema", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "On it.",
        capabilityId: "schedule.forDay",
        slotsJson: json({ dateISO: "not-a-date" }),
      }),
    );
    expect(result).toEqual({ kind: "prose", text: "On it." });
  });

  it("never trusts a raw model-supplied itemId — only the literal FOCUS sentinel is accepted", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "Moved it.",
        capabilityId: "reminder.reschedule",
        slotsJson: json({ itemId: "item-invented-by-the-model", whenText: "5pm" }),
      }),
      undefined,
      FOCUS,
    );
    expect(result).toEqual({ kind: "prose", text: "Moved it." });
  });

  it("degrades to prose when FOCUS is used but no focus entity was supplied", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "Moved it.",
        capabilityId: "reminder.reschedule",
        slotsJson: json({ itemId: "FOCUS", whenText: "5pm" }),
      }),
      undefined,
      null,
    );
    expect(result).toEqual({ kind: "prose", text: "Moved it." });
  });

  it("resolves FOCUS to the real focus entity id and enriches title, when a focus entity is supplied", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "Moving it to 5.",
        capabilityId: "reminder.reschedule",
        slotsJson: json({ itemId: "FOCUS", whenText: "5pm" }),
      }),
      undefined,
      FOCUS,
    );
    expect(result).toEqual({
      kind: "propose_action",
      text: "Moving it to 5.",
      capabilityId: "reminder.reschedule",
      slots: { itemId: "item-123", whenText: "5pm", title: "Water the plants" },
    });
  });

  it("degrades to prose for a destructive capability (reminder.delete) exactly the same way — no separate bypass", () => {
    const result = parseAskAIResponse(
      json({
        kind: "propose_action",
        text: "Deleted.",
        capabilityId: "reminder.delete",
        slotsJson: json({ itemId: "raw-id-from-model" }),
      }),
      undefined,
      FOCUS,
    );
    expect(result).toEqual({ kind: "prose", text: "Deleted." });
  });
});

describe("generateAskAIResponse", () => {
  // GEMINI_API_KEY isn't loaded from .env into the Vitest process env — stub
  // it so the "model unavailable" branch these tests target is the one
  // ACTUALLY under test, not just "no key configured" short-circuiting
  // early. generateContentWithFallback is mocked above regardless, so no
  // real network call is possible either way.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("degrades to a deterministic prose reply when the model call fails — never throws, never proposes", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockGenerateContentWithFallback.mockRejectedValue(new Error("rate limited"));

    const result = await generateAskAIResponse({
      message: "remind me when I get home",
      face: "schedule",
      scheduleContext: SCHEDULE_CONTEXT,
    });

    expect(result.kind).toBe("prose");
    if (result.kind === "prose") {
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it("degrades to prose when the model returns malformed JSON despite responseSchema", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockGenerateContentWithFallback.mockResolvedValue({ text: "not valid json {{{" });

    const result = await generateAskAIResponse({
      message: "remind me when I get home",
      face: "schedule",
      scheduleContext: SCHEDULE_CONTEXT,
    });

    expect(result.kind).toBe("prose");
  });

  it("returns a validated proposal end-to-end when the model output is well-formed and matches context", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockGenerateContentWithFallback.mockResolvedValue({
      text: json({
        kind: "propose_nfc_reminder",
        text: "Set that up for when you arrive?",
        reminderTitle: "Call the bank",
        nfcTagId: "tag-front-door",
        targetState: "arriving",
      }),
    });

    const result = await generateAskAIResponse({
      message: "remind me to call the bank when I get home",
      face: "schedule",
      scheduleContext: SCHEDULE_CONTEXT,
    });

    expect(result).toEqual({
      kind: "propose_nfc_reminder",
      text: "Set that up for when you arrive?",
      reminderTitle: "Call the bank",
      nfcTagId: "tag-front-door",
      nfcTagLabel: "Front Door",
      targetState: "arriving",
    });
  });

  // The NFC gate, end to end: even a well-formed proposal naming a tag that
  // isn't real never reaches the caller as anything but prose — no write is
  // ever reachable from this path.
  it("degrades a well-formed but hallucinated proposal to prose (the NFC safety gate)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockGenerateContentWithFallback.mockResolvedValue({
      text: json({
        kind: "propose_nfc_reminder",
        text: "I'll set that up.",
        reminderTitle: "Call the bank",
        nfcTagId: "tag-invented-by-the-model",
        targetState: "arriving",
      }),
    });

    const result = await generateAskAIResponse({
      message: "remind me when I get home",
      face: "schedule",
      scheduleContext: SCHEDULE_CONTEXT,
    });

    expect(result).toEqual({ kind: "prose", text: "I'll set that up." });
  });
});
