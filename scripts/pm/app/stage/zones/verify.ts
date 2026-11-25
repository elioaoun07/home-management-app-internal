import { ART, ZONE_BY_ID } from "../config";
import { LOCAL_CHECKS } from "../../localRunModel";
import { project } from "../iso";
import { base, part, movingBase, glow } from "./shared";
import { operational } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export const bakePart = movingBase;
export const state = () => {};
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const index = a.evidence?.runningCheck;
  if (index == null) { part(c, a); return; }
  const scanning = operational(a) && !!LOCAL_CHECKS[index];
  const dx = ART.verify.xs[index] - ZONE_BY_ID.verify.machine.x;
  part(c, a, dx, dx / 2 + (scanning ? Math.sin(a.frame.elapsed * Math.PI) * ART.details.verify.sweep / 2 : 0));
  if (scanning) {
    const p = project(dx, ART.verify.y - ZONE_BY_ID.verify.machine.y, ART.verify.z + ART.verify.height);
    glow(c, a, p.x, p.y, 0.65, 28);
  }
}
