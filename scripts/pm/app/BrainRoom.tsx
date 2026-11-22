import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Armchair, ArrowDownUp, CircleDot, Footprints, Map, MessageCircle, ScanLine, X } from "lucide-react";
import { ERAMark } from "@/components/shared/ERAMark";
import { useRoomSettled } from "./LibraryArrival";
import type { LocalActivityEvent } from "./localRunActivityModel";
import type { LocalScene, LocalTimeline } from "./localRunScene";
import type { LocalLiveness } from "./localRunLiveness";
import { roomRows, roomZone } from "./transferRoomModel";
import type { ZoneId } from "./stage/config";
import { ownerStationForZone, stations, zoneNames, type Finish, type View } from "./brain/layout";
import { OWNER_STATIONS, type OwnerStation } from "./ownerStations";
import type { DeliveryRoom } from "./OwnerWorkspace";
import type { Presence, RoomLighting, Signal, Target, WorldApi, WorldControls, WorldState } from "./brain/protocol";
import { deliveryTopic, isModuleTopic, topics } from "./brain/topics";
import { answerQuestion, questionLabels, questionsForPhase, signalFor, suggestions, type Answer, type Context, type Evidence, type Question } from "./brain/questions";
import "./brain-room.css";

type WorldModule = { createWorld(host: HTMLElement, controls: WorldControls, initial: WorldState): WorldApi };
const modulePath = "/app/assets/brain-room.js";
const initialPresence: Presence = { target: null, zone: null, area: "room" };
const seekKinds = ["previous", "present", "next"] as const;
const isStation = (target: Target | null): target is ZoneId =>
  !!target && stations.some(station => station.id === target);
const ownerBay = (target: string | null) => OWNER_STATIONS.find(station => "owner:" + station.id === target);
const safePref = (key: string, value?: string) => {
  try { if (value !== undefined) localStorage.setItem(key, value); else return localStorage.getItem(key); } catch { return null; }
};

export function BrainRoom({
  view, onView, onBoard, scene, timeline, health, lighting, replay, playing, question, reading, inspected,
  onZone, onEvidence, onQuestion, floor, owner, onFloor, onStation, currentStation, inspectedStation,
}: {
  view: View; onView: (view: View) => void; onBoard: () => void;
  scene: LocalScene; timeline: LocalTimeline; health: LocalLiveness;
  lighting: RoomLighting;
  replay: boolean; playing: boolean; question: boolean; reading: boolean; inspected: LocalActivityEvent | null;
  onZone: (zone: ZoneId | "all", source: HTMLElement) => void;
  onEvidence: (row: LocalActivityEvent, source: HTMLElement) => void;
  onQuestion: () => void;
  floor: DeliveryRoom; owner: NonNullable<WorldState["owner"]>;
  onFloor: (floor: DeliveryRoom) => void;
  onStation: (id: OwnerStation, source: HTMLElement) => void;
  currentStation: OwnerStation; inspectedStation: OwnerStation | null;
}) {
  const viewport = useRef<HTMLDivElement>(null), api = useRef<WorldApi | null>(null);
  const controlsHelp = useId();
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "failed">("loading");
  const roomSettled = useRoomSettled();
  useEffect(() => {
    if (load !== "loading") roomSettled?.();
  }, [load, roomSettled]);
  const [attempt, setAttempt] = useState(0);
  const [presence, setPresence] = useState(initialPresence);
  const [software, setSoftware] = useState(false);
  const [nativePreference, setNativePreference] = useState(() => safePref("pm-room-native-motion"));
  const nativeMotion = nativePreference == null ? !software : nativePreference === "true";
  const [finish, setFinish] = useState<Finish>(() => safePref("pm-room-finish") === "illustrated" ? "illustrated" : "realistic");
  const [quiet, setQuiet] = useState(() => safePref("pm-room-low-motion") === "true");
  const [opened, setOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [history, setHistory] = useState<Answer[]>([]);
  const [capture, setCapture] = useState<{ context: Context; scene: LocalScene; replay: boolean; health: LocalLiveness; question: boolean }>();
  const [tracking, setTracking] = useState<Signal | null>(null);
  const queued = useRef<ZoneId | null>(null);
  const queuedTrace = useRef<Signal | null>(null);
  const topic = deliveryTopic(scene.run.work);
  const cursor = scene.latest?.id ?? null;
  const index = useMemo(() => cursor === null ? -1 : timeline.events.findIndex(row => row.id === cursor), [timeline.events, cursor]);
  const previous = scene.events.at(-2), present = scene.latest, next = timeline.events[index + 1];
  const visibleSignal = useMemo(() => signalFor(scene), [scene]);
  const openQuestionId = question ? scene.run.questions?.findLast(q => q.state === "open")?.id : undefined;
  const paused = opened || reading || load !== "ready";
  const hasPrevious = !!previous, hasNext = !!next;
  const worldState = useMemo<WorldState>(() => ({
    view, floor, owner, nativeMotion, finish, topic, paused, quiet, replay, playing, cursor, lighting,
    signal: openQuestionId ? { id: "owner-question:" + openQuestionId, zone: "handover", kind: "question" } : visibleSignal,
    core: [hasPrevious, cursor !== null, hasNext],
  }), [view, floor, owner, nativeMotion, finish, topic, paused, quiet, replay, playing, cursor, lighting, openQuestionId, visibleSignal, hasPrevious, hasNext]);
  const current = useRef({ state: worldState, controls: {} as WorldControls });
  current.current.state = worldState;

  function showAsk(source: HTMLElement | null) {
    const berth = ownerBay(presence.target);
    const bayEvent = berth && scene.events.findLast(event => {
      const zone = roomZone(event);
      return zone && ownerStationForZone(zone) === berth.id;
    });
    const contextEvent = inspected ?? bayEvent;
    const zone = contextEvent ? roomZone(contextEvent) : isStation(presence.target) ? presence.target : presence.zone;
    const row = contextEvent ?? (zone ? roomRows(scene, zone).at(-1) ?? null : null);
    opener.current = source;
    setCapture({ scene, context: { zone, row }, replay, health, question });
    setExpanded(false);
    if (view !== "seat") setAnswer(null);
    setOpened(true);
  }
  function closeAsk() {
    setOpened(false);
    requestAnimationFrame(() => {
      const target = opener.current;
      if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true });
    });
  }
  function inspect(target: Target) {
    const source = viewport.current;
    if (!source) return;
    if (target === "lift") { onFloor(floor === "owner" ? "ai" : "owner"); return; }
    const berth = ownerBay(target);
    if (berth) { onStation(berth.id, source); return; }
    if (target === "seat") { onView("seat"); showAsk(source); return; }
    if (target === "core") { api.current?.enter(); return; }
    if (target === "exit") { api.current?.exit(); return; }
    if (isStation(target)) { onZone(target, source); return; }
    const row = target === "previous" ? previous : target === "next" ? next : present;
    if (row) onEvidence(row, source);
  }
  current.current.controls = {
    softwareRenderer: setSoftware,
    presence: setPresence, ask: () => showAsk(viewport.current), inspect,
    failure: () => setLoad("failed"),
  };
  useEffect(() => {
    const host = viewport.current;
    if (!host) return;
    let alive = true, world: WorldApi | undefined;
    const path = attempt ? modulePath + "?retry=" + attempt : modulePath;
    void (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ path) as Promise<WorldModule>).then(({ createWorld }) => {
      if (!alive) return;
      world = createWorld(host, {
        softwareRenderer: value => current.current.controls.softwareRenderer(value),
        presence: value => current.current.controls.presence(value),
        ask: () => current.current.controls.ask(),
        inspect: target => current.current.controls.inspect(target),
        failure: () => { world?.dispose(); api.current = null; current.current.controls.failure(); },
      }, current.current.state);
      api.current = world; setLoad("ready");
    }).catch(() => { if (alive) setLoad("failed"); });
    return () => { alive = false; world?.dispose(); api.current = null; };
  }, [attempt]);
  useEffect(() => {
    api.current?.update(worldState);
    if (api.current && !worldState.paused && queuedTrace.current) {
      api.current.play(queuedTrace.current);
      queuedTrace.current = null;
    }
  }, [worldState]);
  useEffect(() => {
    if (load === "ready" && current.current.state.view === "walk") viewport.current?.focus({ preventScroll: true });
  }, [load]);
  useEffect(() => {
    const element = dialog.current;
    if (!opened || !element) return;
    element.showModal();
    (element.querySelector<HTMLElement>(".era-brain-questions button") ?? element.querySelector("button"))?.focus();
    return () => element.close();
  }, [opened]);
  useEffect(() => {
    if (opened && answer) dialog.current?.querySelector<HTMLElement>(".era-brain-answer h3")?.focus();
  }, [answer, opened]);
  useEffect(() => {
    if (view !== "walk") return;
    if (queued.current) { api.current?.go(queued.current); queued.current = null; }
  }, [view]);

  function focusView(nextView: View) {
    if (nextView === "seat") {
      onView(nextView); showAsk(viewport.current); return;
    }
    onView(nextView);
    if (nextView === "walk") requestAnimationFrame(() => viewport.current?.focus({ preventScroll: true }));
  }
  function ask(value: Question) {
    if (!capture) return;
    const result = answerQuestion(value, capture.context, capture.scene, capture.health, capture.replay, capture.question);
    setAnswer(result);
    setHistory(prior => [...prior.slice(-7), result]);
  }
  function openEvidence(ref: Evidence) {
    if (!viewport.current) return;
    const source = viewport.current;
    setOpened(false);
    if (ref.row) onEvidence(ref.row, source);
    else onZone(ref.zone ?? "all", source);
  }
  function track(event?: LocalActivityEvent | null) {
    const row = event ?? scene.latest;
    if (!row) return;
    const zone = roomZone(row);
    if (!zone) return;
    const signal = row.id === visibleSignal?.id ? visibleSignal :
      { id: row.id, zone, kind: row.kind === "read" || row.kind === "edit" || row.kind === "command" ? row.kind : "setup" } satisfies Signal;
    if (!signal) return;
    setTracking(signal);
    if (worldState.paused) queuedTrace.current = signal;
    else api.current?.play(signal);
  }

  const candidates = capture ? suggestions(capture.context, capture.scene.phase) : [];
  const list = expanded ? [...new Set([...candidates, ...questionsForPhase(capture?.scene.phase ?? "")])] : candidates;
  const chosenTarget = presence.target;
  const displayedFloor = presence.floor ?? floor;
  const elevatorLabel = "Elevator to " + (displayedFloor === "ai" ? "Owner room" : "AI room");
  const targetLabel = chosenTarget === "lift" ? "Ride elevator" : ownerBay(chosenTarget)?.label ??
    (isStation(chosenTarget) ? zoneNames[chosenTarget] : chosenTarget === "seat" ? "Take seat" :
    chosenTarget === "core" ? "Inside ERA" : chosenTarget === "exit" ? "Back to room" :
    chosenTarget === "previous" ? "Previous action" : chosenTarget === "next" ? "Step forward" : "Selected action");
  const canInspect = chosenTarget && (!seekKinds.some(key => key === chosenTarget) ||
    (chosenTarget === "previous" ? previous : chosenTarget === "next" ? next : present));

  return <><div className="era-brain" data-view={view} data-floor={displayedFloor} data-load={load} data-area={presence.area} data-finish={finish}
    data-core-state={lighting.failed ? "damaged" : "healthy"} data-fault-station={lighting.faultZone ?? undefined}
    data-active-station={lighting.endpoint ?? undefined}>
    <div ref={viewport} className="era-brain-viewport" tabIndex={0} role="region" aria-label="3D room"
      aria-describedby={controlsHelp}
      aria-keyshortcuts="W A S D Shift+W ArrowLeft ArrowRight ArrowUp ArrowDown E Q Escape" />
    <span id={controlsHelp} className="stage-announcement">Click to look, WASD to move, Shift to sprint, E to interact, Q to ask, Escape to release. On touch, move with your left thumb and look with your right.</span>
    {load === "ready" && view === "walk" && <>
      <span className="era-brain-reticle" data-target={!!canInspect} aria-hidden="true" />
      <div className="era-brain-look-hud" aria-hidden="true">
        {canInspect && <span><kbd>E</kbd> {targetLabel}</span>}
        <span><kbd>WASD</kbd> Move</span><span><kbd>Shift</kbd> Sprint</span><span><kbd>Esc</kbd> Release</span>
      </div>
    </>}
    <div className="era-brain-header">
      <div className="era-brain-identity">
        {isModuleTopic(topic) ? <ERAMark module={topic} size={22} /> :
          <CircleDot size={18} aria-hidden="true" style={{ color: `hsl(${topics[topic][1]} 72% 70%)` }} />}
        <strong>{topics[topic][0]}</strong>
        <span>{presence.area === "core" ? "Inside ERA" : ownerBay(chosenTarget)?.label ??
          (presence.zone ? zoneNames[presence.zone] : view === "map" ? "Overview" : view === "seat" ? "Seat" : "Walk")}</span>
      </div>
      <div className="era-brain-actions">
        <button type="button" aria-pressed={finish === "illustrated"} onClick={() => {
          const nextFinish = finish === "realistic" ? "illustrated" : "realistic";
          setFinish(nextFinish); safePref("pm-room-finish", nextFinish);
        }}>{finish === "realistic" ? "Realistic" : "Illustrated"}</button>
        {(software || globalThis.devicePixelRatio > 1) && <button type="button" aria-pressed={nativeMotion} title="Keep full resolution while moving" onClick={() => {
          const next = String(!nativeMotion);
          setNativePreference(next); safePref("pm-room-native-motion", next);
        }}>Native detail</button>}
        <button type="button" aria-pressed={quiet} onClick={() => { setQuiet(!quiet); safePref("pm-room-low-motion", String(!quiet)); }}>Low motion</button>
        <button type="button" onClick={onBoard}>Board</button>
      </div>
    </div>
    {load !== "ready" && <div className="era-brain-notice" role="status">
      <strong>{load === "loading" ? "Opening room" : "3D room unavailable"}</strong>
      {load === "failed" && <><button type="button" onClick={() => { setLoad("loading"); setAttempt(attempt + 1); }}>Retry</button><button type="button" onClick={onBoard}>Open board</button></>}
    </div>}
    <div className="era-brain-bar">
      <div className="era-brain-actions" role="group" aria-label="View">
        <button type="button" aria-pressed={view === "map"} onClick={() => focusView("map")}><Map size={16} /> Map</button>
        <button type="button" aria-pressed={view === "walk"} onClick={() => focusView("walk")}><Footprints size={16} /> {view === "seat" ? "Stand up" : "Walk"}</button>
        <button type="button" aria-pressed={view === "seat"} onClick={() => focusView("seat")}><Armchair size={16} /> {view === "seat" ? "Talk" : "Take seat"}</button>
        <button type="button" onClick={event => showAsk(event.currentTarget)}><MessageCircle size={16} /> Ask ERA</button>
      </div>
      <div className="era-brain-actions" role="group" aria-label="Room actions">
        <button type="button" className="era-brain-elevator" aria-label={elevatorLabel} title={elevatorLabel}
          disabled={load !== "ready" || displayedFloor !== floor} onClick={() => {
            inspect("lift");
            if (view === "walk") viewport.current?.focus({ preventScroll: true });
          }}><ArrowDownUp size={16} />{elevatorLabel}</button>
        {canInspect && chosenTarget !== "lift" && <button type="button" onClick={() => inspect(chosenTarget)}><ScanLine size={16} /> {targetLabel}</button>}
        {view === "walk" && load === "ready" && <>
          {presence.area === "room" ? <label className="era-brain-travel">
            <span className="stage-announcement">Go to station</span>
            <select aria-label="Go to station" value="" onChange={event => {
              const destination = event.target.value as Target;
              const berth = ownerBay(destination);
              if (destination === "lift" || isStation(destination)) api.current?.go(destination);
              else if (berth) api.current?.go(`owner:${berth.id}`);
              viewport.current?.focus({ preventScroll: true });
            }}><option value="" disabled>Go to station</option>
              {displayedFloor === "owner" ? OWNER_STATIONS.map(s => <option key={s.id} value={"owner:" + s.id}>{s.label}</option>)
                : stations.map(s => <option key={s.id} value={s.id}>{zoneNames[s.id]}</option>)}
              <option value="lift">Elevator</option>
            </select>
          </label> : <button type="button" onClick={() => api.current?.exit()}>Back to room</button>}
          {presence.area === "room" && <button type="button" onClick={() => { api.current?.reset(); viewport.current?.focus(); }}>Recenter</button>}
          <button type="button" className="era-brain-mouse" title="Click to look · WASD to walk · Shift to sprint · Esc to release"
            onClick={() => api.current?.captureMouse()}>Mouse look</button>
          {presence.area === "core" && <button type="button" disabled={!next} onClick={() => inspect("next")}>Step forward</button>}
        </>}
        {view === "walk" && presence.area === "room" && lighting.faultZone
          ? <button type="button" onClick={() => api.current?.inspectBreak()}>Inspect break</button>
          : view !== "seat" && presence.area === "room" && visibleSignal && <button type="button" onClick={() => track()}>Track</button>}
      </div>
    </div>
    {tracking && <button type="button" className="era-brain-follow" onClick={() => {
      if (view === "walk") api.current?.go(tracking.zone);
      else { queued.current = tracking.zone; focusView("walk"); }
      setTracking(null);
    }}>Go to {displayedFloor === "owner" ? ownerBay("owner:" + ownerStationForZone(tracking.zone))?.label : zoneNames[tracking.zone]}</button>}
    {opened && createPortal(<dialog ref={dialog} className="era-brain-dialog"
      aria-labelledby="era-brain-dialog-title" data-seated={view === "seat"}
      onCancel={event => { event.preventDefault(); closeAsk(); }}
      onKeyDown={event => {
        if (!answer && /^[1-3]$/u.test(event.key) && candidates[Number(event.key) - 1]) {
          event.preventDefault(); ask(candidates[Number(event.key) - 1]);
        }
      }}>
      <header><span>{topics[topic][0]}</span><h2 id="era-brain-dialog-title">{view === "seat" ? "Talk with ERA" : "Ask ERA"}</h2>
        <button type="button" aria-label="Close questions" onClick={closeAsk}><X size={20} /></button>
      </header>
      {answer ? <div className="era-brain-answer">
        <p className="era-brain-scope">{answer.replay ? "Replay" : "Recorded"} · {new Date(answer.at).toLocaleTimeString([], { hour12: false })}</p>
        <h3 tabIndex={-1}>{answer.label}</h3><p role="status">{answer.text}</p>
        <div className="era-brain-actions">{answer.evidence.map((ref, i) => <button type="button" onClick={() => openEvidence(ref)} key={i}>{ref.label}</button>)}</div>
        <div className="era-brain-actions">
          <button type="button" onClick={() => {
            setAnswer(null); if (capture) setCapture({ ...capture, scene, health, replay, question });
          }}>Ask another</button>
          {view !== "seat" && <button type="button" onClick={() => onView("seat")}>Discuss at seat</button>}
          {answer.evidence.some(ref => ref.row && roomZone(ref.row)) && <button type="button" onClick={() => {
            track(answer.evidence.find(ref => ref.row && roomZone(ref.row))?.row); closeAsk();
          }}>Track in room</button>}
        </div>
      </div> : <div className="era-brain-questions">
        {list.map(value => <button key={value} type="button" onClick={() => ask(value)}>{
          value === "wrong" && capture?.scene.phase === "cancelled" ? "Where did it stop?" :
          value === "changed" && capture?.context.row?.kind === "edit" ? "What changed here?" : questionLabels[value]
        }</button>)}
        {!expanded && <button type="button" onClick={() => setExpanded(true)}>More questions</button>}
      </div>}
      {view === "seat" && history.length > 1 && <details><summary>Earlier answers</summary><ol>
        {history.slice(0,-1).reverse().map((item,i) => <li key={i}><button type="button" onClick={() => setAnswer(item)}>{item.label}</button></li>)}
      </ol></details>}
      {!replay && question && <button type="button" onClick={() => { setOpened(false); onQuestion(); }}>Reply to agent</button>}
    </dialog>, document.body)}
  </div>
    {floor === "owner" && <nav className="room-steps owner-floor-steps" aria-label="Owner workstations">
      {OWNER_STATIONS.map(({ id, label }) => <button type="button" key={id} aria-pressed={id === inspectedStation}
        aria-current={id === currentStation ? "step" : undefined} data-reached={owner.signals[id] === "done"}
        onClick={event => {
          if (view === "walk") api.current?.go(`owner:${id}`);
          onStation(id, event.currentTarget);
        }}>{label}</button>)}
    </nav>}
  </>;
}
