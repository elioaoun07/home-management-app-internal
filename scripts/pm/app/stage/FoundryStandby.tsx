import { useLayoutEffect, useRef } from "react";
import { bakeStatic } from "./board";
import { BOARD, TIMING } from "./config";
import { resolveStagePalette, type StagePalette } from "./palette";
import "./foundry-standby.css";
import { BOARD_HUD_STYLE } from "./hud/layout";
import { Back } from "../components";
import { GameToggle } from "../GameLayer";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const arrive = (n: number) => 1 - (1 - clamp(n)) ** 3;
/** Retained boot timing contract; this loading scene contains no run facts. */
export function standbyPhase(elapsed: number, reducedMotion = false) {
  const t = reducedMotion ? TIMING.boot : Math.max(0, elapsed);
  return {
    circuits: clamp(t / 950),
    machines: [0, 1, 2, 3].map((i) => arrive((t - 400 - i * 280) / 750)),
    era: arrive((t - 1750) / 750),
    settled: t >= TIMING.boot,
  };
}
export function drawFoundryStandby(
  ctx: CanvasRenderingContext2D,
  p: StagePalette,
  width: number,
  height: number,
  _elapsed: number,
  _reducedMotion = false,
) {
  ctx.clearRect(0, 0, width, height);
  const fit = Math.min(
    (width - 32) / BOARD.bounds.width,
    (height - 32) / BOARD.bounds.height,
  );
  ctx.save();
  ctx.translate(
    (width - BOARD.bounds.width * fit) / 2,
    (height - BOARD.bounds.height * fit) / 2,
  );
  ctx.scale(fit, fit);
  ctx.translate(-BOARD.bounds.x, -BOARD.bounds.y);
  bakeStatic(ctx, p);
  ctx.restore();
}
export function FoundryStandby({ error, retry }: { error?: unknown; retry?: () => void } = {}) {
  const root = useRef<HTMLElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const node = root.current,
      surface = canvas.current;
    if (!node || !surface) return;
    const c = surface.getContext("2d");
    if (!c) return;
    const paint = () => {
      const rect = surface.getBoundingClientRect(),
        dpr = Math.min(2, devicePixelRatio || 1);
      surface.width = rect.width * dpr;
      surface.height = rect.height * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFoundryStandby(
        c,
        resolveStagePalette(node),
        rect.width,
        rect.height,
        0,
        true,
      );
    };
    const observer = new ResizeObserver(paint);
    observer.observe(surface);
    paint();
    return () => observer.disconnect();
  }, []);
  return (
    <section
      className="foundry-standby"
      style={BOARD_HUD_STYLE}
      ref={root}
      aria-busy={!error}
      data-motion="paused"
      data-standby="true"
    >
      <header className="board-standby-topbar">
        <Back fallback="/delivery" />
        <h1>{error ? "Unavailable" : "Loading"}</h1>
        <GameToggle />
      </header>
      <canvas
        ref={canvas}
        className="foundry-standby-canvas"
        aria-hidden="true"
      />
      <span className="foundry-standby-caption" role="status">
        {error ? "Unavailable" : "Loading"}
      </span>
      {!!error && <details className="board-standby-error">
        <summary>Error details</summary>
        <pre>{error instanceof Error ? error.message : String(error)}</pre>
        <button type="button" className="secondary" onClick={retry}>Retry</button>
      </details>}
    </section>
  );
}
