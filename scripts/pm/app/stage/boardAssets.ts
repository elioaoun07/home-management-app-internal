import { ART, BOARD, BUDGET, ZONES, ZONE_BY_ID, type ZoneId, type ZoneGroup } from "./config";
import { bakeStatic, bakeZonePart, ZONE_ART } from "./board";
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
  dimPalette: StagePalette;
  milliseconds: number;
}
function bakeBody(id: ZoneId, palette: StagePalette): Sprite {
  // Bodies include the wide arch row and gantry shadows; moving parts keep
  // their smaller, independent envelope.
  const size = { ...ART.sprite,
    width: ART.sprite.width + Math.max(...ART.verify.xs.map(x => Math.abs(x - ZONE_BY_ID.verify.machine.x))),
    height: ART.sprite.height + ART.shadow.depth };
  const image = document.createElement("canvas");
  image.width = size.width * BUDGET.staticDpr;
  image.height = size.height * BUDGET.staticDpr;
  const ctx = image.getContext("2d")!;
  ctx.scale(BUDGET.staticDpr, BUDGET.staticDpr);
  ctx.translate(size.originX, size.originY);
  ZONE_ART[id].bake(ctx, { palette, zone: id });
  return { image, x: -size.originX, y: -size.originY, width: size.width, height: size.height };
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
  return { image, parts, offParts, bodies, glows, dimPalette, milliseconds: performance.now() - start };
}

/** Moving documents/screens carry current factual marks in their cached image. */
export function bakePartFacts(assets: BoardAssets, palette: StagePalette, facts: BoardFacts, evidence: MachineEvidence) {
  const parts = { ...assets.parts };
  const frame: BoardMotionFrame = { beat: null, vitality: 0, heat: 0, elapsed: 0, tempo: 1, reducedMotion: true };
  for (const zone of ZONES) {
    const part = parts[zone.id];
    if (!part || !ZONE_ART[zone.id].stateOnPart) continue;
    const image = document.createElement("canvas");
    image.width = part.image.width;
    image.height = part.image.height;
    const ctx = image.getContext("2d")!;
    ctx.drawImage(part.image, 0, 0);
    ctx.scale(image.width / part.width, image.height / part.height);
    ctx.translate(-part.x, -part.y);
    ZONE_ART[zone.id].state(ctx, { palette, zone: zone.id, facts, frame, evidence });
    parts[zone.id] = { ...part, image, stateBaked: true };
  }
  return parts;
}
