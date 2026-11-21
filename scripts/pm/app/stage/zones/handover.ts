import { ART } from "../config";
import { base, part, movingBase, slope, screen } from "./shared";
import { supervisorWork } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const stateOnPart = true;
export function bake(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  base(c, a);
  slope(c, a, ART.details.handover.slope);
}
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  if (!a.evidence?.handoverRecorded) return;
  screen(c, ...ART.details.handover.seal, a.palette.zones.test.top);
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = supervisorWork(a, "Freezing handover");
  part(c, a, 0, beat && !a.evidence?.handoverRecorded ? Math.sin(beat.progress * Math.PI) * ART.details.handover.roll : 0);
}
