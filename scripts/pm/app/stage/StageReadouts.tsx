import { memo, type ReactNode } from "react";
import type { LocalScene } from "../localRunScene";
import { clock } from "../localRunLiveness";
import { LOCAL_CHECKS } from "../localRunModel";
import { ART, READOUTS, ZONE_BY_ID, type ZoneId } from "./config";
import type { ZoneBoardState } from "./zoneModel";
import { useBoardNow, useBoardReplayTime } from "./clockStore";
import {
  checkDuration,
  hostCheckReadout,
  observedCheckTime,
  type HostCheckReadout,
} from "./checkReadouts";
import "./stage-readouts.css";
import { boardRetry } from "./facts";
import { StaleLife } from "./StaleLife";
import type { BoardAttentionFact, StageTempo } from "./types";
const NO_ATTENTION: readonly BoardAttentionFact[] = [];
const EMPTY_ZONES: readonly ZoneId[] = ["explore", "think", "build", "bench"];
function Plate({
  kind = "",
  children,
  title,
}: {
  kind?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`board-readout ${kind}`} title={title}>
      {children}
    </span>
  );
}
function HostStopwatch({
  scene,
  state,
  replay,
  readout,
}: {
  scene: LocalScene;
  state: string;
  replay: boolean;
  readout: HostCheckReadout;
}) {
  const now = useBoardNow(),
    playhead = useBoardReplayTime(scene.run.run_id, replay ? scene.at : null);
  const value = checkDuration(
    readout,
    observedCheckTime(scene, state, playhead ?? now, replay),
  );
  return <time>{value === null ? "—" : clock(value)}</time>;
}
export const StageReadouts = memo(function StageReadouts({
  snapshot,
  state,
  replay,
  zones,
  attention = NO_ATTENTION,
  tempo = 1,
  worldOnly = false,
}: {
  snapshot: LocalScene;
  state: string;
  replay: boolean;
  zones: ZoneBoardState;
  attention?: readonly BoardAttentionFact[];
  tempo?: StageTempo;
  worldOnly?: boolean;
}) {
  const edited = snapshot.nodes.filter((node) => node.edited).length;
  const facts = {
    snapshot,
    state,
    zones: zones.zones,
    activeZone: zones.activeZone,
    attention,
    buildZone: zones.buildZone,
    atMain: zones.atMain,
    buildGate: snapshot.seals.filter((seal) => seal.state !== "pending").length,
  };
  // World decoration stays with the camera. Factual text occupies a reserved
  // screen-space shelf so neither fit nor Follow can shrink or collide it.
  if (worldOnly) return <StaleLife facts={facts} tempo={tempo} />;
  const base = snapshot.run.base,
    merge = snapshot.run.merge,
    last = snapshot.latest,
    signal =
      state === "signal-lost" && last && Number.isFinite(Date.parse(last.at));
  return (
    <div className="board-readouts" aria-label="Recorded board facts">
      <div className="board-readout-row">
        <Plate kind="board-main-title">MAIN</Plate>
        {base && (
          <Plate kind="board-main-node" title={base}>
            <i aria-hidden="true" />
            <code>{base.slice(0, 7)}</code>
          </Plate>
        )}
        {merge && (
          <Plate kind="board-main-node" title={merge}>
            <i aria-hidden="true" />
            <code>{merge.slice(0, 7)}</code>
          </Plate>
        )}
        {boardRetry(snapshot.run) && <Plate kind="board-retry">RETRY</Plate>}
        {snapshot.events.length > ART.orb.beads && (
          <Plate title={String(snapshot.events.length)}>
            ×{Math.ceil(snapshot.events.length / ART.orb.beads)}
          </Plate>
        )}
        {edited > 4 * ART.build.layers && <Plate>BUILD {edited}</Plate>}
        {snapshot.run.handover && (
          <Plate>UAT {snapshot.run.handover.scenarios.length}</Plate>
        )}
        {EMPTY_ZONES.map((id) => {
          const count = zones.zones.find((zone) => zone.id === id)?.count;
          return count === undefined ? null : (
            <Plate key={id} kind="board-work-count">
              {ZONE_BY_ID[id].label} {count}
            </Plate>
          );
        })}
        {signal && (
          <time className="board-last-signal" dateTime={last.at} title={last.at}>
            {new Date(last.at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </time>
        )}
      </div>
      <div className="board-readout-row board-check-row">
        {LOCAL_CHECKS.map((name, i) => {
          const readout = hostCheckReadout(snapshot, name),
            duration = checkDuration(readout, snapshot.at);
          return (
            <Plate key={name} kind="board-check-readout" title={name}>
              <b>{READOUTS.checkLabels[i]}</b>
              {readout.running ? (
                <HostStopwatch
                  scene={snapshot}
                  state={state}
                  replay={replay}
                  readout={readout}
                />
              ) : (
                <span>
                  {readout.result
                    ? `${readout.exit ?? "—"} · ${duration === null ? "—" : clock(duration)}`
                    : "—"}
                </span>
              )}
            </Plate>
          );
        })}
      </div>
    </div>
  );
});
