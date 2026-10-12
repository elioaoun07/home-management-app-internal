// src/features/fitness/types.ts — domain types live in the shared layer
// (src/lib/fitness/types.ts) so API routes and future ERA reads share them.
export type * from "@/lib/fitness/types";
export type { PTPlanV1, PTWorkout, PTExercise, PTSet, PlanIssue, WorkoutKind, LoadKind } from "@/lib/fitness/ptPlan";
export type { SessionBody, SetValues, PlanActionBody, PreferencesBody } from "@/lib/fitness/contracts";
