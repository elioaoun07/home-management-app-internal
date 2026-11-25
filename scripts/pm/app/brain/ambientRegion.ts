import { Box2, PerspectiveCamera, Vector2, Vector3 } from "three";

/** The CPU renderer retains the last full colour and depth buffer. At a fixed
 * camera, the animated shell and its conductor occupy a small part of it.
 * Project conservative world bounds; a near-plane intersection needs a full
 * paint because point projection is unbounded there. */
export function ambientRegion() {
  const bounds = new Box2(), projected = new Vector2(), p = new Vector3();
  return (camera: PerspectiveCamera, width: number, height: number, center: Vector3, radius: number, route: readonly Vector3[], activeDesk?: Vector3 | null) => {
    bounds.makeEmpty();
    let clipped = false;
    function include(point: Vector3, extent: number) {
      p.copy(point).applyMatrix4(camera.matrixWorldInverse);
      if (p.z - extent >= -camera.near) return;
      if (p.z + extent >= -camera.near) { clipped = true; return; }
      // Project the eight corners in camera space. A sphere's nearest plane
      // alone undershoots its screen extent when the center is off-axis.
      const x = p.x, y = p.y, z = p.z;
      for (const depth of [-extent, extent]) for (const dx of [-extent, extent]) for (const dy of [-extent, extent]) {
        p.set(x + dx, y + dy, z + depth).applyMatrix4(camera.projectionMatrix);
        bounds.expandByPoint(projected.set((p.x * .5 + .5) * width, (.5 - p.y * .5) * height));
      }
    }
    include(center, radius);
    if (activeDesk) {
      include(activeDesk, 1.04);
      include(p.set(activeDesk.x, 2.28, activeDesk.z), .25);
    }
    let priorDepth: number | undefined;
    for (const point of route) {
      const depth = p.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
      if (priorDepth !== undefined && (priorDepth < -camera.near) !== (depth < -camera.near)) clipped = true;
      include(point, .19);
      priorDepth = depth;
    }
    if (clipped) return null;
    const x = Math.max(0, Math.floor(bounds.min.x) - 2), y = Math.max(0, Math.floor(bounds.min.y) - 2);
    const right = Math.min(width, Math.ceil(bounds.max.x) + 2), bottom = Math.min(height, Math.ceil(bounds.max.y) + 2);
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  };
}
