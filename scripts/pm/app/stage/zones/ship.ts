import { ART } from "../config";
import { ringBand } from "../iso";
import { base, part, movingBase } from "./shared";
import { operational } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export function bake(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  base(c, a);
  const d = ART.details.ship;
  ringBand(c, a.palette.zones.ship, 0, 0, d.ringZ, d.ringR, d.ringInner, d.ringH);
}
export const bakePart = movingBase;
export const state = () => {};
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const lifting = operational(a) && a.frame.ceremony?.kind === "launch";
  part(c, a, lifting ? -a.frame.ceremony!.progress * ART.details.ship.retract : 0, 0);
}
