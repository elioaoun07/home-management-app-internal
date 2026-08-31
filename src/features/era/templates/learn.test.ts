// Behavior lock for HUB-30's template learning — turns ONE successful Ask AI
// execution into a reusable `{slot}` pattern by substring-replacing slot
// VALUES that literally appear in the original utterance. Values that don't
// appear verbatim (a resolved itemId, a paraphrased title) are deliberately
// left out — see the module doc for why that's safe.
import { describe, expect, it } from "vitest";
import { learnTemplateFromProposal, shouldLearnFrom } from "./learn";

describe("learnTemplateFromProposal", () => {
  it("templates a slot value that appears verbatim in the utterance", () => {
    const result = learnTemplateFromProposal("shift it to 5pm", {
      itemId: "item-abc-123",
      whenText: "5pm",
      title: "Water the plants",
    });
    expect(result).toEqual({ patternText: "shift it to {whenText}", slotNames: ["whenText"] });
  });

  it("is case-insensitive when locating the slot value", () => {
    const result = learnTemplateFromProposal("Nudge It To Tomorrow", {
      whenText: "tomorrow",
    });
    expect(result?.patternText).toBe("Nudge It To {whenText}");
  });

  // B2 — when NEITHER slot value appears verbatim (both were resolved some
  // other way, e.g. focus memory), the phrase is still worth teaching as a
  // zero-slot template — `matchAgainstTemplates` re-resolves the entity
  // reference from focus memory at match time regardless of slot count.
  it("teaches a zero-slot template when no slot value appears verbatim, but the phrase is a real anchor", () => {
    const result = learnTemplateFromProposal("mark it done", {
      itemId: "item-abc-123",
      title: "Water the plants",
    });
    expect(result).toEqual({ patternText: "mark it done", slotNames: [] });
  });

  it("teaches a zero-slot template for a genuinely argument-less command", () => {
    const result = learnTemplateFromProposal("what's on today", {});
    expect(result).toEqual({ patternText: "what's on today", slotNames: [] });
  });

  it("still refuses a zero-slot fragment too thin to trust as an anchor", () => {
    expect(learnTemplateFromProposal("ok", {})).toBeNull(); // < 8 chars
    expect(learnTemplateFromProposal("done now", { whenText: "" })).toEqual({
      patternText: "done now",
      slotNames: [],
    }); // 8 chars, 2 tokens — exactly at the floor, still taught
    expect(learnTemplateFromProposal("mark", {})).toBeNull(); // 1 token
  });

  it("returns null when the resulting pattern has no meaningful literal anchor", () => {
    // The whole utterance IS the slot value — a template of just "{whenText}"
    // would match nearly anything, so it's rejected rather than taught.
    const result = learnTemplateFromProposal("5", { whenText: "5" });
    expect(result).toBeNull();
  });

  it("captures multiple slots from one utterance", () => {
    const result = learnTemplateFromProposal("move water the plants to tomorrow", {
      title: "water the plants",
      whenText: "tomorrow",
    });
    expect(result).toEqual({
      patternText: "move {title} to {whenText}",
      slotNames: ["title", "whenText"],
    });
  });

  // B4 — a literal anchor made ENTIRELY of stopwords is as useless as none.
  it("rejects a slotted pattern whose literal anchor is pure stopwords", () => {
    // "for" is 3 chars (clears MIN_LITERAL_CHARS) but is a pure stopword —
    // the tokenize() gate must still catch it.
    const result = learnTemplateFromProposal("for tomorrow", { whenText: "tomorrow" });
    expect(result).toBeNull();
  });

  it("keeps a slotted pattern whose literal anchor has real vocabulary", () => {
    const result = learnTemplateFromProposal("nudge it to tomorrow", { whenText: "tomorrow" });
    expect(result).toEqual({ patternText: "nudge it to {whenText}", slotNames: ["whenText"] });
  });

  // B1 — templating happens off the NORMALIZED text, so a politeness prefix
  // or trailing punctuation the user happened to use isn't baked into the
  // taught pattern (and therefore isn't required on every future match).
  it("strips a leading politeness prefix before templating", () => {
    const result = learnTemplateFromProposal("please shift it to 5pm", { whenText: "5pm" });
    expect(result).toEqual({ patternText: "shift it to {whenText}", slotNames: ["whenText"] });
  });

  it("strips trailing punctuation before templating", () => {
    const result = learnTemplateFromProposal("shift it to 5pm?", { whenText: "5pm" });
    expect(result).toEqual({ patternText: "shift it to {whenText}", slotNames: ["whenText"] });
  });

  // HUB-34 — a capability with an entityRefSlot templates its captured
  // `title` as `{target}` instead, so the matcher (intents/index.ts) can
  // tell "this is an entity reference to resolve by name" apart from a
  // capability's own literal `title` slot.
  it("templates a captured title as {target} for a capability with an entityRefSlot", () => {
    const result = learnTemplateFromProposal(
      "shift the dentist reminder to 5pm",
      { itemId: "item-abc-123", title: "the dentist reminder", whenText: "5pm" },
      { entityRefSlot: "itemId" },
    );
    expect(result).toEqual({
      patternText: "shift {target} to {whenText}",
      slotNames: ["target", "whenText"],
    });
  });

  it("templates a captured title as {title} (unchanged) when the capability has no entityRefSlot", () => {
    const result = learnTemplateFromProposal(
      "assign lasagna to friday titled family dinner",
      { title: "family dinner", dayHint: "friday" },
      {},
    );
    expect(result?.slotNames).toContain("title");
    expect(result?.slotNames).not.toContain("target");
  });

  it("is unaffected when no capability is passed at all (backwards compatible)", () => {
    const result = learnTemplateFromProposal("shift it to 5pm", { whenText: "5pm" });
    expect(result).toEqual({ patternText: "shift it to {whenText}", slotNames: ["whenText"] });
  });
});

// HUB-34 — the learning gate: an execution that returned a graceful error
// (result.ok === false) must never be memorized as a working phrasing.
describe("shouldLearnFrom", () => {
  it("learns from a result with ok omitted (the default — success)", () => {
    expect(shouldLearnFrom({})).toBe(true);
  });

  it("learns from a result with ok: true", () => {
    expect(shouldLearnFrom({ ok: true })).toBe(true);
  });

  it("does NOT learn from a result with ok: false", () => {
    expect(shouldLearnFrom({ ok: false })).toBe(false);
  });
});
