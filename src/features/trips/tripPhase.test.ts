import { describe, expect, it } from "vitest";
import { getTripPhase, tripCountdown } from "./tripPhase";

const trip = (start: string | null, end: string | null) => ({ start_date: start, end_date: end });

describe("getTripPhase", () => {
  const today = new Date("2026-08-03T12:00:00");

  it("returns undated when either date is missing", () => {
    expect(getTripPhase(trip(null, null), today)).toBe("undated");
    expect(getTripPhase(trip("2026-08-10", null), today)).toBe("undated");
    expect(getTripPhase(trip(null, "2026-08-10"), today)).toBe("undated");
  });

  it("returns planning when start is more than 14 days out", () => {
    expect(getTripPhase(trip("2026-08-25", "2026-08-30"), today)).toBe("planning");
  });

  it("returns soon when start is within 14 days", () => {
    expect(getTripPhase(trip("2026-08-15", "2026-08-20"), today)).toBe("soon");
  });

  it("returns soon on the boundary day (exactly 14 days out)", () => {
    expect(getTripPhase(trip("2026-08-17", "2026-08-20"), today)).toBe("soon");
  });

  it("returns travelling on the start date", () => {
    expect(getTripPhase(trip("2026-08-03", "2026-08-10"), today)).toBe("travelling");
  });

  it("returns travelling mid-trip", () => {
    expect(getTripPhase(trip("2026-08-01", "2026-08-10"), today)).toBe("travelling");
  });

  it("returns travelling on the end date", () => {
    expect(getTripPhase(trip("2026-07-30", "2026-08-03"), today)).toBe("travelling");
  });

  it("returns home the day after end", () => {
    expect(getTripPhase(trip("2026-07-20", "2026-08-02"), today)).toBe("home");
  });
});

describe("tripCountdown", () => {
  const today = new Date("2026-08-03T12:00:00");

  it("labels an undated trip", () => {
    expect(tripCountdown(trip(null, null), today)).toEqual({
      phase: "undated",
      label: "Set dates to begin",
      days: null,
      totalDays: null,
    });
  });

  it("counts days to go while planning", () => {
    const c = tripCountdown(trip("2026-08-25", "2026-08-30"), today);
    expect(c.phase).toBe("planning");
    expect(c.days).toBe(22);
    expect(c.totalDays).toBe(6);
    expect(c.label).toBe("22 days to go");
  });

  it("counts days to go while soon", () => {
    const c = tripCountdown(trip("2026-08-10", "2026-08-15"), today);
    expect(c.phase).toBe("soon");
    expect(c.days).toBe(7);
    expect(c.totalDays).toBe(6);
    expect(c.label).toBe("7 days to go");
  });

  it("singularizes 1 day to go", () => {
    const c = tripCountdown(trip("2026-08-04", "2026-08-10"), today);
    expect(c.label).toBe("1 day to go");
  });

  it("shows day N of total while travelling", () => {
    const c = tripCountdown(trip("2026-08-01", "2026-08-10"), today);
    expect(c.phase).toBe("travelling");
    expect(c.totalDays).toBe(10);
    expect(c.label).toBe("Day 3 of 10");
  });

  it("shows days home after the trip ends", () => {
    const c = tripCountdown(trip("2026-07-20", "2026-08-01"), today);
    expect(c.phase).toBe("home");
    expect(c.days).toBe(2);
    expect(c.label).toBe("Home 2 days");
  });
});
