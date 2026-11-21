import { ART } from "../config";
import { base, part, screen, movingBase, scanLine } from "./shared";
import { workBeat } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const stateOnPart = true;
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  a.facts.snapshot.events.filter(e => e.kind === "command").slice(-3).forEach((_, i) =>
    screen(c, -12 + i * 6, -16, 51 + i * 7, 23 - i * 4, 3, a.palette.zones.build.top));
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  part(c, a);
  const beat = workBeat(a);
  if (!beat || beat.event.kind !== "command") return;
  const d = ART.details.bench, [x, y, z, width, height] = d.scan;
  scanLine(c, a, x, y, z + d.travel * (1 - beat.progress), width, height);
}
