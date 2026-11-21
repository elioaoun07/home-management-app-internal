import type { LocalActivityEvent } from "../localRunActivityModel";
import { zoneForEvent } from "./zoneModel";
import type { ZoneId } from "./config";

/** Camera destinations use the recorded row, never its decorative Think beat. */
export function cameraZone(event: LocalActivityEvent | null): ZoneId | null {
  const zone = zoneForEvent(event);
  if (zone) return zone;
  if (!event || event.kind !== "event" || event.label !== event.summary) return null;
  if (event.summary === "Run created") return "brief";
  if (event.summary === "Native session started") return "setup";
  if (event.summary === "Owner opened diff review") return "test";
  if (["Owner shipped merge", "Owner reverted merge"].includes(event.summary)) return "ship";
  return null;
}
