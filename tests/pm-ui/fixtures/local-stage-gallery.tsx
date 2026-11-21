// Test-only page: product code has no gallery mode or pixel instrumentation.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  BOARD,
  ART,
  ZONE_BY_ID,
  type ZoneId,
} from "../../../scripts/pm/app/stage/config";
import {
  ZONE_ART,
  drawState,
} from "../../../scripts/pm/app/stage/board";
import { bakeBoardAssets, bakePartFacts } from "../../../scripts/pm/app/stage/boardAssets";
import { machineEvidence } from "../../../scripts/pm/app/stage/machineEvidence";
import { project } from "../../../scripts/pm/app/stage/iso";
import { eraShell, resolveStagePalette } from "../../../scripts/pm/app/stage/palette";
import { bakeEra, drawEra, ERA_SCALE } from "../../../scripts/pm/app/stage/actors/era";
import {
  bakeBuild,
  drawBuild,
} from "../../../scripts/pm/app/stage/actors/build";
import { bakeGlow } from "../../../scripts/pm/app/stage/fx";
import { buildTimeline, sceneAt } from "../../../scripts/pm/app/localRunScene";
import {
  localRunAttention,
  futureRunAttention,
  type FutureAttentionSource,
} from "../../../scripts/pm/app/localRunAttention";
import { zoneEvidence } from "../../../scripts/pm/app/stage/zoneModel";
import { AttentionRail } from "../../../scripts/pm/app/stage/hud/AttentionRail";
import { BOARD_HUD_STYLE } from "../../../scripts/pm/app/stage/hud/layout";
import type { LocalRunView } from "../../../scripts/pm/app/LocalDelivery";
import type {
  BoardFacts,
  BoardMotionFrame,
} from "../../../scripts/pm/app/stage/types";

type Request = {
  run: LocalRunView;
  theme: "blue" | "pink";
  mode: "zone" | "board" | "era" | "build";
  id?: ZoneId;
  time?: number;
};
const frame: BoardMotionFrame = {
  beat: null,
  vitality: 0,
  heat: 0,
  elapsed: 0,
  tempo: 1,
  reducedMotion: true,
};
const host = document.createElement("main");
host.id = "art-gallery";
host.style.cssText =
  "width:fit-content;max-width:100%;padding:24px;background:var(--theme-bg);color:var(--ink)";
document.body.replaceChildren(host);
function canvas(width: number, height: number) {
  const value = document.createElement("canvas"),
    dpr = Math.min(2, devicePixelRatio);
  value.width = width * dpr;
  value.height = height * dpr;
  value.style.cssText = `width:${width}px;height:${height}px;display:block;max-width:100%;object-fit:contain`;
  const ctx = value.getContext("2d")!;
  ctx.scale(dpr, dpr);
  host.appendChild(value);
  return { value, ctx };
}
function pixelFacts(
  value: HTMLCanvasElement,
  tones: { top: string; left: string; right: string },
  strokes: number,
) {
  const c = value.getContext("2d")!,
    data = c.getImageData(0, 0, value.width, value.height).data;
  let minX = value.width,
    minY = value.height,
    maxX = -1,
    maxY = -1,
    ink = 0,
    shadow = 0;
  const exact: Record<string, number> = {},
    rgb = Object.fromEntries(
      Object.entries(tones).map(([key, tone]) => [
        key,
        tone
          .match(/[\d.]+/gu)!
          .slice(0, 3)
          .map(Number)
          .map(Math.round),
      ]),
    );
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 4) continue;
    const x = (i / 4) % value.width,
      y = Math.floor(i / 4 / value.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    ink++;
    if (
      data[i] === 0 &&
      data[i + 1] === 0 &&
      data[i + 2] === 0 &&
      data[i + 3] > 10 &&
      data[i + 3] < 200
    )
      shadow++;
    for (const [key, color] of Object.entries(rgb))
      if (data[i + 3] === 255 && color.every((v, j) => data[i + j] === v))
        exact[key] = (exact[key] ?? 0) + 1;
  }
  return {
    width: value.width,
    height: value.height,
    ink,
    shadow,
    strokes,
    tones,
    exact,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      right: maxX,
      bottom: maxY,
    },
  };
}
export function renderGallery(request: Request) {
  document.documentElement.dataset.theme = request.theme;
  host.replaceChildren();
  const p = resolveStagePalette(host),
    timeline = buildTimeline(request.run),
    snapshot = sceneAt(timeline, request.time ?? timeline.end ?? Date.now());
  const attention = localRunAttention(
    request.run,
    new Set(),
    request.time ?? timeline.end ?? Date.now(),
  );
  const zones = zoneEvidence(snapshot, null, attention);
  const facts: BoardFacts = {
    snapshot,
    state: "live",
    zones: zones.zones,
    attention,
    activeZone: zones.activeZone,
    buildZone: zones.buildZone,
    atMain: zones.atMain,
  };
  const evidence = machineEvidence(facts);
  const title = document.createElement("h1");
  title.textContent = request.id?.toUpperCase() ?? request.mode.toUpperCase();
  title.style.cssText =
    "font:16px monospace;letter-spacing:normal;margin-bottom:18px";
  host.appendChild(title);
  const width =
    request.mode === "board"
      ? BOARD.bounds.width
      : request.mode === "era"
        ? 110 * ERA_SCALE
        : request.mode === "build"
          ? 110
          : 420;
  const height =
    request.mode === "board"
      ? BOARD.bounds.height
      : request.mode === "era"
        ? 120 * ERA_SCALE
        : request.mode === "build"
          ? 150
          : 340;
  const { value, ctx: c } = canvas(width, height);
  let strokes = 0;
  const stroke = CanvasRenderingContext2D.prototype.stroke;
  const strokeWithoutPath: (this: CanvasRenderingContext2D) => void = stroke;
  CanvasRenderingContext2D.prototype.stroke = function (path?: Path2D) {
    strokes++;
    if (path === undefined) strokeWithoutPath.call(this);
    else stroke.call(this, path);
  };
  const started = performance.now();
  let partImage: HTMLCanvasElement | null = null;
  const bodyImages: { image: HTMLCanvasElement; tones: typeof p.hull }[] = [];
  const partImages: HTMLCanvasElement[] = [];
  let orbDpr = 1;
  let orbTones = p.zones.build;
  let tones = request.mode === "era" ? eraShell(p) : p.hull;
  try {
  if (request.mode === "zone") {
    const id = request.id!;
    const assets = bakeBoardAssets(p), parts = bakePartFacts(assets, p, facts, evidence);
    const palette = evidence.reached[id] ? p : assets.dimPalette;
    tones = palette.hull;
    c.translate(180, 220);
    const body = assets.bodies[id][evidence.reached[id] ? "reached" : "off"];
    c.drawImage(body.image, body.x, body.y, body.width, body.height);
    const part = evidence.reached[id] ? parts[id] : assets.offParts[id];
    if (part) {
      partImage = part.image;
      c.drawImage(part.image, part.x, part.y, part.width, part.height);
      if (id === "think") {
        orbDpr = part.image.width / part.width;
        orbTones = palette.zones.build;
      }
    }
    if (!part?.stateBaked) ZONE_ART[id].state(c, { palette, zone: id, facts, frame, part, evidence });
    bodyImages.push({ image: assets.bodies[id].reached.image, tones: p.hull },
      { image: assets.bodies[id].off.image, tones: assets.dimPalette.hull });
    for (const value of [assets.parts[id], assets.offParts[id]])
      if (value) partImages.push(value.image);
  } else if (request.mode === "board") {
    c.translate(-BOARD.bounds.x, -BOARD.bounds.y);
    const assets = bakeBoardAssets(p);
    const parts = bakePartFacts(assets, p, facts, evidence);
    c.drawImage(assets.image, BOARD.bounds.x, BOARD.bounds.y, BOARD.bounds.width, BOARD.bounds.height);
    drawState(c, p, facts, parts, { assets, evidence });
    const stop = ZONE_BY_ID[zones.buildZone].buildStop ?? BOARD.main,
      at = project(stop.x, stop.y);
    drawBuild(c, bakeBuild(snapshot, p), at.x, at.y);
  } else if (request.mode === "era") {
    drawEra(c, bakeEra(p, bakeGlow(p.emissive)), p, 55 * ERA_SCALE, 112 * ERA_SCALE, 1, "upright", {
      static: true,
    });
  } else drawBuild(c, bakeBuild(snapshot, p), 55, 132);
  } finally {
    CanvasRenderingContext2D.prototype.stroke = stroke;
  }
  const bakeMs = performance.now() - started;
  const orbPixels = request.id === "think" && partImage
    ? pixelFacts(partImage, orbTones, 0).exact
    : null;
  const orbArea = Math.PI * (ART.orb.r * orbDpr) ** 2;
  return {
    ...pixelFacts(value, tones, strokes),
    part: partImage ? pixelFacts(partImage, tones, 0) : null,
    bodyVariants: bodyImages.map((sprite) => pixelFacts(sprite.image, sprite.tones, 0)),
    partVariants: partImages.map((image) => pixelFacts(image, p.hull, 0)),
    orb: orbPixels ? {
      pixels: Object.values(orbPixels).reduce((sum, value) => sum + value, 0),
      nativeDpr: orbDpr,
      projectedArea: orbArea,
      visibleRatio: Object.values(orbPixels).reduce((sum, value) => sum + value, 0) / orbArea,
    } : null,
    bakeMs,
    reached: evidence.reached,
    palette: p,
    mode: request.mode,
    id: request.id,
  };
}
/** Native-pixel crop from the exact test gallery, with no DOM heading/label. */
export function renderCrop(request: Request) {
  const facts = renderGallery(request), source = host.querySelector("canvas")!;
  const padding = Math.round(12 * Math.min(2, devicePixelRatio));
  const crop = document.createElement("canvas");
  crop.width = facts.bounds.width + padding * 2;
  crop.height = facts.bounds.height + padding * 2;
  crop.getContext("2d")!.drawImage(source, facts.bounds.x, facts.bounds.y,
    facts.bounds.width, facts.bounds.height, padding, padding,
    facts.bounds.width, facts.bounds.height);
  return { dataUrl: crop.toDataURL("image/png"), width: crop.width, height: crop.height };
}
export function renderFutureRail(
  source: FutureAttentionSource,
  theme: "blue" | "pink",
) {
  document.documentElement.dataset.theme = theme;
  host.replaceChildren();
  const root = document.createElement("div");
  root.className = "board-workshop";
  Object.assign(root.style, {
    width: "340px",
    minHeight: "550px",
    display: "flex",
  });
  for (const [key, value] of Object.entries(BOARD_HUD_STYLE))
    root.style.setProperty(key, String(value));
  host.appendChild(root);
  const items = futureRunAttention(source),
    selected = items.find((item) => item.kind === "question")?.id;
  createRoot(root).render(
    createElement(AttentionRail, {
      items,
      selectedId: selected,
      badges: [],
      badgesOpen: false,
      onBadgesClose: () => {},
    }),
  );
  return items;
}
Object.assign(window, { __artGallery: { renderGallery, renderCrop, renderFutureRail } });
