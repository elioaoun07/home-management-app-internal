import { describe, expect, it } from "vitest";
import {
  adjustOccurrenceToWallClock,
  buildFullRRuleString,
  formatDate,
  formatDateToUTCRRule,
  localToISO,
  startOfCustomMonth,
} from "./date";

describe("startOfCustomMonth", () => {
  it("uses the current month when the date is on or after the custom start day", () => {
    const start = startOfCustomMonth(new Date(2026, 4, 29, 15, 45), 25);

    expect(formatDate(start)).toBe("2026-05-25");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("uses the previous month when the date is before the custom start day", () => {
    const start = startOfCustomMonth(new Date(2026, 4, 20, 15, 45), 25);

    expect(formatDate(start)).toBe("2026-04-25");
  });

  it("clamps day 31 to the last day of shorter months", () => {
    const onClampedStart = startOfCustomMonth(
      new Date(2026, 3, 30, 12),
      31,
    );
    const beforeClampedStart = startOfCustomMonth(
      new Date(2026, 3, 29, 12),
      31,
    );

    expect(formatDate(onClampedStart)).toBe("2026-04-30");
    expect(formatDate(beforeClampedStart)).toBe("2026-03-31");
  });
});

describe("timezone-safe utilities", () => {
  it("converts local date and time input to a UTC ISO string that round-trips locally", () => {
    const iso = localToISO("2026-04-21", "21:00");
    const roundTrip = new Date(iso);

    expect(iso.endsWith("Z")).toBe(true);
    expect(formatDate(roundTrip)).toBe("2026-04-21");
    expect(roundTrip.getHours()).toBe(21);
    expect(roundTrip.getMinutes()).toBe(0);
  });

  it("formats UTC dates for RRule DTSTART values", () => {
    const date = new Date(Date.UTC(2026, 0, 15, 8, 30, 5));

    expect(formatDateToUTCRRule(date)).toBe("20260115T083005Z");
  });

  it("builds full RRule strings with UTC DTSTART and count", () => {
    const start = new Date(Date.UTC(2026, 0, 15, 8, 30, 0));

    expect(
      buildFullRRuleString(start, { rrule: "FREQ=MONTHLY", count: 3 }),
    ).toBe("DTSTART:20260115T083000Z\nRRULE:FREQ=MONTHLY;COUNT=3");
  });

  it("preserves local wall-clock time on adjusted occurrences", () => {
    const occurrence = new Date(2026, 5, 5, 12, 0);
    const original = new Date(2026, 0, 5, 18, 15);
    const adjusted = adjustOccurrenceToWallClock(occurrence, original);

    expect(formatDate(adjusted)).toBe(formatDate(occurrence));
    expect(adjusted.getHours()).toBe(18);
    expect(adjusted.getMinutes()).toBe(15);
  });
});
