import { describe, expect, it } from "vitest";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import { roomCassette, roomCheck, roomMoment, roomStepRow, roomZone } from "../../scripts/pm/app/transferRoomModel";
import { createBoardPlayback } from "../../scripts/pm/app/stage/playback";
import { at, boardRun, handover, row } from "./local-board-fixtures";

describe("Transfer Room evidence", () => {
  it("jogs exact equal-time rows and keeps check output beyond the earlier pin", () => {
    const timeline = buildTimeline(boardRun({
      phase: "checking",
      head: "candidate",
      activity: [
        row(2, "edit", "src/panel.ts", 41),
        row(2, "status", "Host checks started", 42),
        row(2, "status", "test: 0", 43),
      ],
      checks: [{ name: "test", exit: 0, stdout: "12 passed", stderr: "", error: null, finished_at: at(2) }],
    }));
    const [edit, start, passed] = timeline.events;
    expect([edit, start, passed].map(roomZone)).toEqual(["build", "verify", "verify"]);
    expect(roomStepRow(timeline, edit.id, false, 1)).toBe(start);
    expect(roomStepRow(timeline, passed.id, true, -1)).toBe(start);
    const a = roomMoment(timeline, edit)!;
    const b = roomMoment(timeline, passed)!;
    expect(a.scene.run.head).toBeNull();
    expect(a.scene.run.checks).toEqual([]);
    expect(roomMoment(timeline, start)?.scene.run.head).toBe("candidate");
    expect(roomCheck(b.scene, b.event)?.stdout).toBe("12 passed");
    const reopened = createBoardPlayback({
      timeline,
      snapshot: b.scene,
      state: "live",
      time: Date.parse(passed.at),
      playing: false,
      speed: 1,
      tempo: 1,
      replayMode: "recap",
    }, 500);
    expect(reopened.sample(500).replay?.event?.id).toBe(passed.id);
    expect(roomMoment(timeline, { ...passed, summary: "reused legacy slot" })).toBeNull();
    expect(roomMoment(timeline, { ...passed, id: "expired" })).toBeNull();
  });

  it("delivers the cassette only at a recorded ready handover", () => {
    const timeline = buildTimeline(boardRun({
      phase: "uat-ready",
      handover: handover(),
      activity: [
        row(1, "status", "Host checks started"),
        row(2, "status", "Freezing handover"),
        row(3, "status", "Ready for owner UAT"),
      ],
    }));
    expect(roomCassette(sceneAt(timeline, Date.parse(at(2)), "native:2"))).toBe("verify");
    expect(roomCassette(sceneAt(timeline, Date.parse(at(3)), "native:3"))).toBe("received");
    expect(roomZone(buildTimeline(boardRun({ activity: [row(1, "message", "Owner shipped merge")] })).events[0])).toBe("think");
  });
});
