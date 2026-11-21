import { describe, expect, it } from "vitest";
import { bays, canStand, coreStations, playerRadius, roomPoint, spawn } from "../../scripts/pm/app/brain/layout";
import { advanceGait, advanceWalk, movementKey, restingGait } from "../../scripts/pm/app/brain/navigation";
import { roomRenderBudget } from "../../scripts/pm/app/brain/renderBudget";

function travel(rate: number, forward = 1, side = 0) {
  const pose = { ...spawn, x: 0, z: 7.5, yaw: 0, pitch: 0 };
  const velocity = { x: 0, z: 0 };
  for (let frame = 0; frame < 2 * rate; frame++)
    advanceWalk(pose, velocity, "room", forward, side, 1 / rate);
  return { pose, velocity, distance: Math.hypot(pose.x, pose.z - 7.5) };
}

describe("room navigation", () => {
  it("travels the same distance at 30, 60, and 120 Hz and normalizes diagonals", () => {
    const { distance } = travel(60);
    expect(distance).toBeGreaterThan(4.5);
    for (const hz of [2, 5, 30, 60, 120]) {
      expect(travel(hz).distance).toBeCloseTo(distance, 4);
      expect(travel(hz, 1, 1).distance).toBeCloseTo(distance, 4);
    }
  });

  it("uses a foreground hitch while discarding a suspended tab's elapsed time", () => {
    const pose = { ...spawn }, stepped = { ...spawn };
    const velocity = { x: 0, z: 0 }, comparison = { x: 0, z: 0 };
    advanceWalk(pose, velocity, "room", 1, 0, .12);
    for (let frame = 0; frame < 12; frame++)
      advanceWalk(stepped, comparison, "room", 1, 0, .01);
    expect(pose.z).toBeCloseTo(stepped.z, 6);
    advanceWalk(pose, velocity, "room", 1, 0, 10);
    expect(pose.z).toBeCloseTo(stepped.z, 6);
    expect(velocity).toEqual({ x: 0, z: 0 });
  });

  it("slides along the well and settles after release", () => {
    const pose = { ...spawn, z: 2.52 }, velocity = { x: 0, z: 0 };
    for (let frame = 0; frame < 32; frame++) {
      advanceWalk(pose, velocity, "room", 1, 1, 1 / 60);
      expect(canStand(pose, "room")).toBe(true);
    }
    expect(pose.x).toBeGreaterThan(.65);
    const releaseX = pose.x;
    for (let frame = 0; frame < 30; frame++)
      advanceWalk(pose, velocity, "room", 0, 0, 1 / 60);
    expect(pose.x - releaseX).toBeLessThan(.15);
    expect(velocity).toEqual({ x: 0, z: 0 });
  });

  it("uses physical movement keys across keyboard layouts and tracks both shift keys", () => {
    expect(movementKey("KeyW", "z")).toBe("w");
    expect(movementKey("ShiftLeft", "Shift")).not.toBe(movementKey("ShiftRight", "Shift"));
    expect(movementKey("ArrowLeft", "ArrowLeft")).toBe("arrowleft");
    expect(movementKey("KeyQ", "q")).toBe("");
  });

  it("allows forward sprint and keeps a full player footprint at the well", () => {
    const pose = { ...spawn, x: 0, z: 7.5, yaw: 0 }, velocity = { x: 0, z: 0 };
    for (let i = 0; i < 60; i++) advanceWalk(pose, velocity, "room", 1, 0, 1 / 60, true);
    expect(7.5 - pose.z).toBeGreaterThan(3.7);
    for (let i = 0; i < 60; i++) advanceWalk(pose, velocity, "room", 1, 0, 1 / 60, true);
    expect(pose.z).toBeCloseTo(2.23 + playerRadius, 4);
    expect(velocity.z).toBeCloseTo(0, 6);
    advanceWalk(pose, velocity, "room", -1, 0, .2, true);
    expect(velocity.z).toBeLessThan(2.4);
  });

  it("holds the capsule inside at wall corners, the outer rim, and all four core pedestals", () => {
    for (const bay of bays) {
      for (const offset of [-1, 0, 1]) {
        const degrees = bay.angle + offset * bay.opening * 180 / Math.PI;
        const pose = { ...spawn, ...roomPoint(degrees, 8), yaw: -degrees * Math.PI / 180 };
        const velocity = { x: 0, z: 0 };
        for (let frame = 0; frame < 45; frame++) {
          advanceWalk(pose, velocity, "room", 1, 0, 1 / 30, true);
          expect(canStand(pose, "room"), `${bay.name} offset ${offset} frame ${frame} at (${pose.x}, ${pose.z})`).toBe(true);
        }
      }
    }
    for (const [, x, z] of coreStations) {
      const yaw = Math.atan2(-x, -z);
      const pose = { x: x * .6, z: z * .6, yaw, pitch: 0 };
      const velocity = { x: 0, z: 0 };
      for (let i = 0; i < 60; i++) advanceWalk(pose, velocity, "core", 1, 0, 1 / 30, true);
      expect(canStand(pose, "core")).toBe(true);
      expect(Math.hypot(pose.x - x, pose.z - z)).toBeCloseTo(.24 + playerRadius, 4);
    }
  });

  it("derives stride from traveled distance and returns to eye height at rest", () => {
    const gait = restingGait();
    for (let i = 0; i < 60; i++) advanceGait(gait, 4.15 / 60, 1 / 60);
    expect(gait.sprint).toBeGreaterThan(.99);
    expect(gait.weight).toBeGreaterThan(.99);
    const phase = gait.phase;
    advanceGait(gait, 0, 1 / 60);
    expect(gait.phase).toBe(phase);
    expect(Math.abs(gait.lift)).toBeLessThan(.023);
    for (let i = 0; i < 60; i++) advanceGait(gait, 0, 1 / 60);
    expect(gait).toEqual(restingGait());
  });

  it("keeps small displays sharp and changes resolution only under sustained load or headroom", () => {
    const budget = roomRenderBudget();
    expect(budget.resize(390, 600, 2)).toBe(2);
    expect(budget.sample(180)).toBe(false);
    budget.sample(16.7);
    for (let i = 0; i < 3; i++) budget.sample(90);
    expect(budget.scale).toBeLessThan(2);
    const reduced = budget.scale;
    expect(budget.resize(390, 600, 2)).toBe(reduced);
    for (let i = 0; i < 90; i++) budget.sample(16.7);
    expect(budget.scale).toBe(reduced);
    for (let i = 0; i < 1500; i++) budget.sample(16.7);
    expect(budget.scale).toBe(2);
    const desktop = roomRenderBudget();
    const pixels = 2516 * 1089;
    expect(desktop.resize(2516, 1089, 1)).toBe(1);
    expect(desktop.restingScale).toBe(1);
    for (let i = 0; i < 2000; i++) desktop.sample(16.7);
    expect(desktop.scale).toBe(1);
    desktop.resize(2516, 1089, 2);
    for (let i = 0; i < 2000; i++) desktop.sample(16.7);
    expect(pixels * desktop.scale ** 2).toBeCloseTo(8_300_000, 0);
    const software = roomRenderBudget(true);
    expect(pixels * software.resize(2516, 1089, 1) ** 2).toBeCloseTo(950_000, 0);
    for (let i = 0; i < 220; i++) software.sample(100);
    expect(pixels * software.scale ** 2).toBeCloseTo(950_000, 0);
    expect(software.restingScale).toBe(1);
    const slowDisplay = roomRenderBudget();
    slowDisplay.resize(960, 640, 1);
    for (let i = 0; i < 210; i++) slowDisplay.sample(33.3, 5);
    expect(slowDisplay.scale).toBe(1);
  });
});
