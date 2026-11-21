import { ART, ZONE_BY_ID } from "../config";
import { LOCAL_CHECKS } from "../../localRunModel";
import { box, project } from "../iso";
import { base, part, movingBase, glow } from "./shared";
import { operational } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export function bake(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  base(c, a);
  const p = ZONE_BY_ID.verify.machine, g = ART.verify;
  for (const x of g.xs) {
    const xx = x - p.x, yy = g.y - p.y;
    box(c, a.palette.hull, xx - 5, yy - 19, g.z, 10, 8, g.height);
    box(c, a.palette.hull, xx - 5, yy + 11, g.z, 10, 8, g.height);
    box(c, a.palette.zones.verify, xx - 5, yy - 19, g.z + g.height, 10, 38, 8);
  }
}
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  a.facts.snapshot.seals.forEach((seal, i) => {
    const p = project(ART.verify.xs[i] - ZONE_BY_ID.verify.machine.x,
      ART.verify.y - ZONE_BY_ID.verify.machine.y, ART.verify.z + ART.verify.height + 8);
    c.fillStyle = seal.state === "passed" ? a.palette.ok : seal.state === "failed" ? a.palette.bad :
      seal.state === "inconclusive" ? a.palette.warn : a.palette.trim.right;
    c.beginPath(); c.arc(p.x, p.y, 4, 0, Math.PI * 2); c.fill();
  });
}
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
