// src/lib/health/medicationSchedule.test.ts
import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  asNeededState,
  countCourseSlots,
  courseDay,
  dateKeyInZone,
  doseSlotsOnDate,
  evenlySpacedTimes,
  nextDoseSlot,
  zonedDateTime,
  type MedicationScheduleInput,
} from "./medicationSchedule";

const BEIRUT = "Asia/Beirut"; // UTC+3 in September

function course(overrides: Partial<MedicationScheduleInput> = {}): MedicationScheduleInput {
  return {
    mode: "course",
    dose_times: ["07:00", "15:00", "23:00"],
    timezone: BEIRUT,
    // First dose Sat 2026-09-26 15:00 Beirut = 12:00Z; 7 days.
    starts_at: "2026-09-26T12:00:00.000Z",
    ends_at: "2026-10-03T12:00:00.000Z",
    ...overrides,
  };
}

describe("zonedDateTime / dateKeyInZone", () => {
  it("converts wall clock in the medication's zone, not the host's", () => {
    expect(zonedDateTime("2026-09-26", "15:00", BEIRUT).toISOString()).toBe(
      "2026-09-26T12:00:00.000Z",
    );
    expect(dateKeyInZone(new Date("2026-09-26T21:30:00Z"), BEIRUT)).toBe("2026-09-27");
  });

  it("keeps wall-clock time across a DST change", () => {
    // Europe/London leaves BST on 2026-10-25.
    expect(zonedDateTime("2026-10-24", "08:00", "Europe/London").toISOString()).toBe(
      "2026-10-24T07:00:00.000Z",
    );
    expect(zonedDateTime("2026-10-26", "08:00", "Europe/London").toISOString()).toBe(
      "2026-10-26T08:00:00.000Z",
    );
  });

  it("does month/year calendar arithmetic on keys", () => {
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("doseSlotsOnDate", () => {
  it("drops slots before the first dose on day one", () => {
    const slots = doseSlotsOnDate(course(), "2026-09-26").map((d) => d.toISOString());
    expect(slots).toEqual(["2026-09-26T12:00:00.000Z", "2026-09-26T20:00:00.000Z"]);
  });

  it("stops before the exclusive end on the last day", () => {
    const slots = doseSlotsOnDate(course(), "2026-10-03").map((d) => d.toISOString());
    expect(slots).toEqual(["2026-10-03T04:00:00.000Z"]); // 07:00 only; 15:00 == end
  });

  it("has no slots outside the course or for as-needed", () => {
    expect(doseSlotsOnDate(course(), "2026-10-04")).toEqual([]);
    expect(doseSlotsOnDate(course({ mode: "as_needed" }), "2026-09-27")).toEqual([]);
  });

  it("dedupes repeated times", () => {
    expect(
      doseSlotsOnDate(course({ dose_times: ["07:00", "07:00"] }), "2026-09-27"),
    ).toHaveLength(1);
  });
});

describe("course totals", () => {
  it("7 days × 3 a day = 21 doses regardless of first-dose time", () => {
    expect(countCourseSlots(course())).toBe(21);
  });

  it("ongoing course has no total", () => {
    expect(countCourseSlots(course({ ends_at: null }))).toBeNull();
  });

  it("counts the course day", () => {
    expect(courseDay(course(), new Date("2026-09-28T13:00:00Z"))).toEqual({ day: 3, total: 7 });
    expect(courseDay(course(), new Date("2026-09-26T10:00:00Z"))).toBeNull();
  });

  it("finds the next dose, including across midnight", () => {
    expect(nextDoseSlot(course(), new Date("2026-09-26T20:30:00Z"))?.toISOString()).toBe(
      "2026-09-27T04:00:00.000Z",
    );
    expect(nextDoseSlot(course(), new Date("2026-10-03T05:00:00Z"))).toBeNull();
  });
});

describe("evenlySpacedTimes", () => {
  it("spreads doses over 24h from the first one, sorted", () => {
    expect(evenlySpacedTimes("15:00", 3)).toEqual(["07:00", "15:00", "23:00"]);
    expect(evenlySpacedTimes("08:00", 2)).toEqual(["08:00", "20:00"]);
    expect(evenlySpacedTimes("06:30", 4)).toEqual(["00:30", "06:30", "12:30", "18:30"]);
  });
});

describe("asNeededState", () => {
  const prn = course({ mode: "as_needed", dose_times: [], ends_at: null, min_hours_between: 6, max_per_day: 2 });

  it("counts today's doses in the medication's zone and the minimum gap", () => {
    const now = new Date("2026-09-27T12:00:00Z"); // 15:00 Beirut
    const state = asNeededState(
      prn,
      [
        { scheduled_at: null, taken_at: "2026-09-27T09:00:00Z" }, // 12:00 today
        { scheduled_at: null, taken_at: "2026-09-26T22:00:00Z" }, // 01:00 today
        { scheduled_at: null, taken_at: "2026-09-26T18:00:00Z" }, // 21:00 yesterday
      ],
      now,
    );
    expect(state.takenToday).toBe(2);
    expect(state.atDailyMax).toBe(true);
    expect(state.nextOkAt?.toISOString()).toBe("2026-09-27T15:00:00.000Z");
  });

  it("no wait once the gap has passed", () => {
    const state = asNeededState(
      prn,
      [{ scheduled_at: null, taken_at: "2026-09-27T00:00:00Z" }],
      new Date("2026-09-27T12:00:00Z"),
    );
    expect(state.nextOkAt).toBeNull();
    expect(state.atDailyMax).toBe(false);
  });
});
