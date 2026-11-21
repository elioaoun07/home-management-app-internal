import {
  useLayoutEffect,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";
import { FoundryHud, type FoundryHudProps } from "./stage/hud/FoundryHud";
import {
  ART,
  BOARD,
  LAMPS,
  READOUTS,
  TIMING,
  ZONE_BY_ID,
  type ZoneId,
} from "./stage/config";
import type { BoardPlacement } from "./stage/types";
import type { StagingUi } from "./useStageClock";
import "./stage/foundry.css";
import { BOARD_HUD_STYLE } from "./stage/hud/layout";
import { StageReadouts } from "./stage/StageReadouts";
import { zoneEvidence } from "./stage/zoneModel";
import { boardPoint } from "./stage/board";

export type WorkshopStation = "source" | "forge" | "lab" | "review" | "launch";
interface WorkshopProps extends FoundryHudProps {
  stageRef: RefObject<HTMLElement | null>;
  positions: readonly BoardPlacement[];
  staging: StagingUi;
  railOpen: boolean;
  onZone: (zone: ZoneId) => void;
  seat?: ReactNode;
  seated?: boolean;
  children?: ReactNode;
}
export function DeliveryWorkshop({
  stageRef,
  positions,
  staging,
  railOpen,
  onZone,
  seat,
  seated = false,
  children,
  ...hud
}: WorkshopProps) {
  const { snapshot, state = "live", replay = false, attention = [] } = hud;
  const chip = positions.find((position) => position.id === staging.zone);
  const zones = useMemo(
    () => hud.zones ?? zoneEvidence(snapshot, null, attention),
    [hud.zones, snapshot, attention],
  );
  useLayoutEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const measure = () =>
      root.style.setProperty(
        "--board-top",
        `${root.getBoundingClientRect().top + window.scrollY}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stageRef]);
  return (
    <section
      ref={stageRef}
      className="delivery-workshop board-workshop"
      style={BOARD_HUD_STYLE}
      aria-label="ERA workshop"
      data-renderer={seated ? "transfer-room" : "solid-board"}
      data-rail={railOpen ? "open" : "closed"}
      data-liveness={state}
      data-phase={snapshot.phase}
      data-station={snapshot.station}
      data-active={["live", "thinking"].includes(state)}
      data-completed={snapshot.phase === "shipped"}
      data-plates={snapshot.nodes.filter((node) => node.edited).length}
      data-seals={snapshot.counts.checks}
      data-replay={replay}
      data-attention={
        attention.filter(
          (item) => item.level === "act" && item.state === "open",
        ).length
      }
      data-motion="paused"
    >
      <div className="board-region">
        {seat}
        {!seated && <>
        <div className="board-world">
          <div className="board-camera">
            <canvas data-layer="static" aria-hidden="true" />
            <canvas data-layer="state" aria-hidden="true" />
            <canvas
              data-layer="motion"
              className="stage-fx"
              aria-hidden="true"
            />
            {positions.map((position) => {
              const zone = ZONE_BY_ID[position.id];
              const legacy =
                zone.id === "brief"
                  ? "Open brief"
                  : zone.id === "explore"
                    ? "Open activity"
                    : zone.id === "build"
                      ? "Open changes"
                      : zone.id === "verify"
                        ? "Open verification"
                        : `Open ${zone.label}`;
              const w = zone.pad.width,
                d = zone.pad.depth,
                o = ART.label.offsetY;
              const points = `${d},${o} ${w + d},${o + w / 2} ${w},${o + (w + d) / 2} 0,${o + d / 2}`;
              const clipPath = `polygon(${d}px ${o}px,${w + d}px ${o + w / 2}px,${w}px ${o + (w + d) / 2}px,0px ${o + d / 2}px)`;
              const sx = zone.pad.x + ART.stripe.inset,
                sy = zone.pad.y + d - ART.stripe.front,
                sw = w - ART.stripe.inset * 2;
              const stripe = [
                [sx, sy],
                [sx + sw, sy],
                [sx + sw, sy + ART.stripe.depth],
                [sx, sy + ART.stripe.depth],
              ]
                .map(([x, y]) => {
                  const p = boardPoint(
                    x,
                    y,
                    BOARD.pad.raise + ART.stripe.height,
                  );
                  return `${p.x - position.x},${p.y - position.y}`;
                })
                .join(" ");
              const owner = attention.some(
                (item) =>
                  item.zone === zone.id &&
                  item.level === "act" &&
                  item.state === "open",
              );
              return (
                <div
                  key={zone.id}
                  className="board-zone-target"
                  style={{
                    left: position.x,
                    top: position.y,
                    width: position.width,
                    height: position.height,
                  }}
                >
                  <button
                    className="board-zone workshop-station"
                    data-zone={zone.id}
                    data-station={zone.legacyStation}
                    aria-label={legacy}
                    style={{
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      clipPath,
                    }}
                    onClick={() => onZone(zone.id)}
                  ></button>
                  <button
                    className="board-zone-name"
                    data-zone={zone.id}
                    data-row={zone.pad.y < BOARD.front[0] ? "rear" : "front"}
                    data-state={
                      zones.zones.find((item) => item.id === zone.id)?.status
                    }
                    onClick={() => onZone(zone.id)}
                    style={{
                      left: position.width / 2,
                      top: position.height - ART.label.offsetY,
                    }}
                  >
                    {String(zone.number).padStart(2, "0")} {zone.label}
                  </button>
                  <svg
                    className="board-zone-focus"
                    viewBox={`0 0 ${position.width} ${position.height}`}
                    aria-hidden="true"
                  >
                    <polygon
                      points={points}
                      strokeWidth={READOUTS.focusWidth}
                    />
                  </svg>
                  {owner && (
                    <svg
                      className="board-zone-attention"
                      style={{
                        animationDuration: `${TIMING.attentionPulse}ms`,
                      }}
                      viewBox={`0 0 ${position.width} ${position.height}`}
                      aria-hidden="true"
                    >
                      <polygon points={stripe} fill={LAMPS.owner} />
                    </svg>
                  )}
                </div>
              );
            })}
            <StageReadouts
              snapshot={snapshot}
              state={state}
              replay={replay}
              zones={zones}
              attention={attention}
              tempo={hud.tempo ?? 1}
              worldOnly
            />
            {chip && staging.label && (
              <output
                className="board-zone-chip foundry-command-chip"
                data-zone={staging.zone ?? undefined}
                data-row={ZONE_BY_ID[chip.id].pad.y < BOARD.front[0] ? "rear" : "front"}
                title={staging.label}
                tabIndex={0}
                style={{ left: chip.chipX, top: chip.chipY }}
              >
                {staging.label}
              </output>
            )}
            <div className="workshop-presence" aria-hidden="true" />
          </div>
        </div>
        <StageReadouts
          snapshot={snapshot}
          state={state}
          replay={replay}
          zones={zones}
        />
        <div className="board-state-overlay" aria-hidden="true" />
        </>}
      </div>
      <FoundryHud {...hud} railOpen={railOpen} />
      {children}
      <span className="stage-announcement" role="status" aria-atomic="true" />
    </section>
  );
}
