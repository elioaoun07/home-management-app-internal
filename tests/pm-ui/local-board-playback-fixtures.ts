import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import type { PlaybackInput } from "../../scripts/pm/app/stage/playback";
import { boardRun, epoch } from "./local-board-fixtures";

export function playbackInput(
  run: LocalRunView = boardRun(),
  changes: Partial<PlaybackInput> = {},
): PlaybackInput {
  const timeline = buildTimeline(run);
  return {
    timeline,
    snapshot: sceneAt(timeline, changes.time ?? epoch + 30_000),
    state: "live",
    time: null,
    playing: false,
    speed: 1,
    tempo: 1,
    replayMode: "full",
    ...changes,
  };
}
export function seek(
  input: PlaybackInput,
  time: number,
  id?: string,
): PlaybackInput {
  return {
    ...input,
    time,
    playing: false,
    snapshot: sceneAt(input.timeline, time, id),
  };
}
