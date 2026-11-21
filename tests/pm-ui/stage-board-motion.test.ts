import { describe, expect, it } from "vitest";
import { beatZone } from "../../scripts/pm/app/stage/board";
import { ART, BUDGET, ZONE_IDS } from "../../scripts/pm/app/stage/config";
import {
  buildStop,
  createMotionState,
  needsBoardAnimation,
} from "../../scripts/pm/app/stage/motion";
import { project } from "../../scripts/pm/app/stage/iso";
import { CROSSINGS, createServiceWalk, deckHeight, serviceRoute } from "../../scripts/pm/app/stage/serviceWalk";
import { operatorPose } from "../../scripts/pm/app/stage/renderMotion";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { boardRun, epoch, row } from "./local-board-fixtures";
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
    expect(m.worker(f, v, 0.5)).toEqual(project(78, 108));
    v.beat!.stage = "decide";
    expect(m.worker(f, v, 0.4)).toEqual(project(78, 108));
    v.beat!.stage = "travel";
    m.worker(f, v, .7);
    expect(m.footing.y).toBe(108);
    expect(m.footing.x).toBeGreaterThan(78);
    expect(m.worker(f, v, 3)).toEqual(project(591, 108));
  });
  it("mirrors travel when recorded work returns from Build to Explore", () => {
    const motion = createMotionState(), value = facts(), view = frame();
    motion.worker(value, view, 4);
    expect(motion.workerHeading).toBe(1);
    value.activeZone = "explore";
    const point = motion.worker(value, view, 0.5);
    expect(operatorPose(value, view, motion, point, "live")).toMatchObject({ gesture: "travel", facing: -1 });
  });
  it("snaps the paused operator to the selected read or edit and folds it during quiet", () => {
    const timeline = buildTimeline(boardRun({
      activity: [row(0, "status", "Native session started"), row(1, "command", "Get-Content src/model.ts"), row(1, "edit", "src/model.ts", 2)],
    }));
    const motion = createMotionState(), value = facts(), view = { ...frame(), settled: true };
    value.snapshot = sceneAt(timeline, epoch + 1000, "native:2");
    let point = motion.worker(value, view, 2);
    expect(point).toEqual(project(591, 108));
    expect(operatorPose(value, view, motion, point, "live")).toMatchObject({
      gesture: "edit", facing: 1, static: true, extension: 1,
    });
    value.snapshot = sceneAt(timeline, epoch + 1000, "native:1");
    point = motion.worker(value, view, 2);
    expect(point).toEqual(project(320, 108));
    expect(operatorPose(value, view, motion, point, "live")).toMatchObject({ gesture: "scan", extension: 1 });
    expect(operatorPose(value, view, motion, point, "quiet")).toMatchObject({ gesture: "park", extension: 0 });
    expect(operatorPose(value, view, motion, point, "signallost")).toMatchObject({ gesture: "idle", ghost: true, extension: 0 });
  });
  it("crosses the conveyor only on a raised bridge, including an interrupted crossing", () => {
    for (const start of [{ x: 591, y: 108 }, { x: 384, y: 129 }]) {
      const route = serviceRoute(start, { x: 232, y: 160 });
      for (let distance = 0; distance < route.length; distance++) {
        const point = route.at(distance);
        if (point.y > 122.5 && point.y < 137.5) {
          expect(CROSSINGS).toContain(point.x);
          expect(deckHeight(point)).toBe(5);
        }
      }
    }
  });
  it("plants a sole in the same world position across successive animation frames", () => {
    const w = createServiceWalk(), target = { x: 232, y: 160 };
    let last: { x: number; y: number; lift: number }[] | undefined;
    let frames = 0, planted = 0;
    for (let i = 0; i < 180; i++) {
      const base = w.update(target, 1 / 60, 1, false);
      if (!w.moving) break;
      frames++;
      const soles = w.feet.map(f => ({ ...f, x: f.x + base.x, y: f.y + base.y }));
      expect(soles.some(sole => sole.lift === 0)).toBe(true);
      if (last) for (const [i, foot] of soles.entries()) {
        if (foot.lift !== 0 || last[i].lift !== 0) continue;
        expect(foot.x).toBeCloseTo(last[i].x, 7);
        expect(foot.y).toBeCloseTo(last[i].y, 7);
        planted++;
      }
      last = soles;
    }
    expect(frames).toBeGreaterThan(55);
    expect(planted).toBeGreaterThan(frames * .8);
    expect(w.center).toEqual(target);
    expect(w.feet.map(f => f.lift)).toEqual([0, 0]);
  });
  it("keeps the planted foot when a new recorded action interrupts a swing", () => {
    const w = createServiceWalk(), verify = { x: 636, y: 160 };
    let base = w.update(verify, 0, 1, false);
    for (let n = 0; n < 240 && w.feet[1].lift < 2; n++) base = w.update(verify, 1 / 60, 1, false);
    expect(w.feet[1].lift).toBeGreaterThanOrEqual(2);
    const planted = { x: base.x + w.feet[0].x, y: base.y + w.feet[0].y };
    base = w.update({ x: 78, y: 108 }, 1 / 60, 1, false);
    expect(w.feet[0].lift).toBe(0);
    expect(base.x + w.feet[0].x).toBeCloseTo(planted.x, 7);
    expect(base.y + w.feet[0].y).toBeCloseTo(planted.y, 7);
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
