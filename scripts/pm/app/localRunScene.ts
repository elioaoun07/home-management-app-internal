import type { LocalRunView } from "./LocalDelivery";
import {
  localRunActivity,
  type LocalActivityEvent,
  type LocalActivityStation,
} from "./localRunActivityModel";
import { LOCAL_CHECKS } from "./localRunModel";
import { localRunFailure } from "./localRunFailure";

const closedPhases = new Set(["failed", "cancelled", "shipped", "reverted"]);
const instant = (value: string | undefined) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export interface LocalTimeline {
  run: LocalRunView;
  events: LocalActivityEvent[];
  start: number | null;
  end: number | null;
  bands: { phase: string; at: number; end: number }[];
  truncated: boolean;
}
export interface CoreNode {
  id: string;
  path: string | null;
  edited: boolean;
  touchedAt: number;
  area: string | null;
}
export type EraPose =
  | "scanning"
  | "forging"
  | "command"
  | "facing"
  | "idle"
  | "searching"
  | "powered-down"
  | "ghost"
  | "done";
export interface LocalScene {
  run: LocalRunView;
  at: number;
  phase: string;
  station: LocalActivityStation;
  pose: EraPose;
  latest: LocalActivityEvent | null;
  message: LocalActivityEvent | null;
  events: LocalActivityEvent[];
  nodes: CoreNode[];
  nodeCount: number;
  plates: number;
  seals: {
    name: string;
    state: "pending" | "passed" | "failed" | "inconclusive";
    at: number | null;
  }[];
  objectiveCount: number;
  objectivesAccepted: boolean;
  subagents: { id: string; at: number }[];
  counts: {
    files: number;
    reads: number;
    edits: number;
    commands: number;
    checks: number;
    events: number;
  };
  elapsed: number | null;
  caption: string;
  band: string;
}

function observedPhase(event: LocalActivityEvent): string | null {
  if (
    !["event", "check"].includes(event.kind) ||
    event.label === "Tool requested"
  )
    return null;
  const summary = event.summary;
  if (summary === "Native session started") return "building";
  if (
    summary === "Host checks started" ||
    /^(typecheck|lint|test|pm:lint):/u.test(summary)
  )
    return "checking";
  if (
    summary === "Ready for owner UAT" ||
    summary === "Owner opened diff review"
  )
    return "uat-ready";
  if (summary === "Owner shipped merge") return "shipped";
  if (summary === "Owner reverted merge") return "reverted";
  return null;
}

/** The retained window is the only timeline. Missing history remains missing. */
export function buildTimeline(run: LocalRunView): LocalTimeline {
  // The activity projection is newest-first. Restore recorder order before
  // sorting: second-resolution timestamps can be shared by several milestones.
  const recorded = localRunActivity(run).events.reverse();
  const positions = new Map(recorded.map((event, index) => [event.id, index]));
  const events = recorded
    .filter((event) => instant(event.at) !== null)
    .sort(
      (a, b) =>
        Date.parse(a.at) - Date.parse(b.at) ||
        positions.get(a.id)! - positions.get(b.id)!,
    );
  const times = [
    ...events.map((event) => Date.parse(event.at)),
    ...run.checks.flatMap((check) => {
      const time = instant(check.finished_at);
      return time === null ? [] : [time];
    }),
  ].sort((a, b) => a - b);
  const start = times[0] ?? null;
  const end = times.at(-1) ?? null;
  const bands: LocalTimeline["bands"] = [];
  if (start !== null && end !== null) {
    let phase = "preparing";
    for (const event of events) {
      const next =
        observedPhase(event) ||
        (["read", "edit", "command"].includes(event.kind) &&
        phase === "preparing"
          ? "building"
          : phase);
      if (!bands.length || next !== phase) {
        if (bands.length) bands[bands.length - 1].end = Date.parse(event.at);
        bands.push({ phase: next, at: Date.parse(event.at), end });
      }
      phase = next;
    }
  }
  return {
    run,
    events,
    start,
    end,
    bands,
    truncated: run.activity.length >= 200,
  };
}

function checkTime(
  timeline: LocalTimeline,
  name: string,
  finishedAt: string | undefined,
) {
  return (
    instant(finishedAt) ??
    instant(
      timeline.events.find(
        (event) => event.kind === "check" && event.detail === name,
      )?.at,
    )
  );
}

/** Live and replay share this projection; future checks, files and phases never leak. */
export function sceneAt(
  timeline: LocalTimeline,
  t: number,
  throughId?: string,
): LocalScene {
  const throughIndex = throughId
    ? timeline.events.findIndex((event) => event.id === throughId)
    : -1;
  const final =
    (timeline.end === null || t >= timeline.end) &&
    (throughIndex < 0 || throughIndex === timeline.events.length - 1);
  const recordedEnd =
    closedPhases.has(timeline.run.phase) && timeline.end !== null
      ? Math.min(t, timeline.end)
      : t;
  const events = timeline.events.filter(
    (event, index) =>
      Date.parse(event.at) <= recordedEnd &&
      (throughIndex < 0 || index <= throughIndex),
  );
  const latest = events.at(-1) ?? null;
  let phase = "preparing";
  let station: LocalActivityStation = "launch";
  for (const event of events) {
    const next = observedPhase(event);
    if (next) phase = next;
    else if (
      phase === "preparing" &&
      ["read", "edit", "command"].includes(event.kind)
    )
      phase = "building";
    // Ordinary commands and narration happen where ERA already is.
    if (
      ["read", "edit"].includes(event.kind) ||
      event.station === "lab" ||
      observedPhase(event)
    )
      station = event.station;
  }
  if (final) phase = timeline.run.phase;
  if (phase === "checking") station = "lab";
  if (["uat-ready", "reverted"].includes(phase)) station = "review";
  if (
    ["merging", "push-pending", "revert-push-pending", "shipped"].includes(
      phase,
    )
  )
    station = "launch";

  const checks = timeline.run.checks.filter((check) => {
    const time = checkTime(timeline, check.name, check.finished_at);
    const rowIndex = timeline.events.findIndex(
      (event) => event.kind === "check" && event.detail === check.name,
    );
    if (throughIndex >= 0 && rowIndex > throughIndex) return false;
    // Old captures have no completion timestamp; only expose those at final frame.
    return time === null ? final : time <= recordedEnd;
  });
  const eventIds = new Set(events.map((event) => event.id));
  const candidateObserved =
    final || events.some((event) => observedPhase(event) === "checking");
  const filteredRun: LocalRunView = {
    ...timeline.run,
    phase,
    activity: timeline.run.activity.filter((entry, index) => {
      const identity =
        entry.seq !== undefined
          ? `${entry.job_id || "activity"}:${entry.seq}`
          : `${entry.at}:${index}`;
      return eventIds.has(identity);
    }),
    checks,
    head: candidateObserved ? timeline.run.head : null,
    current_head: candidateObserved ? timeline.run.current_head : null,
    risk: candidateObserved ? timeline.run.risk : undefined,
    merge: final ? timeline.run.merge : null,
    interrupted: final && timeline.run.interrupted,
    error: final ? timeline.run.error : undefined,
    failure: final ? timeline.run.failure : undefined,
    handover: final ? timeline.run.handover : null,
    usage: final ? timeline.run.usage : null,
    // Replay shows a question only once asked, and its answer only once given.
    questions: final
      ? timeline.run.questions
      : timeline.run.questions
          ?.filter((entry) => (instant(entry.asked_at) ?? Infinity) <= recordedEnd)
          .map((entry) =>
            entry.answered_at && (instant(entry.answered_at) ?? Infinity) <= recordedEnd
              ? entry
              : { ...entry, answers: null, answered_at: null, state: "closed" as const },
          ),
    messages: final
      ? timeline.run.messages
      : timeline.run.messages?.filter((entry) => (instant(entry.at) ?? Infinity) <= recordedEnd),
  };
  const nodeMap = new Map<string, CoreNode>();
  if (phase === "failed") {
    const fault = localRunFailure(filteredRun)?.station;
    if (fault) station = fault === "forge-lab" ? "forge" : fault;
  }
  const subagents = new Map<string, number>();
  for (const event of events) {
    if (event.agent?.role === "subagent" && event.agent.id)
      subagents.set(event.agent.id, Date.parse(event.at));
    if (!["read", "edit"].includes(event.kind)) continue;
    for (const path of event.paths.length ? event.paths : [null]) {
      const key = path || `anonymous:${event.id}`;
      const previous = nodeMap.get(key);
      const parts = path?.split("/") ?? [];
      const area = path
        ? parts[0] === "src"
          ? parts.slice(0, 3).join("/")
          : parts[0] === "ERA Notes"
            ? "ERA Notes"
            : parts.slice(0, 2).join("/")
        : null;
      nodeMap.set(key, {
        id: key,
        path,
        edited: previous?.edited === true || event.kind === "edit",
        touchedAt: Date.parse(event.at),
        area,
      });
    }
  }
  const nodes = [...nodeMap.values()];
  const seals: LocalScene["seals"] = LOCAL_CHECKS.map((name) => {
    const check = checks.find((entry) => entry.name === name);
    return {
      name,
      at: check ? checkTime(timeline, name, check.finished_at) : null,
      state: !check
        ? "pending"
        : check.error || check.exit === null
          ? "inconclusive"
          : check.exit === 0
            ? "passed"
            : "failed",
    };
  });
  const counts = {
    files: nodes.filter((node) => node.path !== null).length,
    reads: events.filter((event) => event.kind === "read").length,
    edits: events.filter((event) => event.kind === "edit").length,
    commands: events.filter((event) => event.kind === "command").length,
    checks: seals.filter((seal) => seal.state === "passed").length,
    events: events.length,
  };
  const captions: Record<string, string> = {
    preparing: "Preparing",
    building: "Building",
    checking: "Verifying",
    "uat-ready": "Your turn",
    merging: "Building",
    "push-pending": "Push pending",
    "revert-push-pending": "Push pending",
    failed: "Failed",
    cancelled: "Stopped",
    shipped: "Shipped",
    reverted: "Reverted",
  };
  const pose: EraPose = filteredRun.interrupted
    ? "ghost"
    : phase === "failed"
      ? "powered-down"
      : phase === "shipped"
        ? "done"
        : phase === "cancelled" || phase === "reverted"
          ? "idle"
          : phase === "uat-ready" || latest?.kind === "message"
            ? "facing"
            : latest?.kind === "read"
              ? /search/iu.test(latest.label)
                ? "searching"
                : "scanning"
              : latest?.kind === "edit"
                ? "forging"
                : latest?.kind === "command"
                  ? "command"
                  : "idle";
  return {
    run: filteredRun,
    at: recordedEnd,
    phase,
    station,
    pose,
    latest,
    message:
      [...events].reverse().find((event) => event.kind === "message") ?? null,
    events,
    nodes,
    nodeCount: nodes.length,
    plates: nodes.filter((node) => node.edited).length,
    seals,
    counts,
    objectiveCount: (
      timeline.run.work.brief?.match(/^\s*-\s+\*\*Acceptance:\*\*/gmu) ?? []
    ).length,
    objectivesAccepted:
      final && timeline.run.handover?.acceptance.state === "accepted",
    subagents: [...subagents].map(([id, at]) => ({ id, at })),
    elapsed:
      timeline.start === null
        ? null
        : Math.max(0, recordedEnd - timeline.start),
    caption: captions[phase] ?? "Building",
    band: phase,
  };
}

/** Loading a run assembles existing plates, never replays its historic cues. */
export function cuesBetween(
  previous: LocalTimeline | null,
  next: LocalTimeline,
) {
  if (!previous) return [];
  const seen = new Set(previous.events.map((event) => event.id));
  return next.events.filter((event) => !seen.has(event.id));
}

/** Preserve recorded rhythm while bounding a four-second poll burst to 2.5 s. */
export function cueBatch(events: LocalActivityEvent[]) {
  const gaps = events.map((event, index) =>
    index
      ? Math.min(
          600,
          Math.max(
            120,
            Date.parse(event.at) - Date.parse(events[index - 1].at),
          ),
        )
      : 0,
  );
  const scale = Math.min(
    1,
    2500 /
      Math.max(
        1,
        gaps.reduce((total, gap) => total + gap, 0),
      ),
  );
  let offset = 0;
  return events.map((event, index) => ({
    event,
    delay: (offset += gaps[index] * scale),
  }));
}
