import { describe, expect, it } from "vitest";
import { createBoardPlayback } from "../../scripts/pm/app/stage/playback";
import { makeReplayTimeline } from "../../scripts/pm/app/stage/director";
import { boardRun, epoch, row } from "./local-board-fixtures";
import { playbackInput, seek } from "./local-board-playback-fixtures";

const tied = () =>
  playbackInput(
    boardRun({
      activity: [
        row(0, "edit", "src/first.ts", 1),
        row(0, "edit", "src/second.ts", 2),
        row(0, "edit", "src/third.ts", 3),
      ],
    }),
  );
describe("R123 recorded board playback", () => {
  it("the first recorded supervisor ceremony begins at progress zero", () => {
    const initial = playbackInput(
      boardRun({
        phase: "failed",
        error: "git commit: hook failed",
        activity: [
          row(0, "status", "Native session started"),
          row(10, "status", "git commit: hook failed"),
        ],
      }),
    );
    const playback = createBoardPlayback(initial, 0);
    playback.update(
      { ...seek(initial, epoch, "native:0"), playing: true },
      100,
    );
    expect(playback.sample(100).ceremony).toMatchObject({
      kind: "boot",
      progress: 0,
    });
    expect(playback.observations(100).map((event) => event.id)).toEqual([
      "native:0",
    ]);
    expect(playback.observations(100)).toEqual([]);
  });
  it("seeks equal timestamps by stable row id, pauses, and resumes that row", () => {
    const initial = tied(),
      playback = createBoardPlayback(initial, 0);
    const paused = seek(initial, epoch, "native:2");
    playback.update(paused, 100);
    expect(playback.sample(900).beat).toMatchObject({
      id: "native:2",
      stage: "think",
      progress: 0,
    });
    expect(playback.observations(900)).toEqual([]);
    const playing = { ...paused, playing: true };
    playback.update(playing, 1000);
    expect(playback.sample(1500).beat).toMatchObject({
      id: "native:2",
      stage: "decide",
      progress: 0,
    });
    expect(playback.observations(1500).map((event) => event.id)).toEqual([
      "native:2",
    ]);
    expect(playback.observations(1500)).toEqual([]);
    playback.update(paused, 1600);
    expect(playback.sample(3000).beat?.elapsed).toBe(600);
    playback.update(playing, 4000);
    expect(playback.sample(4500).beat?.elapsed).toBe(1100);
  });
  it.each([
    [0.75, 1.5],
    [1.5, 0.75],
  ] as const)(
    "keeps mid-stage identity/progress through tempo %s to %s",
    (from, to) => {
      const initial = { ...tied(), tempo: from },
        playback = createBoardPlayback(initial, 0);
      const playing = { ...seek(initial, epoch, "native:2"), playing: true };
      playback.update(playing, 100);
      const before = playback.sample(100 + 3000 * from).beat!;
      playback.update({ ...playing, tempo: to }, 100 + 3000 * from);
      expect(playback.sample(100 + 3000 * from).beat).toMatchObject({
        id: before.id,
        stage: before.stage,
      });
      expect(playback.sample(100 + 3000 * from).beat?.progress).toBeCloseTo(
        before.progress,
      );
    },
  );
  it("speed changes preserve position and use the new multiplier only afterward", () => {
    const initial = tied(),
      playback = createBoardPlayback(initial, 0),
      playing = { ...seek(initial, epoch, "native:1"), playing: true };
    playback.update(playing, 100);
    expect(playback.sample(1100).replay?.presentationTime).toBe(1000);
    playback.update({ ...playing, speed: 4 }, 1100);
    expect(playback.sample(1600).replay?.presentationTime).toBe(3000);
  });
  it("preserves a long real silence through tempo remapping", () => {
    const initial = playbackInput(
      boardRun({
        activity: [
          row(0, "command", "Get-Content src/a.ts"),
          row(325, "edit", "src/b.ts"),
        ],
      }),
    );
    const plan = makeReplayTimeline(initial.timeline.events, { mode: "full" });
    const gap = plan.segments.find((segment) => segment.kind === "gap")!;
    const playback = createBoardPlayback(initial, 0),
      playing = { ...seek(initial, epoch, "native:0"), playing: true };
    playback.update(playing, 100);
    const now = 100 + gap.startAt + 1000;
    expect(playback.sample(now).replay?.gap).toMatchObject({
      tag: "5:25",
      progress: 0.5,
    });
    playback.update({ ...playing, tempo: 1.5 }, now);
    expect(playback.sample(now).replay?.gap).toMatchObject({
      tag: "5:25",
      progress: 0.5,
    });
  });
  it("switches replay mode at the actual selected row and retains final pose on pause", () => {
    const initial = tied(),
      playback = createBoardPlayback(initial, 0),
      paused = seek(initial, epoch, "native:2");
    playback.update(paused, 100);
    playback.update({ ...paused, replayMode: "recap" }, 200);
    expect(playback.sample(200).replay?.event?.id).toBe("native:2");
    const playing = { ...paused, replayMode: "full" as const, playing: true };
    playback.update(playing, 300);
    expect(playback.sample(100_000).replay?.complete).toBe(true);
    playback.update({ ...playing, playing: false }, 100_000);
    expect(playback.sample(200_000).replay).toMatchObject({
      complete: true,
      beat: { id: "native:3", progress: 1 },
    });
  });
  it("returns to Live without replaying historical rows or leaking a replay frame", () => {
    const initial = tied(),
      playback = createBoardPlayback(initial, 0);
    playback.update(
      { ...seek(initial, epoch, "native:1"), playing: true },
      100,
    );
    playback.observations(500);
    playback.update({ ...initial, time: null, playing: false }, 600);
    expect(playback.sample(600)).toMatchObject({
      replay: null,
      beat: null,
      gap: null,
    });
    expect(playback.observations(1000)).toEqual([]);
    const next = playbackInput(
      boardRun({
        activity: [
          ...initial.timeline.run.activity,
          row(1, "edit", "src/live.ts", 4),
        ],
      }),
    );
    playback.update(next, 2000);
    expect(playback.observations(2000).map((event) => event.id)).toEqual([
      "native:4",
    ]);
  });
});
