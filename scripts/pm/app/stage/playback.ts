import {
  activeBeatsAt,
  beatsStartingBetween,
  planBeats,
  planCeremonies,
  latestCeremonyAt,
  makeReplayTimeline,
  replayAt,
  presentationAtRecorded,
  remapPresentation,
  ceremonyForPhase,
  type CeremonyKind,
  type StageTempo,
  type ReplayMode,
  type StagedBeat,
  type StagedCeremony,
} from "./director";
import {
  cuesBetween,
  type LocalTimeline,
  type LocalScene,
} from "../localRunScene";
import type { LocalActivityEvent } from "../localRunActivityModel";

export interface PlaybackInput {
  timeline: LocalTimeline;
  snapshot: LocalScene;
  state: string;
  time: number | null;
  playing: boolean;
  speed: 1 | 4;
  tempo: StageTempo;
  replayMode: ReplayMode;
}
/** Presentation advances against one monotonic clock. React and DOM publication
 * belong to the separate fact coordinator, never the animation callback. */
export function createBoardPlayback(initial: PlaybackInput, now: number) {
  let input = initial,
    plan = makeReplayTimeline(initial.timeline.events, {
      mode: initial.replayMode,
      tempo: initial.tempo,
      terminalPhase: initial.timeline.run.phase,
    });
  let anchor = now,
    position = initial.time === null
      ? 0
      : presentationAtRecorded(plan, initial.time, initial.snapshot.latest?.id),
    queue: StagedBeat[] = [],
    ceremonies: StagedCeremony[] = [],
    previous = initial.timeline;
  let emittedUntil = now,
    replayEmitted = position - 0.001;
  const seen = new Set(initial.timeline.events.map((event) => event.id));
  const active = () => input.time !== null && input.playing;
  const presentation = (at: number) =>
    Math.min(
      plan.duration,
      position + (active() ? Math.max(0, at - anchor) * input.speed : 0),
    );
  let fallback: { kind: CeremonyKind; start: number; duration: number } | null =
    initial.time === null && ["preparing", "building", "checking"].includes(initial.snapshot.phase)
      ? { kind: "boot", start: now, duration: 2500 * initial.tempo }
      : null;
  return {
    update(next: PlaybackInput, at: number) {
      const unavailable = ["signal-lost", "link-down"].includes(next.state);
      if (unavailable) {
        queue = [];
        ceremonies = [];
        fallback = null;
      }
      let present = presentation(at);
      if (
        next.timeline !== input.timeline ||
        next.replayMode !== input.replayMode ||
        next.tempo !== input.tempo
      ) {
        const nextPlan = makeReplayTimeline(next.timeline.events, {
          mode: next.replayMode,
          tempo: next.tempo,
          terminalPhase: next.timeline.run.phase,
        });
        if (next.time !== null && next.replayMode === input.replayMode)
          present = remapPresentation(plan, nextPlan, present);
        plan = nextPlan;
      }
      if (
        next.time !== null &&
        (input.time === null ||
          next.replayMode !== input.replayMode ||
          (!next.playing &&
            (next.time !== input.time ||
              next.snapshot.latest?.id !== input.snapshot.latest?.id)))
      ) {
        present = presentationAtRecorded(
          plan,
          next.time,
          next.snapshot.latest?.id,
        );
        replayEmitted = present - 0.001;
      }
      if (next.time === null) {
        const rows = cuesBetween(previous, next.timeline).filter(
          (event) => !seen.has(event.id),
        );
        if (!unavailable && input.time === null && rows.length) {
          queue = planBeats(rows, queue, {
            startAt: at,
            tempo: next.tempo,
            policy: "auto",
            phase: next.snapshot.phase,
          });
          ceremonies = planCeremonies(rows, ceremonies, {
            startAt: at,
            tempo: next.tempo,
            phase: next.snapshot.phase,
          });
        }
        if (
          !unavailable &&
          input.snapshot.phase !== next.snapshot.phase &&
          !ceremonies.some((c) => c.endAt > at)
        ) {
          const spec = ceremonyForPhase(next.snapshot.phase);
          if (spec)
            fallback = {
              kind: spec.kind,
              start: at,
              duration: spec.duration * next.tempo,
            };
        }
      } else {
        queue = [];
        fallback = null;
      }
      next.timeline.events.forEach((event) => seen.add(event.id));
      previous = next.timeline;
      position = present;
      anchor = at;
      input = next;
    },
    sample(at: number) {
      const rf = input.time === null ? null : replayAt(plan, presentation(at));
      let beats = rf?.beat ? [rf.beat] : activeBeatsAt(queue, at);
      const live = latestCeremonyAt(ceremonies, at);
      let ceremony = rf?.ceremony
        ? {
            kind: rf.ceremony.kind,
            progress: rf.ceremony.progress,
            check: rf.ceremony.check,
            exit: rf.ceremony.exit,
          }
        : live
          ? {
              kind: live.kind,
              progress: live.progress,
              check: live.check,
              exit: live.exit,
            }
          : undefined;
      if (!ceremony && fallback && input.time === null) {
        const progress = Math.min(
          1,
          Math.max(0, (at - fallback.start) / fallback.duration),
        );
        if (progress < 1)
          ceremony = { kind: fallback.kind, progress, check: null, exit: null };
        else fallback = null;
      }
      if (["signal-lost", "link-down"].includes(input.state)) {
        beats = [];
        ceremony = undefined;
      }
      if (
        input.time === null &&
        [
          "failed",
          "shipped",
          "cancelled",
          "reverted",
          "your-turn",
          "push-pending",
        ].includes(input.state)
      )
        beats = [];
      return {
        beat: beats.at(-1) ?? null,
        beats,
        ceremony,
        replay: rf,
        backlog: queue.filter((b) => b.endAt > at).length,
        gap: rf?.gap?.tag ?? null,
      };
    },
    observations(at: number): LocalActivityEvent[] {
      if (["signal-lost", "link-down"].includes(input.state)) {
        emittedUntil = at;
        replayEmitted = presentation(at);
        return [];
      }
      if (input.time !== null) {
        if (!input.playing) return [];
        const end = presentation(at),
          rows = plan.segments
            .filter(
              (segment) =>
                segment.event &&
                segment.kind !== "gap" &&
                segment.startAt > replayEmitted &&
                segment.startAt <= end,
            )
            .map((segment) => segment.event!);
        replayEmitted = end;
        return rows;
      }
      const rows = beatsStartingBetween(queue, emittedUntil, at).map(
        (beat) => beat.event,
      );
      for (const ceremony of ceremonies)
        if (ceremony.startAt > emittedUntil && ceremony.startAt <= at)
          rows.push(ceremony.event);
      emittedUntil = at;
      return rows;
    },
  };
}
