import type { Material, PrimitiveOptions, Vec2, Vec3 } from "./types";
export const LINE = {
  silhouette: 2.5,
  structure: 1.5,
  detail: 1,
  hairline: 0.5,
} as const;
export const project = (x: number, y: number, z = 0): Vec2 => ({
  x: x - y,
  y: (x + y) / 2 - z,
});
export function painterSort<T extends Vec3>(parts: readonly T[]): T[] {
  return [...parts].sort((a, b) => a.x + a.y - b.x - b.y || a.z - b.z);
}
export function polygon(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}
export function box(
  ctx: CanvasRenderingContext2D,
  p: Material,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  o: PrimitiveOptions = {},
) {
  const a = project(x, y, z + h),
    b = project(x + w, y, z + h),
    c = project(x + w, y + d, z + h),
    e = project(x, y + d, z + h);
  const f = project(x + w, y + d, z),
    g = project(x, y + d, z),
    j = project(x + w, y, z);
  polygon(ctx, [e, c, f, g], o.left ?? p.left);
  polygon(ctx, [b, c, f, j], o.right ?? p.right);
  polygon(ctx, [a, b, c, e], o.top ?? p.top);
}
export function cylinder(
  ctx: CanvasRenderingContext2D,
  p: Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  o: PrimitiveOptions = {},
) {
  const a = project(x, y, z),
    b = project(x, y, z + h);
  ctx.fillStyle = o.left ?? p.left;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, r, r * 0.5, 0, 0, Math.PI);
  ctx.lineTo(b.x - r, b.y);
  ctx.ellipse(b.x, b.y, r, r * 0.5, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.fillStyle = o.right ?? p.right;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, r, r * 0.5, 0, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(b.x, b.y + r * 0.5);
  ctx.ellipse(b.x, b.y, r, r * 0.5, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();
  ctx.fillStyle = o.top ?? p.top;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
export function hexPrism(
  ctx: CanvasRenderingContext2D,
  p: Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  rotation = 0,
  o: PrimitiveOptions = {},
) {
  const ground = Array.from({ length: 6 }, (_, i) => ({
    x: x + Math.cos((i * Math.PI) / 3 + rotation) * r,
    y: y + Math.sin((i * Math.PI) / 3 + rotation) * r,
  }));
  for (let i = 0; i < 6; i++) {
    const a = ground[i],
      b = ground[(i + 1) % 6];
    if (a.x + a.y + b.x + b.y >= 2 * (x + y))
      polygon(
        ctx,
        [
          project(a.x, a.y, z + h),
          project(b.x, b.y, z + h),
          project(b.x, b.y, z),
          project(a.x, a.y, z),
        ],
        i < 3 ? (o.right ?? p.right) : (o.left ?? p.left),
      );
  }
  polygon(
    ctx,
    ground.map((a) => project(a.x, a.y, z + h)),
    o.top ?? p.top,
  );
}
export function ringBand(
  ctx: CanvasRenderingContext2D,
  p: Material,
  x: number,
  y: number,
  z: number,
  r: number,
  inner: number,
  h: number,
  o: PrimitiveOptions = {},
) {
  cylinder(ctx, p, x, y, z, r, h, o);
  const a = project(x, y, z + h);
  ctx.fillStyle = p.right;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, inner, inner * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
export function dome(
  ctx: CanvasRenderingContext2D,
  p: Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  o: PrimitiveOptions = {},
) {
  const a = project(x, y, z + h * 0.5);
  ctx.fillStyle = o.right ?? p.right;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, r, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = o.left ?? p.left;
  ctx.beginPath();
  ctx.ellipse(
    a.x - r * 0.16,
    a.y - h * 0.02,
    r * 0.84,
    h * 0.46,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = o.top ?? p.top;
  ctx.beginPath();
  ctx.ellipse(
    a.x - r * 0.3,
    a.y - h * 0.16,
    r * 0.45,
    h * 0.26,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
export function contactShadow(
  ctx: CanvasRenderingContext2D,
  p: { shadow: string },
  x: number,
  y: number,
  w: number,
  d: number,
  opacity = 1,
) {
  ctx.globalAlpha = opacity;
  ctx.fillStyle = p.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, w, d, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
