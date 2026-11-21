import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowLeftRight, BookOpen, ChevronLeft, ChevronRight, Disc3, Radio, X } from "lucide-react";
import { Markdown } from "./components";
import { BlackBox } from "./BlackBox";
import { LocalChat } from "./LocalChat";
import { LocalRunVerificationPanel } from "./LocalRunVerificationPanel";
import { chatThread } from "./localChatModel";
import type { LocalActivityEvent } from "./localRunActivityModel";
import { stripAnsi } from "./localRunFailure";
import { localCheckLabel, localRunLabel } from "./localRunModel";
import type { LocalScene, LocalTimeline } from "./localRunScene";
import type { LocalLiveness } from "./localRunLiveness";
import { ZONE_BY_ID, type ZoneId } from "./stage/config";
import type { ZoneBoardState } from "./stage/zoneModel";
import { BrainRoom } from "./BrainRoom";
import type { View } from "./brain/layout";
import { roomLighting } from "./brain/lighting";
import { resolveMark, roomCassette, roomCheck, roomMoment, roomRows, roomStepRow, roomSteps, roomZone, type RoomMark } from "./transferRoomModel";
import "./transfer-room.css";

const zoneLabel = (zone: ZoneId) => {
  if (zone === "brief") return "Plan";
  if (zone === "think") return "Comms";
  const label = ZONE_BY_ID[zone].label;
  return label[0] + label.slice(1).toLowerCase();
};
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour12: false });
const actor = (event: LocalActivityEvent) =>
  event.agent?.role === "subagent" ? event.agent.id || "Subagent" : event.agent?.executor;
const roomArt = {
  "--room-work-plate": 'url("/assets/transfer-room.webp")',
  "--room-handoff-plate": 'url("/assets/transfer-handoff.webp")',
  "--room-cassette": 'url("/assets/transfer-cassette.webp")',
} as CSSProperties;
type Filter = ZoneId | "all";
type Reader = { zone: Filter; mark: RoomMark | null };
type OpenMoment = NonNullable<ReturnType<typeof roomMoment>>;

function EventOutput({ event, scene }: { event: LocalActivityEvent; scene: LocalScene }) {
  const check = roomCheck(scene, event);
  const output = check && [check.stdout, check.stderr, check.error]
    .filter((value): value is string => !!value)
    .map(stripAnsi)
    .join("\n");
  const recorded = event.kind === "failure" && event.summary.length > 2000
    ? "See error details"
    : stripAnsi(event.summary);
  return (
    <>
      <div className="room-output-meta">
        <strong>{event.label}</strong>
        {actor(event) && <span>{actor(event)}</span>}
        <time dateTime={event.at}>{time(event.at)}</time>
      </div>
      {!!event.paths.length && <ul className="room-paths">{event.paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul>}
      {event.kind === "message" ? <p className="room-quote">{recorded}</p> : <pre>{recorded}</pre>}
      {check && <><strong>{localCheckLabel(check)}</strong>{output ? <pre>{output}</pre> : <p className="quiet">No output recorded</p>}</>}
      {event.kind === "command" && <p className="quiet">No output recorded</p>}
    </>
  );
}

function ComparePane({ moment, label }: { moment: OpenMoment | null; label: string }) {
  return (
    <section aria-label={`Moment ${label}`}>
      <h3>{label}</h3>
      {moment ? <>
        <EventOutput {...moment} />
        <ul className="room-check-summary">
          {moment.scene.seals.map((seal) => <li key={seal.name}>{seal.name} · {seal.state}</li>)}
        </ul>
      </> : <p className="quiet">Moment unavailable</p>}
    </section>
  );
}

export function TransferRoom({
  active, timeline, scene, health, liveHealth, replay, cursorMissing, playing, zones, question, onLive, onSeek, onTransportKey, onQuestion, onChanges, testSteps, brain,
}: {
  active: boolean;
  timeline: LocalTimeline;
  scene: LocalScene;
  health: LocalLiveness;
  liveHealth: LocalLiveness;
  replay: boolean;
  cursorMissing: boolean;
  playing: boolean;
  zones: ZoneBoardState;
  question: boolean;
  onLive: () => void;
  onSeek: (event: LocalActivityEvent) => void;
  onTransportKey: (key: " " | "l") => void;
  onQuestion: () => void;
  onChanges: () => void;
  testSteps?: ReactNode;
  brain?: { view: View; onView: (view: View) => void; onBoard: () => void; blocked: boolean };
}) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [pins, setPins] = useState<readonly [RoomMark | null, RoomMark | null]>([null, null]);
  const [compare, setCompare] = useState(false);
  const [smallPane, setSmallPane] = useState<"A" | "B">("A");
  const latest = timeline.events.at(-1);
  const selected = scene.latest;
  const selectedKind = selected?.kind ?? "event";
  const cassette = roomCassette(scene);
  const previous = roomStepRow(timeline, selected?.id, !replay, -1);
  const next = roomStepRow(timeline, selected?.id, !replay, 1);
  const visible = useMemo(() => reader ? roomRows(scene, reader.zone) : [], [scene, reader]);
  const opened = resolveMark(scene.events, reader?.mark ?? null);
  const momentA = useMemo(() => compare ? roomMoment(timeline, pins[0]) : null, [compare, timeline, pins]);
  const momentB = useMemo(() => compare ? roomMoment(timeline, pins[1]) : null, [compare, timeline, pins]);
  const readerTitle = useRef<HTMLHeadingElement>(null);
  const readerBody = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const compareReturn = useRef<HTMLElement | null>(null);
  const compareTop = useRef(0);
  const listTop = useRef(0);
  const reselect = useRef<(() => void) | null>(null);
  const drag = useRef<{ x: number; start: number; current: number } | null>(null);
  const focusReader = () => {
    readerTitle.current?.focus({ preventScroll: true });
    readerTitle.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  };

  function openZone(zone: Filter, control: HTMLElement) {
    returnTo.current = control;
    listTop.current = 0;
    if (readerBody.current) readerBody.current.scrollTop = 0;
    reselect.current = focusReader;
    setCompare(false);
    const rows = ["all", "brief", "verify", "handover", "test", "ship", "think"].includes(zone)
      ? [] : roomRows(scene, zone);
    setReader({ zone, mark: rows.length === 1 ? rows[0] : null });
  }

  function openRow(event: LocalActivityEvent) {
    listTop.current = readerBody.current?.scrollTop ?? 0;
    if (readerBody.current) readerBody.current.scrollTop = 0;
    reselect.current = focusReader;
    setReader({ zone: reader?.zone ?? roomZone(event) ?? "all", mark: event });
  }

  useEffect(() => {
    if (!active) return;
    reselect.current?.();
    reselect.current = null;
  }, [active, reader, compare]);

  function close() {
    if (compare) {
      setCompare(false);
      reselect.current = () => {
        if (readerBody.current) readerBody.current.scrollTop = compareTop.current;
        (readerBody.current?.querySelector<HTMLButtonElement>("[data-room-compare]") ?? compareReturn.current ?? readerTitle.current)?.focus({ preventScroll: true });
      };
    } else if (reader?.mark) {
      reselect.current = () => {
        if (readerBody.current) readerBody.current.scrollTop = listTop.current;
        const row = readerBody.current?.querySelector<HTMLButtonElement>(
          `[data-room-action="${CSS.escape(reader.mark!.id)}"]`,
        );
        (row ?? readerTitle.current)?.focus({ preventScroll: true });
      };
      setReader({ zone: reader.zone, mark: null });
    } else {
      setReader(null);
      returnTo.current?.focus({ preventScroll: true });
    }
  }

  function jog(event: LocalActivityEvent | undefined) {
    if (!event) return;
    if (reader?.mark && !compare) setReader({ zone: roomZone(event) ?? "all", mark: event });
    onSeek(event);
  }

  const pin = (slot: 0 | 1, event: LocalActivityEvent) =>
    setPins((current) => slot === 0 ? [event, current[1]] : [current[0], event]);
  const comparisonReady = !!pins[0] && !!pins[1];
  const position = timeline.events.findIndex((event) => event.id === selected?.id);
  const roomReplay = !!brain && replay;
  const currentHealth = roomReplay ? health : liveHealth;
  const { active: working, state: healthState } = currentHealth;
  const lighting = useMemo(() => roomLighting(scene, zones, { active: working, state: healthState }, question), [scene, zones, working, healthState, question]);
  const currentEvent = roomReplay ? selected : latest;
  const status = currentHealth.state === "thinking"
    ? currentHealth.caption.split(" · ")[0] : currentHealth.caption;
  const handover = scene.run.handover;
  const fault = scene.phase === "failed" || scene.run.interrupted;
  const preview = selected && (selected.paths[0] ?? (selected.kind === "message" ? selected.summary : selected.detail));
  const historicalThread = useMemo(() => reader?.zone === "think" && replay ? chatThread(scene.run, 40) : [], [reader?.zone, replay, scene.run]);

  return (
    <section
      aria-label="Transfer Room"
      className="transfer-room"
      style={roomArt}
      hidden={!active}
      data-brain={!!brain}
      data-reader={!!reader || compare}
      data-comparing={compare}
      onKeyDown={(event) => {
        if (event.key === "Escape" && (reader || compare)) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="room-deck">
        <div className="room-now">
          <Radio size={14} aria-hidden="true" />
          <span className="room-kicker">{roomReplay ? "Replay" : "Now"}</span>
          <strong>{status}</strong>
          {currentEvent && <>
            <span className="room-now-event" title={currentEvent.paths[0] || currentEvent.summary}>
              {[currentEvent.label, currentEvent.paths[0]?.split("/").at(-1) || currentEvent.detail, actor(currentEvent)].filter(Boolean).join(" · ")}
            </span>
            <time dateTime={currentEvent.at}>{time(currentEvent.at)}</time>
          </>}
          {question && <button type="button" className="room-question" onClick={onQuestion}>Question</button>}
        </div>
        {brain ? <BrainRoom key={scene.run.run_id} {...brain} scene={scene} timeline={timeline} health={currentHealth} lighting={lighting}
          replay={replay} playing={playing} question={question} reading={!!reader || compare || brain.blocked}
          inspected={opened} onZone={openZone} onQuestion={onQuestion}
          onEvidence={(event, source) => {
            returnTo.current = source;
            setCompare(false);
            onSeek(event);
            openRow(event);
          }}
        /> : <div className="room-bay" data-seat-state={health.state} data-cassette={cassette} data-has-work={scene.plates > 0 || !!scene.run.head} data-owner={(!replay && question) || cassette === "received"}>
          <div className="room-picture" aria-hidden="true">
            <div className="room-backdrop"><div className="room-handoff-pose" /></div>
            <div className="room-worklight" />
            <div className="room-eye" />
            <div className="room-sled">
              <div className="room-sprite" />
              <span className="room-seam" />
            </div>
            <span className="room-scan" key={selected?.id} data-kind={
              (replay ? playing : liveHealth.active) && !question ? selectedKind : undefined
            } />
            <div className="room-wheel-grip"
              onPointerDown={(event) => {
                if (event.button !== 0 || !timeline.events.length) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, start: Math.max(position, 0), current: Math.max(position, 0) };
              }}
              onPointerMove={(event) => {
                const gesture = drag.current;
                if (!gesture) return;
                const index = Math.max(0, Math.min(timeline.events.length - 1, gesture.start + Math.trunc((event.clientX - gesture.x) / 18)));
                if (index === gesture.current) return;
                gesture.current = index;
                jog(timeline.events[index]);
              }}
              onLostPointerCapture={() => { drag.current = null; }}
            />
          </div>
          {replay && <div className="room-scene-label">
            <span className="room-kicker">Replay</span>
            <strong>{fault ? localRunLabel(scene.run) : cassette === "received" ? "Your turn" : localRunLabel(scene.run)}</strong>
            {selected && <time dateTime={selected.at}>{time(selected.at)}</time>}
          </div>}
          <button className="room-cassette-button" type="button" onClick={(event) => openZone(
            fault || scene.phase === "cancelled" ? "all" : cassette === "received" ? "handover" : cassette === "verify" ? "verify" : ["shipped", "reverted"].includes(cassette) ? "ship" : "build",
            event.currentTarget,
          )}>
            {fault ? "Error details" : scene.phase === "cancelled" ? "Last activity" : cassette === "received" ? "Handoff" : cassette === "verify" ? "Checks" : "Cassette"}
          </button>
          {preview && <span className="room-preview" title={preview}>{preview}</span>}
        </div>}
        <nav className="room-steps" aria-label="Room steps">
          <button type="button" onClick={(event) => openZone("brief", event.currentTarget)} aria-pressed={reader?.zone === "brief"}><BookOpen size={15} /> Plan</button>
          {roomSteps.map(({ label, zones: group }) => {
            const lit = group.some((zone) => zones.zones.some((fact) => fact.id === zone && fact.status !== "off" && fact.status !== "skipped"));
            const checked = group.some((zone) => zone === reader?.zone);
            const powered = !!brain && group.some(zone => zone === lighting.endpoint);
            return <button key={label} type="button" aria-pressed={checked} aria-current={powered ? "step" : undefined} data-reached={lit} onClick={(event) => openZone(group.find((zone) => zone === label.toLowerCase()) ?? group[0], event.currentTarget)}>{label}</button>;
          })}
          <button type="button" onClick={(event) => openZone("all", event.currentTarget)} aria-pressed={reader?.zone === "all"}>All actions</button>
        </nav>
        {!brain && <div className="room-jog" aria-label="Jog wheel">
          <button type="button" aria-label="Previous action" onClick={() => jog(previous)} disabled={!previous}><ChevronLeft size={20} /></button>
          <label className="room-wheel">
            <Disc3 size={24} aria-hidden="true" style={{ "--room-detent": `${(Math.max(0, position) % 12) * 30}deg` } as CSSProperties} />
            <input
              type="range" aria-label="Recorded action" min={0} max={Math.max(0, timeline.events.length - 1)}
              disabled={!timeline.events.length}
              value={Math.max(0, position)} aria-valuetext={selected ? `${position + 1} of ${timeline.events.length} · ${selected.label}` : "No activity"}
              onChange={(event) => jog(timeline.events[Number(event.currentTarget.value)])}
              onKeyDown={(event) => {
                if (event.key === " " || event.key.toLowerCase() === "l") {
                  event.preventDefault();
                  onTransportKey(event.key === " " ? " " : "l");
                }
              }}
            />
          </label>
          <button type="button" aria-label="Next action" onClick={() => jog(next)} disabled={!next}><ChevronRight size={20} /></button>
          <output aria-live={playing ? "off" : "polite"}>{cursorMissing ? "Action unavailable" : replay && selected ? selected.label : "Live"}</output>
          {replay && <button type="button" onClick={onLive}>Live</button>}
        </div>}
      </div>
      {(reader || compare) && <section className="room-reader" aria-label="Room output">
        <header>
          {reader?.mark && !compare && <button type="button" aria-label="Back to actions" onClick={close}><ArrowLeft size={18} /></button>}
          <h2 ref={readerTitle} tabIndex={-1}>{compare ? "Compare" : reader?.mark ? "Output" : reader?.zone === "all" ? "All actions" : reader && zoneLabel(reader.zone)}</h2>
          <button type="button" aria-label={compare ? "Close comparison" : "Close output"} onClick={() => {
            if (compare) close();
            else {
              setReader(null);
              returnTo.current?.focus({ preventScroll: true });
            }
          }}><X size={18} /></button>
        </header>
        <div className="room-reader-body" ref={readerBody}>
          {compare ? <>
            <div className="room-output-actions">
              <button type="button" onClick={() => setPins(([a, b]) => [b, a])}><ArrowLeftRight size={15} /> Swap</button>
              <div className="room-compare-tabs" role="group" aria-label="Compare moments">
                <button type="button" aria-pressed={smallPane === "A"} onClick={() => setSmallPane("A")}>A</button>
                <button type="button" aria-pressed={smallPane === "B"} onClick={() => setSmallPane("B")}>B</button>
              </div>
            </div>
            <div className="room-comparison" data-pane={smallPane}><ComparePane label="A" moment={momentA} /><ComparePane label="B" moment={momentB} /></div>
          </> : reader?.mark ? (
            opened ? <>
              <EventOutput event={opened} scene={scene} />
              <div className="room-output-actions">
                <button type="button" onClick={() => onSeek(opened)}>Replay here</button>
                <button type="button" aria-pressed={pins[0]?.id === opened.id} onClick={() => pin(0, opened)}>Pin A</button>
                <button type="button" aria-pressed={pins[1]?.id === opened.id} onClick={() => pin(1, opened)}>Pin B</button>
                {comparisonReady && <button type="button" data-room-compare onClick={(event) => {
                  compareReturn.current = event.currentTarget;
                  compareTop.current = readerBody.current?.scrollTop ?? 0;
                  if (readerBody.current) readerBody.current.scrollTop = 0;
                  reselect.current = focusReader;
                  setSmallPane("A");
                  setCompare(true);
                }}>Compare</button>}
              </div>
            </> : <p className="quiet">Action unavailable at this moment</p>
          ) : reader && <>
            <nav className="room-substeps" aria-label="Zones">
              {roomSteps.find((step) => step.zones.some((zone) => zone === reader.zone))?.zones.map((zone) =>
                <button key={zone} type="button" aria-pressed={zone === reader.zone} onClick={() => { setReader({ zone, mark: null }); if (readerBody.current) readerBody.current.scrollTop = 0; }}>{zoneLabel(zone)}</button>,
              )}
            </nav>
            {reader.zone === "brief" && (scene.run.work.brief ? <Markdown raw={scene.run.work.brief} /> : <p className="quiet">Plan not recorded</p>)}
            {fault && reader.zone === "all" && <BlackBox run={scene.run} hideAttempt />}
            {reader.zone === "build" && scene.run.head && <button type="button" onClick={onChanges}>Changes</button>}
            {reader.zone === "verify" && <LocalRunVerificationPanel viewRun={scene.run} snapshot={scene} passed={scene.counts.checks} />}
            {(reader.zone === "test" || reader.zone === "handover") && <>
              {handover && <>
                {handover.summary && <p>{handover.summary}</p>}
                <p>{handover.acceptance.state} · {handover.scenarios.length} scenarios</p>
                <ol className="room-paths">{handover.scenarios.map((scenario) => <li key={scenario.id}>
                  <details><summary>{scenario.title}</summary><ol>{scenario.steps.map((step, index) =>
                    <li key={index}><strong>{step.action}</strong><p>{step.expected}</p></li>,
                  )}</ol></details>
                </li>)}</ol>
              </>}
              {testSteps}
            </>}
            {reader.zone === "ship" && scene.run.merge && <code>{scene.run.merge}</code>}
            {reader.zone === "think" && (replay ? historicalThread.map((entry) => (
              <p className="room-quote" key={entry.key}>{entry.kind === "agent" ? entry.text : entry.kind === "owner" ? entry.message.text : entry.kind === "answer" ? Object.values(entry.answers).join(" · ") : entry.question.questions.map((item) => item.question).join(" · ")}</p>
            )) : <LocalChat run={timeline.run} />)}
            {visible.length > 0 && <ol className="room-actions">
              {visible.map((event) => <li key={event.id}>
                <button type="button" data-room-action={event.id} onClick={() => openRow(event)}>
                  <strong>{event.label}</strong>
                  <span>{event.paths[0] || (event.kind === "message" ? event.summary : event.detail)}</span>
                  <time dateTime={event.at}>{time(event.at)}</time>
                </button>
              </li>)}
            </ol>}
            {!visible.length && reader.zone !== "brief" && !fault && <p className="quiet">No actions recorded</p>}
            {reader.zone === "all" && timeline.truncated && <p className="quiet">Retained activity · {timeline.events[0] && time(timeline.events[0].at)}</p>}
          </>}
        </div>
      </section>}
    </section>
  );
}
