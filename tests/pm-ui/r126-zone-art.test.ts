import { describe, expect, it } from "vitest";
import { ART, MACHINE_PARTS, ZONE_IDS, type ZoneId } from "../../scripts/pm/app/stage/config";
import { LOCAL_CHECKS } from "../../scripts/pm/app/localRunModel";
import { ZONE_ART } from "../../scripts/pm/app/stage/board";
import { stagePaletteFromColors } from "../../scripts/pm/app/stage/palette";
import { machineEvidence } from "../../scripts/pm/app/stage/machineEvidence";
import { beatAt, planBeats } from "../../scripts/pm/app/stage/director";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { zoneEvidence } from "../../scripts/pm/app/stage/zoneModel";
import type { ZoneRenderState } from "../../scripts/pm/app/stage/types";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { boardRun, epoch, row, handover } from "./local-board-fixtures";

const palette = stagePaletteFromColors([20, 30, 40, 1], [70, 180, 255, 1], [240, 245, 250, 1],
  [140, 150, 160, 1], [50, 60, 70, 1], [5, 10, 20, 1], [251, 191, 36, 1]);
const image = { width: 512, height: 440 } as HTMLCanvasElement;
const glow = { width: 48, height: 48 } as HTMLCanvasElement;
function context() {
  const calls: unknown[][] = [];
  const record = (name: string) => (...args: unknown[]) => calls.push([name, ctx.globalAlpha, ctx.fillStyle, ...args]);
  const ctx = { fillStyle: "", globalAlpha: 1, globalCompositeOperation: "source-over",
    fill: record("fill"), fillRect: record("fillRect"), beginPath: record("beginPath"),
    moveTo: record("moveTo"), lineTo: record("lineTo"), closePath: record("closePath"),
    arc: record("arc"), ellipse: record("ellipse"), drawImage: record("image"),
    save: record("save"), restore: record("restore"), translate: record("translate"),
    stroke: () => { throw new Error("A solid was stroked"); },
    createLinearGradient: () => { throw new Error("Gradient in zone art"); },
    createRadialGradient: () => { throw new Error("Gradient in zone art"); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
function art(zone: ZoneId, kind = "status", summary = "Installing dependencies", progress = 0.2,
  changes: Partial<LocalRunView> = {}): ZoneRenderState {
  const run = boardRun({ activity: [row(0, kind, summary)], ...changes });
  const timeline = buildTimeline(run), snapshot = sceneAt(timeline, timeline.end ?? epoch);
  const [planned] = planBeats(timeline.events, [], { startAt: 0, policy: "full" });
  const work = planned?.stages.find(stage => stage.stage === "work");
  const beat = planned && work ? beatAt(planned, work.startAt + progress * (work.endAt - work.startAt)) : null;
  const facts = { snapshot, state: "live", zones: zoneEvidence(snapshot, beat).zones };
  return { zone, palette, facts, evidence: machineEvidence(facts),
    frame: { beat, elapsed: progress, vitality: 1, heat: 0.5, tempo: 1 },
    part: { image, x: -128, y: -160, width: 256, height: 220 }, glow };
}
function draw(value: ZoneRenderState) {
  const probe = context();
  ZONE_ART[value.zone].motion(probe.ctx, value);
  return probe.calls;
}
const drivers: readonly [ZoneId, string, string][] = [
  ["brief", "status", "Run created"], ["setup", "status", "Installing dependencies"],
  ["explore", "command", "cat src/recorded.ts"], ["think", "message", "Recorded message"],
  ["build", "edit", "src/recorded.ts"], ["bench", "command", "echo recorded"],
  ["seal", "status", "Committing candidate"], ["verify", "status", "typecheck started"],
  ["handover", "status", "Freezing handover"],
];

describe("R126 cached zone assemblies", () => {
  it.each(ZONE_IDS)("bakes a complete fill-only body and neutral part for %s", zone => {
    const probe = context(), value = { zone, palette };
    ZONE_ART[zone].bake(probe.ctx, value);
    expect(probe.calls.some(call => call[0] === "fill")).toBe(true);
    expect(MACHINE_PARTS[zone].length).toBeLessThanOrEqual(12);
    probe.calls.length = 0;
    ZONE_ART[zone].bakePart?.(probe.ctx, value);
    expect(probe.calls.filter(call => call[0] === "fill").length).toBeGreaterThan(0);
    const body = context();
    ZONE_ART[zone].bake(body.ctx, value);
    const group = zone === "brief" || zone === "setup" ? "setup" : zone === "verify" ? "verify" :
      zone === "handover" || zone === "test" ? "test" : zone === "ship" ? "ship" : "build";
    expect([...body.calls, ...probe.calls].some(call => call[0] === "fill" && call[2] === palette.zones[group].top)).toBe(true);
  });
  it.each(drivers)("moves %s only for its recorded %s row", (zone, kind, summary) => {
    expect(draw(art(zone, kind, summary, 0.2))).not.toEqual(draw(art(zone, kind, summary, 0.6)));
    const a = art(zone, "message", summary, 0.2), b = art(zone, "message", summary, 0.6);
    if (zone !== "think") expect(draw(a)).toEqual(draw(b));
  });
  it("paints the complete emissive orb in front of the ring's opaque inner face", () => {
    const probe = context();
    ZONE_ART.think.bakePart?.(probe.ctx, { zone: "think", palette });
    const fills = probe.calls.filter(call => call[0] === "fill").map(call => call[2]);
    expect(fills.slice(-3)).toEqual([palette.zones.build.right, palette.zones.build.left, palette.zones.build.top]);
    expect(fills.lastIndexOf(palette.trim.right)).toBeLessThan(fills.indexOf(palette.zones.build.right));
  });
  it.each(ZONE_IDS)("holds %s still after closure, lost connection and reduced motion", zone => {
    const driver = drivers.find(value => value[0] === zone) ?? [zone, "status", "Installing dependencies"];
    const first = art(zone, driver[1], driver[2], 0.2), second = art(zone, driver[1], driver[2], 0.6);
    for (const phase of ["failed", "cancelled", "shipped", "reverted"]) {
      const stopped = (value: ZoneRenderState) => ({ ...value, facts: { ...value.facts,
        snapshot: { ...value.facts.snapshot, phase } } });
      expect(draw(stopped(first))).toEqual(draw(stopped(second)));
    }
    for (const state of ["link-down", "signal-lost"])
      expect(draw({ ...first, facts: { ...first.facts, state } })).toEqual(draw({ ...second, facts: { ...second.facts, state } }));
    expect(draw({ ...first, frame: { ...first.frame, reducedMotion: true } })).toEqual(draw({ ...second, frame: { ...second.frame, reducedMotion: true } }));
  });
  it("continues the actual running check scanner after staging and stops at its exit", () => {
    const first = art("verify", "status", "typecheck started", 0.1, { phase: "checking" });
    const later = { ...first, frame: { ...first.frame, beat: null, elapsed: 0.6 } };
    expect(first.evidence?.runningCheck).toBe(0);
    expect(draw({ ...first, frame: { ...first.frame, beat: null } })).not.toEqual(draw(later));
    const ended = art("verify", "status", "typecheck: 0", 0.1, { phase: "checking",
      activity: [row(0, "status", "typecheck started"), row(1, "status", "typecheck: 0")] });
    expect(ended.evidence?.runningCheck).toBeNull();
    expect(draw(ended)).toEqual(draw({ ...ended, frame: { ...ended.frame, elapsed: 9 } }));
  });
  it.each(LOCAL_CHECKS)("aligns the cached scanner with the projected %s arch", name => {
    const index = LOCAL_CHECKS.indexOf(name), value = art("verify", "status", `${name} started`, 0);
    const dx = ART.verify.xs[index] - ART.verify.xs[2], imageCall = draw(value).find(call => call[0] === "image")!;
    expect(value.evidence?.runningCheck).toBe(index);
    expect(imageCall[4]).toBe(-128 + dx);
    expect(imageCall[5]).toBe(-160 + dx / 2);
    const next = draw({ ...value, frame: { ...value.frame, elapsed: 0.5 } }).find(call => call[0] === "image")!;
    expect(next[5]).toBe(-160 + dx / 2 + ART.details.verify.sweep / 2);
  });
  it("breathes the amber desk lamp only on the actual owner's turn", () => {
    const value = art("test", "status", "Ready for owner UAT", 0.1, { phase: "uat-ready" });
    value.facts.attention = [{ id: "test", zone: "test", kind: "test", level: "act", state: "open" }];
    expect(draw(value)).not.toEqual(draw({ ...value, frame: { ...value.frame, elapsed: 0.6 } }));
    const legacy = { ...value, facts: { ...value.facts, attention: [] } };
    expect(draw(legacy)).not.toEqual(draw({ ...legacy, frame: { ...legacy.frame, elapsed: 0.6 } }));
    const done = { ...value, facts: { ...value.facts, snapshot: { ...value.facts.snapshot, phase: "merging" } } };
    expect(draw(done)).toEqual(draw({ ...done, frame: { ...done.frame, elapsed: 0.6 } }));
  });
  it("retains four Verify arches and no future declared-check policy", () => {
    expect(ART.verify.xs).toHaveLength(4);
  });
  it("keeps data on the three cached display parts and lights only recorded hook lamps", () => {
    for (const zone of ["brief", "bench", "handover"] as const)
      expect(ZONE_ART[zone].stateOnPart).toBe(true);
    const value = art("seal", "status", "Hook: docs", 0.2, { activity: [
      row(0, "status", "Hook: docs"), row(1, "status", "Hook: tests")] });
    const probe = context();
    ZONE_ART.seal.state(probe.ctx, value);
    expect(probe.calls.filter(call => call[0] === "fillRect").map(call => call[2])).toEqual([
      palette.zones.build.top, palette.trim.right, palette.trim.right,
      palette.trim.right, palette.zones.build.top, palette.trim.right,
    ]);
  });
  it("seals the lectern document only after a real handover ID exists", () => {
    const absent = art("handover", "status", "Ready for owner UAT"), a = context();
    ZONE_ART.handover.state(a.ctx, absent);
    expect(a.calls).toHaveLength(0);
    const present = art("handover", "status", "Ready for owner UAT", 0.2, { handover: handover() }), b = context();
    ZONE_ART.handover.state(b.ctx, present);
    expect(b.calls.filter(call => call[0] === "fillRect")).toHaveLength(1);
  });
  it("lowers three cached cargo regions in sequence, keeping the other crates fixed", () => {
    const before = draw(art("setup", "status", "Installing dependencies", 0.2)),
      after = draw(art("setup", "status", "Installing dependencies", 0.6));
    const beforeCrates = before.filter(call => call[0] === "image" && call.length === 12),
      afterCrates = after.filter(call => call[0] === "image" && call.length === 12);
    expect(beforeCrates).toHaveLength(3);
    expect(afterCrates).toHaveLength(3);
    expect(beforeCrates[0]).not.toEqual(afterCrates[0]);
    expect(beforeCrates[2]).toEqual(afterCrates[2]);
  });
  it("opens a drawer for an observed pathless search without inventing a path", () => {
    const a = art("explore", "command", "rg recorded src", 0.2),
      b = art("explore", "command", "rg recorded src", 0.6);
    expect(a.frame.beat?.event.kind).toBe("read");
    expect(a.frame.beat?.event.paths).toEqual([]);
    expect(draw(a)).not.toEqual(draw(b));
    expect(a.facts.snapshot.counts.reads).toBe(1);
    expect(a.facts.snapshot.nodes.every(node => node.path === null)).toBe(true);
  });
  it("uses cached images exclusively in every zone motion path", () => {
    for (const [zone, kind, summary] of drivers)
      expect(draw(art(zone, kind, summary)).every(call => call[0] === "image")).toBe(true);
  });
  it("keeps legacy completed Setup fully reached while untyped installation text stays mechanically neutral", () => {
    const changes = { activity: [
      { at: row(0, "status", "").at, summary: "Installing dependencies" },
      { at: row(1, "status", "").at, summary: "Native session started" },
    ] };
    const a = art("setup", "status", "Installing dependencies", 0.2, changes),
      b = art("setup", "status", "Installing dependencies", 0.6, changes);
    expect(a.evidence?.reached.setup).toBe(true);
    expect(a.evidence?.supervisorIds.size).toBe(0);
    expect(draw(a)).toEqual(draw(b));
    expect(draw(a)).toHaveLength(1);
  });
  it("reads no scene events in a motion callback after evidence was projected", () => {
    for (const [zone, kind, summary] of drivers) {
      const value = art(zone, kind, summary);
      Object.defineProperty(value.facts.snapshot, "events", { get: () => { throw new Error("Scene scan in RAF"); } });
      expect(() => draw(value)).not.toThrow();
    }
  });
});
