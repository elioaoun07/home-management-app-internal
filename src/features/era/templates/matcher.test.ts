// Behavior lock for the Stage 4 (HUB-30) taught-phrase matcher — the ONLY
// place a `{slot}`-templated pattern turns into a regex. Pins that matching
// is deterministic application code (never AI-generated), and that
// disabled/no-match cases degrade to null rather than a wrong guess.
import { describe, expect, it } from "vitest";
import { matchTemplates, type EraTemplate } from "./matcher";

const RESCHEDULE_TEMPLATE: EraTemplate = {
  id: "tpl-1",
  capabilityId: "reminder.reschedule",
  patternText: "shift it to {whenText}",
  slotNames: ["whenText"],
  enabled: true,
};

describe("matchTemplates", () => {
  it("matches a template and extracts its slot", () => {
    const result = matchTemplates("shift it to 5pm", [RESCHEDULE_TEMPLATE]);
    expect(result).toEqual({ template: RESCHEDULE_TEMPLATE, slots: { whenText: "5pm" } });
  });

  it("is case-insensitive", () => {
    const result = matchTemplates("Shift It To Tomorrow", [RESCHEDULE_TEMPLATE]);
    expect(result?.slots).toEqual({ whenText: "Tomorrow" });
  });

  it("returns null when nothing matches", () => {
    expect(matchTemplates("what's for dinner", [RESCHEDULE_TEMPLATE])).toBeNull();
  });

  it("skips a disabled template", () => {
    const disabled = { ...RESCHEDULE_TEMPLATE, enabled: false };
    expect(matchTemplates("shift it to 5pm", [disabled])).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(matchTemplates("   ", [RESCHEDULE_TEMPLATE])).toBeNull();
  });

  it("captures multiple slots without one swallowing the other", () => {
    const multi: EraTemplate = {
      id: "tpl-2",
      capabilityId: "reminder.reschedule",
      patternText: "move {title} to {whenText}",
      slotNames: ["title", "whenText"],
      enabled: true,
    };
    const result = matchTemplates("move water the plants to tomorrow", [multi]);
    expect(result?.slots).toEqual({ title: "water the plants", whenText: "tomorrow" });
  });

  it("returns the first match when multiple templates could match", () => {
    const other: EraTemplate = {
      id: "tpl-3",
      capabilityId: "reminder.complete",
      patternText: "shift it to {whenText}", // contrived duplicate for the test
      slotNames: ["whenText"],
      enabled: true,
    };
    const result = matchTemplates("shift it to 5pm", [RESCHEDULE_TEMPLATE, other]);
    expect(result?.template.id).toBe("tpl-1");
  });

  it("treats regex special characters in literal text as literal, not as regex syntax", () => {
    const special: EraTemplate = {
      id: "tpl-4",
      capabilityId: "reminder.reschedule",
      patternText: "push it (please) to {whenText}",
      slotNames: ["whenText"],
      enabled: true,
    };
    expect(matchTemplates("push it (please) to noon", [special])?.slots).toEqual({
      whenText: "noon",
    });
    // Without escaping, "(please)" would be a regex GROUP, not literal text —
    // this input should NOT match since the parens aren't in it at all.
    expect(matchTemplates("push it please to noon", [special])).toBeNull();
  });
});
