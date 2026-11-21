import { describe, expect, it } from "vitest";
import {
  box,
  cylinder,
  dome,
  hexPrism,
  LINE,
  painterSort,
  project,
  ringBand,
} from "../../scripts/pm/app/stage/iso";
import {
  alpha,
  shade,
  stagePaletteFromColors,
} from "../../scripts/pm/app/stage/palette";
import {
  autoCamera,
  cameraPoint,
  createCamera,
  criticalSpring,
  holdCamera,
  panCamera,
  PARALLAX,
  resetCamera,
  stepCamera,
  zoomCamera,
} from "../../scripts/pm/app/stage/camera";
import { BOARD, ZONE_IDS, ZONES } from "../../scripts/pm/app/stage/config";
import { dutyLeds } from "../../scripts/pm/app/stage/duty";
import type { LocalScene } from "../../scripts/pm/app/localRunScene";

const palette = stagePaletteFromColors(
  [100, 100, 100, 1],
  [40, 120, 240, 1],
  [240, 240, 240, 1],
  [140, 140, 140, 1],
  [90, 90, 90, 1],
  [10, 10, 10, 1],
  [255, 190, 50, 1],
);

describe("Foundry isometric kit", () => {
  it("defines the eleven board zones in delivery order and fixed terraces", () => {
    expect(ZONES.map((zone) => zone.id)).toEqual(ZONE_IDS);
    expect(ZONES.map((zone) => zone.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(ZONES.slice(0, 6).every((zone) => zone.pad.y === 4)).toBe(true);
    expect(ZONES.slice(6).every((zone) => zone.pad.y === 224)).toBe(true);
    expect(BOARD.camera.ceremonyZoom).toBe(1.06);
  });
  it("duty lamps count only recorded machine shares inside two minutes", () => {
    const now = Date.parse("2026-11-15T10:02:00Z");
    const snapshot = {
      at: now,
      events: [
        { station: "source", at: new Date(now - 10000).toISOString() },
        { station: "source", at: new Date(now - 20000).toISOString() },
        { station: "forge", at: new Date(now - 30000).toISOString() },
        { station: "lab", at: new Date(now - 130000).toISOString() },
      ],
    } as LocalScene;
    expect(dutyLeds(snapshot, "source")).toBe(3);
    expect(dutyLeds(snapshot, "forge")).toBe(2);
    expect(dutyLeds(snapshot, "lab")).toBe(0);
  });
  it("projects 2:1 ground axes and a vertical height", () => {
    expect(project(100, 0)).toEqual({ x: 100, y: 50 });
    expect(project(0, 100)).toEqual({ x: -100, y: 50 });
    expect(project(100, 100, 50)).toEqual({ x: 0, y: 50 });
    expect(project(0, 0, 120)).toEqual({ x: 0, y: -120 });
  });

  it("painter-sorts ground depth first, then height, without mutating input", () => {
    const parts = [
      { x: 20, y: 20, z: 0 },
      { x: 10, y: 10, z: 10 },
      { x: 10, y: 10, z: 0 },
    ];
    expect(painterSort(parts)).toEqual([parts[2], parts[1], parts[0]]);
    expect(parts[0]).toEqual({ x: 20, y: 20, z: 0 });
  });

  it("derives light matte hull faces and fixed zone hues from theme colours", () => {
    expect(shade([100, 100, 100, 1], 0.14)).toEqual([121.7, 121.7, 121.7, 1]);
    expect(shade([100, 100, 100, 1], -0.08)).toEqual([92, 92, 92, 1]);
    expect(shade([100, 100, 100, 1], -0.22)).toEqual([78, 78, 78, 1]);
    expect(palette.top).toBe("rgba(181,181,181,1.000)");
    expect(palette.left).toBe("rgba(159,159,159,1.000)");
    expect(palette.right).toBe("rgba(136,136,136,1.000)");
    expect(palette.zones.setup.top).toBe("rgba(129,140,248,1.000)");
    expect(palette).not.toHaveProperty("edge");
    expect(alpha([1, 2, 3, 0.5], 0.4)).toEqual([1, 2, 3, 0.2]);
  });

  it("uses the four specified line weights", () => {
    expect(LINE).toEqual({
      silhouette: 2.5,
      structure: 1.5,
      detail: 1,
      hairline: 0.5,
    });
  });

  it("fills all solids with three tones and never strokes a solid", () => {
    const fills: string[] = [];
    let strokes = 0;
    const ctx = new Proxy(
      { fillStyle: "", globalAlpha: 1 },
      {
        get(target, key) {
          if (key === "fill") return () => fills.push(target.fillStyle);
          if (key === "stroke")
            return () => {
              strokes++;
            };
          return key in target ? target[key as keyof typeof target] : () => {};
        },
        set(target, key, value) {
          (target as Record<PropertyKey, unknown>)[key] = value;
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    const primitives = [
      () => box(ctx, palette, 0, 0, 0, 50, 50, 50),
      () => hexPrism(ctx, palette, 0, 0, 0, 50, 50),
      () => cylinder(ctx, palette, 0, 0, 0, 50, 50),
      () => ringBand(ctx, palette, 0, 0, 0, 50, 35, 10),
      () => dome(ctx, palette, 0, 0, 0, 50, 70),
    ];
    for (const draw of primitives) {
      fills.length = 0;
      draw();
      expect(new Set(fills)).toEqual(
        new Set([palette.top, palette.left, palette.right]),
      );
      expect(strokes).toBe(0);
    }
  });
});

describe("Foundry camera", () => {
  it("settles critically without overshooting and is independent of frame rate", () => {
    const camera = createCamera();
    const target = { x: 100, y: -60, zoom: 1.15 };
    const positions: number[] = [];
    for (let index = 0; index < 120; index++) {
      stepCamera(camera, target, 1 / 60);
      positions.push(camera.x);
    }
    expect(
      positions.every(
        (x, index) => x <= 100 && (index === 0 || x >= positions[index - 1]),
      ),
    ).toBe(true);
    expect(camera.x).toBeGreaterThan(99);
    const oneStep = createCamera();
    stepCamera(oneStep, target, 2);
    expect(camera.x).toBeCloseTo(oneStep.x, 10);
    expect(camera.zoom).toBeCloseTo(oneStep.zoom, 10);
    expect(criticalSpring(2, 3, 20, 0)).toEqual([2, 3]);
  });

  it("holds manual pan and machine focus until auto is requested", () => {
    const camera = createCamera();
    panCamera(camera, 60, -20);
    stepCamera(camera, { x: -100, y: -100, zoom: 1.3 }, 1);
    expect(camera.x).toBe(60);
    expect(camera.y).toBe(-20);
    holdCamera(camera, { x: 80, y: 10, zoom: 1.25 });
    stepCamera(camera, { x: 0, y: 0, zoom: 1 }, 2);
    expect(camera.x).toBeGreaterThan(79);
    autoCamera(camera);
    stepCamera(camera, { x: 0, y: 0, zoom: 1 }, 3);
    expect(camera.x).toBeLessThan(1);
    resetCamera(camera);
    expect(camera.target).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("bounds wheel zoom between one and 1.8", () => {
    const camera = createCamera();
    zoomCamera(camera, -1e6);
    expect(camera.target.zoom).toBe(1.8);
    stepCamera(camera, { x: 0, y: 0, zoom: 1 }, 4);
    expect(camera.zoom).toBeLessThanOrEqual(1.8);
    zoomCamera(camera, 1e6);
    expect(camera.target.zoom).toBe(1);
  });

  it("has five distinct parallax depths and keeps a zoom centre fixed", () => {
    expect(PARALLAX).toEqual([0.05, 0.15, 0.5, 1, 1.3]);
    expect(
      cameraPoint(
        { x: 700, y: 350 },
        { x: 0, y: 0, zoom: 1.8 },
        { x: 700, y: 350 },
      ),
    ).toEqual({ x: 700, y: 350 });
    expect(
      cameraPoint(
        { x: 0, y: 0 },
        { x: 20, y: 10, zoom: 1 },
        { x: 0, y: 0 },
        0.5,
        { x: 10, y: 6 },
      ),
    ).toEqual({ x: 15, y: 8 });
  });
});
