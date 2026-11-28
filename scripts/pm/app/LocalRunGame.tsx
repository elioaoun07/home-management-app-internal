import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Armchair, Footprints, Map, Maximize, Minimize2, RotateCw, X } from "lucide-react";
import { LocalActions, type LocalAct, type LocalAction, type LocalRunView } from "./LocalDelivery";
import { DeliveryWorkshop } from "./DeliveryWorkshop";
import { LocalRunConsole, type Tool } from "./LocalRunConsole";
import { buildTimeline, sceneAt } from "./localRunScene";
import { clock, liveness, type LocalPollHealth } from "./localRunLiveness";
import { useStageClock, type StagingUi } from "./useStageClock";
import { LocalRunReplay } from "./LocalRunReplay";
import { LOCAL_RUN_TOOLS, LocalRunTools } from "./LocalRunTools";
import { BlackBox } from "./BlackBox";
import { Debrief } from "./Debrief";
import { StagePresence } from "./StagePresence";
import { LocalChat } from "./LocalChat";
import { TransferRoom } from "./TransferRoom";
import type { LocalActivityEvent } from "./localRunActivityModel";
import { resolveMark, type RoomMark } from "./transferRoomModel";
import { openQuestion } from "./localChatModel";
import { type AttentionItem } from "./localRunAttention";
import {
  attentionActionAllowed,
  localBoardActionAllowed,
} from "./localBoardActions";
import {
  useLocalAttention,
  useRunHealth,
  useAttentionProjection,
} from "./useLocalAttention";
import { useRoute, useWorld } from "./state";
import { cleanStageStreak, cleanShipIncrement } from "./stage/game";
import { zoneEvidence } from "./stage/zoneModel";
import { HUD, ZONE_BY_ID, type ZoneId } from "./stage/config";
import { BoardClock, BoardTelemetry, AttentionAge } from "./stage/ClockLeaves";
import type { BoardPlacement } from "./stage/types";
import type { StageTempo, ReplayMode } from "./stage/director";
import type { View } from "./brain/layout";
import "./local-run-game.css";
import { Back } from "./components";
import { attemptLabel, displayTitle, newAttemptHref } from "./localRunModel";
import { OwnerWorkspace, RoomSwitch, opensAtOwner, type DeliveryRoom } from "./OwnerWorkspace";
import { LocalStopControl } from "./LocalStopControl";
import { currentOwnerStation, type OwnerStation } from "./ownerStations";

export function LocalRunGame({
  run,
  busy,
  act,
  patch,
  poll,
  retry,
}: {
  run: LocalRunView;
  busy: boolean;
  act: LocalAct;
  patch: string | null;
  poll?: LocalPollHealth;
  retry?: () => void;
}) {
  const { world } = useWorld(),
    streak = cleanStageStreak(world.cockpit);
  const history = useRef({ previous: world.cockpit, current: world.cockpit });
  if (history.current.current !== world.cockpit)
    history.current = {
      previous: history.current.current,
      current: world.cockpit,
    };
  const cleanIncrement = cleanShipIncrement(
    history.current.previous,
    history.current.current,
    run,
  );
  const timeline = useMemo(() => buildTimeline(run), [run]);
  const arrivingFromLibrary = useRoute().query.get("arrival") === "library";
  const [room, setRoom] = useState<DeliveryRoom>(() => !arrivingFromLibrary && opensAtOwner(run) ? "owner" : "ai");
  const [ownerStation, setOwnerStation] = useState<OwnerStation>();
  const [view, setView] = useState<"overview" | "seat">(() => {
    try {
      return localStorage.getItem("pm-local-game-view") === "seat" ? "seat" : "overview";
    } catch {
      return "overview";
    }
  });
  const [visitedSeat, setVisitedSeat] = useState(arrivingFromLibrary || view === "seat");
  const [brainView, setBrainView] = useState<View | null>(arrivingFromLibrary ? "walk" : null);
  const [quiet, setQuiet] = useState(() => {
    try { return localStorage.getItem("pm-room-low-motion") === "true"; }
    catch { return false; }
  });
  const changeQuiet = (value: boolean) => {
    setQuiet(value);
    try { localStorage.setItem("pm-room-low-motion", String(value)); }
    catch { /* Keep the preference for this visit. */ }
  };
  const inRoom = !!brainView || view === "seat";
  const consoleId = useId();
  const [wideReader, setWideReader] = useState(false);
  const [tool, setTool] = useState<Tool>("activity"),
    [consoleOpen, setConsoleOpen] = useState(false),
    [fileFilter, setFileFilter] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState<ReplayMode>("recap"),
    [replayTime, setReplayTime] = useState<number | null>(null),
    [replayCursor, setReplayCursor] = useState<string | null>(null),
    [replayMark, setReplayMark] = useState<RoomMark | null>(null);
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState<1 | 4>(1),
    [tempo, setTempo] = useState<StageTempo>(1);
  const [positions, setPositions] = useState<BoardPlacement[]>([]),
    [railOpen, setRailOpen] = useState(() => !arrivingFromLibrary && !!openQuestion(run)),
    [selectedAttentionId, setSelectedAttentionId] = useState<string>();
  const [staging, setStaging] = useState<StagingUi>({
    zone: null,
    label: "",
    event: null,
    message: null,
    beat: "idle",
    gap: null,
  });
  const stageRef = useRef<HTMLElement>(null),
    panel = useRef<HTMLElement>(null);
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const realHealth = useRunHealth(run, poll);
  const replay = replayTime !== null;
  const cursorMissing = replay && !!replayCursor && (replayMark
    ? !resolveMark(timeline.events, replayMark)
    : !timeline.events.some((event) => event.id === replayCursor));
  const observed = useRef(Date.now());
  if (realHealth.state !== "link-down") observed.current = Date.now();
  const snapshot = useMemo(
    () =>
      sceneAt(
        timeline,
        cursorMissing && timeline.start !== null && replayTime !== null
          ? Math.min(replayTime, timeline.start - 1)
          : replayTime ?? (realHealth.state === "link-down" ? observed.current : Date.now()),
        replayTime === null ? undefined : (replayCursor ?? undefined),
      ),
    [timeline, replayTime, replayCursor, realHealth.state, cursorMissing],
  );
  const health = liveness(
    snapshot.run,
    replayTime ?? Date.now(),
    replayTime === null ? poll : {},
  );
  const ownerRun = replay ? snapshot.run : run;
  const {
    attention: realAttention,
    acknowledge,
    seen,
  } = useLocalAttention(run, realHealth.state);
  const attention = useAttentionProjection(
    run,
    snapshot,
    replayTime,
    health.state,
    seen,
    realAttention,
  );
  const zones = useMemo(
    () =>
      zoneEvidence(
        snapshot,
        !inRoom && staging.event && staging.beat !== "idle"
          ? { event: staging.event, stage: staging.beat }
          : null,
        attention,
        cursorMissing,
      ),
    [snapshot, staging.event, staging.beat, attention, inRoom, cursorMissing],
  );
  const replayAttention = useMemo(() => replay ? attention.map((item): AttentionItem =>
    item.action.run === "brief" || item.action.run === "summary"
      ? item
      : { ...item, action: { label: "", run: "none" } },
  ) : attention, [attention, replay]);
  const onRailOpenChange = useCallback((open: boolean) => {
    setRailOpen(open);
    if (open && matchMedia(`(max-width: ${HUD.railBelow}px)`).matches)
      setConsoleOpen(false);
  }, []);
  const selectTool = useCallback((next: Tool) => {
    drawerTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTool(next);
    setConsoleOpen(true);
    if (matchMedia(`(max-width: ${HUD.railBelow}px)`).matches)
      setRailOpen(false);
  }, []);
  const openTool = useCallback((next: Tool) => {
    drawerTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTool(next);
    setConsoleOpen(true);
    if (matchMedia(`(max-width: ${HUD.railBelow}px)`).matches)
      setRailOpen(false);
    requestAnimationFrame(() => {
      panel.current?.focus({ preventScroll: true });
    });
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (!consoleOpen || event.key !== "Escape" || event.defaultPrevented) return;
      setConsoleOpen(false);
      drawerTrigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [consoleOpen]);
  const action = useCallback(
    (value: LocalAction, evidence?: Record<string, string>) => {
      if (replay || !localBoardActionAllowed(run, busy, value)) return;
      act(value, evidence);
    },
    [act, run, busy, replay],
  );
  const enterRoom = useCallback((next: DeliveryRoom, station?: OwnerStation) => {
    if (next === room && !station) return;
    setConsoleOpen(false);
    setRailOpen(false);
    if (station) {
      setOwnerStation(station);
      setBrainView(null);
    }
    setRoom(next);
  }, [room]);
  const canAct = useCallback(
    (item: AttentionItem) => attentionActionAllowed(run, busy, item),
    [run, busy],
  );
  const onAttention = useCallback(
    (item: AttentionItem, command?: "primary" | "done" | "copy") => {
      if (replay && item.action.run !== "brief" && item.action.run !== "summary") return;
      setSelectedAttentionId(item.id);
      if (command === "done") {
        if (item.kind === "sql") acknowledge(item.id, item.state !== "done");
        return;
      }
      if (command === "copy" || item.action.run === "copy-path") {
        if (item.detail)
          void navigator.clipboard?.writeText(item.detail).catch(() => {});
        return;
      }
      if (item.action.run === "brief") {
        if (!replay) acknowledge(item.id);
        openTool("brief");
      } else if (item.action.run === "summary") {
        if (!replay) acknowledge(item.id);
        setFileFilter(null);
        openTool("activity");
      } else if (item.action.run === "review") enterRoom("owner", "review");
      else if (item.action.run === "cancel") action("cancel");
      else if (item.action.run === "test") enterRoom("owner", "test");
      else if (item.action.href)
        location.hash = item.action.href.replace(/^#/u, "");
      else if (item.action.run === "new-attempt" && run.work.campaign)
        location.hash = `/deliver/${encodeURIComponent(run.work.campaign)}/${encodeURIComponent(run.work.id)}?from=${encodeURIComponent(`/delivery/run/${run.run_id}`)}`;
    },
    [acknowledge, openTool, action, run, replay, enterRoom],
  );
  const onZone = useCallback(
    (zone: ZoneId) => {
      const item = attention.find(
        (entry) => entry.zone === zone && entry.state === "open",
      );
      if (item) setSelectedAttentionId(item.id);
      if (zone === "brief" && !replay) {
        const brief = attention.find(
          (entry) => entry.kind === "plan" && entry.zone === "brief",
        );
        if (brief) acknowledge(brief.id);
      }
      openTool(ZONE_BY_ID[zone].tab);
    },
    [attention, acknowledge, openTool, replay],
  );
  const onReplayRow = useCallback((at: number, id: string | null) => {
    if (cursorMissing) return;
    setReplayTime(at);
    setReplayCursor(id);
    if (replayMark && replayMark.id !== id) setReplayMark(null);
  }, [cursorMissing, replayMark]);
  const seek = useCallback((event: LocalActivityEvent) => {
    setPlaying(false);
    setReplayTime(Date.parse(event.at));
    setReplayCursor(event.id);
    setReplayMark(event);
  }, []);
  const live = useCallback(() => {
    setPlaying(false);
    setReplayTime(null);
    setReplayCursor(null);
    setReplayMark(null);
  }, []);
  const play = () => {
    if (!timeline.events.length) return;
    const finalId = timeline.events.at(-1)?.id;
    if ((!playing || cursorMissing) && (cursorMissing || replayTime === null ||
      (replayTime >= (timeline.end ?? 0) && (!replayCursor || replayCursor === finalId)))) {
      setReplayTime(timeline.start);
      setReplayCursor(timeline.events[0]?.id ?? null);
      setReplayMark(null);
    }
    setPlaying(cursorMissing || !playing);
  };
  const toggleView = () => {
    const next = view === "seat" ? "overview" : "seat";
    setPlaying(false);
    setView(next);
    if (next === "seat") {
      setVisitedSeat(true);
      setConsoleOpen(false);
      setRailOpen(false);
    }
    try {
      localStorage.setItem("pm-local-game-view", next);
    } catch {
      // The choice still applies to the current run.
    }
  };
  const explore = () => {
    setVisitedSeat(true);
    setBrainView("walk");
    setConsoleOpen(false);
    setRailOpen(false);
  };
  const showBoard = () => {
    setBrainView(null);
    setView("overview");
    try { localStorage.setItem("pm-local-game-view", "overview"); } catch { /* optional preference */ }
  };
  const ask = realAttention.find((item) => item.kind === "question" && item.state === "open");
  const test = !replay ? realAttention.find((item) => item.kind === "test" && item.action.href) : undefined;
  const onEnd = useCallback(() => setPlaying(false), []);
  useStageClock(stageRef, {
    timeline,
    snapshot,
    cursorMissing,
    state: health.state,
    time: replayTime,
    playing: playing && !cursorMissing,
    speed,
    tempo,
    replayMode,
    streak,
    cleanIncrement,
    attention,
    onReplayRow,
    onEnd,
    onStage: setStaging,
    onPlacements: setPositions,
  }, room === "owner" && !brainView ? "owner" : inRoom ? "seat" : "overview");
  const theater = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else void stageRef.current?.closest(".board-game")?.requestFullscreen?.().catch(() => {});
  };
  const roomSwitch = <RoomSwitch room={room} onChange={enterRoom} />;
  const stopControl = !replay && <LocalStopControl run={run} busy={busy || realHealth.state === "link-down"} act={action} />;
  if (room === "owner" && !brainView) {
    return <div className="run-game board-game owner-game" data-phase={run.phase}
      data-low-motion={quiet} data-liveness={replay ? health.state : realHealth.state}>
      <section ref={stageRef} className="owner-game-frame" aria-label="Owner room">
        <header className="owner-game-header">
          <Back fallback="/delivery" />
          <div className="board-title"><span className="run-game-tag">{run.work.id}</span>{attemptLabel(run) && <span className="run-game-tag run-game-attempt">{attemptLabel(run)}</span>}<h1 title={displayTitle(run)}>{displayTitle(run)}</h1></div>
          {roomSwitch}
          {stopControl}
          <button type="button" className="owner-view-switch" onClick={explore}>
            <Footprints size={16} />Explore 3D
          </button>
          {replay && <button type="button" onClick={live}>Return live</button>}
          <button type="button" className="owner-theater" onClick={theater} aria-label="Theater" title="Theater"><Maximize size={16} /></button>
        </header>
        {realHealth.state === "link-down" && <button className="owner-reconnect" onClick={retry}><RotateCw size={14} />Reconnect</button>}
        <OwnerWorkspace run={ownerRun} busy={busy || realHealth.state === "link-down"} act={action}
          patch={replay ? null : patch} readOnly={replay} cursorMissing={cursorMissing}
          initialStation={ownerStation} onStationChange={setOwnerStation} />
      </section>
    </div>;
  }
  return (
    <div className="run-game board-game" data-phase={run.phase} data-low-motion={quiet}>
      <DeliveryWorkshop
        stageRef={stageRef}
        cursorMissing={cursorMissing}
        roomSwitch={roomSwitch}
        positions={positions}
        staging={staging}
        railOpen={railOpen}
        seated={inRoom}
        seat={visitedSeat && <TransferRoom
          active={inRoom}
          brain={brainView ? { view: brainView, onView: setBrainView, onBoard: showBoard, blocked: consoleOpen,
            floor: room, onFloor: enterRoom, quiet, onQuietChange: changeQuiet } : undefined}
          owner={{ run: ownerRun, busy: busy || realHealth.state === "link-down", act: action, patch: replay ? null : patch,
            station: ownerStation, onStation: id => setOwnerStation(id === currentOwnerStation(ownerRun) ? undefined : id) }}
          timeline={timeline}
          scene={snapshot}
          health={health}
          liveHealth={realHealth}
          replay={replay}
          cursorMissing={cursorMissing}
          playing={playing && !cursorMissing}
          zones={zones}
          question={!!ask}
          onLive={live}
          onSeek={seek}
          onChanges={() => openTool("changes")}
          onTransportKey={(key) => key === " " ? play() : live()}
          onQuestion={() => {
            live();
            setConsoleOpen(false);
            setRailOpen(true);
            setSelectedAttentionId(ask?.id);
          }}
          testSteps={test && <button className="primary room-test-link" onClick={() => enterRoom("owner", "test")}>Test steps</button>}
        />}
        onZone={onZone}
        snapshot={snapshot}
        timeline={timeline}
        state={health.state}
        caption={health.caption}
        replay={replayTime !== null}
        streak={streak}
        zones={zones}
        attention={replayAttention}
        tempo={tempo}
        onTempo={setTempo}
        stagedMessage={staging.message}
        stageZone={staging.zone}
        onAttention={onAttention}
        canAct={canAct}
        selectedAttentionId={selectedAttentionId}
        onRailOpenChange={onRailOpenChange}
        suppressRailAutoOpen={inRoom || (consoleOpen && typeof matchMedia !== "undefined" && matchMedia(`(max-width: ${HUD.railBelow}px)`).matches)}
        renderAge={(since: number | null) => <AttentionAge since={since} />}
        clock={
          <BoardClock
            scene={snapshot}
            timeline={timeline}
            replayTime={replayTime}
            poll={poll}
          />
        }
        telemetry={
          <BoardTelemetry
            scene={snapshot}
            timeline={timeline}
            replayTime={replayTime}
            frozen={health.state === "link-down"}
          />
        }
        dockTools={<LocalRunTools id={consoleId} tool={tool} onSelect={selectTool}
          open={consoleOpen}
          passed={snapshot.run.checks.filter(check => check.exit === 0 && !check.error).length}
          files={(replayTime === null || snapshot.run.head) ? (patch?.match(/^diff --git /gm)?.length ?? 0) : 0} />}
        dockControls={<LocalRunReplay timeline={timeline} time={replayTime} cursor={replayCursor}
          onCursor={(id) => { setReplayCursor(id); setReplayMark(null); }} replayMode={replayMode} gap={staging.gap} tempo={tempo} onTempo={setTempo}
          onMode={value => { setPlaying(false); setReplayMode(value); }}
          onTime={time => { setPlaying(false); setReplayTime(time); }}
          playing={playing && !cursorMissing} onPlay={play} speed={speed} onSpeed={setSpeed}
          onLive={live} />}
        settingsControls={
          <StagePresence
            run={run}
            state={realHealth.state}
            caption={realHealth.caption}
            elapsed={snapshot.elapsed === null ? "?" : clock(snapshot.elapsed)}
            stageRef={stageRef}
            replay={replayTime !== null}
            attention={realAttention}
            settingsOnly
          />
        }
        theaterControl={
          <>
            {stopControl}
            {!brainView && <button type="button" className="stage-presence-button room-view-switch"
              aria-label="Explore 3D" onClick={explore}><Footprints size={16} /><span>Explore 3D</span></button>}
            {!brainView && <button type="button" className="stage-presence-button room-view-switch"
              aria-label={view === "seat" ? "Overview" : "Take seat"} onClick={toggleView}>
              {view === "seat" ? <Map size={16} /> : <Armchair size={16} />}
              <span>{view === "seat" ? "Overview" : "Take seat"}</span>
            </button>}
            <button
              type="button"
              className="stage-presence-button"
              aria-label="Theater"
              onClick={theater}
            >
              <Maximize size={16} />
            </button>
            {health.state === "link-down" && (
              <button type="button" aria-label="Retry" onClick={retry}>
                <RotateCw size={16} />
              </button>
            )}
          </>
        }
        actions={!replay && (
          <div
            className="run-game-commandbar"
            data-stale={health.state === "stale"}
            data-candidate={!!run.head}
            data-closed-failed={["failed", "cancelled"].includes(run.phase)}
          >
            {newAttemptHref(run) && <a className="primary" href={newAttemptHref(run)!}>New attempt</a>}
            <LocalActions run={run} busy={busy} act={action} station="session" />
          </div>
        )}
        question={
          replayTime === null && openQuestion(run) ? (
            <LocalChat run={run} limit={8} compact composer={false} />
          ) : null
        }
        failure={
          snapshot.run.error || snapshot.run.failure || snapshot.run.interrupted ? (
            <BlackBox run={snapshot.run} hideAttempt />
          ) : null
        }
        debrief={
          snapshot.run.pushed || (snapshot.phase === "shipped" && !!snapshot.run.merge && !snapshot.run.applied) ? (
            <Debrief run={snapshot.run} timeline={timeline} scene={snapshot} />
          ) : null
        }
      >
      <details
        className="board-console-drawer"
        data-expanded={wideReader}
        open={consoleOpen}
        onToggle={(event) => setConsoleOpen(event.currentTarget.open)}
      >
        <summary aria-label="Close details" title="Close details" onClick={() => drawerTrigger.current?.focus({ preventScroll: true })}>
          <span>{LOCAL_RUN_TOOLS.find(item => item.id === tool)?.label}</span><X size={16} />
        </summary>
        {consoleOpen && <button type="button" className="board-expand-reader" aria-pressed={wideReader}
          aria-label={wideReader ? "Reduce details" : "Expand details"} title={wideReader ? "Reduce details" : "Expand details"}
          onClick={() => setWideReader(!wideReader)}>{wideReader ? <Minimize2 size={16} /> : <Maximize size={16} />}</button>}
        {consoleOpen && <LocalRunConsole
          id={consoleId}
          showTools={false}
          run={run}
          snapshot={snapshot}
          timeline={timeline}
          replay={replayTime !== null}
          patch={patch}
          tool={tool}
          setTool={setTool}
          panel={panel}
          busy={busy}
          act={action}
          fileFilter={fileFilter}
          selectedAttentionId={selectedAttentionId}
          setFileFilter={setFileFilter}
        />}
      </details>
      </DeliveryWorkshop>
    </div>
  );
}
