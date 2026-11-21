import { describe, expect, it } from "vitest";
import {
  freeRectangle,
  type FreeRectangle,
} from "../../scripts/pm/app/stage/camera";
import { BOARD } from "../../scripts/pm/app/stage/config";

const fit = (rectangle: FreeRectangle) =>
  Math.min(
    rectangle.width / BOARD.bounds.width,
    rectangle.height / BOARD.bounds.height,
  );
const intersects = (a: FreeRectangle, b: FreeRectangle) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

describe("R125 camera free rectangle", () => {
  it("uses the whole region when no HUD is visible", () => {
    expect(freeRectangle(960, 520, [])).toEqual({
      x: 0,
      y: 0,
      width: 960,
      height: 520,
    });
  });

  it.each([
    [940, 400],
    [1018, 456],
    [1154, 694],
    [390, 360],
  ])("keeps the board out of both measured HUD panels at %s × %s", (width, height) => {
    const obstacles = [
      { x: width - 276, y: 16, width: 260, height: 80 },
      { x: 16, y: height - 60, width: Math.min(380, width - 32), height: 44 },
    ];
    const rectangle = freeRectangle(width, height, obstacles);
    expect(rectangle.width).toBeGreaterThan(0);
    expect(rectangle.height).toBeGreaterThan(0);
    expect(rectangle.x).toBeGreaterThanOrEqual(0);
    expect(rectangle.y).toBeGreaterThanOrEqual(0);
    expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(width);
    expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(height);
    for (const obstacle of obstacles)
      expect(intersects(rectangle, obstacle)).toBe(false);
  });

  it("maximizes the board's limiting fit instead of choosing the largest empty area", () => {
    const obstacles = [
      { x: 600, y: 0, width: 400, height: 500 },
      { x: 0, y: 800, width: 300, height: 200 },
    ];
    const rectangle = freeRectangle(1000, 1000, obstacles);
    // This legal lower-right shot fits the wide board better than the larger
    // left-hand empty area (584 × 784). A fit camera must be at least as useful.
    const lowerRight = { x: 316, y: 516, width: 684, height: 484 };
    expect(fit(lowerRight)).toBeGreaterThan(
      fit({ x: 0, y: 0, width: 584, height: 784 }),
    );
    expect(fit(rectangle)).toBeGreaterThanOrEqual(fit(lowerRight));
    for (const obstacle of obstacles)
      expect(intersects(rectangle, obstacle)).toBe(false);
  });

  it("preserves a tiny unobstructed viewport without producing negative dimensions", () => {
    expect(freeRectangle(12, 8, [])).toEqual({
      x: 0,
      y: 0,
      width: 12,
      height: 8,
    });
  });
});
