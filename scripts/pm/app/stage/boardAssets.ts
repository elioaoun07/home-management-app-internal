import { BOARD, BUDGET, ZONES, type ZoneId, type ZoneGroup } from "./config";
import { bakeStatic, bakeZonePart, ZONE_ART } from "./board";
import { project } from "./iso";
import { bodyBounds } from "./spriteBounds";
import { bakeGlow } from "./fx";
import { desaturatePalette } from "./palette";
import type { BoardFacts, BoardMotionFrame, Sprite, StagePalette } from "./types";
import type { MachineEvidence } from "./machineEvidence";

export interface BoardAssets {
  image: HTMLCanvasElement;
  parts: Partial<Record<ZoneId, Sprite>>;
  offParts: Partial<Record<ZoneId, Sprite>>;
  bodies: Record<ZoneId, { reached: Sprite; off: Sprite }>;
  glows: Record<ZoneGroup, HTMLCanvasElement>;
  padLights: Record<ZoneId, Sprite>;
  dimPalette: StagePalette;
  milliseconds: number;
}
function bakeBody(id: ZoneId, palette: StagePalette): Sprite {
  const size = bodyBounds(id);
  const image = document.createElement("canvas");
  image.width = size.width * BUDGET.staticDpr;
  image.height = size.height * BUDGET.staticDpr;
  const ctx = image.getContext("2d")!;
  ctx.scale(BUDGET.staticDpr, BUDGET.staticDpr);
  ctx.translate(-size.x, -size.y);
  ZONE_ART[id].bake(ctx, { palette: { ...palette, shadow: "transparent" }, zone: id });
  return { image, ...size };
}

function bakePadLights(glows: BoardAssets["glows"]) {
  const textures = new Map<string, HTMLCanvasElement>();
  const lights = {} as BoardAssets["padLights"];
  for (const { id, group, pad } of ZONES) {
    const { width, depth } = pad, extent = width + depth;
    const key = [group, width, depth].join("/");
    let image = textures.get(key);
    if (!image) {
      image = document.createElement("canvas");
      image.width = extent * BUDGET.staticDpr;
      image.height = extent / 2 * BUDGET.staticDpr;
      const c = image.getContext("2d")!;
      c.scale(BUDGET.staticDpr, BUDGET.staticDpr);
      c.beginPath();
      c.moveTo(depth, 0);
      c.lineTo(extent, width / 2);
      c.lineTo(width, extent / 2);
      c.lineTo(0, depth / 2);
      c.closePath();
      c.clip();
      c.drawImage(glows[group], 0, 0, extent, extent / 2);
      textures.set(key, image);
    }
    const corner = project(pad.x, pad.y, BOARD.pad.raise);
    lights[id] = { image, x: corner.x - depth, y: corner.y, width: extent, height: extent / 2 };
  }
  return lights;
}

/** Immutable art is prepared once per palette, then reused by every zoom bucket. */
export function bakeBoardAssets(palette: StagePalette): BoardAssets {
  const start = performance.now();
  const dimPalette = desaturatePalette(palette);
  const image = document.createElement("canvas");
  image.width = BOARD.bounds.width * BUDGET.staticDpr;
  image.height = BOARD.bounds.height * BUDGET.staticDpr;
  const ctx = image.getContext("2d")!;
  ctx.scale(BUDGET.staticDpr, BUDGET.staticDpr);
  ctx.translate(-BOARD.bounds.x, -BOARD.bounds.y);
  bakeStatic(ctx, dimPalette, false);
  const parts: Partial<Record<ZoneId, Sprite>> = {};
  const offParts: Partial<Record<ZoneId, Sprite>> = {};
  const bodies = {} as BoardAssets["bodies"];
  for (const zone of ZONES) {
    parts[zone.id] = bakeZonePart(zone.id, palette);
    offParts[zone.id] = bakeZonePart(zone.id, dimPalette);
    bodies[zone.id] = { reached: bakeBody(zone.id, palette), off: bakeBody(zone.id, dimPalette) };
  }
  const glows = Object.fromEntries(Object.entries(palette.zones).map(([id, m]) => [id, bakeGlow(m.top)])) as BoardAssets["glows"];
  return { image, parts, offParts, bodies, glows, padLights: bakePadLights(glows), dimPalette,
    milliseconds: performance.now() - start };
}

/** Moving documents/screens carry current factual marks in their cached image. */
export function bakePartFacts(assets: BoardAssets, palette: StagePalette, facts: BoardFacts, evidence: MachineEvidence) {
  const parts: BoardAssets["parts"] = {};
  const frame: BoardMotionFrame = { beat: null, vitality: 0, heat: 0, elapsed: 0, tempo: 1, reducedMotion: true };
  for (const zone of ZONES) {
    const reached = evidence.reached[zone.id];
    const part = (reached ? assets.parts : assets.offParts)[zone.id];
    parts[zone.id] = part;
    if (!part || !ZONE_ART[zone.id].stateOnPart) continue;
    const image = document.createElement("canvas");
    image.width = part.image.width;
    image.height = part.image.height;
    const ctx = image.getContext("2d")!;
    ctx.drawImage(part.image, 0, 0);
    ctx.scale(image.width / part.width, image.height / part.height);
    ctx.translate(-part.x, -part.y);
    ZONE_ART[zone.id].state(ctx, { palette: reached ? palette : assets.dimPalette, zone: zone.id, facts, frame, evidence });
    parts[zone.id] = { ...part, image, stateBaked: true };
  }
  return parts;
}
