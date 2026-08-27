// Behavior lock for HUB-31 — derives learned vocabulary from already-taught
// templates, scoped per capability entity so a word learned for one domain
// can never widen an unrelated one (the plan's "never globally ambiguous"
// rule).
import { describe, expect, it } from "vitest";
import type { EraTemplate } from "./matcher";
import { deriveLearnedVocab } from "./vocabGrowth";

describe("deriveLearnedVocab", () => {
  it("extracts literal, non-slot words from a template and scopes them to its capability's entity", () => {
    const templates: EraTemplate[] = [
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "nudge it to {whenText}",
        slotNames: ["whenText"],
        enabled: true,
      },
    ];
    const learned = deriveLearnedVocab(templates);
    expect(learned.reminder?.has("nudge")).toBe(true);
    expect(learned.schedule).toBeUndefined();
  });

  it("skips disabled templates", () => {
    const templates: EraTemplate[] = [
      {
        id: "tpl-1",
        capabilityId: "reminder.reschedule",
        patternText: "nudge it to {whenText}",
        slotNames: ["whenText"],
        enabled: false,
      },
    ];
    expect(deriveLearnedVocab(templates)).toEqual({});
  });

  it("skips a template referencing a capability that no longer exists", () => {
    const templates: EraTemplate[] = [
      {
        id: "tpl-1",
        capabilityId: "reminder.teleport",
        patternText: "beam it to {whenText}",
        slotNames: ["whenText"],
        enabled: true,
      },
    ];
    expect(deriveLearnedVocab(templates)).toEqual({});
  });

  it("never leaks a slot placeholder itself into the learned vocabulary", () => {
    const templates: EraTemplate[] = [
      {
        id: "tpl-1",
        capabilityId: "schedule.forDay",
        patternText: "{dateISO} agenda please",
        slotNames: ["dateISO"],
        enabled: true,
      },
    ];
    const learned = deriveLearnedVocab(templates);
    expect(learned.schedule?.has("dateiso")).toBe(false);
    expect([...(learned.schedule ?? [])]).not.toContain("dateISO");
  });
});
