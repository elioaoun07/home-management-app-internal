import { ART } from "../config";
import type { LocalActivityEvent } from "../../localRunActivityModel";
import { dome } from "../iso";
import { base, glow, part } from "./shared";
import { workBeat } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export const bake = (c: CanvasRenderingContext2D, a: ZoneArtContext) => base(c, a);
const orbit = (angle: number) => ({
  x: Math.cos(angle) * ART.orb.railR,
  y: -ART.orb.z + Math.sin(angle) * ART.orb.railR / 2,
});

function assembly(c: CanvasRenderingContext2D, a: ZoneArtContext, events: readonly LocalActivityEvent[] = []) {
  const o = ART.orb;
  function rail(front: boolean) {
    const start = front ? 0 : Math.PI, end = start + Math.PI;
    c.fillStyle = front ? a.palette.trim.top : a.palette.trim.right;
    c.beginPath();
    c.ellipse(0, -o.z, o.railR + 1.5, o.railR / 2 + 1.5, 0, start, end);
    c.ellipse(0, -o.z, o.railR - 1.5, o.railR / 2 - 1.5, 0, end, start, true);
    c.closePath();
    c.fill();
    events.forEach((row, i) => {
      const angle = i / o.beads * Math.PI * 2;
      if ((angle < Math.PI) !== front) return;
      const p = orbit(angle);
      c.fillStyle = row.kind === "edit" ? a.palette.zones.build.top : a.palette.hull.top;
      c.beginPath();
      c.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      c.fill();
    });
  }
  rail(false);
  dome(c, a.palette.zones.build, 0, 0, o.z - o.r, o.r, o.r * 2);
  rail(true);
}
export const bakePart = (c: CanvasRenderingContext2D, a: ZoneArtContext) => assembly(c, a);
export const stateOnPart = true;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  assembly(c, a, a.facts.snapshot.events.slice(-ART.orb.beads));
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = workBeat(a);
  if (!beat || beat.event.kind !== "message") { part(c, a); return; }
  const angle = beat.progress * Math.PI * 2, p = orbit(angle);
  if (angle >= Math.PI) glow(c, a, p.x, p.y, 0.7, 12);
  part(c, a);
  glow(c, a, 0, -ART.orb.z, 0.5 + Math.sin(beat.progress * Math.PI) * 0.25);
  if (angle < Math.PI) glow(c, a, p.x, p.y, 0.7, 12);
}
