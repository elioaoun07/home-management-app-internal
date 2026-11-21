import { ART } from "../config";
import { base, part, movingBase, screen, glow } from "./shared";
import { HOOK_STEPS, supervisorWork } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const d = ART.details.seal, [x, y, z] = d.lamps;
  HOOK_STEPS.forEach((_, i) => screen(c, x + i * d.lampGap, y, z,
    d.lampSize, d.lampSize, a.evidence?.hooks[i] ? a.palette.zones.build.top : a.palette.trim.right));
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = supervisorWork(a, "Committing candidate");
  part(c, a, 0, beat ? Math.sin(beat.progress * Math.PI) * ART.details.seal.drop : 0);
  const hook = HOOK_STEPS.findIndex(step => !!supervisorWork(a, `Hook: ${step}`));
  if (hook >= 0) {
    const d = ART.details.seal;
    glow(c, a, d.lamps[0] + hook * d.lampGap - d.lamps[1], -d.lamps[2], 0.65, 12);
  }
}
