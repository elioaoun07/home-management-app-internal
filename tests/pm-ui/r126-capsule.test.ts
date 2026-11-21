import { describe, expect, it } from "vitest";
import { capsulePoint, CAPSULE_LIFT } from "../../scripts/pm/app/stage/capsulePose";
import { createMotionState } from "../../scripts/pm/app/stage/motion";
import { BOARD, ZONE_BY_ID } from "../../scripts/pm/app/stage/config";
import { project } from "../../scripts/pm/app/stage/iso";
import type { BoardFacts, BoardMotionFrame } from "../../scripts/pm/app/stage/types";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { boardRun, epoch } from "./local-board-fixtures";

const facts = (): BoardFacts => ({ snapshot: sceneAt(buildTimeline(boardRun()), epoch + 1000), state: "live", zones: [], buildZone: "ship" });
const frame = (): BoardMotionFrame => ({ beat: null, vitality: 1, heat: 0, elapsed: 0, tempo: 1 });
describe("the single recorded capsule", () => {
  it.each([["shipped", "launch"], ["reverted", "reverted"]] as const)("lifts on %s only during its recorded %s ceremony", (phase, kind) => {
    const f = facts(), v = frame(), point = { x: 30, y: 90 };
    f.snapshot.phase = phase;
    v.ceremony = { kind, progress: 0.5 };
    expect(capsulePoint(f, v, point)).toEqual({ x: 30, y: 90 - CAPSULE_LIFT });
    for (const progress of [0, 1]) {
      v.ceremony.progress = progress;
      expect(capsulePoint(f, v, point)).toBe(point);
    }
    v.ceremony = undefined;
    expect(capsulePoint(f, v, point)).toBe(point);
  });
  it("never lifts for native narration, preparing/merging/push-pending, unavailable or reduced motion", () => {
    const f = facts(), v = frame(), point = { x: 30, y: 90 };
    v.ceremony = { kind: "launch", progress: 0.5 };
    for (const phase of ["building", "preparing", "merging", "push-pending", "failed"]) {
      f.snapshot.phase = phase;
      expect(capsulePoint(f, v, point)).toBe(point);
    }
    f.snapshot.phase = "shipped";
    v.reducedMotion = true;
    expect(capsulePoint(f, v, point)).toBe(point);
    v.reducedMotion = false;
    for (const state of ["link-down", "signal-lost"]) {
      f.state = state;
      expect(capsulePoint(f, v, point)).toBe(point);
    }
  });
  it("returns from Main toward Ship at the recorded revert position, independent of sampling interval", () => {
    const f = facts(), v = frame(), movement = createMotionState();
    f.atMain = true;
    movement.build(f, v, 0);
    f.atMain = false;
    f.snapshot.phase = "reverted";
    v.ceremony = { kind: "reverted", progress: 0.5 };
    const ship = ZONE_BY_ID.ship.buildStop!;
    expect(movement.build(f, v, 0.001).point).toEqual(project((BOARD.main.x + ship.x) / 2, (BOARD.main.y + ship.y) / 2, 19));
    v.ceremony.progress = 1;
    expect(movement.build(f, v, 0.001).point).toEqual(project(ship.x, ship.y, 19));
  });
});
