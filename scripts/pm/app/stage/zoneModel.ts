import type { LocalRunView } from "../LocalDelivery";
import type { LocalActivityEvent } from "../localRunActivityModel";
import { openQuestion } from "../localChatModel";
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
  currentZone: ZoneId | null;
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

function workflowZone(run: LocalRunView): ZoneId | null {
  switch (run.phase) {
    case "preparing":
      return "setup";
    case "building":
      return "build";
    case "checking":
    case "accepting":
    case "acceptance-paused":
    case "refreshing":
    case "refresh-failed":
      return "verify";
    case "uat-ready":
      return run.canMerge ? "ship" : "test";
    case "refresh-conflict":
    case "merging":
    case "merged":
    case "committed":
    case "push-pending":
    case "revert-push-pending":
      return "ship";
    default:
      return null;
  }
}

/** Cargo and fault locations persist on the board at the end of a run. */
export function phaseZone(run: LocalRunView): ZoneId {
  if (["shipped", "reverted", "pushed", "cleaned"].includes(run.phase)) return "ship";
  return faultZone(run) ?? workflowZone(run) ?? "build";
}

/** The workflow step at this cursor, independent of the actor's animation and the open inspector. */
export function currentAiZone(scene: LocalScene): ZoneId | null {
  if (scene.run.interrupted) return null;
  if (["checking", "accepting"].includes(scene.phase) && zoneForEvent(scene.latest) === "handover") return "handover";
  if (scene.phase === "building") {
    if (openQuestion(scene.run)) return "think";
    for (let index = scene.events.length - 1; index >= 0; index--) {
      const event = scene.events[index];
      // A new build or revision must not inherit a station from its previous attempt.
      if (event.kind === "event" && event.label !== "Tool requested" && event.summary === "Native session started") break;
      const zone = zoneForEvent(event);
      if (zone && ["explore", "think", "build", "bench", "seal"].includes(zone)) return zone;
    }
  }
  return workflowZone(scene.run);
}

/** Lamps use immediate evidence; only the active work pose follows delayed staging. */
export function zoneEvidence(
  scene: LocalScene,
  beat: Pick<BeatFrame, "event" | "stage"> | null = null,
  attention: readonly ZoneAttention[] = [],
  cursorMissing = false,
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
  const currentZone = cursorMissing ? null : currentAiZone(scene);
  let activeZone = currentZone;
  if (currentZone && scene.phase === "building" && beat)
    activeZone = beat.stage === "think" ? "think" : zoneForEvent(beat.event) ?? currentZone;
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
              : id === currentZone
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
    currentZone,
    activeZone,
    buildZone: currentZone === "handover" ? "handover" : phaseZone(run),
    doneCount: zones.filter((zone) => zone.done || zone.skipped).length,
    total: 11,
    runningCheck,
    atMain: scene.phase === "shipped",
  };
}
