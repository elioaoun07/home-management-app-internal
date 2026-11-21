import { describe, expect, it } from "vitest";
import { beatZone } from "../../scripts/pm/app/stage/board";
import { ART, BUDGET, ZONE_IDS } from "../../scripts/pm/app/stage/config";
import {
  buildStop,
  createMotionState,
  needsBoardAnimation,
} from "../../scripts/pm/app/stage/motion";
import { project } from "../../scripts/pm/app/stage/iso";
import type {
  BoardFacts,
  BoardMotionFrame,
} from "../../scripts/pm/app/stage/types";
const facts = (): BoardFacts => ({
  snapshot: { phase: "building" } as BoardFacts["snapshot"],
  state: "live",
  zones: ZONE_IDS.map((id) => ({ id, status: "off" })),
  buildZone: "build",
});
const frame = (): BoardMotionFrame => ({
  beat: null,
  vitality: 1,
  heat: 0.5,
  elapsed: 0,
  tempo: 1,
});
describe("solid board choreography", () => {
  it("routes recorded reads/searches/edits/commands/messages to their own work zones", () => {
    const f = facts();
    for (const [action, zone] of [
      ["read", "explore"],
      ["search", "explore"],
      ["edit", "build"],
      ["command", "bench"],
      ["agent-check", "bench"],
      ["message", "think"],
    ]) {
      const m = {
        ...frame(),
        beat: { action, stage: "work" },
      } as BoardMotionFrame;
      expect(beatZone(m, f)).toBe(zone);
      m.beat!.stage = "think";
      expect(beatZone(m, f)).toBe("think");
    }
  });
  it("keeps ERA still during Think/Decide, then travels only along the walkway", () => {
    const m = createMotionState(),
      f = facts(),
      v = {
        ...frame(),
        beat: { action: "edit", stage: "think" },
      } as BoardMotionFrame;
    expect(m.worker(f, v, 0.5)).toEqual(project(104, 160, 7));
    v.beat!.stage = "decide";
    expect(m.worker(f, v, 0.4)).toEqual(project(104, 160, 7));
    v.beat!.stage = "travel";
    expect(m.worker(f, v, 0.7)).toEqual(project(360, 160, 7));
    expect(m.worker(f, v, 0.7)).toEqual(project(616, 160, 7));
  });
  it("carries the build around the belt turn before returning through SEAL", () => {
    const m = createMotionState(),
      f = facts(),
      v = frame();
    expect(m.build(f, v, 0).point).toEqual(project(576, 130, ART.build.standZ));
    f.buildZone = "seal";
    const middle = m.build(f, v, 0.9).point;
    expect(middle).toEqual(project(758, 130, ART.build.standZ));
    expect(m.build(f, v, 0.9).point).toEqual(
      project(704, 190, ART.build.standZ),
    );
    f.buildZone = "verify";
    f.buildGate = 2;
    expect(buildStop(f)).toEqual({ x: 512, y: 190 });
    expect(m.build(f, v, 1.8).point).toEqual(
      project(512, 190, ART.build.standZ),
    );
  });
  it("places the build on the owner's desktop and gives real ceremonies their full duration", () => {
    const m = createMotionState(),
      f = facts(),
      v = frame();
    m.build(f, v, 0);
    f.buildZone = "test";
    v.ceremony = { kind: "handover", progress: 0.5 };
    expect(m.build(f, v, 0.01).moving).toBe(true);
    v.ceremony.progress = 1;
    expect(m.build(f, v, 0.01).point).toEqual(project(192, 266, 37));
  });
  it("stamps a recorded candidate at SEAL before entering the first host hoop", () => {
    const m = createMotionState(),
      f = facts(),
      v = frame();
    m.build(f, v, 0);
    f.buildZone = "verify";
    v.ceremony = { kind: "verify", progress: 0.6 };
    expect(m.build(f, v, 0.01).point).toEqual(
      project(704, 190, ART.build.standZ),
    );
    v.ceremony.progress = 1;
    expect(m.build(f, v, 0.01).point).toEqual(
      project(608, 190, ART.build.standZ),
    );
    f.buildGate = 4;
    expect(buildStop(f)).toEqual({ x: 464, y: 190 });
    f.snapshot.seals = [
      { name: "typecheck", state: "passed", at: 1 },
      { name: "lint", state: "failed", at: 2 },
    ];
    expect(buildStop(f)).toEqual({ x: 560, y: 190 });
  });
  it("sleeps for finished, quiet or unavailable worlds and wakes only for activity", () => {
    const f = facts(),
      v = frame();
    v.vitality = 0.1;
    expect(needsBoardAnimation(f, v)).toBe(false);
    v.vitality = 1;
    expect(needsBoardAnimation(f, v)).toBe(true);
    f.snapshot.phase = "failed";
    expect(needsBoardAnimation(f, v)).toBe(false);
    v.ceremony = { kind: "failure", progress: 0.5 };
    expect(needsBoardAnimation(f, v)).toBe(true);
    for (const state of ["link-down", "signal-lost"]) {
      f.state = state;
      expect(needsBoardAnimation(f, v, true)).toBe(false);
    }
    f.state = "live";
    v.reducedMotion = true;
    expect(needsBoardAnimation(f, v, true)).toBe(false);
  });
  it("reduces only particles and then frame frequency when the rolling cost stays high", () => {
    const m = createMotionState();
    for (let i = 0; i < 30; i++) m.sample(9);
    expect(m.cap).toBe(BUDGET.particles / 2);
    for (let i = 0; i < 30; i++) m.sample(9);
    expect(m.cap).toBe(BUDGET.particles / 2);
    expect([m.drawThisFrame(), m.drawThisFrame()]).toEqual([true, false]);
  });
});
