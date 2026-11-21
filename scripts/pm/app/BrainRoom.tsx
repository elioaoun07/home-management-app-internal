import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Armchair, CircleDot, Crosshair, Footprints, Map, MessageCircle, ScanLine, X } from "lucide-react";
import type { LocalActivityEvent } from "./localRunActivityModel";
import type { LocalScene, LocalTimeline } from "./localRunScene";
import type { LocalLiveness } from "./localRunLiveness";
import { roomCassette, roomRows, roomZone } from "./transferRoomModel";
import type { ZoneId } from "./stage/config";
import { stations, zoneNames, type Finish, type View } from "./brain/layout";
import type { Presence, Signal, Target, WorldApi, WorldControls, WorldState } from "./brain/protocol";
import { deliveryTopic, topics } from "./brain/topics";
import { answerQuestion, questionLabels, questionsForPhase, signalFor, suggestions, type Answer, type Context, type Evidence, type Question } from "./brain/questions";
import "./brain-room.css";

type WorldModule = { createWorld(host: HTMLElement, controls: WorldControls, initial: WorldState): WorldApi };
const modulePath = "/app/assets/brain-room.js";
const initialPresence: Presence = { target: null, zone: null, area: "room" };
const seekKinds = ["previous", "present", "next"] as const;
const isStation = (target: Target | null): target is ZoneId =>
  !!target && stations.some(station => station.id === target);
const safePref = (key: string, value?: string) => {
  try { if (value !== undefined) localStorage.setItem(key, value); else return localStorage.getItem(key); } catch { return null; }
};
const stamp = (scene: LocalScene): WorldState["stamps"] => {
  const stamps: Partial<Record<ZoneId, string>> = {};
  if (scene.run.work.brief) stamps.brief = "brief";
  for (const row of scene.events) {
    const zone = roomZone(row);
    if (zone && row.label !== "Tool requested" && zone !== "verify" && zone !== "ship" && zone !== "handover" && zone !== "test") stamps[zone] = row.kind;
  }
  for (const check of scene.run.checks) {
    const status = check.error || check.exit === null ? "inconclusive" : check.exit === 0 ? "passed" : "failed";
    if (stamps.verify !== "failed" && (status !== "passed" || !stamps.verify)) stamps.verify = status;
  }
  if (roomCassette(scene) === "received") stamps.handover = "ready";
  if (scene.objectivesAccepted) stamps.test = "accepted";
  if (["shipped", "reverted", "push-pending", "revert-push-pending"].includes(scene.phase)) stamps.ship = scene.phase;
  return stamps;
};

export function BrainRoom({
  view, onView, onBoard, scene, timeline, health, replay, playing, question, reading, inspected,
  onZone, onEvidence, onQuestion,
}: {
  view: View; onView: (view: View) => void; onBoard: () => void;
  scene: LocalScene; timeline: LocalTimeline; health: LocalLiveness;
  replay: boolean; playing: boolean; question: boolean; reading: boolean; inspected: LocalActivityEvent | null;
  onZone: (zone: ZoneId | "all", source: HTMLElement) => void;
  onEvidence: (row: LocalActivityEvent, source: HTMLElement) => void;
  onQuestion: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null), api = useRef<WorldApi | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [presence, setPresence] = useState(initialPresence);
  const [finish, setFinish] = useState<Finish>(() => safePref("pm-room-finish") === "illustrated" ? "illustrated" : "realistic");
  const [quiet, setQuiet] = useState(() => safePref("pm-room-low-motion") === "true");
  const [opened, setOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [history, setHistory] = useState<Answer[]>([]);
  const [capture, setCapture] = useState<{ context: Context; scene: LocalScene; replay: boolean; health: LocalLiveness; question: boolean }>();
  const [tracking, setTracking] = useState<Signal | null>(null);
  const queued = useRef<ZoneId | null>(null);
  const topic = deliveryTopic(scene.run.work);
  const index = scene.latest ? timeline.events.findIndex(row => row.id === scene.latest?.id) : -1;
  const previous = scene.events.at(-2), present = scene.latest, next = timeline.events[index + 1];
  const visibleSignal = useMemo(() => signalFor(scene), [scene]);
  const animationSignal = !replay && question
    ? { id: "owner-question:" + scene.run.questions?.findLast(q => q.state === "open")?.id, zone: "handover", kind: "question" } as const
    : playing || !replay && health.state !== "link-down" ? visibleSignal : null;
  const worldState: WorldState = {
    view, finish, topic, phase: scene.phase, paused: opened || reading || load !== "ready",
    quiet, signal: animationSignal, stamps: stamp(scene), core: [!!previous, !!present, !!next],
  };
  const current = useRef({ state: worldState, controls: {} as WorldControls });
  current.current.state = worldState;

  function showAsk(source: HTMLElement | null) {
    const zone = inspected ? roomZone(inspected) : isStation(presence.target) ? presence.target : presence.zone;
    const row = inspected ?? (zone ? roomRows(scene, zone).at(-1) ?? null : null);
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
    if (target === "seat") { onView("seat"); showAsk(source); return; }
    if (target === "core") { api.current?.enter(); return; }
    if (target === "exit") { api.current?.exit(); return; }
    if (isStation(target)) { onZone(target, source); return; }
    const row = target === "previous" ? previous : target === "next" ? next : present;
    if (row) onEvidence(row, source);
  }
  current.current.controls = {
    presence: setPresence, ask: () => showAsk(viewport.current), inspect,
    failure: () => setLoad("failed"),
  };
  useEffect(() => {
    const host = viewport.current;
    if (!host) return;
    let alive = true, world: WorldApi | undefined;
    const path = attempt ? modulePath + "?retry=" + attempt : modulePath;
    void (import(path) as Promise<WorldModule>).then(({ createWorld }) => {
      if (!alive) return;
      world = createWorld(host, {
        presence: value => current.current.controls.presence(value),
        ask: () => current.current.controls.ask(),
        inspect: target => current.current.controls.inspect(target),
        failure: () => { world?.dispose(); api.current = null; current.current.controls.failure(); },
      }, current.current.state);
      api.current = world; setLoad("ready");
    }).catch(() => { if (alive) setLoad("failed"); });
    return () => { alive = false; world?.dispose(); api.current = null; };
  }, [attempt]);
  useEffect(() => { api.current?.update(current.current.state); });
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
    api.current?.play(signal);
  }

  const candidates = capture ? suggestions(capture.context, capture.scene.phase) : [];
  const list = expanded ? [...new Set([...candidates, ...questionsForPhase(capture?.scene.phase ?? "")])] : candidates;
  const chosenTarget = presence.target;
  const targetLabel = isStation(chosenTarget) ? zoneNames[chosenTarget] : chosenTarget === "seat" ? "Take seat" :
    chosenTarget === "core" ? "Inside ERA" : chosenTarget === "exit" ? "Back to room" :
    chosenTarget === "previous" ? "Previous action" : chosenTarget === "next" ? "Step forward" : "Selected action";
  const canInspect = chosenTarget && (!seekKinds.some(key => key === chosenTarget) ||
    (chosenTarget === "previous" ? previous : chosenTarget === "next" ? next : present));

  return <div className="era-brain" data-view={view} data-load={load} data-area={presence.area} data-finish={finish}>
    <div ref={viewport} className="era-brain-viewport" tabIndex={0} role="region" aria-label="3D room"
      aria-keyshortcuts="W A S D ArrowLeft ArrowRight ArrowUp ArrowDown E Q" />
    {load === "ready" && view === "walk" && <span className="era-brain-reticle" aria-hidden="true"><Crosshair size={17} /></span>}
    <div className="era-brain-header">
      <div className="era-brain-identity"><CircleDot size={17} aria-hidden="true" /><strong>{topics[topic][0]}</strong>
        <span>{presence.area === "core" ? "Inside ERA" : presence.zone ? zoneNames[presence.zone] : view === "map" ? "Overview" : view === "seat" ? "Seat" : "Walk"}</span>
      </div>
      <div className="era-brain-actions">
        <button type="button" aria-pressed={finish === "illustrated"} onClick={() => {
          const nextFinish = finish === "realistic" ? "illustrated" : "realistic";
          setFinish(nextFinish); safePref("pm-room-finish", nextFinish);
        }}>{finish === "realistic" ? "Realistic" : "Illustrated"}</button>
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
        {canInspect && <button type="button" onClick={() => inspect(chosenTarget)}><ScanLine size={16} /> {targetLabel}</button>}
        {view === "walk" && load === "ready" && <>
          {presence.area === "room" ? <label className="era-brain-travel">
            <span className="stage-announcement">Go to station</span>
            <select aria-label="Go to station" value="" onChange={event => {
              if (isStation(event.target.value as Target)) api.current?.go(event.target.value as ZoneId);
            }}><option value="" disabled>Go to station</option>{stations.map(s => <option key={s.id} value={s.id}>{zoneNames[s.id]}</option>)}</select>
          </label> : <button type="button" onClick={() => api.current?.exit()}>Back to room</button>}
          {presence.area === "room" && <button type="button" onClick={() => { api.current?.reset(); viewport.current?.focus(); }}>Recenter</button>}
          {presence.area === "room" && <button type="button" className="era-brain-mouse" onClick={() => {
            viewport.current?.focus({ preventScroll: true });
            try { void Promise.resolve(viewport.current?.requestPointerLock()).catch(() => {}); } catch { /* drag-to-look is available */ }
          }}>Mouse look</button>}
          {presence.area === "core" && <button type="button" disabled={!next} onClick={() => inspect("next")}>Step forward</button>}
        </>}
        {view !== "seat" && presence.area === "room" && visibleSignal && <button type="button" onClick={() => track()}>Track</button>}
      </div>
    </div>
    {tracking && <button type="button" className="era-brain-follow" onClick={() => {
      if (view === "walk") api.current?.go(tracking.zone);
      else { queued.current = tracking.zone; focusView("walk"); }
      setTracking(null);
    }}>Go to {zoneNames[tracking.zone]}</button>}
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
  </div>;
}
