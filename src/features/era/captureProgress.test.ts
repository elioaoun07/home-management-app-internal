import { describe, expect, it } from "vitest";
import { captureSeed, detectCapture } from "./capture";
import {
  captureProgress,
  completeCaptureText,
  OPTIONAL_STEPS,
} from "./captureProgress";

const options = { hasChildren: false };
const step = (
  text: string,
  overrides: Record<string, string> = {},
  extra = {},
) => {
  const kind = detectCapture(text);
  return captureProgress(
    kind,
    text,
    { ...captureSeed(kind!, text), ...overrides },
    { ...options, ...extra },
  );
};

describe("progressive sentence capture", () => {
  it("advances with typing and backs up when a detail is erased", () => {
    expect(step("Add a reminder")).toBe("title");
    expect(step("Add a reminder call mom")).toBe("date");
    expect(step("Add a reminder call mom tomorrow")).toBe("time");
    // Alert has a default and stays correctable from the summary.
    expect(step("Add a reminder call mom tomorrow at 5pm")).toBe("ready");
    expect(step("Add a reminder call mom tomorrow")).toBe("time");
  });
  it("does not treat today's date and noon defaults as supplied details", () => {
    expect(step("Add an event meeting")).toBe("date");
    expect(step("Add an event meeting tomorrow")).toBe("time");
  });
  it("keeps asking for the title when only a date and time were supplied", () => {
    expect(step("Add a reminder tomorrow at 5pm")).toBe("title");
    expect(step("Add an event tomorrow at 5pm")).toBe("title");
    expect(step("Remind me today at 5pm")).toBe("title");
    expect(step("Please remind me today at 5pm")).toBe("title");
    expect(step("Don't forget tomorrow at 5pm")).toBe("title");
    expect(step("Remind me today at 5pm urgent")).toBe("title");
    expect(step("Remember to tomorrow at 5pm")).toBe("title");
  });
  it("accepts deliberately supplied date and time without treating parser defaults as input", () => {
    expect(
      step(
        "Add a reminder call mom",
        { date: "2026-10-13" },
        { dateChosen: true },
      ),
    ).toBe("time");
    expect(
      step(
        "Add a reminder call mom",
        { date: "2026-10-13", time: "17:00" },
        { dateChosen: true, timeChosen: true },
      ),
    ).toBe("ready");
  });
  it("skips already typed steps for a complete event", () => {
    expect(step("Add an event dinner at Parents tomorrow at 8pm")).toBe(
      "ready",
    );
  });
  it("guides an expense by missing detail and keeps incidental event words in Budget", () => {
    expect(step("I paid")).toBe("amount");
    expect(step("I paid $5")).toBe("description");
    expect(step("I paid 5 USD for")).toBe("description");
    expect(step("I paid for event 5$", { accountId: "own" })).toBe(
      "categoryId",
    );
    // The subcategory is asked, but optional — as in the expense form.
    expect(
      step(
        "I paid for event 5$",
        { accountId: "own", categoryId: "leisure" },
        { hasChildren: true },
      ),
    ).toBe("subcategoryId");
    expect(OPTIONAL_STEPS.has("subcategoryId")).toBe(true);
    expect(
      step(
        "I paid for event 5$",
        { accountId: "own", categoryId: "leisure", subcategoryId: "tickets" },
        { hasChildren: true },
      ),
    ).toBe("ready");
  });
  it("needs only a list and items for shopping; the group has a default", () => {
    const text = "Add to shopping list\nMilk\nMac and cheese";
    expect(step(text)).toBe("threadId");
    expect(step(text, { threadId: "family" })).toBe("ready");
    expect(step("Add to shopping list", { threadId: "family" })).toBe("items");
  });
  it.each([
    [
      "Add a reminder call mom",
      "tomorrow",
      "Add a reminder call mom tomorrow ",
    ],
    [
      "Add a reminder call mom tom",
      "tomorrow",
      "Add a reminder call mom tomorrow ",
    ],
    [
      "Add a reminder call mom tomorrow at",
      "at 5pm",
      "Add a reminder call mom tomorrow at 5pm ",
    ],
    [
      "Add a reminder call mom tomorrow at 5",
      "at 5pm",
      "Add a reminder call mom tomorrow at 5pm ",
    ],
  ])("completes %s without repeated words", (text, phrase, expected) => {
    expect(completeCaptureText(text, phrase)).toBe(expected);
  });
  it("replaces an accepted date or time when correcting a token", () => {
    expect(
      completeCaptureText(
        "Add a reminder call mom tomorrow at 5pm",
        "today",
        "date",
      ),
    ).toBe("Add a reminder call mom today at 5pm ");
    expect(
      completeCaptureText(
        "Add a reminder call mom tomorrow at 5pm",
        "at 9am",
        "time",
      ),
    ).toBe("Add a reminder call mom tomorrow at 9am ");
  });
  it("adds a time after 'tonight' instead of overwriting the day", () => {
    expect(
      completeCaptureText("Remind me to call mom tonight", "at 8pm", "time"),
    ).toBe("Remind me to call mom tonight at 8pm ");
  });
});
