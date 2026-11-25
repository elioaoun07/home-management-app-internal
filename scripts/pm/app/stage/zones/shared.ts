import { ART, MACHINE_PARTS, ZONE_BY_ID } from "../config";
import { box, contactShadow, project, polygon } from "../iso";
import type { ZoneArtContext, ZoneRenderState } from "../types";
export function floorShadow(ctx: CanvasRenderingContext2D, art: ZoneArtContext) {
  const p = art.palette,
    h = ART.shadow;
  const height = Math.max(
    ...MACHINE_PARTS[art.zone].map((part) => part[2] + part[5]),
  );
  contactShadow(ctx, p, 0, 4, h.r * 0.8, h.depth * 0.7);
  contactShadow(ctx, p, h.x, height * 0.35, h.r, h.depth);
}
export function base(ctx: CanvasRenderingContext2D, art: ZoneArtContext) {
  const p = art.palette;
  if (p.shadow !== "transparent") floorShadow(ctx, art);
  for (const [x, y, z, w, d, height, material] of MACHINE_PARTS[art.zone])
    box(
      ctx,
      material === "zone" ? p.zones[ZONE_BY_ID[art.zone].group] : p[material],
      x,
      y,
      z,
      w,
      d,
      height,
    );
}
export function part(
  ctx: CanvasRenderingContext2D,
  art: ZoneRenderState,
  x = 0,
  y = 0,
  opacity = 1,
) {
  if (!art.part) return;
  ctx.globalAlpha = opacity;
  ctx.drawImage(
    art.part.image,
    art.part.x + x,
    art.part.y + y,
    art.part.width,
    art.part.height,
  );
  ctx.globalAlpha = 1;
}
export function glow(
  ctx: CanvasRenderingContext2D,
  art: ZoneRenderState,
  x: number,
  y: number,
  alpha = 0.4,
  size: number = ART.glow.size,
) {
  if (!art.glow) return;
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(art.glow, x - size / 2, y - size / 2, size, size);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}
export function scanLine(ctx: CanvasRenderingContext2D, art: ZoneRenderState,
  x: number, y: number, z: number, width: number, height: number) {
  if (!art.glow) return;
  const p = project(x, y, z);
  ctx.globalAlpha = 0.75;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(art.glow, p.x - width / 2, p.y - height / 2, width, height);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}
export const hash = (value: string) => {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++)
    n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
};
export function working(art: ZoneRenderState) {
  return art.frame.beat?.stage === "work";
}
export function movingBase(ctx: CanvasRenderingContext2D, art: ZoneArtContext) {
  for (const [x, y, z, w, d, height, material] of ART.parts[art.zone])
    box(ctx, material === "zone" ? art.palette.zones[ZONE_BY_ID[art.zone].group] : art.palette[material],
      x, y, z, w, d, height);
}
export function partRegion(ctx: CanvasRenderingContext2D, art: ZoneRenderState,
  region: readonly [number, number, number, number], dy: number) {
  const p = art.part;
  if (!p) return;
  const [x, y, width, height] = region, dpr = p.image.width / p.width;
  ctx.drawImage(p.image, (x - p.x) * dpr, (y - p.y) * dpr,
    width * dpr, height * dpr, x, y + dy, width, height);
}
/** A filled, slanted desktop; its three faces share the board's key light. */
export function slope(ctx: CanvasRenderingContext2D, art: ZoneArtContext,
  shape: readonly [number, number, number, number, number, number]) {
  const [x, y, z, w, d, h] = shape, p = art.palette.hull;
  const a = project(x, y, z + h), b = project(x + w, y, z + h),
    c = project(x + w, y + d, z + 6), e = project(x, y + d, z + 6);
  polygon(ctx, [e, c, project(x + w, y + d, z), project(x, y + d, z)], p.left);
  polygon(ctx, [b, c, project(x + w, y + d, z), project(x + w, y, z)], p.right);
  polygon(ctx, [a, b, c, e], p.top);
}
export function screen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  color: string,
) {
  const p = project(x, y, z);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
}
