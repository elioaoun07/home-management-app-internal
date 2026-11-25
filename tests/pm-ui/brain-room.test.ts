import { describe, expect, it } from "vitest";
import { Box3, Group, Mesh, Vector3 } from "three";
import { CAMPAIGNS } from "../../scripts/pm/lint.mjs";
import { bays, canStand, stations } from "../../scripts/pm/app/brain/layout";
import { roomLighting } from "../../scripts/pm/app/brain/lighting";
import { campaigns, deliveryTopic, isModuleTopic, topics, type Topic } from "../../scripts/pm/app/brain/topics";
import { makeSphere } from "../../scripts/pm/app/brain/topicSphere";
import { FACES } from "../../src/features/era/faceRegistry";
import { answerQuestion, signalFor } from "../../scripts/pm/app/brain/questions";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { liveness } from "../../scripts/pm/app/localRunLiveness";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { ZONE_IDS } from "../../scripts/pm/app/stage/config";
import { zoneEvidence } from "../../scripts/pm/app/stage/zoneModel";

const at = "2026-11-21T09:24:15.512Z";
const now = Date.parse(at);
function run(phase: string, rows: string[]): LocalRunView {
  return {
    run_id: "local-fixture", phase, workspace: "", branch: "", head: null, current_head: null,
    canShip: false, canUndo: false, interrupted: false, checks: [], usage: null, handover: null,
    work: { id: "TRIP-33", title: "Trip", brief: "## Phase 1: Attach document" },
    activity: rows.map((summary, seq) => ({ summary, seq, at, job_id: "job", kind: summary.startsWith("src") ? "edit" : "status" })),
  };
}

describe("3D delivery", () => {
  it("covers the campaign registry, retains inherited topic identity and allows explicit refinements", () => {
    expect(Object.fromEntries(Object.entries(campaigns).map(([name, [prefix]]) => [name, prefix]))).toEqual(CAMPAIGNS);
    expect(Object.keys(topics)).toHaveLength(16);
    expect(deliveryTopic({ id: "R131" })).toBe("tooling");
    expect(deliveryTopic({ id: "SCH-4.3b" })).toBe("schedule");
    expect(deliveryTopic({ id: "TRIP-33", campaign: "Trips" })).toBe("trip");
    expect(deliveryTopic({ id: "TRIP-33", campaign: "Budget" })).toBe("general");
    expect(deliveryTopic({ id: "KIT-10", campaign: "Kitchen", topic: "meal" })).toBe("meal");
    expect(deliveryTopic({ id: "BUD-1", topic: " Expense " })).toBe("financial");
    expect(deliveryTopic({ id: "BUD-1", topic: "unregistered" })).toBe("general");
    for (const face of FACES) {
      expect(deliveryTopic({ id: "R131", topic: face.key })).toBe(face.eraModuleKey);
      expect(isModuleTopic(face.eraModuleKey)).toBe(true);
    }
  });
  it("keeps each authored mark full-sized, dimensional and present at rest, during work and inside ERA", () => {
    const shapes = new Set<string>();
    for (const topic of Object.keys(topics) as Topic[]) {
      const sphere = makeSphere(topic,false);
      const cue = sphere.orb.children.find(child => child instanceof Group)!;
      if (topic === "general") {
        expect(cue.children).toHaveLength(0);
        continue;
      }
      expect(cue.children.length,topic).toBeLessThanOrEqual(3);
      const meshes = cue.children as Mesh[];
      const size = new Box3().setFromObject(cue).getSize(new Vector3());
      expect(Math.max(size.x,size.y), topic).toBeGreaterThan(1.35);
      expect(size.z,topic).toBeGreaterThan(.15);
      shapes.add(meshes.map(mesh => mesh.geometry.getAttribute("position").count).join("/") + size.toArray().join("/"));
      for (const inner of [false,true]) {
        sphere.paint(.84,.6,2.5,inner);
        expect(cue.visible, topic).toBe(true);
        expect(new Box3().setFromObject(cue).getSize(new Vector3()).length(), topic).toBeGreaterThan(inner ? .75 : 1.9);
      }
    }
    expect(shapes.size).toBe(Object.keys(topics).length-1);
  });
  it("keeps every station arrival traversable and the core well solid", () => {
    expect(bays.map(bay => bay.name)).toEqual(["Plan", "Setup", "Build", "Verify", "Test", "Ship"]);
    expect(stations.map(s => s.id).sort()).toEqual([...ZONE_IDS].sort());
    for (const station of stations) {
      expect(canStand(station.arrival, "room"), station.id).toBe(true);
      expect(canStand(station, "room"), station.id).toBe(false);
    }
    expect(canStand({ x: 0, z: 0 }, "room")).toBe(false);
    expect(canStand({ x: 0, z: 11.5 }, "room")).toBe(false);
    expect(canStand({ x: 0, z: 3.3 }, "core")).toBe(true);
  });
  it("answers the cancelled run without exposing its outcome at an earlier equal-time row", () => {
    const fixture = run("cancelled", ["Installing dependencies", "cancelled"]);
    const timeline = buildTimeline(fixture), health = liveness(fixture, now, {});
    const context = { zone: "setup" as const, row: null };
    const terminal = answerQuestion("wrong", context, sceneAt(timeline, now), health, false, false);
    expect(terminal.text).toContain("Installing dependencies");
    expect(terminal.text).toContain("no reason");
    expect(terminal.evidence.map(item => item.row?.id)).toEqual(["job:0","job:1"]);
    const early = sceneAt(timeline, now, "job:0");
    expect(answerQuestion("wrong", context, early, health, true, false).text).not.toMatch(/cancelled/i);
    expect(answerQuestion("milestone", context, early, health, true, false).text).toContain("Completion unconfirmed");
  });
  it("separates an edit, a host check start, and a returned check at the same time", () => {
    const fixture = run("checking", ["src/edit.ts", "Host checks started", "test: 0"]);
    fixture.checks = [{ name: "test", exit: 0, stdout: "12 passed", stderr: "", error: null, finished_at: at }];
    const timeline = buildTimeline(fixture), health = liveness(fixture, now, {});
    const editing = sceneAt(timeline, now, "job:0"), starting = sceneAt(timeline, now, "job:1"), done = sceneAt(timeline, now, "job:2");
    expect(signalFor(editing)?.kind).toBe("edit");
    expect(signalFor(starting)?.kind).toBe("start-check");
    expect(signalFor(done)?.result).toBe("passed");
    const context = { zone: "verify" as const, row: null };
    expect(answerQuestion("checks", context, starting, health, true, false).text).not.toMatch(/passed/i);
    expect(answerQuestion("checks", context, done, health, true, false).text).toMatch(/passed/i);
  });
  it("powers exact substation endpoints and masks unreturned check results", () => {
    const fixture = run("checking", ["Installing dependencies", "Native session started", "src/edit.ts", "pnpm typecheck", "Host checks started", "test: 0"]);
    fixture.activity[3].kind = "command";
    fixture.checks = [{ name: "test", exit: 0, stdout: "", stderr: "", error: null, finished_at: at }];
    const timeline = buildTimeline(fixture);
    const lightsAt = (row: number) => {
      const scene = sceneAt(timeline, now, `job:${row}`);
      return roomLighting(scene, zoneEvidence(scene), liveness(scene.run, now), false);
    };
    expect(lightsAt(0)).toMatchObject({ endpoint: "setup", energy: .37, marks: { setup: "reached" } });
    expect(lightsAt(2)).toMatchObject({ endpoint: "build", energy: 1, marks: { build: "reached" } });
    expect(lightsAt(3).endpoint).toBe("bench");
    expect(lightsAt(4)).toMatchObject({ endpoint: "verify", checks: [null, null, null, null] });
    expect(lightsAt(5).checks).toContain("passed");
    expect(lightsAt(5).marks.ship).toBeUndefined();
  });
  it("settles quiet, lost and stopped work and keeps owner questions distinct from handoff", () => {
    const fixture = run("building", ["src/edit.ts"]);
    const scene = sceneAt(buildTimeline(fixture), now);
    const zones = zoneEvidence(scene);
    const live = liveness(scene.run, now);
    expect(roomLighting(scene, zones, liveness(scene.run, now + 94_000), false)).toMatchObject({
      endpoint: null, marks: { build: "reached" }, working: false,
    });
    expect(roomLighting(scene, zones, liveness(scene.run, now, { isError: true }), false).endpoint).toBeNull();
    expect(roomLighting(scene, zones, { ...live, state: "your-turn", active: false }, true)).toMatchObject({ endpoint: "seat", owner: true });
    const ready = run("uat-ready", ["Ready for owner UAT"]);
    for (const [canMerge, endpoint] of [[false, "test"], [true, "ship"]] as const) {
      ready.canMerge = canMerge;
      const handoff = sceneAt(buildTimeline(ready), now);
      expect(roomLighting(handoff, zoneEvidence(handoff), liveness(handoff.run, now), false))
        .toMatchObject({ endpoint, owner: true, marks: { handover: "reached" } });
    }
    for (const phase of ["accepting", "acceptance-paused", "refreshing", "refresh-failed"]) {
      const verify = sceneAt(buildTimeline(run(phase, ["Host checks started"])), now);
      expect(roomLighting(verify, zoneEvidence(verify), liveness(verify.run, now), false).endpoint).toBe("verify");
    }
    const cancelled = sceneAt(buildTimeline(run("cancelled", ["Installing dependencies"])), now);
    expect(roomLighting(cancelled, zoneEvidence(cancelled), liveness(cancelled.run, now), false)).toMatchObject({
      endpoint: null, marks: { setup: "reached" }, working: false, failed: false, faultZone: null,
    });
  });
  it("powers down and breaks only the recorded lead at the failed frame", () => {
    for (const [code, zone] of [["install", "setup"], ["native-error", "build"], ["commit-hook", "seal"],
      ["checks", "verify"], ["handover", "handover"]] as const) {
      const fixture = run("failed", ["Installing dependencies", "src/edit.ts", "Native session failed"]);
      fixture.failure = { code, step: zone, detail: "Fixture failure" };
      const timeline = buildTimeline(fixture);
      for (const cursor of [undefined, "job:0", undefined]) {
        const scene = sceneAt(timeline, now, cursor);
        const light = roomLighting(scene, zoneEvidence(scene), liveness(scene.run, now), false);
        if (cursor) expect(light).toMatchObject({ failed: false, faultZone: null });
        else expect(light).toMatchObject({ failed: true, faultZone: zone, endpoint: null, energy: 0, working: false });
      }
    }
    const unknown = sceneAt(buildTimeline(run("failed", ["src/edit.ts"])), now);
    expect(roomLighting(unknown, zoneEvidence(unknown), liveness(unknown.run, now), false))
      .toMatchObject({ failed: true, faultZone: null });
  });
});
