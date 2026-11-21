import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Pause, Play, Radio } from "lucide-react";
import type { LocalTimeline } from "./localRunScene";
import "./local-run-story.css";

export interface FlightRecorderProps {
  timeline: LocalTimeline;
  time: number | null;
  onTime: (time: number) => void;
  playing: boolean;
  onPlay: () => void;
  speed: 1 | 4;
  onSpeed: (speed: 1 | 4) => void;
  onLive: () => void;
  cursor?: string | null;
  onCursor?: (id: string | null) => void;
}

const bandLabels: Record<string, string> = {
  preparing: "Setup",
  building: "Plan & build",
  checking: "Verify",
  "uat-ready": "Test",
  shipped: "Ship",
  reverted: "Reverted",
};

/** Tick placement uses timestamps, so a silent commit remains an empty gap. */
export function FlightRecorder({
  timeline,
  time,
  onTime,
  playing,
  onPlay,
  speed,
  onSpeed,
  onLive,
  cursor,
  onCursor,
}: FlightRecorderProps) {
  const slider = useRef<HTMLDivElement>(null);
  const id = useId();
  const start = timeline.start ?? 0;
  const end = timeline.end ?? start;
  const current = Math.max(start, Math.min(end, time ?? end));
  const duration = Math.max(1, end - start);
  const ratio = (at: number) =>
    Math.max(0, Math.min(100, ((at - start) / duration) * 100));
  const latest =
    timeline.events.find((event) => event.id === cursor) ??
    [...timeline.events]
      .reverse()
      .find((event) => Date.parse(event.at) <= current);
  const valueText = latest
    ? `${new Date(current).toLocaleTimeString([], { hour12: false })} · ${latest.label}`
    : "Preparing";
  const select = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onTime(
      start +
        Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) *
          duration,
    );
    onCursor?.(null);
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = latest
      ? timeline.events.findIndex((entry) => entry.id === latest.id)
      : -1;
    let selected: number | null = null;
    if (event.key === "ArrowLeft") selected = Math.max(0, index - 1);
    else if (event.key === "ArrowRight")
      selected = Math.min(timeline.events.length - 1, index + 1);
    else if (event.key === "Home") selected = 0;
    else if (event.key === "End") selected = timeline.events.length - 1;
    else if (event.key === " ") onPlay();
    else if (event.key.toLowerCase() === "l") onLive();
    else return;
    if (selected !== null && timeline.events[selected]) {
      const row = timeline.events[selected];
      onTime(Date.parse(row.at));
      onCursor?.(row.id);
    }
    event.preventDefault();
  };
  return (
    <section
      className="flight-recorder"
      aria-label="Flight recorder"
      data-playing={playing}
    >
      <div className="flight-recorder-controls">
        <button
          type="button"
          className="secondary"
          aria-label={playing ? "Pause" : "Play"}
          onClick={onPlay}
          disabled={!timeline.events.length}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className="secondary flight-speed"
          onClick={() => onSpeed(speed === 1 ? 4 : 1)}
          aria-label={`${speed}×`}
        >
          {speed}×
        </button>
        {time !== null && (
          <button type="button" className="secondary" onClick={onLive}>
            <Radio size={13} /> Live
          </button>
        )}
        <output id={id}>{time !== null ? "Replay" : "Live"}</output>
      </div>
      <div className="flight-recorder-window">
        <nav className="flight-bands" aria-label="Delivery stages">
          {timeline.bands.map((band, index) => (
            <span
              key={`${band.phase}:${index}`}
              data-phase={band.phase}
              style={{
                left: `${ratio(band.at)}%`,
                width: `${Math.max(0.4, ratio(band.end) - ratio(band.at))}%`,
              }}
            >
              {bandLabels[band.phase] ?? band.phase}
            </span>
          ))}
        </nav>
        <div
          className="flight-slider"
          ref={slider}
          role="slider"
          tabIndex={0}
          aria-label="Replay"
          aria-describedby={id}
          aria-valuemin={start}
          aria-valuemax={end}
          aria-valuenow={current}
          aria-valuetext={valueText}
          onKeyDown={keyboard}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            select(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) select(event);
          }}
        >
          <div className="flight-axis" />
          {timeline.events.map((event) => (
            <i
              key={event.id}
              className="flight-tick"
              data-kind={event.kind}
              style={{ left: `${ratio(Date.parse(event.at))}%` }}
              title={`${new Date(event.at).toLocaleTimeString([], { hour12: false })} · ${event.label}`}
            />
          ))}
          {timeline.run.checks.map((check) => {
            const at = check.finished_at
              ? Date.parse(check.finished_at)
              : timeline.events.find(
                  (event) =>
                    event.kind === "check" && event.detail === check.name,
                )?.at;
            if (at === undefined) return null;
            const timestamp = typeof at === "string" ? Date.parse(at) : at;
            if (!Number.isFinite(timestamp)) return null;
            return (
              <b
                key={check.name}
                className="flight-check"
                data-result={
                  check.error || check.exit === null
                    ? "inconclusive"
                    : check.exit === 0
                      ? "passed"
                      : "failed"
                }
                title={`${check.name}: ${check.exit ?? "Inconclusive"}`}
                style={{ left: `${ratio(timestamp)}%` }}
              />
            );
          })}
          {timeline.run.phase === "failed" && (
            <b
              className="flight-failure"
              style={{ left: "100%" }}
              aria-label="Failed"
            >
              ×
            </b>
          )}
          <span
            className="flight-cursor"
            style={{ left: `${ratio(current)}%` }}
          />
        </div>
        <div className="flight-time">
          <time>
            {timeline.start === null
              ? "—"
              : new Date(start).toLocaleTimeString([], { hour12: false })}
          </time>
          <time>
            {timeline.end === null
              ? "—"
              : new Date(end).toLocaleTimeString([], { hour12: false })}
          </time>
        </div>
      </div>
    </section>
  );
}
