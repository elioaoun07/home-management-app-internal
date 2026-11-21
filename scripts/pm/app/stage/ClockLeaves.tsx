import type { LocalScene, LocalTimeline } from "../localRunScene";
import { clock, liveness, type LocalPollHealth } from "../localRunLiveness";
import { useBoardNow, useBoardReplayTime } from "./clockStore";
import { localStageGame } from "./game";
import { Telemetry } from "./hud/Telemetry";

export function BoardClock({
  scene,
  timeline,
  replayTime,
  poll,
}: {
  scene: LocalScene;
  timeline: LocalTimeline;
  replayTime: number | null;
  poll?: LocalPollHealth;
}) {
  const now = useBoardNow(),
    replayAt = useBoardReplayTime(scene.run.run_id, replayTime),
    at = replayAt ?? now,
    health = liveness(scene.run, at, replayTime === null ? poll : {});
  const elapsed =
    ["failed", "shipped", "cancelled", "reverted"].includes(scene.phase) ||
    health.state === "link-down"
      ? scene.elapsed
      : timeline.start === null
        ? null
        : Math.max(0, at - timeline.start);
  return (
    <>
      <span>{health.caption}</span>
      <time>
        {elapsed === null
          ? "—"
          : clock(elapsed) + (timeline.truncated ? "+" : "")}
      </time>
    </>
  );
}
export function AttentionAge({ since }: { since: number | null }) {
  const now = useBoardNow();
  if (since === null) return null;
  const minutes = Math.max(0, Math.floor((now - since) / 60000));
  return (
    <time>
      {minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`}
    </time>
  );
}
export function BoardTelemetry({
  scene,
  timeline,
  replayTime,
  frozen = false,
}: {
  scene: LocalScene;
  timeline: LocalTimeline;
  replayTime: number | null;
  frozen?: boolean;
}) {
  const now = useBoardNow(),
    replayAt = useBoardReplayTime(scene.run.run_id, replayTime),
    at = replayAt ?? (frozen ? scene.at : now),
    game = localStageGame(timeline, { ...scene, at });
  return (
    <Telemetry
      combo={game.combo}
      charge={game.charge}
      counts={scene.counts}
      at={at}
      phase={scene.phase}
      signalTimes={[
        ...scene.events.map((event) => Date.parse(event.at)),
        ...scene.run.checks.flatMap((check) =>
          check.finished_at ? [Date.parse(check.finished_at)] : [],
        ),
      ].filter(Number.isFinite)}
      partial={timeline.truncated || scene.nodes.some((node) => !node.path)}
    />
  );
}
