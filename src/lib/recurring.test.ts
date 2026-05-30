import { describe, expect, it } from "vitest";
import { calculateNextDueDate } from "./recurring";

describe("calculateNextDueDate", () => {
  it("advances daily payments by one day", () => {
    expect(
      calculateNextDueDate({
        currentDueDate: "2026-05-29",
        recurrenceType: "daily",
      }),
    ).toBe("2026-05-30");
  });

  it("advances weekly payments by seven days when no weekday is configured", () => {
    expect(
      calculateNextDueDate({
        currentDueDate: "2026-05-29",
        recurrenceType: "weekly",
      }),
    ).toBe("2026-06-05");
  });

  it("uses the configured weekday for weekly payments and stays strictly in the future", () => {
    expect(
      calculateNextDueDate({
        currentDueDate: "2026-05-27",
        recurrenceType: "weekly",
        recurrenceDay: 5,
      }),
    ).toBe("2026-05-29");

    expect(
      calculateNextDueDate({
        currentDueDate: "2026-05-29",
        recurrenceType: "weekly",
        recurrenceDay: 5,
      }),
    ).toBe("2026-06-05");
  });

  it("advances monthly payments and clamps overflowing days to month end", () => {
    expect(
      calculateNextDueDate({
        currentDueDate: "2026-01-31",
        recurrenceType: "monthly",
        recurrenceDay: 31,
      }),
    ).toBe("2026-02-28");
  });

  it("uses the configured monthly day when present", () => {
    expect(
      calculateNextDueDate({
        currentDueDate: "2026-01-31",
        recurrenceType: "monthly",
        recurrenceDay: 15,
      }),
    ).toBe("2026-02-15");
  });

  it("advances yearly payments and clamps leap day to February 28", () => {
    expect(
      calculateNextDueDate({
        currentDueDate: "2024-02-29",
        recurrenceType: "yearly",
      }),
    ).toBe("2025-02-28");
  });
});
