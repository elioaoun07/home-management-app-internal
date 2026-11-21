import { ART } from "../config";
import { dome, project, ringBand } from "../iso";
import { base, glow, part } from "./shared";
import { workBeat } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
export function bakePart(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  const o = ART.orb, r = ART.details.think;
  ringBand(c, a.palette.trim, 0, 0, r.ringZ, r.ringR, r.ringInner, r.ringH);
  dome(c, a.palette.zones.build, 0, 0, o.z - o.r, o.r, o.r * 2);
}
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  a.facts.snapshot.events.slice(-ART.orb.beads).forEach((row, i) => {
    const t = (i / ART.orb.beads) * Math.PI * 2,
      p = project(Math.cos(t) * ART.orb.railR, Math.sin(t) * ART.orb.railR, ART.orb.z);
    c.fillStyle = row.kind === "edit" ? a.palette.zones.build.top : a.palette.hull.top;
    c.beginPath(); c.arc(p.x, p.y, 2.2, 0, Math.PI * 2); c.fill();
  });
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  part(c, a);
  const beat = workBeat(a);
  if (!beat || beat.event.kind !== "message") return;
  const angle = beat.progress * Math.PI * 2, r = ART.details.think;
  glow(c, a, 0, -ART.orb.z, 0.5 + Math.sin(beat.progress * Math.PI) * 0.25);
  glow(c, a, Math.cos(angle) * r.ringR, -r.ringZ + Math.sin(angle) * r.ringR / 2, 0.7, 12);
}
