// src/lib/health/measurements.ts
// Shared Healthcare measurement contract — weight/height history written and
// read by BOTH Healthcare and Fitness (health_measurements). Canonical units
// are kg and cm; conversions happen only at the input edge.
import { z } from "zod";

export interface HealthMeasurement {
  id: string;
  profile_id: string;
  managing_user_id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  source: "healthcare" | "fitness";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const weight = z.number().gt(0).lt(700).nullable();
const height = z.number().gt(30).lt(300).nullable();

export const createMeasurementSchema = z
  .object({
    id: z.uuid(), // client-generated: a retried create is idempotent
    profile_id: z.uuid(),
    measured_at: z.iso.datetime(),
    weight_kg: weight.optional().default(null),
    height_cm: height.optional().default(null),
    source: z.enum(["healthcare", "fitness"]).default("healthcare"),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((m) => m.weight_kg !== null || m.height_cm !== null, { message: "Weight or height required" });

export const updateMeasurementSchema = z
  .object({
    measured_at: z.iso.datetime().optional(),
    weight_kg: weight.optional(),
    height_cm: height.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type CreateMeasurementDTO = z.input<typeof createMeasurementSchema>;
export type UpdateMeasurementDTO = z.infer<typeof updateMeasurementSchema>;

// ── Units ───────────────────────────────────────────────────────────────────
export const LB_PER_KG = 2.204_622_621_8;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 100) / 100;
export const kgToLb = (kg: number) => Math.round(kg * LB_PER_KG * 10) / 10;
export const inToCm = (inches: number) => Math.round(inches * CM_PER_IN * 10) / 10;
export const cmToFtIn = (cm: number) => {
  const total = cm / CM_PER_IN;
  const ft = Math.floor(total / 12);
  return { ft, in: Math.round((total - ft * 12) * 10) / 10 };
};

/** "72.5" → 72.5; "" → null; anything else → NaN (caller shows an error). */
export function parseDecimal(input: string): number | null {
  const t = input.trim().replace(",", ".");
  if (!t) return null;
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

// ── BMI ─────────────────────────────────────────────────────────────────────

export interface BmiPoint {
  measured_at: string;
  weight_kg: number;
  /** Height in force at that date, or null when none was recorded by then. */
  height_cm: number | null;
  height_measured_at: string | null;
  bmi: number | null;
}

export const bmi = (weightKg: number, heightCm: number) =>
  Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;

/**
 * One point per weight measurement. BMI uses the latest height measured at or
 * before that weight — never a later height, never an invented default.
 * Informational only: Fitness never scores or judges with it.
 */
export function deriveBmiSeries(measurements: HealthMeasurement[]): BmiPoint[] {
  const sorted = [...measurements].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  let height: HealthMeasurement | null = null;
  const out: BmiPoint[] = [];
  for (const m of sorted) {
    if (m.height_cm !== null) height = m;
    if (m.weight_kg === null) continue;
    out.push({
      measured_at: m.measured_at,
      weight_kg: m.weight_kg,
      height_cm: height?.height_cm ?? null,
      height_measured_at: height?.measured_at ?? null,
      bmi: height?.height_cm ? bmi(m.weight_kg, height.height_cm) : null,
    });
  }
  return out;
}

export function latestOf(measurements: HealthMeasurement[], field: "weight_kg" | "height_cm") {
  return [...measurements]
    .filter((m) => m[field] !== null)
    .sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at))[0] ?? null;
}
