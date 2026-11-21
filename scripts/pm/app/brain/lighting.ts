import type { LocalLiveness } from "../localRunLiveness";
import type { LocalScene } from "../localRunScene";
import { roomCassette, roomZone } from "../transferRoomModel";
import type { ZoneBoardState } from "../stage/zoneModel";
import type { ZoneId } from "../stage/config";
import type { RoomLighting } from "./protocol";

/** The room depicts the same cursor-filtered facts as the evidence reader. */
export function roomLighting(scene: LocalScene, zones: ZoneBoardState, health: Pick<LocalLiveness, "active" | "state">, question: boolean): RoomLighting {
  const marks: Partial<Record<ZoneId, "reached" | "skipped" | "fault">> = {};
  const failed = scene.phase === "failed";
  const faultZone = failed ? zones.zones.find(zone => zone.status === "fault")?.id ?? null : null;
  for (const zone of zones.zones) {
    if (zone.status === "fault") marks[zone.id] = "fault";
    else if (zone.skipped) marks[zone.id] = "skipped";
    else if (zone.done || (zone.count ?? 0) > 0) marks[zone.id] = "reached";
  }
  for (const row of scene.events) {
    const zone = roomZone(row);
    if (zone && !marks[zone] && ["setup", "seal"].includes(zone)) marks[zone] = "reached";
  }
  const ready = roomCassette(scene) === "received";
  if (ready && !marks.handover) marks.handover = "reached";
  const checks = scene.seals.map(seal => seal.state === "pending" ? null : seal.state);
  if (checks.some(Boolean) && !marks.verify) marks.verify = "reached";
  const ship = scene.phase === "shipped" || scene.phase === "reverted" ? scene.phase :
    health.state === "push-pending" ? "pending" : null;
  if (ship && ship !== "pending") marks.ship = "reached";

  const working = !failed && health.active;
  const owner = !failed && health.state === "your-turn";
  let endpoint: RoomLighting["endpoint"] = null;
  let energy = .23;
  if (owner) {
    endpoint = question ? "seat" : ready ? "test" : null;
    energy = .51;
  } else if (working) {
    if (scene.phase === "building") {
      for (let i = scene.events.length - 1; i >= 0; i--) {
        const zone = roomZone(scene.events[i]);
        if (zone === "explore" || zone === "think" || zone === "build" || zone === "bench" || zone === "seal") {
          endpoint = zone;
          break;
        }
      }
      energy = 1;
    } else {
      endpoint = zones.activeZone;
      energy = scene.phase === "checking" ? .82 : .37;
    }
  } else if (ship === "pending") {
    endpoint = "ship";
    energy = .43;
  }
  return { failed, faultZone, endpoint, marks, checks, energy: failed ? 0 : energy, working, owner, ship };
}
