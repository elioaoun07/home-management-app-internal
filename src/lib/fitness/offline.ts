// src/lib/fitness/offline.ts
// Overlays queued (IndexedDB) workout writes on the cached bundle so an
// offline workout keeps working across refreshes, and pending work stays
// visibly pending until the server acknowledges it. Pure; tested.
import type { SessionBody } from "./contracts";
import { workoutById } from "./ptPlan";
import type { FitnessBundle, FitnessSetLog, OpenSession, RecentSession } from "./types";

function omitSnapshot<T extends { snapshot: unknown }>(o: T): Omit<T, "snapshot"> {
  const copy: Partial<T> = { ...o };
  delete copy.snapshot;
  return copy as Omit<T, "snapshot">;
}

export interface QueuedFitnessOp {
  id: string;
  body: SessionBody;
  reviewRequired?: boolean;
  label?: string;
  createdAt: number;
}

export interface OfflineView {
  bundle: FitnessBundle;
  pendingCount: number;
  /** Replays the server rejected (conflicts, closed sessions): input kept for review. */
  held: QueuedFitnessOp[];
  /** Session ids whose Finish is queued (rewards pending). */
  pendingFinish: Set<string>;
}

export function mergeOffline(bundle: FitnessBundle, ops: QueuedFitnessOp[]): OfflineView {
  const live = ops.filter((o) => !o.reviewRequired).sort((a, b) => a.createdAt - b.createdAt);
  const held = ops.filter((o) => o.reviewRequired);
  const pendingFinish = new Set<string>();
  let open: OpenSession | null = bundle.open_session ? { ...bundle.open_session, sets: [...bundle.open_session.sets] } : null;
  const recent: RecentSession[] = [...bundle.recent_sessions];

  for (const { body } of live) {
    if (body.op === "start") {
      if (open?.id === body.id || recent.some((s) => s.id === body.id)) continue;
      const content = bundle.live_plan?.version.content;
      const slot = bundle.live_plan?.slots.find((s) => s.id === body.slot_id);
      const workoutId = slot && content ? content.workout_order[slot.slot_index] : body.workout_id;
      const workout = content && workoutId ? workoutById(content, workoutId) : undefined;
      if (!workout || !bundle.live_plan) continue;
      open = {
        id: body.id, user_id: bundle.preferences.user_id, plan_id: body.plan_id, version: bundle.live_plan.version.version,
        slot_id: body.slot_id, period_start: body.week, workout_id: workout.id, workout_name: workout.name, kind: workout.kind,
        snapshot: workout, training_target: bundle.live_plan.version.training_target, status: "in_progress", source: "fitness",
        started_at: body.started_at, finished_at: null, local_date: null, has_sets: false, fully_logged: false, notes: null,
        revision: 0, deleted_at: null, sets: [], pending: true,
      };
    } else if (body.op === "log-set" && open?.id === body.session_id) {
      const existing = open.sets.find((s) => s.exercise_id === body.exercise_id && s.set_index === body.set_index);
      const exercise = open.snapshot.exercises.find((e) => e.id === body.exercise_id);
      const row: FitnessSetLog = {
        id: existing?.id ?? `pending:${body.op_id}`, session_id: body.session_id, exercise_id: body.exercise_id, set_index: body.set_index,
        exercise_name: exercise?.name ?? body.exercise_id, equipment: exercise?.equipment ?? null,
        load_kind: exercise?.sets[body.set_index]?.load_kind ?? exercise?.sets.at(-1)?.load_kind ?? "unspecified",
        substitution: body.substitution, status: body.status, reps: body.reps, load_kg: body.load_kg,
        duration_seconds: body.duration_seconds, distance_m: body.distance_m, rpe: body.rpe, rir: body.rir, notes: body.notes,
        logged_at: body.logged_at, revision: existing?.revision ?? 0, pending: true,
      };
      open.sets = [...open.sets.filter((s) => s !== existing), row];
    } else if (body.op === "delete-set" && open?.id === body.session_id) {
      open.sets = open.sets.filter((s) => !(s.exercise_id === body.exercise_id && s.set_index === body.set_index));
    } else if (body.op === "finish" && open?.id === body.session_id) {
      pendingFinish.add(open.id);
      const { sets, ...withSnapshot } = open;
      const rest = omitSnapshot(withSnapshot);
      recent.unshift({
        ...rest, status: "completed", finished_at: body.finished_at, local_date: body.local_date, pending: true,
        sets_done: sets.filter((s) => s.status === "done").length, volume_kg: null,
      });
      open = null;
    } else if (body.op === "delete" && open?.id === body.session_id) {
      open = null;
    }
  }
  return { bundle: { ...bundle, open_session: open, recent_sessions: recent }, pendingCount: live.length, held, pendingFinish };
}

/**
 * Coalescing rule for queued set edits: a second offline edit of the same set
 * replaces the queued body (its base revision is still the last server one),
 * so the replay never conflicts with itself.
 */
export function sameSet(a: SessionBody, b: SessionBody): boolean {
  return (
    (a.op === "log-set" || a.op === "delete-set") &&
    (b.op === "log-set" || b.op === "delete-set") &&
    a.session_id === b.session_id && a.exercise_id === b.exercise_id && a.set_index === b.set_index
  );
}
