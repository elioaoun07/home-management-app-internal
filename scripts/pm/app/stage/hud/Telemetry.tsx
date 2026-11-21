import { memo } from "react";
import type { LocalScene } from "../../localRunScene";
import { clock } from "../../localRunLiveness";
import { tracePath } from "../../LivePulse";

export interface TelemetryProps {
  combo: number;
  charge: number;
  counts: LocalScene["counts"];
  at: number;
  signalTimes: readonly number[];
  phase: string;
  partial?: boolean;
}

/** Only this leaf subscribes to the parent's one-second counter store. */
export const Telemetry = memo(function Telemetry({
  combo,
  charge,
  counts,
  at,
  signalTimes,
  phase,
  partial = false,
}: TelemetryProps) {
  const last = signalTimes.length ? Math.max(...signalTimes) : null;
  return (
    <div className="board-telemetry-values">
      <div className="board-flow">
        <strong>FLOW ×{combo}</strong>
        <span className="board-flow-meter">
          <i
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, charge))})` }}
          />
        </span>
      </div>
      <div
        className="board-counters stage-stats"
        aria-label="Recorded activity counts"
      >
        <span>
          <b>
            {counts.reads}
            {partial ? "+" : ""}
          </b>{" "}
          read
        </span>
        <span>
          <b>{counts.edits}</b> edits
        </span>
        <span>
          <b>{counts.commands}</b> commands
        </span>
        <span>
          <b>{counts.checks}/4</b> checks
        </span>
      </div>
      <div className="board-pulse stage-pulse">
        <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={tracePath([...signalTimes], at, 300, 24)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        {last !== null &&
          !["failed", "cancelled", "shipped", "reverted"].includes(phase) && (
            <time>{clock(Math.max(0, at - last))}</time>
          )}
      </div>
    </div>
  );
});
