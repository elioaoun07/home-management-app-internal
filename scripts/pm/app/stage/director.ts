import type { LocalActivityEvent } from "../localRunActivityModel";
import { clock } from "../localRunLiveness";

export const STAGE_TEMPOS = [0.75, 1, 1.5] as const;
export type StageTempo = (typeof STAGE_TEMPOS)[number];
export type BeatStage =
  | "think"
  | "decide"
  | "travel"
  | "work"
  | "deliver"
  | "remember";

/** The art bible's timings are milliseconds; tempo multiplies duration. */
export const EDIT_BEAT_STAGES = [
  { stage: "think", start: 0, end: 500 },
  { stage: "decide", start: 500, end: 900 },
  { stage: "travel", start: 900, end: 2300 },
  { stage: "work", start: 2300, end: 3700 },
  { stage: "deliver", start: 3700, end: 4200 },
  { stage: "remember", start: 4200, end: 4400 },
] as const;
export const EDIT_BEAT_DURATION = 4400;
export const MAX_STAGING_LAG = 12_000;
export type BeatAction =
  | "read"
  | "search"
  | "edit"
  | "command"
  | "agent-check"
  | "message"
  | "observation";
export type BeatMode = "full" | "accelerated" | "montage";

export interface StagedBeat {
  id: string;
  event: LocalActivityEvent;
  tempo: StageTempo;
  startAt: number;
  endAt: number;
  duration: number;
  action: BeatAction;
  station: LocalActivityEvent["station"];
  mode: BeatMode;
  actor: "main" | "subagent";
  actorId: string | null;
  stages: { stage: BeatStage; startAt: number; endAt: number }[];
}

export interface BeatFrame {
  id: string;
  event: LocalActivityEvent;
  stage: BeatStage;
  /** Fraction of this stage only. Never rendered as completion of the task. */
  progress: number;
  /** Elapsed and duration are total beat milliseconds. */
  elapsed: number;
  duration: number;
  startAt: number;
  endAt: number;
  stageStartAt: number;
  stageEndAt: number;
  mode: BeatMode;
  action: BeatAction;
  station: LocalActivityEvent["station"];
  actor: "main" | "subagent";
  actorId: string | null;
  pending: boolean;
  complete: boolean;
}

export interface BeatPlanOptions {
  startAt?: number;
  tempo?: StageTempo;
  policy?: "auto" | "full";
  lagMs?: number;
  station?: LocalActivityEvent["station"];
  phase?: string;
}

export function beatAction(event: LocalActivityEvent): BeatAction {
  if (event.kind === "read")
    return /^Searched |^Search /u.test(event.label) ? "search" : "read";
  if (event.kind === "edit") return "edit";
  if (event.kind === "command")
    return event.station === "lab" ? "agent-check" : "command";
  if (event.kind === "message") return "message";
  return "observation";
}

function makeBeat(
  event: LocalActivityEvent,
  startAt: number,
  tempo: StageTempo,
  policy: BacklogPolicy,
  currentStation: LocalActivityEvent["station"],
): StagedBeat {
  const action = beatAction(event);
  const station =
    action === "read" || action === "search"
      ? "source"
      : action === "edit"
        ? "forge"
        : action === "agent-check"
          ? "lab"
          : currentStation;
  const intervals =
    policy.mode === "montage"
      ? [{ stage: "work" as const, start: 0, end: 350 }]
      : EDIT_BEAT_STAGES.filter(
          (interval) => !policy.skipThink || interval.stage !== "think",
        );
  const offset = policy.mode !== "montage" && policy.skipThink ? 500 : 0;
  const factor = tempo / policy.speed;
  const stages = intervals.map((interval) => ({
    stage: interval.stage,
    startAt: startAt + (interval.start - offset) * factor,
    endAt: startAt + (interval.end - offset) * factor,
  }));
  const endAt = stages[stages.length - 1].endAt;
  return {
    id: event.id,
    event,
    tempo,
    startAt,
    endAt,
    duration: endAt - startAt,
    stages,
    action,
    station,
    mode: policy.mode,
    actor: event.agent?.role === "subagent" ? "subagent" : "main",
    actorId: event.agent?.role === "subagent" ? (event.agent.id ?? null) : null,
  };
}

/** Native observations become beats; supervisor observations become ceremonies.
 * Completed/active beats keep their identity. Future staging can accelerate or
 * overlap in montage to catch up inside twelve seconds. No fact is discarded.
 */
export function planBeats(
  rows: readonly LocalActivityEvent[],
  queue: readonly StagedBeat[] = [],
  options: BeatPlanOptions = {},
): StagedBeat[] {
  const now = options.startAt ?? 0;
  const seen = new Set(queue.map((beat) => beat.id));
  const tempo = options.tempo ?? 1;
  const added: LocalActivityEvent[] = [];
  for (const event of rows) {
    if (ceremonyForEvent(event) || seen.has(event.id)) continue;
    added.push(event);
    seen.add(event.id);
  }
  if (!added.length) return [...queue];
  const finished = queue.filter((beat) => beat.endAt <= now);
  const active = queue.filter(
    (beat) => beat.startAt <= now && beat.endAt > now,
  );
  const pending = [
    ...queue.filter((beat) => beat.startAt > now).map((beat) => beat.event),
    ...added,
  ];
  let policy =
    options.policy === "full"
      ? backlogPolicy(0, 0)
      : backlogPolicy(pending.length + active.length, options.lagMs ?? 0);
  let cursor = Math.max(now, ...active.map((beat) => beat.endAt));
  const fullDuration = pending.reduce(
    (total, event) =>
      total + makeBeat(event, 0, tempo, policy, "forge").duration,
    0,
  );
  if (
    options.policy !== "full" &&
    cursor + fullDuration > now + MAX_STAGING_LAG
  )
    policy = backlogPolicy(7, 0);
  const montageDuration = 350 * tempo;
  const spacing =
    policy.mode === "montage"
      ? Math.min(
          montageDuration,
          Math.max(
            0,
            (now + MAX_STAGING_LAG - cursor - montageDuration) /
              Math.max(1, pending.length - 1),
          ),
        )
      : 0;
  const planned = [...finished, ...active];
  let station =
    options.station ??
    active.at(-1)?.station ??
    finished.at(-1)?.station ??
    "forge";
  for (const event of pending) {
    const beat = makeBeat(event, cursor, tempo, policy, station);
    planned.push(beat);
    station = beat.station;
    cursor = policy.mode === "montage" ? cursor + spacing : beat.endAt;
  }
  return planned;
}

/** An arbitrary-time view is useful for static/reduced-motion and seeking.
 * Boundaries belong to the next stage; the exact end is Remember's final pose.
 */
export function beatAt(beat: StagedBeat, time: number): BeatFrame {
  const elapsed = Math.max(0, Math.min(beat.duration, time - beat.startAt));
  const clamped = beat.startAt + elapsed;
  const interval =
    beat.stages.find((stage) => clamped < stage.endAt) ??
    beat.stages[beat.stages.length - 1];
  return {
    id: beat.id,
    event: beat.event,
    stage: interval.stage,
    progress: Math.max(
      0,
      Math.min(
        1,
        (clamped - interval.startAt) / (interval.endAt - interval.startAt),
      ),
    ),
    elapsed,
    duration: beat.duration,
    startAt: beat.startAt,
    endAt: beat.endAt,
    stageStartAt: interval.startAt,
    stageEndAt: interval.endAt,
    mode: beat.mode,
    action: beat.action,
    station: beat.station,
    actor: beat.actor,
    actorId: beat.actorId,
    pending: time < beat.startAt,
    complete: time >= beat.endAt,
  };
}

/** Half-open intervals ensure a shared boundary selects exactly one beat. */
export function activeBeatAt(
  queue: readonly StagedBeat[],
  time: number,
): BeatFrame | null {
  const beat = queue.findLast(
    (entry) => time >= entry.startAt && time < entry.endAt,
  );
  return beat ? beatAt(beat, time) : null;
}

export function activeBeatsAt(
  queue: readonly StagedBeat[],
  time: number,
): BeatFrame[] {
  return queue
    .filter((beat) => time >= beat.startAt && time < beat.endAt)
    .map((beat) => beatAt(beat, time));
}

/** A long frame still observes every start in a dense montage. */
export function beatsStartingBetween(
  queue: readonly StagedBeat[],
  previous: number,
  current: number,
): StagedBeat[] {
  return current < previous
    ? []
    : queue.filter(
        (beat) => beat.startAt > previous && beat.startAt <= current,
      );
}

export interface BacklogPolicy {
  mode: "full" | "accelerated" | "montage";
  speed: 1 | 1.5 | 2.5;
  skipThink: boolean;
  montageBeatMs: number | null;
  maxLagMs: number;
}

/** Queue speed is distinct from the owner's duration-multiplying tempo. */
export function backlogPolicy(queued: number, lagMs: number): BacklogPolicy {
  const common = { maxLagMs: MAX_STAGING_LAG };
  if (queued > 6 || lagMs > MAX_STAGING_LAG)
    return {
      ...common,
      mode: "montage",
      speed: 1,
      skipThink: true,
      montageBeatMs: 350,
    };
  if (queued >= 4)
    return {
      ...common,
      mode: "accelerated",
      speed: 2.5,
      skipThink: true,
      montageBeatMs: null,
    };
  if (queued >= 2)
    return {
      ...common,
      mode: "accelerated",
      speed: 1.5,
      skipThink: false,
      montageBeatMs: null,
    };
  return {
    ...common,
    mode: "full",
    speed: 1,
    skipThink: false,
    montageBeatMs: null,
  };
}

/** Retained for the Golden Corner gallery; the full replay planner is below. */
export function makeFullEditTimeline(
  events: readonly LocalActivityEvent[],
  tempo: StageTempo = 1,
): StagedBeat[] {
  return planBeats(
    events.filter((event) => event.kind === "edit"),
    [],
    { startAt: 0, tempo, policy: "full" },
  );
}

export type CeremonyKind =
  | "boot"
  | "verify"
  | "gate-pass"
  | "gate-fail"
  | "gate-inconclusive"
  | "handover"
  | "review"
  | "launch"
  | "failure"
  | "cancelled"
  | "reverted";
/** Four ceremony durations are prescribed by the art bible. Smaller mechanical
 * gate/review transitions stay below the phase-card duration of 2400ms.
 */
export const CEREMONY_DURATIONS: Record<CeremonyKind, number> = {
  boot: 2500,
  verify: 2400,
  "gate-pass": 900,
  "gate-fail": 1200,
  "gate-inconclusive": 1200,
  handover: 6000,
  review: 1800,
  launch: 8000,
  failure: 5000,
  cancelled: 3000,
  reverted: 1800,
};
export interface CeremonySpec {
  kind: CeremonyKind;
  duration: number;
  check: string | null;
  exit: number | null;
}
export interface StagedCeremony extends CeremonySpec {
  id: string;
  event: LocalActivityEvent;
  startAt: number;
  endAt: number;
  tempo: StageTempo;
}
export interface CeremonyFrame extends StagedCeremony {
  progress: number;
  elapsed: number;
  pending: boolean;
  complete: boolean;
}

export function ceremonyForPhase(phase: string): CeremonySpec | null {
  const kind: CeremonyKind | null =
    phase === "preparing" || phase === "building"
      ? "boot"
      : phase === "checking"
        ? "verify"
        : phase === "uat-ready"
          ? "handover"
          : phase === "shipped"
            ? "launch"
            : phase === "failed"
              ? "failure"
              : phase === "cancelled"
                ? "cancelled"
                : phase === "reverted"
                  ? "reverted"
                  : null;
  return kind
    ? { kind, duration: CEREMONY_DURATIONS[kind], check: null, exit: null }
    : null;
}

export function ceremonyForEvent(
  event: LocalActivityEvent,
  phase?: string,
): CeremonySpec | null {
  // An assistant can say these exact words. Only supervisor-class observations
  // may start a ceremony; narration and command text never prove a phase/result.
  if (["read", "edit", "command", "message"].includes(event.kind)) return null;
  const summary = event.summary;
  const check = /^(typecheck|lint|test|pm:lint):\s*(-?\d+|null)$/u.exec(
    summary,
  );
  let kind: CeremonyKind | null = null;
  if (event.kind === "failure")
    kind = phase === "cancelled" ? "cancelled" : "failure";
  else if (summary === "Native session started") kind = "boot";
  else if (summary === "Host checks started") kind = "verify";
  else if (summary === "Ready for owner UAT") kind = "handover";
  else if (summary === "Owner opened diff review") kind = "review";
  else if (summary === "Owner shipped merge") kind = "launch";
  else if (summary === "Owner reverted merge") kind = "reverted";
  else if (check)
    kind =
      check[2] === "null" || event.label === "Check inconclusive"
        ? "gate-inconclusive"
        : check[2] === "0"
          ? "gate-pass"
          : "gate-fail";
  else if (event.kind === "check") kind = "gate-inconclusive";
  if (!kind) return null;
  return {
    kind,
    duration: CEREMONY_DURATIONS[kind],
    check: check?.[1] ?? null,
    exit: check && check[2] !== "null" ? Number(check[2]) : null,
  };
}

export function planCeremonies(
  rows: readonly LocalActivityEvent[],
  queue: readonly StagedCeremony[] = [],
  options: BeatPlanOptions = {},
): StagedCeremony[] {
  const now = options.startAt ?? 0,
    seen = new Set(queue.map((entry) => entry.id)),
    tempo = options.tempo ?? 1;
  const added: LocalActivityEvent[] = [];
  for (const event of rows) {
    const spec = ceremonyForEvent(event, options.phase);
    if (!spec || seen.has(event.id)) continue;
    seen.add(event.id);
    added.push(event);
  }
  if (!added.length) return [...queue];
  const fixed = queue.filter((entry) => entry.startAt <= now);
  const pending = [
    ...queue.filter((entry) => entry.startAt > now).map((entry) => entry.event),
    ...added,
  ];
  const specs = pending.map((event) => ({
    event,
    spec: ceremonyForEvent(event, options.phase)!,
  }));
  let cursor = Math.max(now, ...fixed.map((entry) => entry.endAt));
  const total = specs.reduce(
    (sum, entry) => sum + entry.spec.duration * tempo,
    0,
  );
  let spacing = 1;
  if (options.policy !== "full" && cursor + total > now + MAX_STAGING_LAG) {
    // Overlap finished mechanical effects during catch-up. Each prescribed
    // ceremony keeps its complete duration; the newest state has visual priority.
    cursor = now;
    let prefix = 0;
    for (const entry of specs) {
      const duration = entry.spec.duration * tempo;
      if (prefix)
        spacing = Math.min(
          spacing,
          Math.max(0, (MAX_STAGING_LAG - duration) / prefix),
        );
      prefix += duration;
    }
  }
  const planned = [...fixed];
  for (const { event, spec } of specs) {
    const duration = spec.duration * tempo;
    planned.push({
      ...spec,
      duration,
      id: event.id,
      event,
      startAt: cursor,
      endAt: cursor + duration,
      tempo,
    });
    cursor += duration * spacing;
  }
  return planned;
}

export function ceremonyAt(
  ceremony: StagedCeremony,
  time: number,
): CeremonyFrame {
  const elapsed = Math.max(
    0,
    Math.min(ceremony.duration, time - ceremony.startAt),
  );
  return {
    ...ceremony,
    elapsed,
    progress: ceremony.duration ? elapsed / ceremony.duration : 1,
    pending: time < ceremony.startAt,
    complete: time >= ceremony.endAt,
  };
}

/** Keep the most recently started ceremony's final pose, rather than reviving an
 * older overlapping effect when the newest one finishes. Facts choose the state.
 */
export function latestCeremonyAt(
  queue: readonly StagedCeremony[],
  time: number,
): CeremonyFrame | null {
  const ceremony = queue.findLast((entry) => entry.startAt <= time);
  return ceremony ? ceremonyAt(ceremony, time) : null;
}

export type ReplayMode = "recap" | "full";
export interface ReplaySegment {
  kind: "beat" | "ceremony" | "gap";
  startAt: number;
  endAt: number;
  recordedStartAt: number;
  recordedEndAt: number;
  event: LocalActivityEvent | null;
  beat: StagedBeat | null;
  ceremony: StagedCeremony | null;
  realGap: number;
  gapTag: string | null;
}
export interface ReplayTimeline {
  mode: ReplayMode;
  tempo: StageTempo;
  duration: number;
  recordedStartAt: number | null;
  recordedEndAt: number | null;
  events: LocalActivityEvent[];
  segments: ReplaySegment[];
}
export interface ReplayFrame {
  mode: ReplayMode;
  presentationTime: number;
  recordedTime: number | null;
  event: LocalActivityEvent | null;
  beat: BeatFrame | null;
  ceremony: CeremonyFrame | null;
  gap: { duration: number; tag: string | null; progress: number } | null;
  complete: boolean;
}
export interface ReplayOptions {
  mode?: ReplayMode;
  tempo?: StageTempo;
  recapDuration?: number;
  terminalPhase?: string;
}

function ceremonyStation(
  kind: CeremonyKind,
  fallback: LocalActivityEvent["station"],
): LocalActivityEvent["station"] {
  return kind === "boot" || kind === "launch" || kind === "cancelled"
    ? "launch"
    : kind === "verify" || kind.startsWith("gate-")
      ? "lab"
      : kind === "handover" || kind === "review" || kind === "reverted"
        ? "review"
        : fallback;
}

/** The source clock and the presentation clock are deliberately separate.
 * Full gives every row its scene; each real gap is retained, capped at2s.
 * Recap keeps the existing20s mapping and uses350ms montage pulses.
 */
export function makeReplayTimeline(
  events: readonly LocalActivityEvent[],
  options: ReplayOptions = {},
): ReplayTimeline {
  const mode = options.mode ?? "recap",
    tempo = options.tempo ?? 1;
  const rows = events
    .filter((event) => Number.isFinite(Date.parse(event.at)))
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        Date.parse(a.event.at) - Date.parse(b.event.at) || a.index - b.index,
    )
    .map((entry) => entry.event);
  const first = rows[0] ? Date.parse(rows[0].at) : null,
    last = rows.at(-1) ? Date.parse(rows.at(-1)!.at) : null;
  const timeline: ReplayTimeline = {
    mode,
    tempo,
    duration: 0,
    recordedStartAt: first,
    recordedEndAt: last,
    events: rows,
    segments: [],
  };
  if (!rows.length || first === null || last === null) return timeline;
  const recapDuration = options.recapDuration ?? 20_000;
  let cursor = 0,
    station: LocalActivityEvent["station"] = "launch";
  rows.forEach((event, index) => {
    const at = Date.parse(event.at),
      spec = ceremonyForEvent(
        event,
        index === rows.length - 1 ? options.terminalPhase : undefined,
      );
    const mapped =
      last === first
        ? (index / Math.max(1, rows.length - 1)) *
          Math.max(0, recapDuration - 350)
        : ((at - first) / (last - first)) * recapDuration;
    const startAt = mode === "recap" ? mapped : cursor;
    const policy = mode === "recap" ? backlogPolicy(7, 0) : backlogPolicy(0, 0);
    const beat = spec ? null : makeBeat(event, startAt, tempo, policy, station);
    const duration =
      mode === "recap"
        ? 350 * tempo
        : spec
          ? spec.duration * tempo
          : beat!.duration;
    const ceremony: StagedCeremony | null = spec
      ? {
          ...spec,
          duration,
          id: event.id,
          event,
          tempo,
          startAt,
          endAt: startAt + duration,
        }
      : null;
    const endAt = startAt + duration;
    timeline.segments.push({
      kind: spec ? "ceremony" : "beat",
      startAt,
      endAt,
      recordedStartAt: at,
      recordedEndAt: at,
      event,
      beat,
      ceremony,
      realGap: 0,
      gapTag: null,
    });
    station = spec ? ceremonyStation(spec.kind, station) : beat!.station;
    cursor = endAt;
    if (mode === "full" && rows[index + 1]) {
      const next = Date.parse(rows[index + 1].at),
        realGap = Math.max(0, next - at);
      if (realGap) {
        const gapDuration = Math.min(realGap, 2000) * tempo;
        timeline.segments.push({
          kind: "gap",
          startAt: cursor,
          endAt: cursor + gapDuration,
          recordedStartAt: at,
          recordedEndAt: next,
          event,
          beat: null,
          ceremony: null,
          realGap,
          gapTag: realGap > 2000 ? clock(realGap) : null,
        });
        cursor += gapDuration;
      }
    }
  });
  timeline.duration = mode === "recap" ? recapDuration : cursor;
  return timeline;
}

export function replayAt(
  timeline: ReplayTimeline,
  presentationTime: number,
): ReplayFrame {
  const time = Math.max(0, Math.min(timeline.duration, presentationTime)),
    complete = presentationTime >= timeline.duration;
  const base = {
    mode: timeline.mode,
    presentationTime: time,
    recordedTime: timeline.recordedStartAt,
    event: null,
    beat: null,
    ceremony: null,
    gap: null,
    complete,
  };
  if (
    !timeline.segments.length ||
    timeline.recordedStartAt === null ||
    timeline.recordedEndAt === null
  )
    return base;
  if (timeline.mode === "recap") {
    const recordedTime =
      timeline.recordedStartAt +
      ((timeline.recordedEndAt - timeline.recordedStartAt) * time) /
        Math.max(1, timeline.duration);
    const segment =
      timeline.segments.findLast((entry) => entry.startAt <= time) ??
      timeline.segments[0];
    const active = time <= segment.endAt || complete;
    return {
      ...base,
      recordedTime,
      event: segment.event,
      beat:
        active && segment.beat
          ? beatAt(segment.beat, complete ? segment.endAt : time)
          : null,
      ceremony:
        active && segment.ceremony
          ? ceremonyAt(segment.ceremony, complete ? segment.endAt : time)
          : null,
    };
  }
  const segment =
    timeline.segments.find(
      (entry) => time >= entry.startAt && time < entry.endAt,
    ) ?? timeline.segments[timeline.segments.length - 1];
  if (segment.kind === "gap") {
    const progress = Math.max(
      0,
      Math.min(1, (time - segment.startAt) / (segment.endAt - segment.startAt)),
    );
    return {
      ...base,
      event: segment.event,
      recordedTime:
        segment.recordedStartAt +
        (segment.recordedEndAt - segment.recordedStartAt) * progress,
      gap: { duration: segment.realGap, tag: segment.gapTag, progress },
    };
  }
  return {
    ...base,
    event: segment.event,
    recordedTime: segment.recordedStartAt,
    beat: segment.beat ? beatAt(segment.beat, time) : null,
    ceremony: segment.ceremony ? ceremonyAt(segment.ceremony, time) : null,
  };
}

/** Reverse mapping for seek/resume and switching replay modes. A stable event ID
 * disambiguates equal timestamps and selects its entry pose. Without an ID the
 * recorded endpoint maps to the completed presentation frame.
 */
export function presentationAtRecorded(
  timeline: ReplayTimeline,
  recordedTime: number,
  eventId?: string | null,
): number {
  const first = timeline.recordedStartAt,
    last = timeline.recordedEndAt;
  if (first === null || last === null || !Number.isFinite(recordedTime))
    return 0;
  const exact = eventId
    ? timeline.segments.find(
        (segment) => segment.kind !== "gap" && segment.event?.id === eventId,
      )
    : undefined;
  if (exact && recordedTime === exact.recordedStartAt) return exact.startAt;
  if (recordedTime <= first) return 0;
  if (recordedTime >= last) return timeline.duration;
  if (timeline.mode === "recap")
    return (
      ((recordedTime - first) / Math.max(1, last - first)) * timeline.duration
    );
  const gap = timeline.segments.find(
    (segment) =>
      segment.kind === "gap" &&
      recordedTime > segment.recordedStartAt &&
      recordedTime < segment.recordedEndAt,
  );
  if (gap)
    return (
      gap.startAt +
      ((recordedTime - gap.recordedStartAt) /
        (gap.recordedEndAt - gap.recordedStartAt)) *
        (gap.endAt - gap.startAt)
    );
  return (
    timeline.segments.findLast(
      (segment) =>
        segment.kind !== "gap" && segment.recordedStartAt <= recordedTime,
    )?.startAt ?? 0
  );
}

/** A tempo rebuild changes presentation milliseconds, never which observed row
 * or fraction of its scene is being watched. Stable IDs disambiguate ties.
 * Idle Recap spans and removed segments fall back to the recorded-time mapping. */
export function remapPresentation(
  previous: ReplayTimeline,
  next: ReplayTimeline,
  presentation: number,
): number {
  if (!previous.segments.length || !next.segments.length) return 0;
  const time = Number.isNaN(presentation)
    ? 0
    : Math.max(0, Math.min(previous.duration, presentation));
  if (time >= previous.duration) return next.duration;
  const candidate =
    previous.mode === "recap"
      ? previous.segments.findLast((segment) => segment.startAt <= time)
      : previous.segments.find(
          (segment) => segment.startAt <= time && time < segment.endAt,
        );
  const active = candidate && time < candidate.endAt ? candidate : undefined;
  const matched =
    active &&
    next.segments.find(
      (segment) =>
        segment.kind === active.kind && segment.event?.id === active.event?.id,
    );
  if (active && matched) {
    const progress = Math.max(
      0,
      Math.min(
        1,
        (time - active.startAt) / Math.max(1, active.endAt - active.startAt),
      ),
    );
    return Math.max(
      0,
      Math.min(
        next.duration,
        matched.startAt + progress * (matched.endAt - matched.startAt),
      ),
    );
  }
  const frame = replayAt(previous, time);
  return frame.recordedTime === null
    ? 0
    : presentationAtRecorded(next, frame.recordedTime, frame.event?.id);
}
