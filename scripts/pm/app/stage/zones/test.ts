import { ART } from "../config";
import { box, cylinder, ringBand } from "../iso";
import { base, glow, part, movingBase } from "./shared";
import { operational } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const tokens = a.facts.attention?.filter(item => item.zone === "test" && item.level === "act") ?? [];
  tokens.slice(0, 8).forEach((item, i) => {
    const material = { top: item.state === "done" ? a.palette.ok : a.palette.warn,
      left: a.palette.trim.left, right: a.palette.trim.right },
      x = -24 + (i % 4) * 13, y = -12 + Math.floor(i / 4) * 15;
    if (item.kind === "sql") cylinder(c, material, x + 5, y + 5, 37, 5, 13);
    else if (item.kind === "review") {
      ringBand(c, material, x + 4, y + 4, 37, 6, 3, 4);
      box(c, material, x + 7, y + 7, 37, 8, 3, 3);
    } else {
      box(c, material, x, y, 37, 10, 10, 7);
      box(c, a.palette.hull, x + 3, y - 2, 44, 4, 4, 3);
    }
  });
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  part(c, a);
  if (operational(a) && a.facts.snapshot.phase === "uat-ready")
    glow(c, a, ...ART.details.test.lamp, 0.65 + Math.sin(a.frame.elapsed * Math.PI) * 0.15);
}
