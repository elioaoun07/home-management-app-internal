// Behavior lock for HUB-30's template learning — turns ONE successful Ask AI
// execution into a reusable `{slot}` pattern by substring-replacing slot
// VALUES that literally appear in the original utterance. Values that don't
// appear verbatim (a resolved itemId, a paraphrased title) are deliberately
// left out — see the module doc for why that's safe.
import { describe, expect, it } from "vitest";
import { learnTemplateFromProposal } from "./learn";

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

  it("omits a slot whose value never appears in the raw text (e.g. a resolved id)", () => {
    const result = learnTemplateFromProposal("mark it done", {
      itemId: "item-abc-123",
      title: "Water the plants",
    });
    expect(result).toBeNull(); // neither value appears verbatim — nothing to templatize
  });

  it("returns null when no slot value is found in the text at all", () => {
    expect(learnTemplateFromProposal("do the thing", { whenText: "" })).toBeNull();
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
});
