import { describe, expect, it, vi } from "vitest";
import { createBoardPlayback } from "../../scripts/pm/app/stage/playback";
import { createReplayPublisher } from "../../scripts/pm/app/stage/replayPublication";
import { boardReplayClock } from "../../scripts/pm/app/stage/clockStore";
import { playbackInput } from "./local-board-playback-fixtures";
import { epoch } from "./local-board-fixtures";

describe("R123 replay publication boundaries", () => {
  it("keeps silent-gap second ticks out of the parent, and publishes health boundaries", () => {
    const input = {
      ...playbackInput(undefined, { time: epoch, playing: true }),
      onReplayRow: vi.fn(),
      onEnd: vi.fn(),
    };
    const sample = createBoardPlayback(input, 0).sample(0);
    const publish = createReplayPublisher();
    const frame = (seconds: number, complete = false) => ({
      ...sample,
      replay: {
        ...sample.replay!,
        recordedTime: epoch + seconds * 1000,
        complete,
      },
    });
    publish(input, frame(0), 0);
    expect(input.onReplayRow).toHaveBeenCalledTimes(1);
    for (let i = 1; i < 20; i++) publish(input, frame(i), i * 1000);
    expect(input.onReplayRow).toHaveBeenCalledTimes(1);
    expect(boardReplayClock.get(input.snapshot.run.run_id)).toBe(epoch + 19000);
    publish(input, frame(20), 20000);
    expect(input.onReplayRow).toHaveBeenCalledTimes(2);
    for (let i = 21; i < 30; i++) publish(input, frame(i), i * 1000);
    expect(input.onReplayRow).toHaveBeenCalledTimes(2);
    publish(input, frame(30, true), 30000);
    publish(input, frame(30, true), 31000);
    expect(input.onEnd).toHaveBeenCalledTimes(1);
    publish({ ...input, time: null }, sample, 32000);
    expect(boardReplayClock.get(input.snapshot.run.run_id)).toBeNull();
  });

  it("publishes a new tied row once and preserves the exact replay cursor", () => {
    const input = {
      ...playbackInput(undefined, { time: epoch, playing: true }),
      onReplayRow: vi.fn(),
      onEnd: vi.fn(),
    };
    const sample = createBoardPlayback(input, 0).sample(0),
      publish = createReplayPublisher();
    publish(input, sample, 0);
    const event = { ...input.timeline.events[0], id: "tied-row" };
    publish(input, { ...sample, replay: { ...sample.replay!, event } }, 1);
    expect(input.onReplayRow).toHaveBeenLastCalledWith(
      sample.replay!.recordedTime,
      "tied-row",
    );
    expect(input.onReplayRow).toHaveBeenCalledTimes(2);
  });
});
