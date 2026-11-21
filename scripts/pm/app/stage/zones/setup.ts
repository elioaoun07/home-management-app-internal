import { ART } from "../config";
import { base, glow, movingBase, part, partRegion } from "./shared";
import { supervisorWork } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export const bakePart = movingBase;
export const state = () => {};
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = supervisorWork(a, "Installing dependencies"), d = ART.details.setup;
  if (!beat || a.evidence?.nativeStarted) { part(c, a); return; }
  d.slices.forEach((slice, index) => {
    const landed = Math.max(0, Math.min(1, beat.progress * d.slices.length - index));
    partRegion(c, a, slice, -d.drop * (1 - landed) ** 2);
  });
  glow(c, a, d.lamp[0], d.lamp[1], 0.65);
}
