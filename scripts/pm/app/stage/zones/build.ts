import { ART } from "../config";
import { base, part, glow, movingBase } from "./shared";
import { workBeat } from "../machineEvidence";
import { box, project } from "../iso";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const buildKey = project(18, 32, 31);
export function bake(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  base(c, a);
  box(c, a.palette.trim, 9, 23, 14, 18, 12, 15);
  box(c, a.palette.hull, 8, 22, 29, 20, 13, 1.5);
  box(c, a.palette.zones.build, 14, 29, 30.5, 8, 5, 1.5);
}
export const bakePart = movingBase;
export const state = () => {};
export const buildHeadDrop = (progress: number) => Math.sin(progress * Math.PI) * ART.details.build.drop;
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = workBeat(a), active = beat?.event.kind === "edit";
  part(c, a, 0, active ? buildHeadDrop(beat.progress) : 0);
  if (active) glow(c, a, ...ART.details.build.glow, 0.5 + a.frame.heat * 0.3);
}
