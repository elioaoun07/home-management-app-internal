import { memo, useMemo, useState, type ReactNode } from "react";
import { Award, History } from "lucide-react";
import type { LocalRunView } from "../../LocalDelivery";
import type { LocalActivityEvent } from "../../localRunActivityModel";
import type { AttentionItem } from "../../localRunAttention";
import { clock as formatClock } from "../../localRunLiveness";
import { attemptLabel, displayTitle } from "../../localRunModel";
import type { LocalScene, LocalTimeline } from "../../localRunScene";
import { localBoardGame, localStageGame } from "../game";
import { zoneEvidence, type ZoneBoardState } from "../zoneModel";
import type { ZoneId } from "../config";
import { TopBar } from "./TopBar";
import { AttentionRail } from "./AttentionRail";
import type { AttentionHandler } from "./AttentionCard";
import { Telemetry } from "./Telemetry";
import { Comms } from "./Comms";
import { Results } from "./Results";
import { BadgePop } from "./BadgePop";
import "./foundry-hud.css";

export { FoundryPortrait } from "./FoundryPortrait";
export { Telemetry } from "./Telemetry";
export { ZoneChip } from "./ZoneChip";
export { BOARD_HUD_STYLE } from "./layout";

const EMPTY_ATTENTION: readonly AttentionItem[] = [];
const readRank = () => {
  try {
    return localStorage.getItem("pm-stage-rank") !== "off";
  } catch {
    return true;
  }
};

export interface FoundryHudProps {
  snapshot: LocalScene;
  timeline: LocalTimeline;
  realRun?: LocalRunView;
  zones?: ZoneBoardState;
  attention?: readonly AttentionItem[];
  state?: string;
  caption?: string;
  elapsed?: string;
  clock?: ReactNode;
  telemetry?: ReactNode;
  dockControls?: ReactNode;
  dockTools?: ReactNode;
  controls?: ReactNode;
  settingsControls?: ReactNode;
  theaterControl?: ReactNode;
  roomSwitch?: ReactNode;
  actions?: ReactNode;
  failure?: ReactNode;
  question?: ReactNode;
  debrief?: ReactNode;
  streak?: number | null;
  replay?: boolean;
  tempo?: 0.75 | 1 | 1.5;
  onTempo?: (tempo: 0.75 | 1 | 1.5) => void;
  onTest?: () => void;
  onAttention?: AttentionHandler;
  canAct?: (item: AttentionItem) => boolean;
  selectedAttentionId?: string | null;
  onRailOpenChange?: (open: boolean) => void;
  railOpen?: boolean;
  suppressRailAutoOpen?: boolean;
  renderAge?: (since: number | null) => ReactNode;
  stagedMessage?: LocalActivityEvent | null;
  stageZone?: ZoneId | null;
}

/** Region siblings use the parent's board grid. Only clock/counter slots
 * subscribe to the one-second values; the rail remains memoised. */
export const FoundryHud = memo(function FoundryHud({
  snapshot,
  timeline,
  zones: suppliedZones,
  attention = EMPTY_ATTENTION,
  state = "live",
  caption = snapshot.caption,
  elapsed,
  clock,
  telemetry,
  dockControls,
  dockTools,
  controls,
  settingsControls,
  theaterControl,
  roomSwitch,
  actions,
  failure,
  question,
  debrief,
  streak = null,
  replay = false,
  tempo = 1,
  onTempo,
  onAttention,
  canAct,
  selectedAttentionId,
  onRailOpenChange,
  railOpen,
  suppressRailAutoOpen,
  renderAge,
  stagedMessage = null,
}: FoundryHudProps) {
  const zones = useMemo(
    () => suppliedZones ?? zoneEvidence(snapshot, null, attention),
    [suppliedZones, snapshot, attention],
  );
  const game = useMemo(
    () => localStageGame(timeline, snapshot, streak),
    [timeline, snapshot, streak],
  );
  const board = useMemo(
    () => localBoardGame(timeline, snapshot, zones, attention),
    [timeline, snapshot, zones, attention],
  );
  const badges = useMemo(
    () => [
      ...new Map(
        [...game.badges, ...board.badges].map((badge) => [badge.id, badge]),
      ).values(),
    ],
    [game.badges, board.badges],
  );
  const [rank, setRank] = useState(readRank);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const toggleRank = () => {
    setRank((value) => {
      try {
        localStorage.setItem("pm-stage-rank", value ? "off" : "on");
      } catch {
        /* Session preference remains usable. */
      }
      return !value;
    });
  };
  const signalTimes = useMemo(
    () =>
      [
        ...snapshot.events.map((event) => Date.parse(event.at)),
        ...snapshot.run.checks.flatMap((check) =>
          check.finished_at ? [Date.parse(check.finished_at)] : [],
        ),
      ].filter(Number.isFinite),
    [snapshot],
  );
  const results = useMemo(
    () =>
      ["shipped", "uat-ready", "cancelled", "reverted"].includes(
        snapshot.phase,
      ) && !snapshot.run.interrupted ? (
        <Results
          snapshot={snapshot}
          game={game}
          board={board}
          rank={rank}
          debrief={debrief}
        />
      ) : null,
    [snapshot, game, board, rank, debrief],
  );
  const elapsedText =
    elapsed ??
    (snapshot.elapsed === null
      ? "—"
      : `${formatClock(snapshot.elapsed)}${timeline.truncated ? "+" : ""}`);
  return (
    <>
      <TopBar
        id={snapshot.run.work.id}
        title={displayTitle(snapshot.run)}
        attempt={attemptLabel(snapshot.run)}
        zones={zones}
        line={board.line}
        turn={board.turn}
        caption={clock ? "" : caption}
        clock={clock ?? elapsedText}
        theater={theaterControl}
        roomSwitch={roomSwitch}
        replay={replay}
        tempo={tempo}
        onTempo={onTempo}
        rank={rank}
        onRank={toggleRank}
        controls={settingsControls ?? controls}
        showTempo={!dockControls}
      />
      <div className="board-hud" data-state={state}>
        <Comms
          message={stagedMessage}
          history={snapshot.events}
          state={state}
        />
        <BadgePop badges={badges} replay={replay} />
      </div>
      <div className="board-dock" data-compact={!!roomSwitch} data-recorder={recorderOpen}>
        {roomSwitch && <button type="button" className="board-recorder-toggle" aria-expanded={recorderOpen}
          onClick={() => setRecorderOpen(value => !value)}><History size={16} />{replay ? "Replay" : "Recorder"}</button>}
        {(!roomSwitch || recorderOpen) && <>
        <section className="board-telemetry">
          {telemetry ?? (
            <Telemetry
              combo={game.combo}
              charge={game.charge}
              counts={snapshot.counts}
              at={snapshot.at}
              phase={snapshot.phase}
              signalTimes={signalTimes}
              partial={
                timeline.truncated ||
                snapshot.nodes.some((node) => node.path === null)
              }
            />
          )}
          <button
            type="button"
            className="board-badge-count"
            aria-label={`Badges ${badges.length}`}
            aria-expanded={badgesOpen}
            onClick={() => setBadgesOpen((value) => !value)}
          >
            <Award size={15} />
            {badges.length}
          </button>
        </section>
        {dockControls}
        </>}
        <div className="board-dock-tools">{dockTools}</div>
      </div>
      <AttentionRail
        items={attention}
        selectedId={selectedAttentionId}
        onAction={onAttention}
        canAct={canAct}
        actions={actions}
        results={results}
        failure={failure}
        question={question}
        badges={badges}
        badgesOpen={badgesOpen}
        onBadgesClose={() => setBadgesOpen(false)}
        onOpenChange={onRailOpenChange}
        open={railOpen}
        suppressAutoOpen={suppressRailAutoOpen}
        renderAge={renderAge}
        stale={state === "stale"}
      />
    </>
  );
});
