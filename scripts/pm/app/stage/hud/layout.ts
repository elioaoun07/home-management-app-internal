import type { CSSProperties } from "react";
import { BOARD, HUD, LAMPS, TIMING, ZONE_HUES } from "../config";

/** Shared with Loading and the real board; config.ts is the tuning surface. */
export const BOARD_HUD_STYLE = {
  "--stage-ok": LAMPS.done,
  "--stage-warn": ZONE_HUES.test,
  "--stage-bad": LAMPS.fault,
  "--board-topbar-height": `${HUD.topbar}px`,
  "--board-dock-height": `${HUD.dock}px`,
  "--board-mobile-dock-height": `${HUD.mobileDock}px`,
  "--board-region-min": `${HUD.boardMin}px`,
  "--board-drawer-height": `${HUD.drawer * 100}%`,
  "--board-rail-width": `${HUD.rail}px`,
  "--board-rail-closed": `${HUD.collapsedRail}px`,
  "--board-comms-width": `${HUD.comms.width}px`,
  "--board-comms-height": `${HUD.comms.height}px`,
  "--board-telemetry-width": `${HUD.telemetry.width}px`,
  "--board-telemetry-height": `${HUD.telemetry.height}px`,
  "--board-stage-min": `${HUD.stage.min}px`,
  "--board-stage-max": `${HUD.stage.max}px`,
  "--board-page-offset": `${HUD.stage.offset}px`,
  "--board-inset": `${BOARD.margin}px`,
  "--board-stale-time": `${TIMING.staleFade}ms`,
  "--board-recovery-time": `${TIMING.recovery}ms`,
  "--board-glitch-time": `${TIMING.glitch}ms`,
  "--board-pulse-time": `${TIMING.hover}ms`,
} as CSSProperties;
