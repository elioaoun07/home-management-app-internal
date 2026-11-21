import type { Vec2 } from "./types";
import { BOARD } from "./config";
export { createBoardCamera } from "./boardCamera";

export const PARALLAX = [0.05, 0.15, 0.5, 1, 1.3] as const;
export interface CameraTarget {
  x: number;
  y: number;
  zoom: number;
}
export interface CameraState extends CameraTarget {
  vx: number;
  vy: number;
  vZoom: number;
  mode: "auto" | "manual" | "held";
  target: CameraTarget;
}
const zoomLimit = (zoom: number) => Math.max(1, Math.min(1.8, zoom));
export const CAMERA_ZOOM = {
  rest: 1,
  work: 1,
  failure: 1,
  ceremony: BOARD.camera.ceremonyZoom,
} as const;
export function createCamera(initial: Partial<CameraTarget> = {}): CameraState {
  const target = {
    x: initial.x ?? 0,
    y: initial.y ?? 0,
    zoom: zoomLimit(initial.zoom ?? 1),
  };
  return {
    ...target,
    vx: 0,
    vy: 0,
    vZoom: 0,
    mode: "auto",
    target: { ...target },
  };
}
export interface FreeRectangle { x: number; y: number; width: number; height: number }
/** Largest useful fit between measured HUD rectangles. Runs on invalidation only. */
export function freeRectangle(width: number, height: number, obstacles: readonly FreeRectangle[]): FreeRectangle {
  obstacles = obstacles.flatMap(r => {
    const x = Math.max(0, Math.min(width, r.x)), y = Math.max(0, Math.min(height, r.y));
    const right = Math.max(0, Math.min(width, r.x + r.width)), bottom = Math.max(0, Math.min(height, r.y + r.height));
    return right > x && bottom > y ? [{ x, y, width: right - x, height: bottom - y }] : [];
  });
  const xs = [0, width, ...obstacles.flatMap(r => [Math.max(0, r.x - BOARD.margin), Math.min(width, r.x + r.width + BOARD.margin)])];
  const ys = [0, height, ...obstacles.flatMap(r => [Math.max(0, r.y - BOARD.margin), Math.min(height, r.y + r.height + BOARD.margin)])];
  let best = { x: 0, y: 0, width, height }, score = -1;
  for (const x of xs) for (const right of xs) for (const y of ys) for (const bottom of ys) {
    if (right <= x || bottom <= y || obstacles.some(r => x < r.x + r.width && right > r.x && y < r.y + r.height && bottom > r.y)) continue;
    const next = Math.min((right - x) / BOARD.bounds.width, (bottom - y) / BOARD.bounds.height);
    if (next > score) { best = { x, y, width: right - x, height: bottom - y }; score = next; }
  }
  return best;
}
/** Exact critically damped solution, frame-rate independent and never overshoots. */
export function criticalSpring(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  omega = 3.5,
): [number, number] {
  if (dt <= 0) return [value, velocity];
  const offset = value - target,
    drive = velocity + omega * offset,
    decay = Math.exp(-omega * dt);
  return [
    target + (offset + drive * dt) * decay,
    (velocity - omega * drive * dt) * decay,
  ];
}
/** Called by the stage's existing clock. This module never schedules a frame. */
export function stepCamera(
  camera: CameraState,
  autoTarget: CameraTarget,
  dt: number,
): CameraState {
  if (camera.mode === "auto")
    camera.target = { ...autoTarget, zoom: zoomLimit(autoTarget.zoom) };
  [camera.x, camera.vx] = criticalSpring(
    camera.x,
    camera.vx,
    camera.target.x,
    dt,
  );
  [camera.y, camera.vy] = criticalSpring(
    camera.y,
    camera.vy,
    camera.target.y,
    dt,
  );
  [camera.zoom, camera.vZoom] = criticalSpring(
    camera.zoom,
    camera.vZoom,
    zoomLimit(camera.target.zoom),
    dt,
  );
  camera.zoom = zoomLimit(camera.zoom);
  return camera;
}
export function panCamera(camera: CameraState, dx: number, dy: number) {
  camera.mode = "manual";
  camera.x += dx;
  camera.y += dy;
  camera.target = { x: camera.x, y: camera.y, zoom: camera.zoom };
  camera.vx = camera.vy = 0;
}
/** Wheel delta uses the browser's sign: scrolling up zooms in. */
export function zoomCamera(
  camera: CameraState,
  wheelDelta: number,
  anchor: Vec2 = { x: 0, y: 0 },
) {
  camera.mode = "manual";
  const zoom = zoomLimit(camera.target.zoom * Math.exp(-wheelDelta * 0.001));
  const scale = zoom / camera.target.zoom;
  camera.target = {
    x: anchor.x - (anchor.x - camera.target.x) * scale,
    y: anchor.y - (anchor.y - camera.target.y) * scale,
    zoom,
  };
}
export function holdCamera(camera: CameraState, target: Partial<CameraTarget>) {
  camera.mode = "held";
  camera.target = {
    x: target.x ?? camera.x,
    y: target.y ?? camera.y,
    zoom: zoomLimit(target.zoom ?? CAMERA_ZOOM.work),
  };
}
export function autoCamera(camera: CameraState) {
  camera.mode = "auto";
}
export function resetCamera(camera: CameraState) {
  camera.mode = "auto";
  camera.target = { x: 0, y: 0, zoom: 1 };
}
/** Screen-space transform for an already projected 2:1 world. */
export function cameraPoint(
  point: Vec2,
  camera: CameraTarget,
  center: Vec2 = { x: 0, y: 0 },
  layer = 1,
  pointer: Vec2 = { x: 0, y: 0 },
): Vec2 {
  return {
    x:
      center.x +
      (point.x - center.x) * camera.zoom +
      (camera.x + pointer.x) * layer,
    y:
      center.y +
      (point.y - center.y) * camera.zoom +
      (camera.y + pointer.y) * layer,
  };
}
export function applyCamera(
  ctx: CanvasRenderingContext2D,
  camera: CameraTarget,
  center: Vec2,
  layer = 1,
  pointer: Vec2 = { x: 0, y: 0 },
) {
  ctx.translate(
    center.x + (camera.x + pointer.x) * layer,
    center.y + (camera.y + pointer.y) * layer,
  );
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-center.x, -center.y);
}
