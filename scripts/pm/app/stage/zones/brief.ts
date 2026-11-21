import { ART } from "../config";
import { base, glow, movingBase, part, screen, slope, scanLine } from "./shared";
import { supervisorWork } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const stateOnPart = true;
export function bake(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  base(c, a);
  slope(c, a, ART.details.brief.slope);
}
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  for (let i = 0; i < a.facts.snapshot.objectiveCount; i++)
    screen(c, -16 + (i % 5) * 8, -4, 44 + Math.floor(i / 5) * 7, 5, 5,
      a.facts.snapshot.objectivesAccepted ? a.palette.ok : a.palette.zones.setup.top);
  if (a.facts.retry) screen(c, 18, 6, 32, 14, 5, a.palette.zones.setup.top);
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  part(c, a);
  const beat = supervisorWork(a, "Run created");
  if (!beat) return;
  const d = ART.details.brief, [x, y, z, width, height] = d.scan;
  scanLine(c, a, x, y, z + d.travel * (1 - beat.progress), width, height);
  glow(c, a, 0, -60, 0.5);
}
