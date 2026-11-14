import { describe, expect, it } from "vitest";
import {
  createCoreDynamics,
  kickCore,
  stepCoreDynamics,
  type CoreDynamics,
} from "../../scripts/pm/app/coreDynamics";
import type { CoreSessionState } from "../../scripts/pm/app/coreState";

function advanceFrames(
  model: CoreDynamics,
  state: CoreSessionState["state"],
  seconds: number,
  fps: number,
) {
  const frames = Math.floor(seconds * fps);
  for (let frame = 0; frame < frames; frame++)
    stepCoreDynamics(model, state, 1 / fps);
  stepCoreDynamics(model, state, seconds - frames / fps);
}

describe("ERA core momentum", () => {
  it("accelerates quickly, then loses speed and heat gradually after release", () => {
    const model = createCoreDynamics();
    kickCore(model);
    stepCoreDynamics(model, "idle", 0.6);
    expect(model.speed).toBeGreaterThan(1300);
    expect(model.energy).toBeGreaterThan(0.97);
    stepCoreDynamics(model, "idle", 1.8);
    expect(model.throttleRemaining).toBe(0);
    const samples = [{ ...model }];
    for (let i = 0; i < 8; i++) {
      stepCoreDynamics(model, "idle", 0.5);
      samples.push({ ...model });
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].speed).toBeLessThan(samples[i - 1].speed);
      expect(samples[i].speed).toBeGreaterThan(22.5);
      expect(samples[i].energy).toBeLessThan(samples[i - 1].energy);
      expect(samples[i].angle).toBeGreaterThan(samples[i - 1].angle);
    }
    expect(samples[1].speed).toBeGreaterThan(800);
    expect(model.speed).toBeLessThan(60);
    expect(model.energy).toBeLessThan(0.01);
  });

  it("preserves phase and speed when clicked again during a coast", () => {
    const model = createCoreDynamics();
    kickCore(model);
    stepCoreDynamics(model, "idle", 3.2);
    const released = { ...model };
    kickCore(model);
    expect(model).toEqual({ ...released, throttleRemaining: 2.4 });
    stepCoreDynamics(model, "idle", 1 / 60);
    expect(model.angle).toBeGreaterThan(released.angle);
    expect(model.angle - released.angle).toBeLessThan(20);
    expect(model.speed).toBeGreaterThan(released.speed);
    expect(model.energy).toBeGreaterThan(released.energy);
  });

  it("travels the same distance at 30, 60 and 120 Hz, including mid-frame release", () => {
    const reference = createCoreDynamics();
    kickCore(reference);
    stepCoreDynamics(reference, "idle", 6.137);
    for (const fps of [30, 60, 120]) {
      const model = createCoreDynamics();
      kickCore(model);
      advanceFrames(model, "idle", 6.137, fps);
      expect(model.angle).toBeCloseTo(reference.angle, 8);
      expect(model.speed).toBeCloseTo(reference.speed, 8);
      expect(model.energy).toBeCloseTo(reference.energy, 8);
      expect(model.elapsed).toBeCloseTo(6.137, 10);
      expect(model.throttleRemaining).toBe(0);
    }
  });

  it("sustains a real running session and coasts to the slower approval state", () => {
    const model = createCoreDynamics();
    stepCoreDynamics(model, "running", 20);
    expect(model.speed).toBeCloseTo(1080, 8);
    expect(model.energy).toBeCloseTo(0.82, 8);
    kickCore(model);
    stepCoreDynamics(model, "running", 10);
    expect(model.speed).toBeGreaterThanOrEqual(1080);
    expect(model.speed).toBeLessThan(1081);
    expect(model.energy).toBeCloseTo(0.82, 3);
    const before = { ...model };
    stepCoreDynamics(model, "attention", 0.1);
    expect(model.speed).toBeLessThan(before.speed);
    expect(model.speed).toBeGreaterThan(900);
    expect(model.angle).toBeGreaterThan(before.angle);
    stepCoreDynamics(model, "attention", 15);
    expect(model.speed).toBeCloseTo(11.25, 2);
    expect(model.energy).toBeLessThan(0.0001);
  });

  it("never drives a failed ring, but allows heat before settling to rest", () => {
    const model = createCoreDynamics();
    stepCoreDynamics(model, "running", 2);
    const before = { ...model };
    kickCore(model);
    stepCoreDynamics(model, "failed", 0.2);
    expect(model.speed).toBeLessThan(before.speed);
    expect(model.energy).toBeGreaterThan(before.energy);
    stepCoreDynamics(model, "failed", 25);
    expect(model.speed).toBeCloseTo(0, 6);
    expect(model.energy).toBeCloseTo(0, 6);
    expect(model.angle).toBeGreaterThan(before.angle);
  });

  it("does not advance paused time or poison momentum with invalid timestamps", () => {
    const model = createCoreDynamics();
    kickCore(model);
    stepCoreDynamics(model, "idle", 1);
    const before = { ...model };
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      stepCoreDynamics(model, "idle", dt);
    expect(model).toEqual(before);
  });
});
