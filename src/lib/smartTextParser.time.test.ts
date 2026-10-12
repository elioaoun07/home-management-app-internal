import { describe, expect, it } from "vitest";
import { parseTime } from "./smartTextParser";

describe("parseTime precedence", () => {
  it.each([
    // A written clock time beats the named period's default.
    ["call mom tonight at 9pm", "21:00", "at 9pm"],
    ["call mom tonight at 9", "21:00", "at 9"],
    ["3pm this afternoon", "15:00", "3pm"],
    ["at 10 in the morning", "10:00", "at 10"],
    ["morning run at 6", "06:00", "at 6"],
    ["evening class at 7", "19:00", "at 7"],
    ["half past 6 in the evening", "18:30", "half past 6"],
    ["lunch at 1", "13:00", "at 1"],
    ["dinner tonight at 20:30", "20:30", "at 20:30"],
    // Named periods alone, and clock-like names, keep their meaning.
    ["tomorrow morning", "07:00", "morning"],
    ["tonight", "20:00", "tonight"],
    ["at 12 noon", "12:00", "noon"],
    // Clock times alone are unchanged.
    ["at 5", "17:00", "at 5"],
    ["at 9am", "09:00", "at 9am"],
    ["18:00", "18:00", "18:00"],
  ])("%s → %s", (text, time, matched) => {
    const parsed = parseTime(text);
    expect(parsed?.time).toBe(time);
    expect(parsed?.matched.trim()).toBe(matched);
  });
  it("returns null with no time at all", () => {
    expect(parseTime("call mom")).toBeNull();
  });
});
