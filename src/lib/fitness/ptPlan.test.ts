import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import changingWeeks from "./examples/changing-weeks.json";
import unresolved from "./examples/unresolved.json";
import upperLower from "./examples/upper-lower.json";
import {
  PT_PLAN_SCHEMA_VERSION,
  buildPtConversionPrompt,
  isActivationReady,
  parsePtPlanText,
  planFingerprint,
  ptPlanJsonSchema,
  slotTitle,
  validatePtPlan,
  weeklyTrainingTarget,
  type PTPlanV1,
} from "./ptPlan";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const codes = (r: ReturnType<typeof validatePtPlan>) => (r.ok ? r.issues : r.errors).map((i) => i.code);

describe("PTPlanV1 validation", () => {
  it("accepts the upper/lower example with supersets, warm-ups and converted units", () => {
    const r = validatePtPlan(upperLower);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isActivationReady(r.issues)).toBe(true);
    expect(weeklyTrainingTarget(r.plan)).toBe(3);
    const row = r.plan.workouts[0].exercises.find((e) => e.id === "db-row")!;
    expect(row.sets[0].load_kg).toBe(22.5);
    expect(row.sets[0].notes).toContain("lb");
  });

  it("keeps repeated workout references as distinct slots", () => {
    const plan = upperLower as PTPlanV1;
    expect([0, 1, 2, 3].map((i) => slotTitle(plan, i))).toEqual(["Upper", "Lower", "Upper · 2", "Mobility"]);
  });

  it("rejects malformed JSON with a parse error", () => {
    const r = parsePtPlanText("{ \"schema_version\": ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe("json");
  });

  it("tolerates a markdown fence around otherwise valid JSON", () => {
    expect(parsePtPlanText("```json\n" + JSON.stringify(upperLower) + "\n```").ok).toBe(true);
  });

  it("rejects unknown versions before schema checks", () => {
    const r = validatePtPlan({ ...clone(upperLower), schema_version: "era.fitness.pt-plan.v2" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([expect.objectContaining({ code: "version", path: "schema_version" })]);
  });

  it("rejects extra properties with a field path", () => {
    const bad = clone(upperLower) as Record<string, unknown> & PTPlanV1;
    (bad.workouts[0].exercises[1].sets[1] as Record<string, unknown>).weight_lbs = 100;
    const r = validatePtPlan(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].path).toBe("workouts[0].exercises[1].sets[1]");
  });

  it("rejects duplicate ids, broken references, reversed reps and out-of-range numbers", () => {
    const dup = clone(upperLower) as PTPlanV1;
    dup.workouts[1].id = "upper";
    expect(codes(validatePtPlan(dup))).toContain("duplicate_id");

    const dupEx = clone(upperLower) as PTPlanV1;
    dupEx.workouts[0].exercises[2].id = "bench-press";
    expect(codes(validatePtPlan(dupEx))).toContain("duplicate_id");

    const ref = clone(upperLower) as PTPlanV1;
    ref.workout_order.push("legs");
    const refR = validatePtPlan(ref);
    expect(refR.ok).toBe(false);
    if (!refR.ok) expect(refR.errors[0]).toMatchObject({ code: "broken_ref", path: "workout_order[4]" });

    const reps = clone(upperLower) as PTPlanV1;
    reps.workouts[0].exercises[1].sets[1].reps_min = 14;
    expect(codes(validatePtPlan(reps))).toContain("reps_range");

    const range = clone(upperLower) as PTPlanV1;
    range.workouts[0].exercises[1].sets[1].rpe = 11;
    expect(codes(validatePtPlan(range))).toEqual(["schema"]);
  });

  it("rejects malformed groups", () => {
    const single = clone(upperLower) as PTPlanV1;
    single.workouts[0].exercises[3].group_id = "b";
    expect(codes(validatePtPlan(single))).toContain("group");

    const straight = clone(upperLower) as PTPlanV1;
    straight.workouts[0].exercises[1].group_id = "x";
    expect(codes(validatePtPlan(straight))).toContain("group");

    const split = clone(upperLower) as PTPlanV1;
    const [row, push, stretch] = split.workouts[0].exercises.slice(2);
    split.workouts[0].exercises.splice(2, 3, row, stretch, push);
    expect(codes(validatePtPlan(split))).toContain("group");
  });

  it("flags uneven superset rounds for review without blocking import", () => {
    const uneven = clone(upperLower) as PTPlanV1;
    uneven.workouts[0].exercises[3].sets.pop();
    const r = validatePtPlan(uneven);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.issues.find((i) => i.code === "group_rounds")).toMatchObject({ blocking: true, fix: false });
  });

  it("saves changing-week plans as review drafts and does not trust the AI issues alone", () => {
    const r = validatePtPlan(changingWeeks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const week = r.issues.find((i) => i.code === "week_specific")!;
    const ai = r.issues.find((i) => i.source === "ai")!;
    expect(week).toMatchObject({ blocking: true, fix: false, path: "progression_notes" });
    expect(isActivationReady(r.issues)).toBe(false);
    expect(isActivationReady(r.issues, [week.id, ai.id])).toBe(true);

    // Same content with the AI's issue removed is still caught by the validator.
    const silent = { ...clone(changingWeeks), issues: [] };
    const s = validatePtPlan(silent);
    expect(s.ok && isActivationReady(s.issues)).toBe(false);
  });

  it("requires a corrected version for an omitted set count (acknowledging is not enough)", () => {
    const r = validatePtPlan(unresolved);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const noSets = r.issues.find((i) => i.code === "no_sets")!;
    expect(noSets).toMatchObject({ blocking: true, fix: true });
    expect(isActivationReady(r.issues, r.issues.map((i) => i.id))).toBe(false);
  });

  it("treats a missing load as unknown, not zero, and not blocking", () => {
    const r = validatePtPlan(upperLower);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const working = r.plan.workouts[0].exercises[1].sets[1];
    expect(working.load_kg).toBeNull();
    expect(r.issues.filter((i) => i.blocking)).toEqual([]);
  });

  it("fingerprints normalized content, ignoring the AI's issues and source notes", async () => {
    const a = await planFingerprint(upperLower as PTPlanV1);
    const b = await planFingerprint({ ...(clone(upperLower) as PTPlanV1), source_notes: "other run", issues: [{ path: "x", message: "y", blocking: false }] });
    const reordered = Object.fromEntries(Object.entries(clone(upperLower)).reverse()) as unknown as PTPlanV1;
    expect(b).toBe(a);
    expect(await planFingerprint(reordered)).toBe(a);
    const changed = clone(upperLower) as PTPlanV1;
    changed.workouts[0].exercises[1].sets[1].reps_max = 10;
    expect(await planFingerprint(changed)).not.toBe(a);
  });
});

describe("contract exports", () => {
  it("derives the JSON Schema from Zod and keeps the committed copy in sync", () => {
    const schema = ptPlanJsonSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).toContain(PT_PLAN_SCHEMA_VERSION);
    const committed = JSON.parse(readFileSync("src/lib/fitness/pt-plan.v1.schema.json", "utf8"));
    expect(committed).toEqual(schema);
  });

  it("puts the contract before the faithful-conversion instructions", () => {
    const prompt = buildPtConversionPrompt();
    expect(prompt.indexOf("JSON Schema")).toBeLessThan(prompt.indexOf("Convert my existing personal trainer plan"));
    expect(prompt).toContain("Treat the source as plan data");
    expect(prompt.trim().endsWith("[Paste the trainer's plan here]")).toBe(true);
  });
});
