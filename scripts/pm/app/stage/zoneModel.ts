import type { LocalRunView } from "../LocalDelivery";
import type { LocalActivityEvent } from "../localRunActivityModel";
import { localRunFailure } from "../localRunFailure";
import { LOCAL_CHECKS } from "../localRunModel";
import type { LocalScene } from "../localRunScene";
import type { BeatFrame } from "./director";
import { ZONE_IDS, type ZoneId } from "./config";

export type ZoneStatus =
  | "off"
  | "active"
  | "done"
  | "skipped"
  | "needs-you"
  | "fault";
export interface ZoneAttention {
  zone: ZoneId;
  level: "act" | "look";
  state: "open" | "done";
}
export interface ZoneEvidence {
  id: ZoneId;
  status: ZoneStatus;
  done: boolean;
  skipped: boolean;
  count?: number;
}
export interface ZoneBoardState {
  zones: ZoneEvidence[];
  activeZone: ZoneId | null;
  buildZone: ZoneId;
  doneCount: number;
  total: 11;
  runningCheck: string | null;
  atMain: boolean;
}

/** Native checks are commands; only the supervisor's result rows reach VERIFY. */
export function zoneForEvent(event: LocalActivityEvent | null): ZoneId | null {
  if (!event) return null;
  if (event.kind === "read") return "explore";
  if (event.kind === "message") return "think";
  if (event.kind === "edit") return "build";
  if (event.kind === "command") return "bench";
  if (event.kind === "check") return "verify";
  if (event.kind !== "event" || event.label === "Tool requested") return null;
  if (event.summary === "Host checks started" || event.summary === "Acceptance check started") return "verify";
  if (event.summary === "Ready for owner UAT") return "handover";
  if (event.label !== event.summary) return null;
  if (/^(typecheck|lint|test|pm:lint) started$/u.test(event.summary))
    return "verify";
  if (event.summary === "Installing dependencies") return "setup";
  if (
    event.summary === "Committing candidate" ||
    /^Hook: (docs|mirrors|manifests|typecheck|tests|lint)$/u.test(event.summary)
  ) return "seal";
  if (event.summary === "Freezing handover") return "handover";
  return null;
}

export function faultZone(run: LocalRunView): ZoneId | null {
  if (run.phase !== "failed") return null;
  const error = run.error ?? "";
  if (error.startsWith("git ")) return "seal";
  const fault = localRunFailure(run);
  if (!fault) return null;
  if (fault.stage === "Seal") return "seal";
  if (fault.stage === "Setup" || fault.title === "Secret guard stopped it")
    return "setup";
  if (fault.stage === "Handover") return "handover";
  if (fault.stage === "Verify") return "verify";
  return "build";
}

/** Current phase supplies location, never an unevidenced completed lamp. */
export function phaseZone(run: LocalRunView): ZoneId {
  const fault = faultZone(run);
  if (fault) return fault;
  if (run.phase === "preparing") return "setup";
  // DLV-175: the Acceptance Check runs at the Verify station; a pause waits there.
  if (["checking", "accepting", "acceptance-paused"].includes(run.phase)) return "verify";
  if (run.phase === "uat-ready") return "test";
  if (
    [
      "merging",
      "push-pending",
      "revert-push-pending",
      "shipped",
      "reverted",
    ].includes(run.phase)
  )
    return "ship";
  return "build";
}

/** Lamps use immediate evidence; only the active work pose follows delayed staging. */
export function zoneEvidence(
  scene: LocalScene,
  beat: Pick<BeatFrame, "event" | "stage"> | null = null,
  attention: readonly ZoneAttention[] = [],
): ZoneBoardState {
  const run = scene.run;
  const has = (summary: string) =>
    scene.events.some(
      (event) =>
        event.kind === "event" &&
        event.label !== "Tool requested" &&
        event.summary === summary,
    );
  const counts = {
    explore: scene.events.filter((event) => event.kind === "read").length,
    think: scene.events.filter((event) => event.kind === "message").length,
    build: scene.events.filter((event) => event.kind === "edit").length,
    bench: scene.events.filter((event) => event.kind === "command").length,
  };
  const buildingEnded =
    !["preparing", "building"].includes(scene.phase) &&
    (has("Native session started") || !!run.head || run.checks.length > 0);
  const completeBuildTrace =
    has("Native session started") && run.activity.length < 200;
  const reviewed = !!run.head && run.reviewed_head === run.head;
  const accepted = run.handover?.acceptance.state === "accepted";
  const fault = faultZone(run);
  const operational =
    !run.interrupted &&
    !["failed", "cancelled", "shipped", "reverted"].includes(scene.phase);
  const freezing =
    scene.phase === "checking" &&
    scene.latest?.summary === "Freezing handover" &&
    zoneForEvent(scene.latest) === "handover";
  let activeZone: ZoneId | null = null;
  if (operational) {
    if (freezing) activeZone = "handover";
    else if (scene.phase === "preparing") activeZone = "setup";
    else if (scene.phase === "checking") activeZone = "verify";
    else if (scene.phase === "uat-ready") activeZone = "test";
    else if (scene.phase === "merging") activeZone = "ship";
    else if (beat)
      activeZone = beat.stage === "think" ? "think" : zoneForEvent(beat.event);
    else if (zoneForEvent(scene.latest) === "seal") activeZone = "seal";
  }
  const zones = ZONE_IDS.map((id): ZoneEvidence => {
    let done = false,
      skipped = false;
    let count: number | undefined;
    if (id === "brief") done = !!run.work.brief?.trim();
    else if (id === "setup") done = has("Native session started");
    else if (id in counts) {
      count = counts[id as keyof typeof counts];
      done = buildingEnded && count > 0;
      skipped = buildingEnded && completeBuildTrace && count === 0;
    } else if (id === "seal") done = !!run.head;
    else if (id === "verify")
      done = LOCAL_CHECKS.every((name) =>
        run.checks.some(
          (check) => check.name === name && check.exit === 0 && !check.error,
        ),
      );
    else if (id === "handover") done = has("Ready for owner UAT");
    else if (id === "test")
      done = accepted && (!run.risk?.required || reviewed);
    else if (id === "ship") done = scene.phase === "shipped";
    const needsYou = attention.some(
      (item) =>
        item.zone === id && item.level === "act" && item.state === "open",
    );
    const status: ZoneStatus =
      id === fault
        ? "fault"
        : needsYou
          ? "needs-you"
          : done
            ? "done"
            : skipped
              ? "skipped"
              : id === activeZone
                ? "active"
                : "off";
    return {
      id,
      status,
      done,
      skipped,
      ...(count === undefined ? {} : { count }),
    };
  });
  const runningCheck =
    scene.phase === "checking"
      ? (LOCAL_CHECKS.find(
          (name) => !run.checks.some((check) => check.name === name),
        ) ?? null)
      : null;
  return {
    zones,
    activeZone,
    buildZone: freezing ? "handover" : phaseZone(run),
    doneCount: zones.filter((zone) => zone.done || zone.skipped).length,
    total: 11,
    runningCheck,
    atMain: scene.phase === "shipped",
  };
}
