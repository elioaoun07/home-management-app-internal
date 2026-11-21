import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { LocalActivityEvent } from "./localRunActivityModel";
import type { AttentionItem } from "./localRunAttention";
import { createBoardEngine } from "./stage/engine";
import { createBoardPlayback, type PlaybackInput } from "./stage/playback";
import { boardFactKey, boardRetry } from "./stage/facts";
import { createReplayPublisher } from "./stage/replayPublication";
import { boardClock } from "./stage/clockStore";
import { createAnimationPause } from "./stage/pause";
import { cameraZone } from "./stage/cameraFacts";
import { zoneEvidence, zoneForEvent } from "./stage/zoneModel";
import { localStageGame, type CleanShipIncrement } from "./stage/game";
import { stepVitality, vitalityTarget } from "./stage/vitality";
import { ZONE_BY_ID, TIMING, type ZoneId } from "./stage/config";
import type { BeatStage } from "./stage/director";
import type { BoardMotionFrame, BoardPlacement } from "./stage/types";

export interface StagingUi {
  zone: ZoneId | null;
  label: string;
  event: LocalActivityEvent | null;
  message: LocalActivityEvent | null;
  beat: BeatStage | "idle";
  gap: string | null;
}
interface Input extends PlaybackInput {
  attention: readonly AttentionItem[];
  streak: number | null;
  cleanIncrement: CleanShipIncrement | null;
  onReplayRow: (time: number, id: string | null) => void;
  onEnd: () => void;
  onStage: (stage: StagingUi) => void;
  onPlacements: (placements: BoardPlacement[]) => void;
}
/** One animation callback paints baked moving sprites. The factual coordinator
 * publishes React, HUD, sound and row changes outside the frame path. */
export function useStageClock(
  section: RefObject<HTMLElement | null>,
  input: Input,
  view: "overview" | "seat" = "overview",
) {
  const current = useRef(input);
  current.current = input;
  const notify = useRef<() => void>(() => {});
  useEffect(() => notify.current(), [input]);
  useLayoutEffect(() => {
    const root = section.current;
    const staticCanvas = root?.querySelector<HTMLCanvasElement>(
      '[data-layer="static"]',
    );
    const stateCanvas = root?.querySelector<HTMLCanvasElement>(
      '[data-layer="state"]',
    );
    const motionCanvas = root?.querySelector<HTMLCanvasElement>(
      '[data-layer="motion"]',
    );
    const wrapper = root?.querySelector<HTMLElement>(".board-camera");
    const region = root?.querySelector<HTMLElement>(".board-region");
    if (!root || !region) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const engine = view === "overview" && staticCanvas && stateCanvas && motionCanvas && wrapper ? createBoardEngine({
      staticCanvas,
      stateCanvas,
      motionCanvas,
      wrapper,
      root,
      onPlacements: (positions: BoardPlacement[]) =>
        current.current.onPlacements(positions),
    }) : null;
    const playback = createBoardPlayback(current.current, performance.now());
    let raf = 0,
      lastFrame = 0,
      visible = true,
      disposed = false,
      heat = 0,
      life = 0,
      wall = 0,
      vitality = vitalityTarget(current.current.state),
      combo = 0;
    const publishReplay = createReplayPublisher();
    let previousFacts = "",
      previousUi = "",
      lastSecond = -1,
      lastMessage: LocalActivityEvent | null = null;
    let cameraRow = current.current.snapshot.latest?.id;
    let awarded = "",
      insigniaUntil = 0;
    let composed = false;
    const pauseAnimations = createAnimationPause(root);
    let seatQuiet: boolean | undefined;
    let seatLatest = current.current.snapshot.latest?.id;
    let seatReplayTimer: number | undefined;
    let selection = {
      time: current.current.time,
      cursor: current.current.snapshot.latest?.id,
      mode: current.current.replayMode,
      playing: current.current.playing,
    };
    const disabled = () =>
      preference.matches ||
      !visible ||
      document.visibilityState === "hidden" ||
      current.current.state === "link-down";
    const attr = (name: string, value: unknown) => {
      const text = String(value);
      if (root.getAttribute("data-" + name) !== text)
        root.setAttribute("data-" + name, text);
    };
    const frameAt = (now: number, dt = 0): BoardMotionFrame => {
      const c = current.current,
        sample = playback.sample(now);
      if (c.state !== "signal-lost" && c.state !== "link-down")
        heat *= Math.pow(0.5, dt / TIMING.heatHalfLife);
      vitality = preference.matches
        ? vitalityTarget(c.state)
        : stepVitality(vitality, c.state, dt);
      wall += dt;
      life += dt * vitality;
      return {
        beat: sample.beat,
        beats: sample.beats,
        vitality,
        heat,
        elapsed: preference.matches ? 0 : life,
        wallTime: wall,
        tempo: c.tempo,
        reducedMotion: preference.matches,
        settled: c.time !== null && !c.playing,
        ceremony: sample.ceremony
          ? {
              ...sample.ceremony,
              progress: preference.matches ? 1 : sample.ceremony.progress,
            }
          : undefined,
        combo,
        streak: c.streak,
        cleanIncrement: now < insigniaUntil ? 1 : undefined,
      };
    };
    let animationFrame = frameAt(performance.now());
    const canRun = () =>
      !disabled() &&
      (current.current.time === null || current.current.playing) &&
      !!engine?.needsAnimation(animationFrame);
    const tick = (now: number) => {
      const startedAt = performance.now();
      raf = 0;
      if (disposed || disabled()) return;
      const dt = lastFrame
        ? Math.min(TIMING.maxDelta, (now - lastFrame) / TIMING.second)
        : 0;
      lastFrame = now;
      animationFrame = frameAt(now, dt);
      engine?.drawMotion(animationFrame, dt, startedAt);
      composed = true;
      if (canRun()) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (canRun()) {
        if (!raf) {
          lastFrame = 0;
          raf = requestAnimationFrame(tick);
        }
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        lastFrame = 0;
        engine?.sleep();
      }
    };
    const facts = () => {
      if (disposed) return;
      const now = performance.now(),
        c = current.current;
      if (
        (c.time === null && selection.time !== null) ||
        (c.time !== null &&
          !c.playing &&
          (selection.playing ||
            c.time !== selection.time ||
            c.snapshot.latest?.id !== selection.cursor ||
            c.replayMode !== selection.mode))
      ) {
        engine?.clear();
        previousFacts = "";
      }
      selection = {
        time: c.time,
        cursor: c.snapshot.latest?.id,
        mode: c.replayMode,
        playing: c.playing,
      };
      playback.update(
        {
          ...c,
          playing:
            c.playing && visible && document.visibilityState !== "hidden",
        },
        now,
      );
      const sample = playback.sample(now);
      if (!engine) {
        const advancing = c.playing && visible && document.visibilityState !== "hidden";
        if (advancing && seatReplayTimer === undefined)
          seatReplayTimer = window.setInterval(facts, TIMING.facts);
        else if (!advancing && seatReplayTimer !== undefined) {
          clearInterval(seatReplayTimer);
          seatReplayTimer = undefined;
        }
        const rows = playback.observations(now);
        const mute = disabled();
        if (mute !== seatQuiet) {
          seatQuiet = mute;
          root.dispatchEvent(new CustomEvent("pm-stage-life", { detail: { vitality: 0, tier: 0, muted: mute } }));
        }
        const latest = c.snapshot.latest;
        const row = c.time === null && latest?.id !== seatLatest && ["live", "thinking"].includes(c.state)
          ? latest
          : c.playing ? rows.at(-1) : undefined;
        seatLatest = latest?.id;
        if (!mute && row) {
          root.dispatchEvent(new CustomEvent("pm-stage-cue", { detail: { kind: row.kind } }));
        }
        if ((sample.gap ?? "") !== previousUi) {
          previousUi = sample.gap ?? "";
          c.onStage({ zone: null, label: "", event: null, message: null, beat: "idle", gap: sample.gap });
        }
        publishReplay(c, sample, now);
        const second = Math.floor(now / TIMING.second);
        if (second !== lastSecond) {
          lastSecond = second;
          if (c.state !== "link-down") boardClock.tick();
        }
        root.toggleAttribute("data-seat-paused", mute);
        return;
      }
      const zones = zoneEvidence(c.snapshot, sample.beat, c.attention);
      const changedCameraRow = cameraRow !== c.snapshot.latest?.id;
      cameraRow = c.snapshot.latest?.id;
      const cameraEvent = sample.beat?.event ?? (changedCameraRow || c.time !== null ? c.snapshot.latest : null);
      const rowAt = c.snapshot.latest ? Date.parse(c.snapshot.latest.at) : NaN;
      engine.observeCamera({
        nowMs: now,
        rowAgeMs: Number.isFinite(rowAt) ? Math.max(0, (c.time === null ? Date.now() : c.snapshot.at) - rowAt) : null,
        stagedZone: cameraEvent && ["merging", "push-pending", "revert-push-pending"].includes(c.snapshot.phase) ? "ship" : cameraZone(cameraEvent),
        closed: ["failed", "cancelled", "shipped", "reverted"].includes(c.snapshot.phase),
        frozen: ["signal-lost", "link-down"].includes(c.state),
        reducedMotion: preference.matches,
      });
      combo = localStageGame(c.timeline, c.snapshot, c.streak).combo;
      if (
        c.time === null &&
        c.cleanIncrement &&
        awarded !== c.cleanIncrement.sessionId
      ) {
        awarded = c.cleanIncrement.sessionId;
        insigniaUntil = now + TIMING.badge;
      }
      for (const row of playback.observations(now)) {
        heat = Math.min(1, heat + 0.25);
        attr("cue", row.kind);
        attr("cue-id", row.id);
        root.dispatchEvent(
          new CustomEvent("pm-stage-cue", {
            detail: {
              kind: row.kind,
              seal:
                row.kind === "check" &&
                c.snapshot.seals.some(
                  (seal) => seal.name === row.detail && seal.state === "passed",
                ),
            },
          }),
        );
      }
      const boardFacts = {
        snapshot: c.snapshot,
        state: c.state,
        zones: zones.zones,
        attention: c.attention,
        activeZone: zones.activeZone,
        buildZone: zones.buildZone,
        buildGate: c.snapshot.seals.filter((seal) => seal.state !== "pending")
          .length,
        atMain: zones.atMain,
        retry: boardRetry(c.snapshot.run),
      };
      const signature = boardFactKey(boardFacts);
      if (signature !== previousFacts) {
        previousFacts = signature;
        engine.setFacts(boardFacts);
        const zone = zones.activeZone ?? zones.buildZone;
        attr("liveness", c.state);
        if (!["link-down", "signal-lost"].includes(c.state))
          attr("weather", ["quiet", "stale"].includes(c.state) ? c.state : "");
        attr("zone", zone);
        attr("station", ZONE_BY_ID[zone].legacyStation);
        attr("plates", c.snapshot.nodes.filter((node) => node.edited).length);
        attr("seals", c.snapshot.counts.checks);
        attr("replay", c.time !== null);
        attr("combo", combo);
        attr(
          "attention",
          c.attention.filter(
            (item) => item.level === "act" && item.state === "open",
          ).length,
        );
        animationFrame = frameAt(now);
        if (
          (!canRun() && c.state !== "link-down") ||
          (!composed && disabled())
        ) {
          engine.drawMotion(animationFrame, 0);
          composed = true;
        }
      }
      const activeZone = sample.beat
        ? sample.beat.stage === "think"
          ? "think"
          : zoneForEvent(sample.beat.event)
        : zones.activeZone;
      if (
        lastMessage &&
        !c.snapshot.events.some((event) => event.id === lastMessage!.id)
      )
        lastMessage = null;
      if (sample.beat?.event.kind === "message")
        lastMessage = sample.beat.event;
      const label = sample.beat
        ? [
            (
              {
                read: "READ",
                search: "SEARCH",
                edit: "EDIT",
                command: "RUN",
                "agent-check": "CHECK",
                message: "SAY",
                observation: "",
              } as const
            )[sample.beat.action],
            sample.beat.event.paths[0]?.split("/").pop() ||
              sample.beat.event.command ||
              sample.beat.event.label,
          ]
            .filter(Boolean)
            .join(" ")
        : "";
      const uiKey = [
        sample.beat?.id,
        sample.beat?.stage,
        activeZone,
        label,
        lastMessage?.id,
        sample.gap,
        sample.ceremony?.kind,
      ].join("|");
      if (uiKey !== previousUi) {
        previousUi = uiKey;
        c.onStage({
          zone: activeZone,
          label,
          event: sample.beat?.event ?? null,
          message: lastMessage,
          beat: sample.beat?.stage ?? "idle",
          gap: sample.gap,
        });
      }
      publishReplay(c, sample, now);
      const second = Math.floor(now / TIMING.second);
      if (second !== lastSecond) {
        lastSecond = second;
        if (c.state !== "link-down") boardClock.tick();
        root.dispatchEvent(
          new CustomEvent("pm-stage-life", {
            detail: {
              vitality,
              tier: combo >= 10 ? 3 : combo >= 6 ? 2 : combo >= 3 ? 1 : 0,
              muted: disabled(),
            },
          }),
        );
      }
      animationFrame = frameAt(now);
      pauseAnimations(disabled(), vitality);
      attr("motion", disabled() ? "paused" : "active");
      attr("sleep", !canRun());
      attr("tempo", c.tempo);
      attr("beat", sample.beat?.stage ?? "idle");
      attr("staged-id", sample.replay?.event?.id ?? sample.beat?.id ?? "");
      attr("backlog", sample.backlog);
      schedule();
    };
    notify.current = facts;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      facts();
    });
    observer.observe(root);
    const fit = () => engine?.resize(region.clientWidth, region.clientHeight);
    const resize = new ResizeObserver(fit);
    if (engine) {
      resize.observe(region);
      for (const hud of root.querySelectorAll(".board-comms,.board-telemetry,.board-replay-strip,.board-console-drawer,.board-console-drawer > summary,.board-rail,.board-dock")) resize.observe(hud);
    }
    const timer = engine
      ? window.setInterval(facts, TIMING.facts)
      : window.setInterval(() => {
          if (seatReplayTimer === undefined && current.current.state !== "link-down" && document.visibilityState !== "hidden") boardClock.tick();
        }, TIMING.second);
    const wake = () => facts();
    document.addEventListener("visibilitychange", wake);
    preference.addEventListener("change", wake);
    const auto = () => engine?.fit();
    root.addEventListener("pm-stage-auto", auto);
    facts();
    return () => {
      disposed = true;
      notify.current = () => {};
      cancelAnimationFrame(raf);
      clearInterval(timer);
      clearInterval(seatReplayTimer);
      observer.disconnect();
      resize.disconnect();
      engine?.dispose();
      root.removeAttribute("data-seat-paused");
      document.removeEventListener("visibilitychange", wake);
      preference.removeEventListener("change", wake);
      root.removeEventListener("pm-stage-auto", auto);
    };
  }, [section, view]);
}
