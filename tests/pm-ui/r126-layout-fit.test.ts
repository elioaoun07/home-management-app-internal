import { describe, expect, it } from "vitest";
import { freeRectangle } from "../../scripts/pm/app/stage/camera";

describe("mission HUD fit", () => {
  it("keeps dock and desktop rail outside the board's rectangle", () => {
    const actual = freeRectangle(940, 540, [
      { x: 0, y: 596, width: 940, height: 56 },
      { x: 940, y: -44, width: 340, height: 584 },
    ]);
    expect(actual).toEqual({ x: 0, y: 0, width: 940, height: 540 });
  });

  it("reserves a mobile bottom sheet, clipping HUD bounds to the region", () => {
    const actual = freeRectangle(390, 688, [
      { x: -1, y: 520, width: 392, height: 300 },
    ]);
    expect(actual.x).toBeGreaterThanOrEqual(0);
    expect(actual.y).toBeGreaterThanOrEqual(0);
    expect(actual.width).toBe(390);
    expect(actual.y + actual.height).toBeLessThanOrEqual(520);
  });
});
