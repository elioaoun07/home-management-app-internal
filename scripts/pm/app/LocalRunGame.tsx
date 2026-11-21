import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Armchair, Map, Maximize, RotateCw, X } from "lucide-react";
import { LocalActions, type LocalRunView } from "./LocalDelivery";
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
import { useWorld } from "./state";
import { cleanStageStreak, cleanShipIncrement } from "./stage/game";
import { zoneEvidence } from "./stage/zoneModel";
import { HUD, ZONE_BY_ID, type ZoneId } from "./stage/config";
import { BoardClock, BoardTelemetry, AttentionAge } from "./stage/ClockLeaves";
import type { BoardPlacement } from "./stage/types";
import type { StageTempo, ReplayMode } from "./stage/director";
import "./local-run-game.css";

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
  act: (action: "review" | "ship" | "undo" | "cancel") => void;
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
  const [view, setView] = useState<"overview" | "seat">(() => {
    try {
      return localStorage.getItem("pm-local-game-view") === "seat" ? "seat" : "overview";
    } catch {
      return "overview";
    }
  });
  const [visitedSeat, setVisitedSeat] = useState(view === "seat");
  const consoleId = useId();
  const [tool, setTool] = useState<Tool>("activity"),
    [consoleOpen, setConsoleOpen] = useState(false),
    [fileFilter, setFileFilter] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState<ReplayMode>("recap"),
    [replayTime, setReplayTime] = useState<number | null>(null),
    [replayCursor, setReplayCursor] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState<1 | 4>(1),
    [tempo, setTempo] = useState<StageTempo>(1);
  const [positions, setPositions] = useState<BoardPlacement[]>([]),
    [railOpen, setRailOpen] = useState(() =>
      typeof matchMedia === "undefined" || !matchMedia(`(max-width: ${HUD.railCollapseBelow - 1}px)`).matches),
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
  const realHealth = useRunHealth(run, poll);
  const replay = replayTime !== null;
  const cursorMissing = !!replayCursor && !timeline.events.some((event) => event.id === replayCursor);
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
        view === "overview" && staging.event && staging.beat !== "idle"
          ? { event: staging.event, stage: staging.beat }
          : null,
        attention,
      ),
    [snapshot, staging.event, staging.beat, attention, view],
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
    setTool(next);
    setConsoleOpen(true);
    if (matchMedia(`(max-width: ${HUD.railBelow}px)`).matches)
      setRailOpen(false);
  }, []);
  const openTool = useCallback((next: Tool) => {
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
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setConsoleOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const action = useCallback(
    (value: "review" | "ship" | "undo" | "cancel") => {
      if (replay || !localBoardActionAllowed(run, busy, value)) return;
      if (value === "review") openTool("changes");
      act(value);
    },
    [act, openTool, run, busy, replay],
  );
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
        acknowledge(item.id);
        openTool("brief");
      } else if (item.action.run === "summary") {
        acknowledge(item.id);
        setFileFilter(null);
        openTool("activity");
      } else if (item.action.run === "review") action("review");
      else if (item.action.run === "cancel") action("cancel");
      else if (item.action.run === "retry")
        action(run.phase === "revert-push-pending" ? "undo" : "ship");
      else if (item.action.href)
        location.hash = item.action.href.replace(/^#/u, "");
      else if (item.action.run === "new-attempt" && run.work.campaign)
        location.hash = `/deliver/${encodeURIComponent(run.work.campaign)}/${encodeURIComponent(run.work.id)}?from=${encodeURIComponent(`/delivery/run/${run.run_id}`)}`;
    },
    [acknowledge, openTool, action, run, replay],
  );
  const onZone = useCallback(
    (zone: ZoneId) => {
      const item = attention.find(
        (entry) => entry.zone === zone && entry.state === "open",
      );
      if (item) setSelectedAttentionId(item.id);
      if (zone === "brief") {
        const brief = attention.find(
          (entry) => entry.kind === "plan" && entry.zone === "brief",
        );
        if (brief) acknowledge(brief.id);
      }
      openTool(ZONE_BY_ID[zone].tab);
    },
    [attention, acknowledge, openTool],
  );
  const onReplayRow = useCallback((at: number, id: string | null) => {
    if (cursorMissing) return;
    setReplayTime(at);
    setReplayCursor(id);
  }, [cursorMissing]);
  const seek = useCallback((event: LocalActivityEvent) => {
    setPlaying(false);
    setReplayTime(Date.parse(event.at));
    setReplayCursor(event.id);
  }, []);
  const live = useCallback(() => {
    setPlaying(false);
    setReplayTime(null);
    setReplayCursor(null);
  }, []);
  const play = () => {
    if (!timeline.events.length) return;
    const finalId = timeline.events.at(-1)?.id;
    if ((!playing || cursorMissing) && (cursorMissing || replayTime === null ||
      (replayTime >= (timeline.end ?? 0) && (!replayCursor || replayCursor === finalId)))) {
      setReplayTime(timeline.start);
      setReplayCursor(timeline.events[0]?.id ?? null);
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
    }
    try {
      localStorage.setItem("pm-local-game-view", next);
    } catch {
      // The choice still applies to the current run.
    }
  };
  const ask = realAttention.find((item) => item.kind === "question" && item.state === "open");
  const test = !replay ? realAttention.find((item) => item.kind === "test" && item.action.href) : undefined;
  const onEnd = useCallback(() => setPlaying(false), []);
  useStageClock(stageRef, {
    timeline,
    snapshot,
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
  }, view);
  const theater = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else void stageRef.current?.requestFullscreen().catch(() => {});
  };
  return (
    <div className="run-game board-game" data-phase={run.phase}>
      <DeliveryWorkshop
        stageRef={stageRef}
        positions={positions}
        staging={staging}
        railOpen={railOpen}
        seated={view === "seat"}
        seat={visitedSeat && <TransferRoom
          active={view === "seat"}
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
          onTransportKey={(key) => key === " " ? play() : live()}
          onQuestion={() => {
            live();
            setConsoleOpen(false);
            setRailOpen(true);
            setSelectedAttentionId(ask?.id);
          }}
          testSteps={test && <a className="primary room-test-link" href={test.action.href}>Test steps</a>}
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
        suppressRailAutoOpen={consoleOpen && typeof matchMedia !== "undefined" && matchMedia(`(max-width: ${HUD.railBelow}px)`).matches}
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
          onCursor={setReplayCursor} replayMode={replayMode} gap={staging.gap} tempo={tempo} onTempo={setTempo}
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
            <button type="button" className="stage-presence-button room-view-switch"
              aria-label={view === "seat" ? "Overview" : "Take seat"} onClick={toggleView}>
              {view === "seat" ? <Map size={16} /> : <Armchair size={16} />}
              <span>{view === "seat" ? "Overview" : "Take seat"}</span>
            </button>
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
            {["failed", "cancelled"].includes(run.phase) && run.work.campaign && <a className="primary" href={`#/deliver/${encodeURIComponent(run.work.campaign)}/${encodeURIComponent(run.work.id)}?from=${encodeURIComponent(`/delivery/run/${run.run_id}`)}`}>New attempt</a>}
            {run.head ? <LocalActions run={run} busy={busy} act={action} /> : localBoardActionAllowed(run, busy, "cancel") || (["preparing", "building", "checking"].includes(run.phase) && !run.interrupted) ? <div className="gate-actions"><button className="secondary" disabled={busy} onClick={() => action("cancel")}>Cancel</button></div> : null}
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
          snapshot.phase === "shipped" ? (
            <Debrief run={snapshot.run} timeline={timeline} scene={snapshot} />
          ) : null
        }
      >
      <details
        className="board-console-drawer"
        open={consoleOpen}
        onToggle={(event) => setConsoleOpen(event.currentTarget.open)}
      >
        <summary aria-label="Close details">{LOCAL_RUN_TOOLS.find(item => item.id === tool)?.label}<X size={16} /></summary>
        <LocalRunConsole
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
        />
      </details>
      </DeliveryWorkshop>
    </div>
  );
}
