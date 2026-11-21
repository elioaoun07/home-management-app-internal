import { BoardFlightRecorder } from "./stage/BoardFlightRecorder";
import type { FlightRecorderProps } from "./FlightRecorder";
import type { ReplayMode, StageTempo } from "./stage/director";

export function LocalRunReplay({ replayMode, onMode, gap, tempo, onTempo, ...recorder }: FlightRecorderProps & {
  replayMode: ReplayMode;
  onMode: (value: ReplayMode) => void;
  gap: string | null;
  tempo: StageTempo;
  onTempo: (value: StageTempo) => void;
}) {
  return <div className="board-replay-strip">
    <button type="button" className="secondary board-live" onClick={recorder.onLive}
      aria-pressed={recorder.time === null}>Live</button>
    <div className="foundry-replay-modes" role="group" aria-label="Replay">
      <output className="foundry-gap" hidden={!gap}>{gap}</output>
      <button type="button" className="secondary" aria-pressed={replayMode === "recap"}
        onClick={() => onMode("recap")}>Recap</button>
      <button type="button" className="secondary" aria-pressed={replayMode === "full"}
        onClick={() => onMode("full")}>Full</button>
    </div>
    <BoardFlightRecorder {...recorder} />
    <select className="board-dock-tempo" aria-label="Tempo" value={tempo}
      onChange={event => onTempo(Number(event.target.value) as StageTempo)}>
      <option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.5}>1.5×</option>
    </select>
  </div>;
}
