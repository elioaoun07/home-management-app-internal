import { ART, BOARD, READOUTS, TIMING, ZONES, type ZoneId } from "./config";
import { project } from "./iso";
import type { Vec2 } from "./types";
import type { ZoneAttention } from "./zoneModel";

const { bounds } = BOARD;
const points = (vertices: Vec2[]) => vertices.map(({ x, y }) => `${x},${y}`).join(" ");
const pads = ZONES.map(({ id, pad: { x, y, width, depth } }) => {
  const right = x + width, front = y + depth, top = BOARD.pad.raise;
  const a = project(x, y, top), b = project(right, y, top);
  const c = project(right, front, top), d = project(x, front, top);
  const sx = x + ART.stripe.inset, ex = right - ART.stripe.inset;
  const sy = front - ART.stripe.front, ey = sy + ART.stripe.depth, z = top + ART.stripe.height;
  return {
    id,
    surface: points([a, b, c, d]),
    // Run the indicator along the two visible vertical faces of the platform.
    edge: points([project(x, front, top / 2), project(right, front, top / 2), project(right, y, top / 2)]),
    stripe: points([project(sx, sy, z), project(ex, sy, z), project(ex, ey, z), project(sx, ey, z)]),
  };
});

export function BoardFloorMarks({ current, focused, attention }: {
  current: ZoneId | null;
  focused: ZoneId | null;
  attention: readonly ZoneAttention[];
}) {
  return (
    <svg className="board-floor-marks" viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      aria-hidden="true" focusable="false">
      {pads.map(pad => (
        <g key={pad.id} data-zone={pad.id}>
          {attention.some(item => item.zone === pad.id && item.level === "act" && item.state === "open") &&
            <polygon className="board-zone-attention" points={pad.stripe} style={{ animationDuration: `${TIMING.attentionPulse}ms` }} />}
          {pad.id === focused && <polygon className="board-zone-focus" points={pad.surface} strokeWidth={READOUTS.focusWidth} />}
          {pad.id === current && <>
            <polyline className="board-current-edge" points={pad.edge} />
            <polyline className="board-current-trace" points={pad.edge} pathLength="100" />
          </>}
        </g>
      ))}
    </svg>
  );
}
