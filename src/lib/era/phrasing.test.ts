// Mechanics of ERA's varied voice.
//
// The pools live with their formatters; what's pinned here is the machinery
// every pool depends on — slot filling, the "when" phrasing, and the shape of
// an error reply. A bug in `fill` shows up as mangled punctuation in hundreds
// of sentences at once, so it gets its own coverage.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dayPart,
  describeWhen,
  errorReply,
  fill,
  greeting,
  listOut,
  lowerFirst,
  money,
  pick,
  plural,
  say,
} from "./phrasing";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Drive Math.random across its range and collect every distinct output. */
function allOutputs(produce: () => string, samples = 60): string[] {
  const spy = vi.spyOn(Math, "random");
  const seen = new Set<string>();
  for (let i = 0; i < samples; i++) {
    spy.mockReturnValue(i / samples);
    seen.add(produce());
  }
  spy.mockRestore();
  return [...seen];
}

describe("fill", () => {
  it("substitutes slots", () => {
    expect(fill("Remind you to {task} {when}.", { task: "call mom", when: "at 5" }))
      .toBe("Remind you to call mom at 5.");
  });

  it("drops an empty slot AND the space before it", () => {
    // The whole point: templates are written for the richest case, so a
    // missing fact must not leave "One thing today ." behind.
    expect(fill("One thing today{first}.", { first: "" })).toBe(
      "One thing today.",
    );
    expect(fill("One thing today{first}.", { first: undefined })).toBe(
      "One thing today.",
    );
    expect(fill("One thing today{first}.", { first: null })).toBe(
      "One thing today.",
    );
  });

  it("drops an unknown slot rather than printing the placeholder", () => {
    expect(fill("Total {nope}.", {})).toBe("Total.");
  });

  it("keeps a zero — 0 is a fact, not a missing value", () => {
    expect(fill("You have {n} left.", { n: 0 })).toBe("You have 0 left.");
  });

  it("does not leave a space before punctuation", () => {
    expect(fill("Total {n} .", { n: "5" })).toBe("Total 5.");
  });

  it("cleans up a separator left holding nothing", () => {
    // A template written for the full sentence must not read "one,." when the
    // second fact is absent.
    expect(fill("{a}, {b}.", { a: "one", b: "" })).toBe("one.");
    expect(fill("{a} — {b}.", { a: "one", b: "" })).toBe("one.");
    expect(fill("{a}: {b}", { a: "one", b: "" })).toBe("one");
    expect(fill("{a}, {b}", { a: "one", b: "" })).toBe("one");
  });

  it("collapses runs of whitespace introduced by dropped slots", () => {
    expect(fill("{a} {b} {c} end", { a: "x", b: "", c: "" })).toBe("x end");
  });
});

describe("say", () => {
  it("fills whichever variant it picked", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(say(["first {x}", "second {x}"], { x: "slot" })).toBe("first slot");
  });

  it("can reach every entry in the pool", () => {
    const pool = ["a", "b", "c", "d"];
    expect(allOutputs(() => say(pool)).sort()).toEqual(pool);
  });
});

describe("pick", () => {
  it("never runs off the end of the pool", () => {
    // Math.random() is [0,1) so 0.999… must still land on the last entry.
    vi.spyOn(Math, "random").mockReturnValue(0.9999999);
    expect(pick(["a", "b", "c"])).toBe("c");
  });
});

describe("describeWhen", () => {
  it("says today / tomorrow / yesterday rather than a date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));

    expect(describeWhen(new Date(2026, 7, 22, 17, 0).toISOString())).toBe(
      "today at 5:00 PM",
    );
    expect(describeWhen(new Date(2026, 7, 23, 11, 0).toISOString())).toBe(
      "tomorrow at 11:00 AM",
    );
    expect(describeWhen(new Date(2026, 7, 21, 9, 30).toISOString())).toBe(
      "yesterday at 9:30 AM",
    );
  });

  it("uses the weekday inside the coming week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0)); // Saturday
    // +3 days → Tuesday
    expect(describeWhen(new Date(2026, 7, 25, 18, 30).toISOString())).toBe(
      "Tuesday at 6:30 PM",
    );
  });

  it("falls back to a full date beyond a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 10, 0, 0));
    expect(describeWhen(new Date(2026, 8, 15, 12, 0).toISOString())).toBe(
      "Tue, Sep 15 at 12:00 PM",
    );
  });

  it("returns empty for missing or unparseable input, never 'Invalid Date'", () => {
    expect(describeWhen(null)).toBe("");
    expect(describeWhen(undefined)).toBe("");
    expect(describeWhen("")).toBe("");
    expect(describeWhen("not a date")).toBe("");
  });
});

describe("errorReply", () => {
  it("varies the apology and the nudge but never the diagnosis", () => {
    const variants = allOutputs(() => errorReply("I couldn't save that."));

    expect(variants.length).toBeGreaterThan(1);
    for (const v of variants) expect(v).toContain("I couldn't save that.");
  });

  it("can omit the retry nudge", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(errorReply("Nothing to do.", false)).not.toMatch(/try again/i);
  });
});

describe("small helpers", () => {
  it("lowerFirst opens a title mid-sentence but leaves proper nouns alone", () => {
    expect(lowerFirst("Call the bank")).toBe("call the bank");
    expect(lowerFirst("NFC tag")).toBe("NFC tag");
    expect(lowerFirst("")).toBe("");
  });

  it("money drops a pointless .00 but keeps real cents", () => {
    expect(money(25)).toBe("$25");
    expect(money(2600)).toBe("$2,600");
    expect(money(18.5)).toBe("$18.50");
    expect(money(1240.5)).toBe("$1,240.50");
  });

  it("plural agrees with the count", () => {
    expect(plural(1, "transaction")).toBe("1 transaction");
    expect(plural(41, "transaction")).toBe("41 transactions");
    expect(plural(2, "thing")).toBe("2 things");
  });

  it("listOut reads like a person", () => {
    expect(listOut([])).toBe("");
    expect(listOut(["a"])).toBe("a");
    expect(listOut(["a", "b"])).toBe("a and b");
    expect(listOut(["a", "b", "c"])).toBe("a, b and c");
  });

  it("dayPart buckets the clock", () => {
    expect(dayPart(new Date(2026, 7, 22, 2))).toBe("night");
    expect(dayPart(new Date(2026, 7, 22, 9))).toBe("morning");
    expect(dayPart(new Date(2026, 7, 22, 14))).toBe("afternoon");
    expect(dayPart(new Date(2026, 7, 22, 19))).toBe("evening");
    expect(dayPart(new Date(2026, 7, 22, 23))).toBe("night");
  });
});

describe("greeting", () => {
  it("matches the time of day", () => {
    const morning = allOutputs(() => greeting(new Date(2026, 7, 22, 9)));
    expect(morning.some((g) => /morning/i.test(g))).toBe(true);
    expect(morning.some((g) => /evening/i.test(g))).toBe(false);

    const evening = allOutputs(() => greeting(new Date(2026, 7, 22, 19)));
    expect(evening.some((g) => /evening/i.test(g))).toBe(true);
    expect(evening.some((g) => /morning/i.test(g))).toBe(false);
  });

  it("has enough breadth not to repeat itself", () => {
    expect(allOutputs(() => greeting(new Date(2026, 7, 22, 9))).length)
      .toBeGreaterThanOrEqual(4);
  });
});
