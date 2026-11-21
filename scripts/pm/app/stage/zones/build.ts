import { ART } from "../config";
import { base, part, glow, movingBase } from "./shared";
import { workBeat } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export const bakePart = movingBase;
export const state = () => {};
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = workBeat(a), active = beat?.event.kind === "edit";
  part(c, a, 0, active ? Math.sin(beat.progress * Math.PI) * ART.details.build.drop : 0);
  if (active) glow(c, a, ...ART.details.build.glow, 0.5 + a.frame.heat * 0.3);
}
