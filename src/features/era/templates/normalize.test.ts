// Behavior lock for Stage B1's shared normalizer — the same rules must hold
// for a plain utterance (matcher.ts's incoming text, learn.ts's rawText) and
// for a stored pattern's literal segments (matcher.ts's compilePattern),
// or the two silently disagree about what "the same sentence" means.
import { describe, expect, it } from "vitest";
import { normalizePatternText, normalizeUtterance } from "./normalize";

describe("normalizeUtterance", () => {
  it("collapses internal whitespace", () => {
    expect(normalizeUtterance("shift   it    to 5pm")).toBe("shift it to 5pm");
  });

  it("strips trailing punctuation", () => {
    expect(normalizeUtterance("shift it to 5pm?")).toBe("shift it to 5pm");
    expect(normalizeUtterance("shift it to 5pm!!")).toBe("shift it to 5pm");
    expect(normalizeUtterance("shift it to 5pm.")).toBe("shift it to 5pm");
  });

  it("strips a leading politeness/address prefix", () => {
    expect(normalizeUtterance("please shift it to 5pm")).toBe("shift it to 5pm");
    expect(normalizeUtterance("can you shift it to 5pm")).toBe("shift it to 5pm");
    expect(normalizeUtterance("could you shift it to 5pm")).toBe("shift it to 5pm");
    expect(normalizeUtterance("hey era, shift it to 5pm")).toBe("shift it to 5pm");
    expect(normalizeUtterance("era shift it to 5pm")).toBe("shift it to 5pm");
  });

  it("strips a stacked prefix", () => {
    expect(normalizeUtterance("hey era, please shift it to 5pm")).toBe("shift it to 5pm");
  });

  it("preserves casing — matching case-insensitivity is the regex's job, not the normalizer's", () => {
    expect(normalizeUtterance("Shift It To Tomorrow")).toBe("Shift It To Tomorrow");
  });

  it("does not touch interior punctuation", () => {
    expect(normalizeUtterance("push it (please) to noon")).toBe("push it (please) to noon");
  });
});

describe("normalizePatternText", () => {
  it("leaves a plain pattern untouched", () => {
    expect(normalizePatternText("shift it to {whenText}")).toBe("shift it to {whenText}");
  });

  it("strips a leading prefix from only the first literal segment", () => {
    expect(normalizePatternText("please shift it to {whenText}")).toBe(
      "shift it to {whenText}",
    );
  });

  it("strips trailing punctuation after a slot, from only the last literal segment", () => {
    expect(normalizePatternText("shift it to {whenText}!")).toBe("shift it to {whenText}");
  });

  it("preserves the slot name's exact casing — it's a Zod schema key downstream", () => {
    expect(normalizePatternText("shift it to {whenText}")).toContain("{whenText}");
    expect(normalizePatternText("shift it to {whenText}")).not.toContain("{whentext}");
  });

  it("collapses whitespace around a slot without touching the slot itself", () => {
    expect(normalizePatternText("shift   it   to   {whenText}")).toBe(
      "shift it to {whenText}",
    );
  });

  it("handles multiple adjacent slots without losing either", () => {
    expect(normalizePatternText("move {title} to {whenText}")).toBe(
      "move {title} to {whenText}",
    );
  });

  it("handles a pattern that starts with a slot (no leading literal to strip a prefix from)", () => {
    expect(normalizePatternText("{title}   is due")).toBe("{title} is due");
  });
});
