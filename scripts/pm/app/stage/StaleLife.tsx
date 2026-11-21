import { memo, useRef, type CSSProperties } from "react";
import { READOUTS, TIMING } from "./config";
import { eraDestination } from "./motion";
import { boardPoint } from "./board";
import { deckHeight } from "./serviceWalk";
import type { BoardFacts, StageTempo } from "./types";
/** Compositor-only life remains active while the stale Canvas clock sleeps. */
export const StaleLife = memo(function StaleLife({
  facts,
  tempo,
}: {
  facts: BoardFacts;
  tempo: StageTempo;
}) {
  const held = useRef<{ x: number; y: number } | null>(null);
  if (facts.state === "stale") {
    const stand = eraDestination(facts, {
      beat: null,
      vitality: 0,
      heat: 0,
      elapsed: 0,
      tempo: 1,
    });
    held.current = boardPoint(stand.x, stand.y, deckHeight(stand));
  } else if (facts.state !== "link-down") held.current = null;
  const point = held.current;
  if (!point) return null;
  const s = READOUTS.stale;
  const style = {
    left: point.x,
    top: point.y,
    "--stale-dish-width": `${s.dishWidth}px`,
    "--stale-dish-height": `${s.dishHeight}px`,
    "--stale-dish-y": `${s.dishY - s.dishHeight - s.stem}px`,
    "--stale-stem": `${s.stem}px`,
    "--stale-sonar-width": `${s.sonarWidth}px`,
    "--stale-sonar-height": `${s.sonarHeight}px`,
    "--stale-sonar-y": `${s.sonarY}px`,
    "--stale-line": `${s.line}px`,
    "--stale-sweep": `${s.sweep}deg`,
    "--stale-scale": s.scale,
    "--stale-cycle": `${TIMING.sonar}ms`,
    "--stale-arrival": `${TIMING.travel * tempo}ms`,
  } as CSSProperties;
  return (
    <span
      key={`${point.x}:${point.y}`}
      className="board-stale-life"
      style={style}
      data-frozen={facts.state === "link-down"}
      aria-hidden="true"
    >
      <i className="board-stale-dish">
        <b />
      </i>
      <i className="board-stale-sonar" />
    </span>
  );
});
