import { describe, expect, it } from "vitest";
import { machineEvidence, HOOK_STEPS, operational, supervisorWork } from "../../scripts/pm/app/stage/machineEvidence";
import { beatAt, planBeats } from "../../scripts/pm/app/stage/director";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { zoneEvidence } from "../../scripts/pm/app/stage/zoneModel";
import type { BoardFacts, ZoneRenderState } from "../../scripts/pm/app/stage/types";
import { stagePaletteFromColors } from "../../scripts/pm/app/stage/palette";
import { boardRun, epoch, row, handover } from "./local-board-fixtures";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

function facts(run: LocalRunView): BoardFacts {
  const timeline = buildTimeline(run), snapshot = sceneAt(timeline, timeline.end ?? epoch);
  return { snapshot, state: "live", zones: zoneEvidence(snapshot).zones };
}
const evidence = (run: LocalRunView) => machineEvidence(facts(run));

describe("R126 actual machine evidence", () => {
  it("never fills earlier zones from a later phase or a candidate head", () => {
    const value = evidence(boardRun({ phase: "shipped", head: "candidate", activity: [] }));
    expect(value.reached).toMatchObject({ brief: true, ship: true, seal: true,
      setup: false, explore: false, think: false, build: false, bench: false, verify: false, handover: false, test: false });
    expect(value.hooks).toEqual([false, false, false, false, false, false]);
  });
  it("reads each work-zone observation independently, including edits without reads", () => {
    const value = evidence(boardRun({ activity: [row(0, "edit", "src/only-edited.ts"),
      row(1, "command", "echo recorded"), row(2, "message", "Recorded note")] }));
    expect(value.reached).toMatchObject({ explore: false, think: true, build: true, bench: true });
    expect(evidence(boardRun({ activity: [row(0, "command", "cat src/read.ts")] })).reached.explore).toBe(true);
  });
  it.each(["message", "command", "tool", undefined])("does not promote %s milestone text", kind => {
    const activity = ["Installing dependencies", "Native session started", "Committing candidate",
      "Hook: tests", "Freezing handover", "typecheck started"].map((text, index) =>
      ({ ...row(index, "status", text), kind }));
    const value = evidence(boardRun({ activity }));
    expect(value.supervisorIds.size).toBe(0);
    expect(value).toMatchObject({ installStarted: false, nativeStarted: false,
      commitStarted: false, freezeStarted: false, runningCheck: null });
    expect(value.hooks.some(Boolean)).toBe(false);
  });
  it("lights only the hook steps actually recorded, without inferring skipped predecessors", () => {
    const value = evidence(boardRun({ activity: [row(0, "status", "Committing candidate"),
      row(1, "status", "Hook: docs"), row(2, "status", "Hook: tests")] }));
    expect(value.commitStarted).toBe(true);
    expect(value.hooks).toEqual([true, false, false, false, true, false]);
    expect(value.supervisorIds.size).toBe(3);
    const all = evidence(boardRun({ activity: HOOK_STEPS.map((name, index) => row(index, "status", `Hook: ${name}`)) }));
    expect(all.hooks).toEqual([true, true, true, true, true, true]);
  });
  it("distinguishes reached handover from an actual sealed handover ID", () => {
    const ready = evidence(boardRun({ activity: [row(0, "status", "Freezing handover"), row(1, "status", "Ready for owner UAT")] }));
    expect(ready).toMatchObject({ freezeStarted: true, handoverRecorded: false });
    expect(ready.reached.handover).toBe(true);
    expect(evidence(boardRun({ handover: handover() })).handoverRecorded).toBe(true);
  });
  it("requires an explicit check start and stops at the actual exit", () => {
    expect(evidence(boardRun({ phase: "checking", activity: [] })).runningCheck).toBeNull();
    expect(evidence(boardRun({ phase: "checking", activity: [row(0, "command", "pnpm typecheck")] })).runningCheck).toBeNull();
    const start = row(0, "status", "typecheck started");
    expect(evidence(boardRun({ phase: "checking", activity: [start] })).runningCheck).toBe(0);
    expect(evidence(boardRun({ phase: "checking", activity: [start, row(1, "status", "typecheck: 0")] })).runningCheck).toBeNull();
  });
  it("keeps equal-time supervisor and native rows distinct by their stored IDs", () => {
    const value = evidence(boardRun({ activity: [row(0, "message", "Hook: docs", 3), row(0, "status", "Hook: docs", 4)] }));
    expect([...value.supervisorIds]).toEqual(["native:4"]);
  });
  it("preserves approved same-zone legacy done facts without fabricating typed milestones", () => {
    const value = evidence(boardRun({ activity: [
      { at: row(0, "status", "").at, summary: "Native session started" },
      { at: row(1, "status", "").at, summary: "Ready for owner UAT" },
    ] }));
    expect(value.reached).toMatchObject({ setup: true, handover: true, verify: false, seal: false });
    expect(value.supervisorIds.size).toBe(0);
    expect(value.nativeStarted).toBe(false);
    expect(value.handoverRecorded).toBe(false);
    expect(value.hooks).toEqual([false, false, false, false, false, false]);
    const f = facts(boardRun({ activity: [] }));
    f.zones = f.zones.map(zone => zone.id === "think" ? { ...zone, status: "needs-you", done: true } : zone);
    expect(machineEvidence(f).reached.think).toBe(true);
    expect(machineEvidence(f).reached.build).toBe(false);
  });
});

describe("R126 supervisor staging stays in the existing director", () => {
  it.each(["Run created", "Installing dependencies", "Committing candidate", "Hook: docs", "Freezing handover"])(
    "stages recorded %s as an exact observation beat", summary => {
      const f = facts(boardRun({ activity: [row(0, "status", summary)] }));
      const [planned] = planBeats(f.snapshot.events, [], { startAt: 0, policy: "full" });
      expect(planned).toMatchObject({ action: "observation", event: { summary } });
      const interval = planned.stages.find(stage => stage.stage === "work")!;
      const beat = beatAt(planned, (interval.startAt + interval.endAt) / 2);
      const art: ZoneRenderState = { zone: "brief", palette: stagePaletteFromColors(
        [20, 30, 40, 1], [70, 180, 255, 1], [240, 245, 250, 1], [140, 150, 160, 1],
        [50, 60, 70, 1], [5, 10, 20, 1], [251, 191, 36, 1]), facts: f,
        frame: { beat, reducedMotion: false, vitality: 1, heat: 0, elapsed: 0, tempo: 1 }, evidence: machineEvidence(f) };
      expect(supervisorWork(art, summary)?.progress).toBe(0.5);
      expect(supervisorWork(art, "Unrecorded milestone")).toBeNull();
      expect(supervisorWork(art, summary)).toEqual(supervisorWork({ ...art, frame: { ...art.frame, elapsed: 999 } }, summary));
      for (const phase of ["failed", "cancelled", "shipped", "reverted"])
        expect(supervisorWork({ ...art, facts: { ...f, snapshot: { ...f.snapshot, phase } } }, summary)).toBeNull();
      for (const state of ["link-down", "signal-lost"])
        expect(operational({ ...art, facts: { ...f, state } })).toBe(false);
      expect(operational({ ...art, frame: { ...art.frame, reducedMotion: true } })).toBe(false);
    });
});
