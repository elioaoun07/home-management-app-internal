"use client";

// Focused workout: large set controls, prescribed vs actual, previous
// performance, rest timer, exercise navigation, Finish. Portaled + opaque
// (Hard Rule 15); hides the app chrome by covering it.
import { useClearSet, useFinishSession, useLogSet, type FinishResult } from "@/features/fitness/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { SetValues } from "@/lib/fitness/contracts";
import { fmtDuration, prescriptionLabel, resultLabel, setFields } from "@/lib/fitness/format";
import { previousFor } from "@/lib/fitness/progress";
import type { PTExercise, PTSet } from "@/lib/fitness/ptPlan";
import type { FitnessSetLog, OpenSession, PreviousSet } from "@/lib/fitness/types";
import { parseDecimal } from "@/lib/health/measurements";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Repeat, SkipForward, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TimerIcon } from "./FitnessIcons";
import { useFitnessPalette } from "./fitnessTheme";
import { GhostButton, Pill, PrimaryButton, Stepper } from "./fitnessUi";

interface Props {
  session: OpenSession;
  previous: PreviousSet[];
  soundEnabled: boolean;
  readOnly?: boolean;
  onMinimize: () => void;
  onFinished: (result: FinishResult | null) => void;
}

const PHASE_LABEL = { warmup: "Warm-up", main: "Main", cooldown: "Cooldown" } as const;

// ── Rest timer: the deadline persists, so backgrounding/refresh recover it ──
const restKey = (sessionId: string) => `fitness:rest:${sessionId}`;
function readRest(sessionId: string): { deadline: number; total: number } | null {
  try {
    const raw = localStorage.getItem(restKey(sessionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeRest(sessionId: string, v: { deadline: number; total: number } | null) {
  try {
    if (v) localStorage.setItem(restKey(sessionId), JSON.stringify(v));
    else localStorage.removeItem(restKey(sessionId));
  } catch {
    /* storage unavailable: the timer still runs in memory */
  }
}
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio blocked */
  }
}

function useRestTimer(sessionId: string, soundEnabled: boolean) {
  const [rest, setRest] = useState(() => (typeof window === "undefined" ? null : readRest(sessionId)));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    const sync = () => setNow(Date.now());
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [rest]);
  const remaining = rest ? Math.max(0, Math.ceil((rest.deadline - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && remaining === 0) {
      if (soundEnabled && document.visibilityState === "visible") beep();
      try { navigator.vibrate?.(200); } catch { /* unsupported */ }
      writeRest(sessionId, null);
      setRest(null);
    }
  }, [remaining, rest, sessionId, soundEnabled]);
  const start = useCallback((seconds: number) => {
    const v = { deadline: Date.now() + seconds * 1000, total: seconds };
    writeRest(sessionId, v);
    setNow(Date.now());
    setRest(v);
  }, [sessionId]);
  const add = (s: number) => rest && start(Math.max(1, Math.ceil((rest.deadline - Date.now()) / 1000) + s));
  const stop = () => { writeRest(sessionId, null); setRest(null); };
  return { rest, remaining, start, add, stop };
}

// ── Exercise order & groups ─────────────────────────────────────────────────
function groupTags(exercises: PTExercise[]): Map<string, string> {
  const tags = new Map<string, string>();
  let letter = 0;
  let current: string | null = null;
  let pos = 0;
  for (const e of exercises) {
    if (e.group_id && e.group_id === current) pos++;
    else if (e.group_id) { current = e.group_id; letter++; pos = 1; }
    else { current = null; continue; }
    tags.set(e.id, `${String.fromCharCode(64 + letter)}${pos}`);
  }
  return tags;
}

function suggest(set: PTSet | undefined, prev: PreviousSet | null) {
  const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  return {
    reps: s(prev?.reps ?? set?.reps_max ?? set?.reps_min),
    load: s(prev?.load_kg ?? set?.load_kg),
    duration: s(prev?.duration_seconds ?? set?.duration_seconds),
    distance: s(prev?.distance_m ?? set?.distance_m),
  };
}

export function WorkoutScreen({ session, previous, soundEnabled, readOnly, onMinimize, onFinished }: Props) {
  const pal = useFitnessPalette();
  const tc = useThemeClasses();
  const reduced = useReducedMotion();
  const exercises = session.snapshot.exercises;
  const tags = useMemo(() => groupTags(exercises), [exercises]);
  const logOf = useCallback(
    (exId: string, idx: number) => session.sets.find((s) => s.exercise_id === exId && s.set_index === idx) ?? null,
    [session.sets],
  );
  const firstOpen = exercises.findIndex((e) => e.sets.some((_, i) => !logOf(e.id, i)));
  const [exIndex, setExIndex] = useState(Math.max(0, firstOpen));
  const [editing, setEditing] = useState<number | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [substitution, setSubstitution] = useState<Record<string, string>>({});
  const exercise = exercises[exIndex];
  const activeSet = exercise ? exercise.sets.findIndex((_, i) => !logOf(exercise.id, i)) : -1;
  const focusSet = editing ?? (activeSet >= 0 ? activeSet : null);
  const log = useLogSet();
  const clear = useClearSet();
  const finish = useFinishSession();
  const timer = useRestTimer(session.id, soundEnabled);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(session.started_at)) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session.started_at]);

  const prescribed = exercise?.sets[focusSet ?? 0];
  const prev = exercise && focusSet !== null ? previousFor(previous, session.workout_id, exercise.id, focusSet) : null;
  const existing = exercise && focusSet !== null ? logOf(exercise.id, focusSet) : null;
  const [draft, setDraft] = useState(() => suggest(prescribed, prev));
  useEffect(() => {
    setDraft(existing ? {
      reps: existing.reps?.toString() ?? "", load: existing.load_kg?.toString() ?? "",
      duration: existing.duration_seconds?.toString() ?? "", distance: existing.distance_m?.toString() ?? "",
    } : suggest(prescribed, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exIndex, focusSet, existing?.id]);

  const fields = setFields(prescribed);
  const loggedCount = session.sets.length;
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);

  const blocked = () => {
    // Fixture mode is display-only: no writes.
    return !!readOnly;
  };

  function advance() {
    // Supersets/circuits: next exercise in the group for the same round.
    const tag = tags.get(exercise.id);
    if (tag) {
      const group = exercises.filter((e) => e.group_id === exercise.group_id);
      const pos = group.findIndex((e) => e.id === exercise.id);
      const nextInGroup = group[(pos + 1) % group.length];
      const nextIdx = exercises.findIndex((e) => e.id === nextInGroup.id);
      if (nextInGroup.id !== exercise.id && nextInGroup.sets.some((_, i) => !logOf(nextInGroup.id, i))) setExIndex(nextIdx);
      return pos === group.length - 1;   // round complete → rest
    }
    // Last open set of a straight exercise → move on to the next open exercise.
    const remainingHere = exercise.sets.filter((_, i) => i !== focusSet && !logOf(exercise.id, i)).length;
    if (remainingHere === 0) {
      const next = exercises.findIndex((e, i) => i > exIndex && e.sets.some((_, si) => !logOf(e.id, si)));
      if (next >= 0) setExIndex(next);
    }
    return true;
  }

  function submit(status: "done" | "skipped") {
    if (!exercise || focusSet === null || blocked()) return;
    const num = (v: string) => { const n = parseDecimal(v); return n === null || Number.isNaN(n) ? null : n; };
    const values: SetValues = {
      status,
      reps: fields.reps ? (num(draft.reps) === null ? null : Math.round(num(draft.reps)!)) : null,
      load_kg: fields.load ? num(draft.load) : null,
      duration_seconds: fields.duration ? (num(draft.duration) === null ? null : Math.round(num(draft.duration)!)) : null,
      distance_m: fields.distance ? num(draft.distance) : null,
      rpe: null,
      rir: null,
      notes: null,
      substitution: substitution[exercise.id]?.trim() || null,
    };
    if (status === "done" && [values.reps, values.load_kg, values.duration_seconds, values.distance_m].some((v) => v !== null && Number.isNaN(v))) return;
    const label = `${exercise.name} · set ${focusSet + 1}`;
    log.mutate({ session, exerciseId: exercise.id, setIndex: focusSet, values, label });
    setEditing(null);
    if (editing === null) {
      const restNow = advance();
      const rest = prescribed?.rest_seconds;
      if (status === "done" && restNow && rest && rest > 0) timer.start(rest);
    }
  }

  function clearSet(l: FitnessSetLog) {
    if (blocked()) return;
    clear.mutate({ session, set: l, label: `${exercise.name} · set ${l.set_index + 1}` });
    setEditing(null);
  }

  async function doFinish() {
    if (blocked()) return;
    const r = await finish.mutateAsync({ sessionId: session.id, label: session.workout_name, notes: notes.trim() || null }).catch(() => null);
    if (!r) return;
    timer.stop();
    setFinishOpen(false);
    onFinished(r.status === "done" ? r.data : null);
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[70] flex flex-col", tc.bgPage)} role="dialog" aria-modal="true" aria-label={session.workout_name}>
      {/* Top bar */}
      <header className={cn("shrink-0 flex items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b", pal.line)}>
        <button onClick={onMinimize} aria-label="Minimize" className={cn("w-10 h-10 -ml-2 rounded-xl flex items-center justify-center", pal.mute)}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-base font-semibold truncate", pal.ink)}>{session.workout_name}</p>
          <p className={cn("text-xs tabular-nums", pal.faint)}>
            {fmtDuration(elapsed)} · {loggedCount}/{totalSets}
            {session.pending && <span style={{ color: pal.b }}> · Pending</span>}
          </p>
        </div>
        <PrimaryButton className="h-10 px-4" onClick={() => setFinishOpen(true)}>Finish</PrimaryButton>
      </header>

      {/* Exercise strip */}
      <nav className="shrink-0 flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar" aria-label="Exercises">
        {exercises.map((e, i) => {
          const done = e.sets.length > 0 && e.sets.every((_, si) => logOf(e.id, si));
          return (
            <button
              key={e.id}
              onClick={() => { setExIndex(i); setEditing(null); }}
              aria-current={i === exIndex}
              className={cn("shrink-0 rounded-full border px-3 h-8 text-xs font-medium flex items-center gap-1.5", pal.line, i === exIndex ? pal.ink : pal.mute)}
              style={i === exIndex ? { borderColor: pal.a, background: `${pal.a}1f` } : undefined}
            >
              {tags.get(e.id) && <span style={{ color: pal.a }}>{tags.get(e.id)}</span>}
              <span className="max-w-[9rem] truncate">{substitution[e.id] || e.name}</span>
              {done && <Check className="w-3.5 h-3.5" style={{ color: pal.a }} />}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto px-4 pb-48">
        {exercise ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={exercise.id} initial={reduced ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -16 }} transition={{ duration: reduced ? 0 : 0.18 }}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <p className={cn("text-[11px] uppercase tracking-widest", pal.faint)}>
                    {PHASE_LABEL[exercise.phase]}{tags.get(exercise.id) ? ` · ${exercise.group_mode} ${tags.get(exercise.id)}` : ""}
                  </p>
                  <h1 className={cn("text-2xl font-semibold leading-tight", pal.ink)}>{substitution[exercise.id] || exercise.name}</h1>
                  {(substitution[exercise.id] || exercise.equipment) && (
                    <p className={cn("text-sm", pal.mute)}>{substitution[exercise.id] ? `for ${exercise.name}` : exercise.equipment}</p>
                  )}
                </div>
                <GhostButton onClick={() => setSwapOpen((v) => !v)} aria-label="Swap exercise"><Repeat className="w-4 h-4" /> Swap</GhostButton>
              </div>
              {swapOpen && (
                <input
                  autoFocus
                  value={substitution[exercise.id] ?? ""}
                  onChange={(e) => setSubstitution((s) => ({ ...s, [exercise.id]: e.target.value }))}
                  placeholder="Substitute"
                  className={cn("w-full mt-2 rounded-xl border h-11 px-3 bg-transparent text-sm outline-none", pal.line, pal.ink)}
                />
              )}
              {exercise.notes && <p className={cn("mt-2 text-sm", pal.mute)}>{exercise.notes}</p>}

              <ol className="mt-4 space-y-2">
                {exercise.sets.map((s, i) => {
                  const l = logOf(exercise.id, i);
                  const isFocus = i === focusSet;
                  const p = previousFor(previous, session.workout_id, exercise.id, i);
                  return (
                    <li key={i}
                      className={cn("rounded-2xl border transition-colors", pal.line, isFocus ? pal.card : "")}
                      style={isFocus ? { borderColor: `${pal.a}88` } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(l ? (editing === i ? null : i) : null)}
                        className="w-full flex items-center gap-3 px-3 py-3 text-left"
                        aria-expanded={isFocus}
                      >
                        <span
                          className={cn("w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border", pal.line, pal.mute)}
                          style={l?.status === "done" ? { background: pal.a, borderColor: pal.a, color: "#fff" } : undefined}
                        >
                          {l?.status === "done" ? <Check className="w-4 h-4" /> : s.kind === "warmup" ? "W" : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-medium", pal.ink)}>{l ? resultLabel(l) : prescriptionLabel(s)}</span>
                          <span className={cn("block text-xs", pal.faint)}>
                            {l ? prescriptionLabel(s) : p ? `Last ${resultLabel(p)}` : s.rest_seconds ? `Rest ${fmtDuration(s.rest_seconds)}` : ""}
                            {s.notes ? ` · ${s.notes}` : ""}
                          </span>
                        </span>
                        {l?.pending && <Pill tone="pending">Pending</Pill>}
                      </button>

                      {isFocus && (
                        <form
                          className="px-3 pb-3"
                          onSubmit={(e) => { e.preventDefault(); submit("done"); }}
                        >
                          <div className="flex gap-2">
                            {fields.reps && <Stepper label="Reps" value={draft.reps} step={1} onChange={(v) => setDraft((d) => ({ ...d, reps: v }))} />}
                            {fields.load && <Stepper label="kg" value={draft.load} step={2.5} decimals onChange={(v) => setDraft((d) => ({ ...d, load: v }))} />}
                            {fields.duration && <Stepper label="sec" value={draft.duration} step={15} onChange={(v) => setDraft((d) => ({ ...d, duration: v }))} />}
                            {fields.distance && <Stepper label="m" value={draft.distance} step={100} decimals onChange={(v) => setDraft((d) => ({ ...d, distance: v }))} />}
                          </div>
                          <div className="flex gap-2 mt-3">
                            {l ? (
                              <>
                                <GhostButton type="button" className="flex-1 h-12" onClick={() => clearSet(l)}>Clear</GhostButton>
                                <PrimaryButton type="submit" className="flex-[2]">Update</PrimaryButton>
                              </>
                            ) : (
                              <>
                                <GhostButton type="button" className="h-12 px-4" onClick={() => submit("skipped")}><SkipForward className="w-4 h-4" /> Skip</GhostButton>
                                <PrimaryButton type="submit" className="flex-1 h-14 text-base"><Check className="w-5 h-5" /> Log set</PrimaryButton>
                              </>
                            )}
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
                {exercise.sets.length === 0 && <li className={cn("text-sm", pal.mute)}>No prescribed sets</li>}
              </ol>
            </motion.div>
          </AnimatePresence>
        ) : (
          <p className={cn("text-sm mt-8 text-center", pal.mute)}>No exercises</p>
        )}
      </main>

      {/* Rest timer + exercise navigation — fixed above the safe area */}
      <footer className={cn("fixed inset-x-0 bottom-0 z-[71] border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]", pal.line, tc.bgPage)}>
        {timer.rest && (
          <div className="mb-3 flex items-center gap-3" role="timer" aria-live="polite">
            <TimerIcon size={20} style={{ color: pal.a }} />
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className={pal.mute}>Rest</span>
                <span className={cn("font-semibold tabular-nums", pal.ink)}>{fmtDuration(timer.remaining)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: pal.track }}>
                <div className="h-full rounded-full" style={{ width: `${(timer.remaining / timer.rest.total) * 100}%`, background: pal.a, transition: "width 250ms linear" }} />
              </div>
            </div>
            <GhostButton className="h-9 px-2.5" onClick={() => timer.add(15)}>+15</GhostButton>
            <GhostButton className="h-9 px-2.5" onClick={timer.stop} aria-label="Skip rest"><X className="w-4 h-4" /></GhostButton>
          </div>
        )}
        <div className="flex gap-2">
          <GhostButton className="flex-1 h-12" disabled={exIndex === 0} onClick={() => { setExIndex((i) => i - 1); setEditing(null); }}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </GhostButton>
          <GhostButton className="flex-1 h-12" disabled={exIndex >= exercises.length - 1} onClick={() => { setExIndex((i) => i + 1); setEditing(null); }}>
            Next <ChevronRight className="w-4 h-4" />
          </GhostButton>
        </div>
      </footer>

      {/* Finish confirmation */}
      <AnimatePresence>
        {finishOpen && (
          <motion.div className="fixed inset-0 z-[72] flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setFinishOpen(false)} />
            <motion.div
              className={cn("relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]", pal.line, tc.bgPage)}
              initial={reduced ? false : { y: 40 }} animate={{ y: 0 }}
            >
              <p className={cn("text-lg font-semibold", pal.ink)}>Finish {session.workout_name}?</p>
              <p className={cn("text-sm mt-1", pal.mute)}>
                {loggedCount ? `${session.sets.filter((s) => s.status === "done").length} sets logged · ${loggedCount}/${totalSets}` : "No detailed log"}
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                className={cn("mt-4 w-full rounded-xl border p-3 bg-transparent text-sm min-h-[72px] outline-none", pal.line, pal.ink)}
              />
              <div className="flex gap-2 mt-4">
                <GhostButton className="flex-1 h-12" onClick={() => setFinishOpen(false)}>Back</GhostButton>
                <PrimaryButton className="flex-[2]" onClick={doFinish} disabled={finish.isPending}>Finish</PrimaryButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
