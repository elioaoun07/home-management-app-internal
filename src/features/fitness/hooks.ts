// src/features/fitness/hooks.ts
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import type { PlacementBody, PlanActionBody, PreferencesBody, SessionBody, SetValues } from "@/lib/fitness/contracts";
import { fixtureBundle, type FixtureState } from "@/lib/fitness/fixtures";
import { mergeOffline, sameSet, type OfflineView, type QueuedFitnessOp } from "@/lib/fitness/offline";
import { deviceTimeZone, localDate, localWeekStart } from "@/lib/fitness/progress";
import type { FitnessBundle, FitnessPreferences, FitnessSetLog, OpenSession, RecentSession, RewardEvent, RewardTotals } from "@/lib/fitness/types";
import { addToQueue, getAllPending, removeFromQueue, updateQueuedOperation, type OfflineOperation } from "@/lib/offlineQueue";
import { qk } from "@/lib/queryKeys";
import { RequestTimeoutError, isOfflineError, safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fitnessKeys } from "./queryKeys";

// ── Transport ───────────────────────────────────────────────────────────────

export class FitnessApiError extends Error {
  constructor(message: string, public status: number, public body: Record<string, unknown>) {
    super(message);
    this.name = "FitnessApiError";
  }
}
/** The write may have committed; the receipt lookup could not confirm it. */
export class UnverifiedWriteError extends Error {
  constructor(public opId: string) {
    super("Save unverified");
    this.name = "UnverifiedWriteError";
  }
}

const uuid = () => crypto.randomUUID();
type WriteResult<T> = { status: "done"; data: T } | { status: "queued" };

async function readError(res: Response) {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return new FitnessApiError(typeof body.error === "string" ? body.error : "Request failed", res.status, body);
}

/** Ask the durable receipt whether an ambiguous write committed. */
async function reconcile<T>(opId: string): Promise<WriteResult<T> | null> {
  try {
    const res = await safeFetch(`/api/fitness/operations/${opId}`, { method: "GET" });
    if (!res.ok) return null;
    const r = (await res.json()) as { committed: boolean; receipt: { result: T } | null };
    if (r.committed) return { status: "done", data: (r.receipt?.result ?? ({} as T)) };
  } catch {
    /* still unknown */
  }
  return null;
}

/**
 * Every Fitness write. Confirmed-offline workout writes go to the IndexedDB
 * queue (replay is idempotent by op id). A timeout is latency, never offline:
 * it is reconciled against the receipt and otherwise surfaced as unverified —
 * it never enqueues (Hard Rule 6).
 */
async function writeFitness<T>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH",
  body: Record<string, unknown>,
  opts: { opId?: string; queue?: { label: string; operation: OfflineOperation["operation"] }; timeoutMs?: number } = {},
): Promise<WriteResult<T>> {
  let res: Response;
  try {
    res = await safeFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    });
  } catch (e) {
    if (opts.queue && isOfflineError(e)) {
      await enqueueFitness(endpoint, body as SessionBody, opts.queue);
      return { status: "queued" };
    }
    if (e instanceof RequestTimeoutError && opts.opId) {
      const known = await reconcile<T>(opts.opId);
      if (known) return known;
      throw new UnverifiedWriteError(opts.opId);
    }
    throw e;
  }
  if (!res.ok) {
    const err = await readError(res);
    const completion = (err.body.completion as { status?: string } | undefined)?.status;
    if (completion === "unknown" && opts.opId) {
      const known = await reconcile<T>(opts.opId);
      if (known) return known;
      throw new UnverifiedWriteError(opts.opId);
    }
    throw err;
  }
  return { status: "done", data: (await res.json()) as T };
}

async function enqueueFitness(endpoint: string, body: SessionBody, q: { label: string; operation: OfflineOperation["operation"] }) {
  if (body.op === "log-set" || body.op === "delete-set") {
    const queued = (await getAllPending()).find(
      (o) => o.feature === "fitness" && !o.reviewRequired && sameSet(o.body as SessionBody, body),
    );
    if (queued) {
      const prev = queued.body as SessionBody;
      // A delete of a set that only ever existed in the queue cancels both.
      if (body.op === "delete-set" && prev.op === "log-set" && prev.base_revision === null) {
        await removeFromQueue(queued.id);
        return;
      }
      const base = "base_revision" in prev ? prev.base_revision : null;
      await updateQueuedOperation(queued.id, { body: { ...body, base_revision: base } as Record<string, unknown>, metadata: { label: q.label } });
      return;
    }
  }
  await addToQueue({ feature: "fitness", operation: q.operation, endpoint, method: "POST", body: body as Record<string, unknown>, metadata: { label: q.label } });
}

function invalidateFitness(qc: QueryClient, schedule = true) {
  qc.invalidateQueries({ queryKey: fitnessKeys.all });
  if (schedule) {
    // Slot items and their completions live in Schedule.
    qc.invalidateQueries({ queryKey: qk.scheduleItems() });
    qc.invalidateQueries({ queryKey: qk.flexibleRoutines() });
  }
}

function errorToast(e: unknown, retry?: () => void) {
  if (e instanceof UnverifiedWriteError) {
    toast.error("Save unverified", { icon: ToastIcons.error, duration: 6000, ...(retry ? { action: { label: "Retry", onClick: retry } } : {}) });
    return;
  }
  const status = e instanceof FitnessApiError ? e.status : 0;
  const msg = status === 503 ? "Fitness setup pending" : e instanceof Error ? e.message : "Request failed";
  toast.error(msg, { icon: ToastIcons.error });
}

// ── Reads ───────────────────────────────────────────────────────────────────

export function useFitnessBundle(fixture?: FixtureState | null) {
  return useQuery({
    queryKey: fixture ? fitnessKeys.fixture(fixture) : fitnessKeys.bundle(),
    queryFn: async (): Promise<FitnessBundle> => {
      if (fixture) return fixtureBundle(fixture);
      if (!isReallyOnline()) throw new Error("Offline");
      const res = await fetch("/api/fitness");
      if (!res.ok) throw await readError(res);
      return (await res.json()).bundle as FitnessBundle;
    },
    staleTime: fixture ? Infinity : 15_000,
    refetchOnWindowFocus: !fixture,
    retry: (count, error) => (error?.message === "Offline" || (error as FitnessApiError)?.status === 503 ? false : count < 2),
  });
}

/** Queued fitness ops from IndexedDB, live-updated on queue changes. */
export function usePendingFitnessOps() {
  const [ops, setOps] = useState<QueuedFitnessOp[]>([]);
  const refresh = useCallback(async () => {
    const all = await getAllPending().catch(() => [] as OfflineOperation[]);
    setOps(
      all
        .filter((o) => o.feature === "fitness")
        .map((o) => ({ id: o.id, body: o.body as SessionBody, reviewRequired: o.reviewRequired, label: o.metadata?.label, createdAt: o.createdAt })),
    );
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("offline-queue-changed", refresh);
    return () => window.removeEventListener("offline-queue-changed", refresh);
  }, [refresh]);
  return { ops, refresh };
}

/** Bundle + offline overlay — what every Fitness surface renders. */
export function useFitnessView(fixture?: FixtureState | null): { query: ReturnType<typeof useFitnessBundle>; view: OfflineView | null } {
  const query = useFitnessBundle(fixture);
  const { ops } = usePendingFitnessOps();
  const view = useMemo(() => (query.data ? mergeOffline(query.data, fixture ? [] : ops) : null), [query.data, ops, fixture]);
  return { query, view };
}

export function useSessionHistory(enabled = true) {
  return useInfiniteQuery({
    queryKey: fitnessKeys.history(),
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: "20", ...(pageParam ? { before: pageParam } : {}) });
      const res = await fetch(`/api/fitness/sessions?${qs}`);
      if (!res.ok) throw await readError(res);
      return (await res.json()).sessions as RecentSession[];
    },
    getNextPageParam: (last) => (last.length === 20 ? last[last.length - 1].finished_at : null),
  });
}

export function useSessionDetail(id: string | null) {
  return useQuery({
    queryKey: fitnessKeys.session(id ?? "none"),
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/fitness/sessions/${id}`);
      if (!res.ok) throw await readError(res);
      return (await res.json()).session as RecentSession & { sets: FitnessSetLog[] };
    },
  });
}

// ── Plans ───────────────────────────────────────────────────────────────────

export function useImportPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: unknown; source_text: string | null; planId?: string }) => {
      const opId = uuid();
      const body = input.planId
        ? { action: "version", op_id: opId, content: input.content, source_text: input.source_text }
        : { op_id: opId, content: input.content, source_text: input.source_text };
      const r = await writeFitness<{ plan: { id: string; name: string; current_version: number } }>(
        input.planId ? `/api/fitness/plans/${input.planId}` : "/api/fitness/plans", "POST", body, { opId, timeoutMs: 15_000 },
      );
      if (r.status !== "done") throw new Error("Offline");
      return r.data;
    },
    onSuccess: ({ plan }, input) => {
      const undo = input.planId
        ? () => planAction(qc, plan.id, { action: "revert-version", op_id: uuid(), version: plan.current_version })
        : () => planAction(qc, plan.id, { action: "delete", op_id: uuid() });
      toast.success(input.planId ? "New version saved" : "Plan imported", {
        icon: ToastIcons.create,
        duration: 4000,
        action: { label: "Undo", onClick: () => void undo() },
      });
    },
    onSettled: () => invalidateFitness(qc),
  });
}

async function planAction(qc: QueryClient, planId: string, body: PlanActionBody) {
  try {
    const r = await writeFitness(`/api/fitness/plans/${planId}`, "POST", body as Record<string, unknown>, { opId: body.op_id, timeoutMs: 15_000 });
    if (r.status !== "done") throw new Error("Offline");
    return r.data;
  } catch (e) {
    errorToast(e);
    throw e;
  } finally {
    invalidateFitness(qc);
  }
}

const INVERSE: Partial<Record<PlanActionBody["action"], PlanActionBody["action"]>> = {
  activate: "deactivate",
  pause: "resume",
  resume: "pause",
  archive: "restore",
  restore: "archive",
};
const LABEL: Partial<Record<PlanActionBody["action"], string>> = {
  activate: "Plan activated",
  pause: "Plan paused",
  resume: "Plan resumed",
  archive: "Plan archived",
  restore: "Plan restored",
  review: "Review saved",
};

/** activate | pause | resume | archive | restore | review — each with a real inverse Undo. */
export function usePlanAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; action: "activate" | "pause" | "resume" | "archive" | "restore" | "review"; acknowledged?: string[]; previousAck?: string[]; week?: string }) => {
      const body: PlanActionBody =
        input.action === "activate"
          ? { action: "activate", op_id: uuid(), week: input.week ?? localWeekStart(), timezone: deviceTimeZone() }
          : input.action === "review"
            ? { action: "review", op_id: uuid(), acknowledged: input.acknowledged ?? [] }
            : { action: input.action, op_id: uuid(), local_date: localDate() };
      const r = await writeFitness(`/api/fitness/plans/${input.planId}`, "POST", body as Record<string, unknown>, { opId: body.op_id, timeoutMs: 15_000 });
      if (r.status !== "done") throw new Error("Offline");
      return r.data;
    },
    onSuccess: (_d, input) => {
      const inverse = INVERSE[input.action];
      const undo = (): Promise<unknown> =>
        input.action === "review"
          ? planAction(qc, input.planId, { action: "review", op_id: uuid(), acknowledged: input.previousAck ?? [] })
          : inverse === "deactivate"
            ? planAction(qc, input.planId, { action: "deactivate", op_id: uuid() })
            : planAction(qc, input.planId, { action: inverse as "pause", op_id: uuid(), local_date: localDate() });
      toast.success(LABEL[input.action] ?? "Saved", {
        icon: ToastIcons.update,
        duration: 4000,
        action: { label: "Undo", onClick: () => void undo().catch(() => undefined) },
      });
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc),
  });
}

export function usePlaceSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slotId: string } & PlacementBody) => {
      const { slotId, ...body } = input;
      const r = await writeFitness<{ previous: { scheduled_for_date: string; scheduled_for_time: string | null } | null }>(
        `/api/fitness/slots/${slotId}/placement`, "PUT", body,
      );
      if (r.status !== "done") throw new Error("Offline");
      return r.data;
    },
    onSuccess: ({ previous }, input) => {
      toast.success(input.date ? "Placed" : "Cleared", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            void writeFitness(`/api/fitness/slots/${input.slotId}/placement`, "PUT", {
              week: input.week,
              date: previous?.scheduled_for_date ?? null,
              time: previous?.scheduled_for_time?.slice(0, 5) ?? null,
            }).then(() => invalidateFitness(qc), (e) => errorToast(e)),
        },
      });
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc),
  });
}

// ── Sessions ────────────────────────────────────────────────────────────────

function patchOpen(qc: QueryClient, fn: (open: OpenSession) => OpenSession | null) {
  qc.setQueryData<FitnessBundle>(fitnessKeys.bundle(), (b) => (b && b.open_session ? { ...b, open_session: fn(b.open_session) } : b));
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; slotId: string | null; workoutId: string | null; label: string }) => {
      const body: SessionBody = {
        op: "start", id: uuid(), plan_id: input.planId, slot_id: input.slotId, workout_id: input.workoutId,
        week: localWeekStart(), started_at: new Date().toISOString(),
      };
      const r = await writeFitness<{ session: OpenSession }>("/api/fitness/sessions", "POST", body, {
        opId: body.id, queue: { label: `${input.label} · start`, operation: "create" },
      });
      return { id: body.id, result: r };
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc, false),
  });
}

/** One tap = one logged set with the displayed (editable) values. No toast: calm logging. */
export function useLogSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { session: OpenSession; exerciseId: string; setIndex: number; values: SetValues; label: string }) => {
      const current = input.session.sets.find((s) => s.exercise_id === input.exerciseId && s.set_index === input.setIndex);
      const body: SessionBody = {
        op: "log-set", op_id: uuid(), session_id: input.session.id, exercise_id: input.exerciseId, set_index: input.setIndex,
        base_revision: current && !current.pending ? current.revision : null, logged_at: new Date().toISOString(), ...input.values,
      };
      const r = await writeFitness<{ set: FitnessSetLog; session: OpenSession }>("/api/fitness/sessions", "POST", body, {
        opId: body.op_id, queue: { label: input.label, operation: "update" },
      });
      return r;
    },
    // Optimistic: the set shows as logged immediately (pending until acknowledged).
    onMutate: (input) => {
      const exercise = input.session.snapshot.exercises.find((e) => e.id === input.exerciseId);
      patchOpen(qc, (open) => {
        const current = open.sets.find((s) => s.exercise_id === input.exerciseId && s.set_index === input.setIndex);
        const row: FitnessSetLog = {
          id: current?.id ?? `pending:${input.exerciseId}:${input.setIndex}`, session_id: open.id, exercise_id: input.exerciseId,
          set_index: input.setIndex, exercise_name: exercise?.name ?? input.exerciseId, equipment: exercise?.equipment ?? null,
          load_kind: exercise?.sets[input.setIndex]?.load_kind ?? "unspecified", logged_at: new Date().toISOString(),
          revision: current?.revision ?? 0, pending: true, ...input.values,
        };
        return { ...open, sets: [...open.sets.filter((s) => s !== current), row] };
      });
    },
    onSuccess: (r) => {
      if (r.status !== "done") return;
      patchOpen(qc, (open) => ({
        ...open,
        revision: r.data.session.revision,
        fully_logged: r.data.session.fully_logged,
        has_sets: r.data.session.has_sets,
        sets: [...open.sets.filter((s) => !(s.exercise_id === r.data.set.exercise_id && s.set_index === r.data.set.set_index)), r.data.set],
      }));
    },
    onError: (e) => {
      invalidateFitness(qc, false);   // roll the optimistic row back to server truth
      if (e instanceof FitnessApiError && e.status === 409 && e.body.conflict) {
        toast.error("Changed on another device", { icon: ToastIcons.error });
        return;
      }
      errorToast(e);
    },
  });
}

export function useClearSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { session: OpenSession; set: FitnessSetLog; label: string }) => {
      const body: SessionBody = {
        op: "delete-set", op_id: uuid(), session_id: input.session.id, exercise_id: input.set.exercise_id,
        set_index: input.set.set_index, base_revision: input.set.pending ? null : input.set.revision,
      };
      return writeFitness("/api/fitness/sessions", "POST", body, { opId: body.op_id, queue: { label: input.label, operation: "delete" } });
    },
    onSuccess: (r, input) => {
      if (r.status === "done") patchOpen(qc, (open) => ({ ...open, sets: open.sets.filter((s) => s.id !== input.set.id) }));
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc, false),
  });
}

export interface FinishResult {
  session: RecentSession;
  rewards?: { events: RewardEvent[]; totals: RewardTotals };
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; label: string; notes?: string | null }) => {
      const body: SessionBody = {
        op: "finish", op_id: uuid(), session_id: input.sessionId, finished_at: new Date().toISOString(), local_date: localDate(), notes: input.notes ?? null,
      };
      return writeFitness<FinishResult>("/api/fitness/sessions", "POST", body, {
        opId: body.op_id, queue: { label: `${input.label} · finish`, operation: "complete" },
      });
    },
    onSuccess: (r, input) => {
      toast.success(r.status === "queued" ? "Saved offline" : "Workout saved", {
        icon: ToastIcons.success,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => void reopen(qc, input.sessionId),
        },
      });
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc),
  });
}

async function reopen(qc: QueryClient, sessionId: string) {
  const body: SessionBody = { op: "reopen", op_id: uuid(), session_id: sessionId };
  try {
    await writeFitness("/api/fitness/sessions", "POST", body, { opId: body.op_id, queue: { label: "Workout · reopen", operation: "toggle" } });
  } catch (e) {
    errorToast(e);
  } finally {
    invalidateFitness(qc);
  }
}

/** Discard an open workout or delete a past one — Undo restores it (and its Schedule completion). */
export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; label: string }) => {
      const body: SessionBody = { op: "delete", op_id: uuid(), session_id: input.sessionId };
      return writeFitness("/api/fitness/sessions", "POST", body, { opId: body.op_id, queue: { label: `${input.label} · delete`, operation: "archive" } });
    },
    onSuccess: (_r, input) => {
      toast.success("Workout removed", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            const body: SessionBody = { op: "restore", op_id: uuid(), session_id: input.sessionId };
            void writeFitness("/api/fitness/sessions", "POST", body, { opId: body.op_id, queue: { label: `${input.label} · restore`, operation: "archive" } })
              .catch((e) => errorToast(e))
              .finally(() => invalidateFitness(qc));
          },
        },
      });
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc),
  });
}

/** Held (conflict/rejected) queue entries: resend on top of the server's version, or drop. */
export function useResolveHeld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { op: QueuedFitnessOp; keep: boolean }) => {
      if (input.keep) {
        let body = input.op.body;
        const held = input.op.body;
        if (held.op === "log-set" || held.op === "delete-set") {
          const fresh = await fetch("/api/fitness").then((r) => r.json()).then((j) => j.bundle as FitnessBundle);
          const server = fresh.open_session?.sets.find((s) => s.exercise_id === held.exercise_id && s.set_index === held.set_index);
          body = { ...held, op_id: uuid(), base_revision: server?.revision ?? null };
        }
        const r = await writeFitness("/api/fitness/sessions", "POST", body as Record<string, unknown>, { opId: "op_id" in body ? body.op_id : body.id });
        if (r.status !== "done") throw new Error("Offline");
      }
      await removeFromQueue(input.op.id);
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc),
  });
}

// ── Preferences & celebrations ──────────────────────────────────────────────

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { patch: PreferencesBody; previous: PreferencesBody; quiet?: boolean }) => {
      const r = await writeFitness<{ preferences: FitnessPreferences }>("/api/fitness/preferences", "PATCH", input.patch);
      if (r.status !== "done") throw new Error("Offline");
      return r.data;
    },
    onMutate: ({ patch }) => {
      qc.setQueryData<FitnessBundle>(fitnessKeys.bundle(), (b) => (b ? { ...b, preferences: { ...b.preferences, ...patch } } : b));
    },
    onSuccess: (_d, input) => {
      if (input.quiet) return;
      toast.success("Saved", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => void writeFitness("/api/fitness/preferences", "PATCH", input.previous).finally(() => invalidateFitness(qc, false)),
        },
      });
    },
    onError: (e) => errorToast(e),
    onSettled: () => invalidateFitness(qc, false),
  });
}

export function useMarkCelebrated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keys: string[]) => {
      if (!keys.length) return;
      await writeFitness("/api/fitness/rewards/seen", "POST", { keys }).catch(() => undefined);
    },
    onMutate: (keys) => {
      const now = new Date().toISOString();
      qc.setQueryData<FitnessBundle>(fitnessKeys.bundle(), (b) =>
        b ? { ...b, rewards: { ...b.rewards, events: b.rewards.events.map((e) => (keys.includes(e.source_key) ? { ...e, celebrated_at: now } : e)) } } : b,
      );
    },
  });
}
