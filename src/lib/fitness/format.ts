// src/lib/fitness/format.ts — compact prescription / result labels.
import type { PTSet } from "./ptPlan";
import type { FitnessSetLog } from "./types";

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

export const fmtKg = (kg: number) => `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace(/\.0$/, "")} kg`;
export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 2 : 0)} km` : `${m} m`);

export function repsLabel(s: Pick<PTSet, "reps_min" | "reps_max">): string | null {
  if (s.reps_min === null && s.reps_max === null) return null;
  if (s.reps_min !== null && s.reps_max !== null && s.reps_min !== s.reps_max) return `${s.reps_min}–${s.reps_max}`;
  return String(s.reps_min ?? s.reps_max);
}

const LOAD_KIND: Record<PTSet["load_kind"], string | null> = { external: null, bodyweight: "BW", assisted: "Assisted", unspecified: null };

/** "8–12 × 60 kg · RPE 8" — unknown parts are simply omitted, never zeroed. */
export function prescriptionLabel(s: PTSet): string {
  const parts: string[] = [];
  const reps = repsLabel(s);
  const load = s.load_kg !== null ? fmtKg(s.load_kg) : LOAD_KIND[s.load_kind];
  if (reps) parts.push(load ? `${reps} × ${load}` : `${reps} reps`);
  else if (load) parts.push(load);
  if (s.duration_seconds !== null) parts.push(fmtDuration(s.duration_seconds));
  if (s.distance_m !== null) parts.push(fmtDistance(s.distance_m));
  if (s.rpe !== null) parts.push(`RPE ${s.rpe}`);
  if (s.rir !== null) parts.push(`RIR ${s.rir}`);
  if (s.tempo) parts.push(s.tempo);
  return parts.join(" · ") || "As prescribed";
}

export function resultLabel(l: Pick<FitnessSetLog, "status" | "reps" | "load_kg" | "duration_seconds" | "distance_m" | "load_kind">): string {
  if (l.status === "skipped") return "Skipped";
  const parts: string[] = [];
  if (l.reps !== null) parts.push(l.load_kg !== null ? `${l.reps} × ${fmtKg(l.load_kg)}` : `${l.reps} reps`);
  else if (l.load_kg !== null) parts.push(fmtKg(l.load_kg));
  if (l.duration_seconds !== null) parts.push(fmtDuration(l.duration_seconds));
  if (l.distance_m !== null) parts.push(fmtDistance(l.distance_m));
  return parts.join(" · ") || "Done";
}

/** Which inputs a set needs, from its prescription (never guessed from nothing). */
export function setFields(s: PTSet | undefined) {
  if (!s) return { reps: true, load: false, duration: false, distance: false };
  const timed = s.duration_seconds !== null;
  const distance = s.distance_m !== null;
  return {
    reps: s.reps_min !== null || s.reps_max !== null || (!timed && !distance),
    load: s.load_kind === "external" || s.load_kind === "assisted",
    duration: timed,
    distance,
  };
}
