import { liveness } from "../localRunLiveness";
import { boardReplayClock } from "./clockStore";
import { TIMING } from "./config";
import type { createBoardPlayback, PlaybackInput } from "./playback";

type PublicationInput = PlaybackInput & {
  onReplayRow: (time: number, id: string | null) => void;
  onEnd: () => void;
};
/** Only new evidence or a health boundary invalidates the parent projection.
 * The one-second playhead belongs to its subscribed clock/recorder leaves. */
export function createReplayPublisher() {
  let lastRow: string | null = null,
    lastHealth = "",
    lastSecond = -1,
    done = false;
  return (
    input: PublicationInput,
    sample: ReturnType<ReturnType<typeof createBoardPlayback>["sample"]>,
    now: number,
  ) => {
    const replay = sample.replay,
      runId = input.snapshot.run.run_id;
    if (input.time === null || replay?.recordedTime == null) {
      boardReplayClock.tick(runId, null);
      lastRow = null;
      lastHealth = "";
      done = false;
      return;
    }
    const row = replay.event?.id ?? "";
    const health = liveness(input.snapshot.run, replay.recordedTime).state;
    const changed = row !== lastRow || health !== lastHealth;
    if (changed) {
      lastRow = row;
      lastHealth = health;
      input.onReplayRow(replay.recordedTime, row || null);
    }
    const second = Math.floor(now / TIMING.second);
    if (changed || second !== lastSecond || !input.playing) {
      lastSecond = second;
      boardReplayClock.tick(runId, replay.recordedTime);
    }
    if (replay.complete && !done) input.onEnd();
    done = replay.complete;
  };
}
