import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOARD,
  ZONE_BY_ID,
  ZONE_IDS,
  type ZoneId,
} from "../../scripts/pm/app/stage/config";
import { project } from "../../scripts/pm/app/stage/iso";
import {
  cameraFollowPose,
  cameraOverview,
  cameraZonePose,
  cameraZoomBucket,
  createBoardCameraController,
  parseCameraTransform,
  type BoardCameraObservation,
  type BoardCameraPose,
  type BoardCameraSettled,
} from "../../scripts/pm/app/stage/boardCamera";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const rectangle = { x: 100, y: 80, width: 800, height: 460 };
function fixture(width = 1000, height = 600) {
  let now = 0,
    computed: BoardCameraPose | null = null,
    captures = 0;
  const paints: { pose: BoardCameraPose; duration: number }[] = [];
  const changes: {
    mode: string;
    zone: ZoneId | null;
    follow: boolean;
    zoom: number;
  }[] = [];
  const settled: BoardCameraSettled[] = [];
  const camera = createBoardCameraController(
    {
      paint(pose, duration) {
        paints.push({ pose, duration });
        if (duration === 0) computed = pose;
      },
      capture() {
        captures++;
        return computed;
      },
      changed: (value) => changes.push(value),
    },
    { now: () => now, onSettled: (value) => settled.push(value) },
  );
  camera.resize(width, height, rectangle);
  const observe = (patch: Partial<BoardCameraObservation> = {}) =>
    camera.observe({
      nowMs: now,
      rowAgeMs: 0,
      stagedZone: null,
      closed: false,
      frozen: false,
      reducedMotion: false,
      ...patch,
    });
  return {
    camera,
    paints,
    changes,
    settled,
    observe,
    at(value: number) {
      now = value;
    },
    computed(value: BoardCameraPose) {
      computed = value;
    },
    captures: () => captures,
  };
}
function padCentre(id: ZoneId, pose: BoardCameraPose) {
  const pad = ZONE_BY_ID[id].pad;
  const p = project(
    pad.x + pad.width / 2,
    pad.y + pad.depth / 2,
    BOARD.pad.raise,
  );
  return {
    x: pose.x + (p.x - BOARD.bounds.x) * pose.scale,
    y: pose.y + (p.y - BOARD.bounds.y) * pose.scale,
  };
}

describe("R126 mission camera framing", () => {
  it("starts at Overview, fits its free rectangle, and follows each of the eleven recorded zones at28% of regionwidth", () => {
    const f = fixture();
    expect(f.camera.mode()).toBe("overview");
    expect(f.camera.target()).toEqual(cameraOverview(rectangle));
    const overview = f.camera.target();
    expect(overview.x).toBeGreaterThanOrEqual(rectangle.x);
    expect(overview.y).toBeGreaterThanOrEqual(rectangle.y);
    expect(
      overview.x + BOARD.bounds.width * overview.scale,
    ).toBeLessThanOrEqual(rectangle.x + rectangle.width);
    expect(
      overview.y + BOARD.bounds.height * overview.scale,
    ).toBeLessThanOrEqual(rectangle.y + rectangle.height);
    for (const zone of ZONE_IDS) {
      f.observe({ stagedZone: zone });
      const target = f.camera.target(),
        pad = ZONE_BY_ID[zone].pad;
      expect(f.camera.mode()).toBe("follow");
      expect((pad.width + pad.depth) * target.scale).toBeCloseTo(
        1000 * 0.28,
        9,
      );
      expect(padCentre(zone, target).x).toBeCloseTo(
        rectangle.x + rectangle.width / 2,
        9,
      );
      expect(padCentre(zone, target).y).toBeCloseTo(
        rectangle.y + rectangle.height / 2,
        9,
      );
      expect(f.paints.at(-1)?.duration).toBe(900);
    }
  });
  it("does not clamp wide-window Follow to Inspect's2.2×, and caps only the bake bucket", () => {
    const free = { x: 0, y: 0, width: 2200, height: 400 };
    const overview = cameraOverview(free),
      follow = cameraFollowPose("build", 2200, free);
    const zoom = follow.scale / overview.scale;
    expect(zoom).toBeGreaterThan(2.2);
    expect(cameraZoomBucket(zoom)).toBe(2.2);
    expect(
      (ZONE_BY_ID.build.pad.width + ZONE_BY_ID.build.pad.depth) * follow.scale,
    ).toBeCloseTo(616);
  });
  it("retains the last staged zone across gaps until20s, then waits for another staged zone", () => {
    const f = fixture();
    f.observe({ stagedZone: "explore" });
    const followed = f.camera.target();
    f.observe({ rowAgeMs: 19_999 });
    expect(f.camera.target()).toEqual(followed);
    f.observe({ rowAgeMs: 20_000 });
    expect(f.camera.mode()).toBe("overview");
    f.observe({ rowAgeMs: 0 });
    expect(f.camera.mode()).toBe("overview");
    f.observe({ stagedZone: "bench" });
    expect(f.camera.target()).toEqual(
      cameraFollowPose("bench", 1000, rectangle),
    );
  });
  it("holds explicit Overview untilF, and returns a newly closed run to Overview", () => {
    const f = fixture();
    f.observe({ stagedZone: "build" });
    f.camera.overview();
    f.observe({ stagedZone: "bench" });
    expect(f.camera.mode()).toBe("overview");
    expect(f.camera.toggleFollow()).toBe(true);
    expect(f.camera.mode()).toBe("follow");
    f.camera.inspect("seal");
    f.observe({ closed: true, stagedZone: "ship" });
    expect(f.camera.mode()).toBe("overview");
    f.camera.inspect("seal");
    f.observe({ closed: true });
    expect(f.camera.mode()).toBe("inspect");
    f.camera.reset();
    expect(f.camera.mode()).toBe("overview");
  });
  it("locks Inspect2.2× before the drawer changes its free rectangle, then recomputes only on viewportresize", () => {
    const f = fixture(),
      before = cameraOverview(rectangle).scale;
    f.observe();
    f.camera.inspect("think");
    expect(f.camera.scale()).toBeCloseTo(before * 2.2);
    const drawerFree = { x: 100, y: 80, width: 800, height: 200 };
    f.camera.resize(1000, 600, drawerFree);
    expect(f.camera.scale()).toBeCloseTo(before * 2.2);
    expect(f.camera.target()).toEqual(
      cameraZonePose("think", before * 2.2, drawerFree),
    );
    expect(f.paints.at(-1)?.duration).toBe(900);
    const resizedFree = { x: 50, y: 40, width: 600, height: 200 };
    f.camera.resize(800, 500, resizedFree);
    expect(f.camera.scale()).toBeCloseTo(
      cameraOverview(resizedFree).scale * 2.2,
    );
    expect(f.paints.at(-1)?.duration).toBe(0);
  });
});

describe("R126 camera ownership and invalidation", () => {
  it("fits an initially unavailable visit on its first positive viewport, then preserves it until recovery", () => {
    const paints: { pose: BoardCameraPose; duration: number }[] = [];
    const settled: BoardCameraSettled[] = [];
    const camera = createBoardCameraController(
      {
        paint: (pose, duration) => paints.push({ pose, duration }),
        capture: () => ({ x: 0, y: 0, scale: 1 }),
      },
      { now: () => 0, onSettled: (value) => settled.push(value) },
    );
    const unavailable: BoardCameraObservation = {
      nowMs: 0,
      rowAgeMs: 30_000,
      stagedZone: null,
      closed: false,
      frozen: true,
      reducedMotion: false,
    };
    camera.observe(unavailable);
    camera.resize(0, 540);
    camera.resize(940, 0);
    expect(settled).toEqual([]);
    const free = { x: 20, y: 10, width: 900, height: 520 };
    camera.resize(940, 540, free);
    const fitted = camera.target();
    expect(fitted).toEqual(cameraOverview(free));
    expect(camera.mode()).toBe("overview");
    expect(paints.at(-1)?.duration).toBe(0);
    for (const id of ZONE_IDS) {
      const pad = ZONE_BY_ID[id].pad;
      for (const [x, y] of [
        [pad.x, pad.y],
        [pad.x + pad.width, pad.y],
        [pad.x, pad.y + pad.depth],
        [pad.x + pad.width, pad.y + pad.depth],
      ]) {
        const point = project(x, y, BOARD.pad.raise);
        const screenX = fitted.x + (point.x - BOARD.bounds.x) * fitted.scale;
        const screenY = fitted.y + (point.y - BOARD.bounds.y) * fitted.scale;
        expect(screenX).toBeGreaterThanOrEqual(free.x);
        expect(screenX).toBeLessThanOrEqual(free.x + free.width);
        expect(screenY).toBeGreaterThanOrEqual(free.y);
        expect(screenY).toBeLessThanOrEqual(free.y + free.height);
      }
    }
    const count = paints.length;
    camera.resize(390, 300);
    camera.observe({ ...unavailable, nowMs: 100, stagedZone: "ship" });
    camera.beginDrag();
    camera.pan(100, 100);
    camera.zoom(-200);
    camera.inspect("ship");
    vi.advanceTimersByTime(1000);
    expect(camera.target()).toEqual(fitted);
    expect(paints).toHaveLength(count);
    expect(settled).toEqual([]);
    camera.observe({
      ...unavailable,
      nowMs: 1100,
      frozen: false,
      rowAgeMs: 0,
      stagedZone: "build",
    });
    expect(camera.mode()).toBe("follow");
    vi.advanceTimersByTime(900);
    expect(settled).toHaveLength(1);
    camera.dispose();
  });
  it("captures an in-flight pose once for a drag and holds Follow for5s after its last pan", () => {
    const f = fixture();
    f.observe({ stagedZone: "explore" });
    f.computed({ x: 23, y: -40, scale: 0.9 });
    f.camera.beginDrag();
    f.camera.pan(30, 20);
    expect(f.captures()).toBe(1);
    expect(f.camera.target()).toEqual({ x: 53, y: -20, scale: 0.9 });
    f.at(100);
    f.observe({ stagedZone: "build" });
    expect(f.camera.target()).toEqual({ x: 53, y: -20, scale: 0.9 });
    f.camera.endDrag();
    f.at(5099);
    f.observe({ stagedZone: "build" });
    expect(f.camera.target()).toEqual({ x: 53, y: -20, scale: 0.9 });
    f.at(5100);
    f.observe({ stagedZone: "build" });
    expect(f.camera.target()).toEqual(
      cameraFollowPose("build", 1000, rectangle),
    );
    expect(f.paints.at(-1)?.duration).toBe(900);
  });
  it("allows a manual2.2× wheel shot around the free centre and preserves a wider Follow before zoomingout", () => {
    const f = fixture();
    f.observe();
    f.camera.overview();
    f.camera.zoom(-1_000_000);
    expect(f.camera.scale() / cameraOverview(rectangle).scale).toBeCloseTo(2.2);
    const centre = {
      x: rectangle.x + rectangle.width / 2,
      y: rectangle.y + rectangle.height / 2,
    };
    const current = f.camera.target();
    expect((centre.x - current.x) / current.scale).toBeCloseTo(
      BOARD.bounds.width / 2,
    );
    f.camera.zoom(1_000_000);
    expect(f.camera.scale() / cameraOverview(rectangle).scale).toBeCloseTo(1);
  });
  it("publishes the actual held pose after a drag release even when the owner never pans", () => {
    const f = fixture();
    f.observe({ stagedZone: "build" });
    f.settled.length = 0;
    f.computed({ x: 12, y: -8, scale: 0.85 });
    f.camera.beginDrag();
    expect(f.camera.settling()).toBe(false);
    f.camera.endDrag();
    expect(f.settled).toHaveLength(1);
    expect(f.settled[0].pose).toEqual({ x: 12, y: -8, scale: 0.85 });
    vi.advanceTimersByTime(900);
    expect(f.settled).toHaveLength(1);
  });
  it("cuts for reducedmotion, including a preference change during an activeease", () => {
    const f = fixture();
    f.observe({ stagedZone: "build" });
    expect(vi.getTimerCount()).toBe(1);
    f.observe({ stagedZone: "build", reducedMotion: true });
    expect(f.paints.at(-1)?.duration).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    f.observe({ stagedZone: "verify", reducedMotion: true });
    expect(f.paints.at(-1)?.duration).toBe(0);
    expect(f.captures()).toBe(0);
  });
  it("freezes the actual mid-ease pose once onLinkDown/SignalLost and cancels the unsettled bake callback", () => {
    const f = fixture();
    f.observe({ stagedZone: "build" });
    f.settled.length = 0;
    f.computed({ x: 12, y: -8, scale: 0.85 });
    f.observe({ stagedZone: "build", frozen: true });
    const count = f.paints.length;
    f.observe({ frozen: true });
    f.camera.pan(100, 100);
    f.camera.zoom(-100);
    f.camera.inspect("ship");
    vi.advanceTimersByTime(1000);
    expect(f.camera.target()).toEqual({ x: 12, y: -8, scale: 0.85 });
    expect(f.paints).toHaveLength(count);
    expect(f.captures()).toBe(1);
    expect(f.settled).toEqual([]);
    expect(f.camera.settling()).toBe(false);
    f.observe({ stagedZone: "bench" });
    expect(f.camera.mode()).toBe("follow");
    expect(f.paints.at(-1)?.duration).toBe(900);
  });
  it("emits one settlement after900ms without rewriting poses or metadata on unchanged factualticks", () => {
    const f = fixture();
    f.settled.length = 0;
    f.observe({ stagedZone: "build" });
    const paints = f.paints.length,
      changes = f.changes.length;
    for (let tick = 1; tick <= 8; tick++) {
      f.at(tick * 100);
      f.observe();
    }
    expect(f.paints).toHaveLength(paints);
    expect(f.changes).toHaveLength(changes);
    expect(vi.getTimerCount()).toBe(1);
    expect(f.camera.settling()).toBe(true);
    vi.advanceTimersByTime(899);
    expect(f.settled).toEqual([]);
    expect(f.camera.settling()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(f.camera.settling()).toBe(false);
    expect(f.settled).toHaveLength(1);
    expect(f.settled[0]).toMatchObject({
      mode: "follow",
      zone: "build",
      bucket: 2.2,
    });
    f.observe({ stagedZone: "verify" });
    f.camera.dispose();
    const disposed = f.paints.length;
    vi.advanceTimersByTime(1000);
    f.observe({ stagedZone: "ship" });
    f.camera.resize(390, 300);
    expect(f.paints).toHaveLength(disposed);
    expect(f.settled).toHaveLength(1);
  });
  it("reads browser2d/3d matrices without accepting unknown or nonfinite transforms", () => {
    expect(parseCameraTransform("matrix(0.8, 0, 0, 0.8, 12, -7)")).toEqual({
      x: 12,
      y: -7,
      scale: 0.8,
    });
    expect(
      parseCameraTransform("matrix3d(1.5,0,0,0,0,1.5,0,0,0,0,1,0,23,45,0,1)"),
    ).toEqual({ x: 23, y: 45, scale: 1.5 });
    for (const bad of [
      "none",
      "matrix(NaN,0,0,1,0,0)",
      "matrix(1,0)",
      "matrix(0,0,0,0,0,0)",
    ])
      expect(parseCameraTransform(bad)).toBeNull();
    expect([0, 1.24, 1.25, 1.84, 1.86, 99].map(cameraZoomBucket)).toEqual([
      1, 1, 1.5, 1.5, 2.2, 2.2,
    ]);
  });
});
