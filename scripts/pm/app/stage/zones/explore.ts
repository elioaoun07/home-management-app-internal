import { ART } from "../config";
import { box, project } from "../iso";
import { base, part, glow, hash, movingBase } from "./shared";
import { workBeat } from "../machineEvidence";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export function bake(c: CanvasRenderingContext2D, a: ZoneArtContext) {
  base(c, a);
  const d = ART.drawer, f = ART.details.explore;
  for (let row = 0; row < d.rows; row++)
    for (let col = 0; col < d.columns; col++)
      box(c, a.palette.trim, f.frontX + col * d.gapX, f.frontY,
        d.z + row * d.gapY, d.width, 4, d.height);
}
export const bakePart = movingBase;
export function state(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const d = ART.drawer;
  for (const node of a.facts.snapshot.nodes) {
    if (!node.path) continue;
    const index = hash(node.path) % (d.rows * d.columns), p = project(
      -22 + (index % d.columns) * d.gapX, 32, d.z + Math.floor(index / d.columns) * d.gapY + 4);
    c.fillStyle = node.edited ? a.palette.zones.build.top : a.palette.hull.top;
    c.fillRect(p.x - 4, p.y - 2, 8, 4);
  }
}
export function motion(c: CanvasRenderingContext2D, a: ZoneRenderState) {
  const beat = workBeat(a);
  if (!beat || beat.event.kind !== "read") { part(c, a); return; }
  const key = beat.event.paths[0] ?? beat.event.id;
  const i = hash(key) % (ART.drawer.rows * ART.drawer.columns);
  part(c, a, ((i % ART.drawer.columns) - 1.5) * ART.drawer.gapX,
    Math.floor(i / ART.drawer.columns) * -ART.drawer.gapY + Math.sin(beat.progress * Math.PI) * 7);
  if (beat.action === "search") glow(c, a, -20 + 40 * beat.progress, -48, 0.5);
}
