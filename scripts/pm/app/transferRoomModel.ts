import type { LocalActivityEvent } from "./localRunActivityModel";
import { sceneAt, type LocalScene, type LocalTimeline } from "./localRunScene";
import { zoneForEvent } from "./stage/zoneModel";
import type { ZoneId } from "./stage/config";
import { bays } from "./brain/layout";

export const roomSteps: readonly { label: string; zones: readonly ZoneId[] }[] =
  bays.slice(1).map(({ name: label, zones }) => ({ label, zones }));

export function roomZone(event: LocalActivityEvent): ZoneId | null {
  if (event.kind === "event" && event.label !== "Tool requested") {
    if (event.summary === "Native session started") return "setup";
    if (event.summary === "Owner opened diff review") return "test";
    if (["Owner shipped merge", "Owner reverted merge"].includes(event.summary)) return "ship";
  }
  return zoneForEvent(event);
}

export function roomRows(scene: LocalScene, zone: ZoneId | "all") {
  return zone === "all" ? scene.events : scene.events.filter((event) => roomZone(event) === zone);
}

export interface RoomMark {
  id: string;
  at: string;
  summary: string;
}

export function resolveMark(events: readonly LocalActivityEvent[], mark: RoomMark | null) {
  if (!mark) return null;
  return events.find((event) =>
    event.id === mark.id && event.at === mark.at && event.summary === mark.summary,
  ) ?? null;
}

export function roomStepRow(
  timeline: LocalTimeline,
  current: string | undefined,
  live: boolean,
  direction: -1 | 1,
) {
  if (live) return direction === -1 ? timeline.events.at(-2) ?? timeline.events.at(-1) : undefined;
  const position = timeline.events.findIndex((event) => event.id === current);
  return position === -1 ? timeline.events[0] : timeline.events[position + direction];
}

export function roomCheck(scene: LocalScene, event: LocalActivityEvent) {
  return event.kind === "check" ? scene.run.checks.find((check) => check.name === event.detail) : undefined;
}

export function roomMoment(timeline: LocalTimeline, mark: RoomMark | null) {
  const event = resolveMark(timeline.events, mark);
  return event ? { event, scene: sceneAt(timeline, Date.parse(event.at), event.id) } : null;
}

export function roomCassette(scene: LocalScene) {
  if (scene.phase === "shipped") return "shipped";
  if (scene.phase === "reverted") return "reverted";
  if (scene.phase === "uat-ready" && (
    scene.run.handover || scene.events.some((event) =>
      event.kind === "event" && event.label !== "Tool requested" && event.summary === "Ready for owner UAT",
    )
  )) return "received";
  if (scene.phase === "checking") return "verify";
  return "bench";
}
