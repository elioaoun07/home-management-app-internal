import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../../scripts/pm/lint.mjs";
import { canStand, stations } from "../../scripts/pm/app/brain/layout";
import { campaigns, deliveryTopic, topics } from "../../scripts/pm/app/brain/topics";
import { answerQuestion, signalFor } from "../../scripts/pm/app/brain/questions";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { liveness } from "../../scripts/pm/app/localRunLiveness";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { ZONE_IDS } from "../../scripts/pm/app/stage/config";

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
  });
  it("keeps every station arrival traversable and the core well solid", () => {
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
});
