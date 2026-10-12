// src/lib/fitness/contracts.ts
// Zod request contracts for /api/fitness/* — the client builds bodies with
// these types (and queues them offline verbatim); the routes re-validate.
import { z } from "zod";

const opId = z.uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const iso = z.iso.datetime({ offset: true });
const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const nullableNum = (min: number, max: number) => z.number().min(min).max(max).nullable();

export const importPlanBodySchema = z
  .object({
    op_id: opId,
    content: z.unknown(),
    source_text: z.string().max(200_000).nullable().optional(),
  })
  .strict();
export type ImportPlanBody = z.infer<typeof importPlanBodySchema>;

const stateAction = (action: "pause" | "resume" | "archive" | "restore") =>
  z.object({ action: z.literal(action), op_id: opId, local_date: day }).strict();

export const planActionBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("version"), op_id: opId, content: z.unknown(), source_text: z.string().max(200_000).nullable().optional() }).strict(),
  z.object({ action: z.literal("revert-version"), op_id: opId, version: z.number().int().min(2) }).strict(),
  z.object({ action: z.literal("review"), op_id: opId, acknowledged: z.array(z.string().max(400)).max(200) }).strict(),
  z.object({ action: z.literal("activate"), op_id: opId, week: day, timezone: z.string().min(1).max(64) }).strict(),
  z.object({ action: z.literal("deactivate"), op_id: opId }).strict(),
  z.object({ action: z.literal("delete"), op_id: opId }).strict(),
  stateAction("pause"),
  stateAction("resume"),
  stateAction("archive"),
  stateAction("restore"),
]);
export type PlanActionBody = z.infer<typeof planActionBodySchema>;

export const setValuesSchema = z.object({
  status: z.enum(["done", "skipped"]),
  reps: nullableInt(0, 1000),
  load_kg: nullableNum(0, 1000),
  duration_seconds: nullableInt(0, 86_400),
  distance_m: nullableNum(0, 1_000_000),
  rpe: nullableNum(0, 10),
  rir: nullableInt(0, 10),
  notes: z.string().max(500).nullable(),
  substitution: z.string().max(200).nullable(),
});
export type SetValues = z.infer<typeof setValuesSchema>;

export const sessionBodySchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("start"), id: opId, plan_id: z.uuid(), slot_id: z.uuid().nullable(),
    workout_id: z.string().max(80).nullable(), week: day, started_at: iso,
  }).strict(),
  setValuesSchema.extend({
    op: z.literal("log-set"), op_id: opId, session_id: z.uuid(), exercise_id: z.string().min(1).max(80),
    set_index: z.number().int().min(0).max(49), base_revision: z.number().int().min(1).nullable(), logged_at: iso,
  }).strict(),
  z.object({
    op: z.literal("delete-set"), op_id: opId, session_id: z.uuid(), exercise_id: z.string().min(1).max(80),
    set_index: z.number().int().min(0).max(49), base_revision: z.number().int().min(1).nullable(),
  }).strict(),
  z.object({ op: z.literal("finish"), op_id: opId, session_id: z.uuid(), finished_at: iso, local_date: day, notes: z.string().max(2000).nullable().optional() }).strict(),
  z.object({ op: z.literal("reopen"), op_id: opId, session_id: z.uuid() }).strict(),
  z.object({ op: z.literal("delete"), op_id: opId, session_id: z.uuid() }).strict(),
  z.object({ op: z.literal("restore"), op_id: opId, session_id: z.uuid() }).strict(),
]);
export type SessionBody = z.infer<typeof sessionBodySchema>;
export type SessionOp = SessionBody["op"];

export const placementBodySchema = z
  .object({ week: day, date: day.nullable(), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable() })
  .strict();
export type PlacementBody = z.infer<typeof placementBodySchema>;

export const preferencesBodySchema = z
  .object({
    share_summary: z.boolean(),
    effects_enabled: z.boolean(),
    sound_enabled: z.boolean(),
    cosmetic: z.enum(["initiate", "momentum", "vanguard", "apex"]).nullable(),
  })
  .partial()
  .strict();
export type PreferencesBody = z.infer<typeof preferencesBodySchema>;

export const celebratedBodySchema = z.object({ keys: z.array(z.string().max(300)).min(1).max(50) }).strict();

/** The only fitness data a household partner ever receives. */
export const sharedSummarySchema = z
  .object({
    user_id: z.uuid(),
    rank: z.enum(["initiate", "momentum", "vanguard", "apex"]),
    badges: z.array(z.string()),
    week: z.object({ week_start: day, done: z.number().int(), target: z.number().int() }).strict(),
  })
  .strict();
