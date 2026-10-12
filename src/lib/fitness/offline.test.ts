import { describe, expect, it } from "vitest";
import type { SessionBody } from "./contracts";
import { fixtureBundle } from "./fixtures";
import { mergeOffline, sameSet, type QueuedFitnessOp } from "./offline";
import { localWeekStart } from "./progress";

const q = (n: number, body: SessionBody, reviewRequired = false): QueuedFitnessOp => ({ id: `op-${n}`, body, createdAt: n, reviewRequired });
const set = (opId: string, sessionId: string, exerciseId: string, idx: number, reps: number): SessionBody => ({
  op: "log-set", op_id: opId, session_id: sessionId, exercise_id: exerciseId, set_index: idx, base_revision: null, status: "done",
  reps, load_kg: 60, duration_seconds: null, distance_m: null, rpe: null, rir: null, notes: null, substitution: null, logged_at: "2026-10-12T10:00:00Z",
});

describe("offline overlay", () => {
  it("starts, logs and finishes a workout entirely offline, keeping everything pending", () => {
    const b = fixtureBundle("week");
    b.open_session = null;
    const sid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const slot = b.live_plan!.slots[0];
    const started = mergeOffline(b, [
      q(1, { op: "start", id: sid, plan_id: b.live_plan!.plan.id, slot_id: slot.id, workout_id: null, week: localWeekStart(), started_at: "2026-10-12T09:00:00Z" }),
      q(2, set("11111111-1111-4111-8111-111111111111", sid, "bench-press", 1, 10)),
      q(3, set("22222222-2222-4222-8222-222222222222", sid, "bench-press", 1, 11)),
    ]);
    expect(started.bundle.open_session).toMatchObject({ id: sid, workout_name: "Upper", pending: true });
    expect(started.bundle.open_session!.sets).toEqual([expect.objectContaining({ reps: 11, pending: true })]);
    expect(started.pendingCount).toBe(3);

    const finished = mergeOffline(b, [
      q(1, { op: "start", id: sid, plan_id: b.live_plan!.plan.id, slot_id: slot.id, workout_id: null, week: localWeekStart(), started_at: "2026-10-12T09:00:00Z" }),
      q(2, { op: "finish", op_id: "33333333-3333-4333-8333-333333333333", session_id: sid, finished_at: "2026-10-12T10:00:00Z", local_date: "2026-10-12" }),
    ]);
    expect(finished.bundle.open_session).toBeNull();
    expect(finished.bundle.recent_sessions[0]).toMatchObject({ id: sid, status: "completed", pending: true });
    expect(finished.pendingFinish.has(sid)).toBe(true);
  });

  it("drops an overlay once the server acknowledged it (refetched bundle wins)", () => {
    const b = fixtureBundle("active");
    const view = mergeOffline(b, [q(1, { op: "start", id: b.open_session!.id, plan_id: b.live_plan!.plan.id, slot_id: null, workout_id: "upper", week: localWeekStart(), started_at: b.open_session!.started_at })]);
    expect(view.bundle.open_session!.pending).toBeUndefined();
  });

  it("surfaces held conflicts without applying them", () => {
    const b = fixtureBundle("active");
    const view = mergeOffline(b, [q(1, set("11111111-1111-4111-8111-111111111111", b.open_session!.id, "bench-press", 1, 99), true)]);
    expect(view.held).toHaveLength(1);
    expect(view.bundle.open_session!.sets.find((s) => s.set_index === 1 && s.exercise_id === "bench-press")!.reps).toBe(11);
  });

  it("coalesces edits of the same set", () => {
    const a = set("11111111-1111-4111-8111-111111111111", "s", "e", 0, 1);
    expect(sameSet(a, set("22222222-2222-4222-8222-222222222222", "s", "e", 0, 2))).toBe(true);
    expect(sameSet(a, set("22222222-2222-4222-8222-222222222222", "s", "e", 1, 2))).toBe(false);
  });
});
