import { describe, expect, it } from "vitest";
import { bmi, createMeasurementSchema, deriveBmiSeries, inToCm, lbToKg, parseDecimal, type HealthMeasurement } from "./measurements";

const m = (measured_at: string, weight_kg: number | null, height_cm: number | null): HealthMeasurement => ({
  id: measured_at, profile_id: "p", managing_user_id: "u", measured_at, weight_kg, height_cm,
  source: "healthcare", notes: null, created_at: measured_at, updated_at: measured_at,
});

describe("BMI derivation", () => {
  it("uses the latest height at or before each weight and shows missing height as null", () => {
    const series = deriveBmiSeries([
      m("2026-01-10T08:00:00Z", 82, null),          // no height yet
      m("2026-02-01T08:00:00Z", null, 180),
      m("2026-02-15T08:00:00Z", 80, null),
      m("2026-03-01T08:00:00Z", 78, 178),           // same-day height applies
    ]);
    expect(series.map((p) => p.bmi)).toEqual([null, bmi(80, 180), bmi(78, 178)]);
    expect(series[0]).toMatchObject({ height_cm: null, height_measured_at: null });
    expect(series[1].height_measured_at).toBe("2026-02-01T08:00:00Z");
    expect(bmi(80, 180)).toBe(24.7);
  });

  it("never applies a later height retroactively", () => {
    const series = deriveBmiSeries([m("2026-03-01T00:00:00Z", null, 175), m("2026-01-01T00:00:00Z", 70, null)]);
    expect(series[0].bmi).toBeNull();
  });
});

describe("measurement input", () => {
  it("stores canonical kg/cm and requires one value", () => {
    expect(lbToKg(176)).toBe(79.83);
    expect(inToCm(70)).toBe(177.8);
    expect(parseDecimal("72,5")).toBe(72.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("7a")).toBeNaN();
    const base = { id: "11111111-1111-4111-8111-111111111111", profile_id: "22222222-2222-4222-8222-222222222222", measured_at: "2026-10-12T08:00:00Z" };
    expect(createMeasurementSchema.safeParse(base).success).toBe(false);
    expect(createMeasurementSchema.safeParse({ ...base, weight_kg: 80 }).success).toBe(true);
    expect(createMeasurementSchema.safeParse({ ...base, height_cm: 20 }).success).toBe(false);
  });
});
