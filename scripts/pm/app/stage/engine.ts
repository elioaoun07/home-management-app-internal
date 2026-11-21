import { boardFactKey } from "./facts";
import { createMotionPainter } from "./renderMotion";
import { BOARD, BUDGET, TIMING } from "./config";
import { boardPlacements, drawState } from "./board";
import { bakeBoardAssets, bakePartFacts } from "./boardAssets";
import { machineEvidence, type MachineEvidence } from "./machineEvidence";
import { createEngineCamera } from "./engineCamera";
import type { BoardCameraObservation, ZoomBucket } from "./boardCamera";
import { resolveStagePalette } from "./palette";
import { bakeEra } from "./actors/era";
import { bakeBuild, drawBuild } from "./actors/build";
import { bakeGlow, createBoardFx } from "./fx";
import { createMotionState, needsBoardAnimation } from "./motion";
import { createPerfMeter } from "./perfMeter";
import type {
  BoardFacts,
  BoardMotionFrame,
  BoardPlacement,
  Sprite,
} from "./types";
export type { BoardFacts, BoardMotionFrame } from "./types";
export interface BoardEngineOptions {
  staticCanvas: HTMLCanvasElement;
  stateCanvas: HTMLCanvasElement;
  motionCanvas: HTMLCanvasElement;
  wrapper: HTMLElement;
  root: HTMLElement;
  onPlacements?: (placements: BoardPlacement[]) => void;
}
const normalize = (state: string) => state.toLowerCase().replace(/[\s-]/gu, "");
/** No clock lives here. The one parent clock schedules only this motion layer. */
export function createBoardEngine(options: BoardEngineOptions) {
  const { staticCanvas, stateCanvas, motionCanvas, wrapper, root } = options;
  const contexts = [staticCanvas, stateCanvas, motionCanvas].map(
    (c) => c.getContext("2d")!,
  );
  const [back, front, motion] = contexts;
  const movement = createMotionState(),
    fx = createBoardFx();
  const perf = createPerfMeter(root, contexts);
  const painter = createMotionPainter(movement, fx);
  let palette = resolveStagePalette(root),
    glow = bakeGlow(palette.emissive),
    ownerGlow = bakeGlow(palette.warn),
    smoke = bakeGlow(palette.muted),
    era = bakeEra(palette, glow);
  let assets = bakeBoardAssets(palette);
  let parts = assets.parts, partsKey = "";
  let build: Sprite | null = null,
    evidence: MachineEvidence | undefined,
    buildKey = "",
    facts: BoardFacts | null = null,
    lastFrame: BoardMotionFrame | null = null,
    key = "",
    disposed = false;
  let composeStill = false;
  let stateDpr = 1,
    motionDpr = 1,
    skippedDt = 0,
    lastDraw = 0,
    resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWidth = 0,
    lastHeight = 0,
    lastPixelRatio = 0;
  let zoomBucket: ZoomBucket = 1;
  const prepare = (ctx: CanvasRenderingContext2D, dpr: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, BOARD.bounds.width, BOARD.bounds.height);
    ctx.translate(-BOARD.bounds.x, -BOARD.bounds.y);
  };
  const paintFacts = () => {
    if (!facts) return;
    prepare(front, stateDpr);
    const nextPartsKey = JSON.stringify([facts.snapshot.objectiveCount, facts.snapshot.objectivesAccepted,
      facts.retry, Math.min(3, facts.snapshot.counts.commands), facts.snapshot.run.handover?.handover_id]);
    if (evidence && nextPartsKey !== partsKey) {
      partsKey = nextPartsKey;
      parts = bakePartFacts(assets, palette, facts, evidence);
    }
    const nextBuildKey = JSON.stringify([
      facts.snapshot.nodes.filter(node => node.edited).map(node => [node.id, node.area]),
      facts.snapshot.run.head,
      facts.snapshot.seals.map(seal => seal.state),
    ]);
    if (nextBuildKey !== buildKey) {
      buildKey = nextBuildKey;
      build = bakeBuild(facts.snapshot, palette);
    }
    if (evidence) drawState(front, palette, facts, parts, { assets, evidence });
    if (["linkdown", "signallost"].includes(normalize(facts.state))) {
      const frame: BoardMotionFrame = lastFrame ?? {
        beat: null,
        vitality: 0,
        heat: 0,
        elapsed: 0,
        tempo: 1,
      };
      const carrier = movement.build(facts, frame, 0);
      if (build) drawBuild(front, build, carrier.point.x, carrier.point.y);
    }
  };
  const bake = () => {
    if (disposed) return;
    const start = performance.now();
    root.style.setProperty("--board-hull-top", palette.hull.top);
    root.style.setProperty("--board-hull-left", palette.hull.left);
    root.style.setProperty("--board-hull-right", palette.hull.right);
    prepare(back, stateDpr);
    back.drawImage(assets.image, BOARD.bounds.x, BOARD.bounds.y, BOARD.bounds.width, BOARD.bounds.height);
    paintFacts();
    if (lastFrame && facts) {
      prepare(motion, motionDpr);
      painter.draw(
        motion,
        { facts, palette, glow, ownerGlow, smoke, era, parts, offParts: assets.offParts,
          dimPalette: assets.dimPalette, glows: assets.glows, evidence, build },
        lastFrame,
        0,
      );
    }
    if (root.dataset.debug === "true") {
      root.dataset.bakeMs = (performance.now() - start).toFixed(2);
      root.dataset.zoomBucket = String(zoomBucket);
      root.dataset.staticDpr = String(stateDpr);
      root.dataset.motionDpr = String(motionDpr);
      root.dataset.assetBakeMs = assets.milliseconds.toFixed(2);
    }
  };
  const allocate = () => {
    const start = performance.now();
    stateDpr = Math.min(BUDGET.staticDpr, (window.devicePixelRatio || 1) * zoomBucket);
    motionDpr = Math.min(BUDGET.motionDpr, (window.devicePixelRatio || 1) * zoomBucket);
    [staticCanvas, stateCanvas, motionCanvas].forEach((canvas, i) => {
      const dpr = i === 2 ? motionDpr : stateDpr;
      const width = Math.round(BOARD.bounds.width * dpr), height = Math.round(BOARD.bounds.height * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      canvas.style.width = `${BOARD.bounds.width}px`;
      canvas.style.height = `${BOARD.bounds.height}px`;
    });
    bake();
    if (root.dataset.debug === "true") root.dataset.bakeMs = (performance.now() - start).toFixed(2);
  };
  const camera = createEngineCamera(root, wrapper, (bucket) => {
    if (bucket === zoomBucket || disposed) return;
    zoomBucket = bucket;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = null;
    allocate();
  });
  const theme = new MutationObserver(() => {
    if (disposed) return;
    const next = resolveStagePalette(root);
    if (
      next.top === palette.top &&
      next.emissive === palette.emissive &&
      next.bg === palette.bg
    )
      return;
    palette = next;
    glow = bakeGlow(palette.emissive);
    ownerGlow = bakeGlow(palette.warn);
    smoke = bakeGlow(palette.muted);
    era = bakeEra(palette, glow);
    assets = bakeBoardAssets(palette);
    partsKey = "";
    buildKey = "";
    bake();
  });
  for (let node: HTMLElement | null = root; node; node = node.parentElement)
    theme.observe(node, {
      attributes: true,
      attributeFilter: ["data-theme", "data-color", "class", "style"],
    });
  return {
    resize(width: number, height: number) {
      const pixelRatio = window.devicePixelRatio || 1;
      const dimensionsChanged = width !== lastWidth || height !== lastHeight || pixelRatio !== lastPixelRatio;
      lastWidth = width;
      lastHeight = height;
      lastPixelRatio = pixelRatio;
      camera.resize(width, height);
      options.onPlacements?.(boardPlacements());
      if (!staticCanvas.width || staticCanvas.width === 300) allocate();
      else if (dimensionsChanged) {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(allocate, TIMING.resize);
      }
    },
    observeCamera(value: BoardCameraObservation) {
      camera.observe(value);
    },
    setFacts(next: BoardFacts) {
      const nextKey = boardFactKey(next);
      facts = next;
      if (key === nextKey) return;
      key = nextKey;
      evidence = machineEvidence(next);
      paintFacts();
    },
    needsAnimation(frame: BoardMotionFrame) {
      return !!facts && needsBoardAnimation(facts, frame, movement.travelling);
    },
    drawMotion(frame: BoardMotionFrame, dt: number, startedAt?: number) {
      if (disposed || !facts) return;
      lastFrame = frame;
      const state = normalize(facts.state),
        unavailable = state === "linkdown" || state === "signallost";
      if (!unavailable && !frame.reducedMotion && !movement.drawThisFrame()) {
        skippedDt += dt;
        return;
      }
      dt += skippedDt;
      skippedDt = 0;
      const ownStart = perf.start(),
        start = startedAt ?? ownStart;
      prepare(motion, motionDpr);
      const particles = painter.draw(
        motion,
        { facts, palette, glow, ownerGlow, smoke, era, parts, offParts: assets.offParts,
          dimPalette: assets.dimPalette, glows: assets.glows, evidence, build },
        composeStill ? { ...frame, reducedMotion: true } : frame,
        dt,
      );
      composeStill = false;
      const cost = performance.now() - start;
      if (!unavailable && !frame.reducedMotion) movement.sample(cost);
      perf.end(start, particles);
      lastDraw = cost;
      if (root.dataset.debug === "true") {
        root.dataset.frameMs = cost.toFixed(3);
        root.dataset.particles = String(particles);
        root.dataset.canvasCalls = String(perf.calls);
        root.dataset.heat = frame.heat.toFixed(3);
        root.dataset.dpr = String(motionDpr);
      }
    },
    sleep() {
      perf.sleep();
      if (root.dataset.debug === "true") {
        root.dataset.canvasCalls = "0";
        root.dataset.particles = "0";
      }
    },
    resetCamera() {
      camera.overview();
    },
    fit() {
      camera.overview();
    },
    clear() {
      fx.clear();
      skippedDt = 0;
      movement.reset();
      composeStill = true;
      key = "";
      if (facts) paintFacts();
    },
    get metrics() {
      return {
        ...perf.receipt,
        frameMs: lastDraw,
        bakeDimensions: { width: lastWidth, height: lastHeight },
      };
    },
    dispose() {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      camera.dispose();
      theme.disconnect();
      perf.dispose();
    },
  };
}
