import { ART, BOARD, LAMPS, ZONES, ZONE_BY_ID, type ZoneId } from "./config";
import { box, cylinder, polygon, project } from "./iso";
import type {
  BoardFacts,
  BoardMotionFrame,
  BoardPlacement,
  Sprite,
  StagePalette,
  ZoneArt,
  ZoneRenderState,
} from "./types";
import * as brief from "./zones/brief";
import * as setup from "./zones/setup";
import * as explore from "./zones/explore";
import * as think from "./zones/think";
import * as build from "./zones/build";
import * as bench from "./zones/bench";
import * as seal from "./zones/seal";
import * as verify from "./zones/verify";
import * as handover from "./zones/handover";
import * as test from "./zones/test";
import * as ship from "./zones/ship";
import type { BoardAssets } from "./boardAssets";
import type { MachineEvidence } from "./machineEvidence";
export const ZONE_ART: Record<ZoneId, ZoneArt> = {
  brief,
  setup,
  explore,
  think,
  build,
  bench,
  seal,
  verify,
  handover,
  test,
  ship,
};
export const boardPoint = (x: number, y: number, z = 0) => {
  const p = project(x, y, z);
  return { x: p.x - BOARD.bounds.x, y: p.y - BOARD.bounds.y };
};
export function boardPlacements(): BoardPlacement[] {
  return ZONES.map((zone) => {
    const p = boardPoint(zone.pad.x, zone.pad.y, 6),
      m = boardPoint(zone.machine.x, zone.machine.y, 0);
    return {
      id: zone.id,
      x: p.x - zone.pad.depth,
      y: p.y - ART.label.offsetY,
      width: zone.pad.width + zone.pad.depth,
      height: (zone.pad.width + zone.pad.depth) / 2 + ART.label.height,
      chipX: m.x,
      chipY: m.y - ART.chip.height,
    };
  });
}
const depthOrder = [...ZONES].sort((a, b) => a.machine.x + a.machine.y - b.machine.x - b.machine.y);
function zoneStrip(c: CanvasRenderingContext2D, p: StagePalette, zone: (typeof ZONES)[number]) {
  box(c, p.zones[zone.group], zone.pad.x + ART.stripe.inset, zone.pad.y + zone.pad.depth - ART.stripe.front,
    BOARD.pad.raise, zone.pad.width - ART.stripe.inset * 2, ART.stripe.depth, ART.stripe.height);
}
export function bakeStatic(c: CanvasRenderingContext2D, p: StagePalette, machines = true) {
  const s = BOARD.slab;
  box(c, p.board, s.x, s.y, -s.thickness, s.width, s.depth, s.thickness);
  for (const z of ZONES) {
    box(
      c,
      p.pad,
      z.pad.x,
      z.pad.y,
      0,
      z.pad.width,
      z.pad.depth,
      BOARD.pad.raise,
    );
    if (machines) zoneStrip(c, p, z);
  }
  for (const y of [BOARD.belt.outbound, BOARD.belt.return]) {
    box(
      c,
      p.trim,
      0,
      y - BOARD.belt.width / 2,
      0,
      BOARD.belt.turnEnd,
      BOARD.belt.width,
      3,
    );
    for (let x = 8; x < BOARD.belt.turnEnd; x += 24) {
      const direction = y === BOARD.belt.outbound ? 1 : -1;
      polygon(
        c,
        [
          project(x, y - 4, 4),
          project(x + 6 * direction, y, 4),
          project(x, y + 4, 4),
          project(x + 2 * direction, y, 4),
        ],
        p.pad.top,
      );
    }
  }
  box(c, p.trim, BOARD.belt.turnStart, BOARD.belt.outbound, 0, 24, 60, 3);
  for (let x = 50; x < 770; x += 128) box(c, p.trim, x, 96, 0, 7, 34, 1);
  if (!machines) return;
  for (const zone of depthOrder) {
    const point = project(zone.machine.x, zone.machine.y);
    c.save();
    c.translate(point.x, point.y);
    ZONE_ART[zone.id].bake(c, { palette: p, zone: zone.id });
    c.restore();
  }
}
export function bakeZonePart(id: ZoneId, p: StagePalette): Sprite | undefined {
  const draw = ZONE_ART[id].bakePart;
  if (!draw) return;
  const size = ART.sprite,
    image = document.createElement("canvas");
  image.width = size.width * 2;
  image.height = size.height * 2;
  const c = image.getContext("2d")!;
  c.scale(2, 2);
  c.translate(size.originX, size.originY);
  draw(c, { palette: p, zone: id });
  return {
    image,
    x: -size.originX,
    y: -size.originY,
    width: size.width,
    height: size.height,
  };
}
export function drawState(
  c: CanvasRenderingContext2D,
  p: StagePalette,
  facts: BoardFacts,
  parts: Partial<Record<ZoneId, Sprite>>,
  cache?: { assets: BoardAssets; evidence: MachineEvidence },
) {
  const frame: BoardMotionFrame = {
    beat: null,
    vitality: 0,
    heat: 0,
    elapsed: 0,
    tempo: 1,
    reducedMotion: true,
  };
  if (facts.snapshot.run.base)
    cylinder(c, p.hull, BOARD.main.x, BOARD.main.y, 0, 9, 6);
  const movingZone =
    facts.activeZone ??
    facts.zones.find((z) => z.status === "fault")?.id ??
    facts.buildZone;
  const unavailable = ["linkdown", "signallost"].includes(
    facts.state.toLowerCase().replace(/[\s-]/gu, ""),
  );
  for (const zone of depthOrder) {
    const point = project(zone.machine.x, zone.machine.y),
      fact = facts.zones.find((z) => z.id === zone.id),
      lamp = ART.lamp;
    if (cache && (fact?.done || fact?.status === "done")) zoneStrip(c, p, zone);
    const reached = cache?.evidence.reached[zone.id] ?? true;
    const part = cache ? (reached ? parts[zone.id] : cache.assets.offParts[zone.id]) : parts[zone.id];
    c.save();
    c.translate(point.x, point.y);
    if (cache) {
      const body = cache.assets.bodies[zone.id][reached ? "reached" : "off"];
      c.drawImage(body.image, body.x, body.y, body.width, body.height);
    }
    const art: ZoneRenderState = { palette: cache && !reached ? cache.assets.dimPalette : p,
      zone: zone.id, facts, frame, part, evidence: cache?.evidence };
    if (
      facts.attention?.some(
        (item) =>
          item.zone === zone.id &&
          item.level === "look" &&
          item.state === "open",
      )
    ) {
      const mark = project(0, 0, zone.pad.y < 100 ? 105 : 62);
      c.fillStyle = p.emissive;
      c.fillRect(mark.x - 3, mark.y - 3, 6, 6);
    }
    if (
      part &&
      (unavailable || (movingZone !== zone.id && (cache || zone.id !== "seal"))) &&
      (cache || zone.id !== "think" || facts.snapshot.message)
    ) {
      c.drawImage(part.image, part.x, part.y, part.width, part.height);
    }
    if (!part?.stateBaked) ZONE_ART[zone.id].state(c, art);
    const post = project(lamp.x, lamp.y, 6);
    box(c, p.trim, lamp.x - 3, lamp.y - 3, 6, 6, 6, lamp.post);
    const color =
      fact?.status === "fault"
        ? p.bad
        : fact?.status === "done"
          ? p.ok
          : fact?.status === "needs-you"
            ? p.warn
            : fact?.status === "active"
              ? p.emissive
              : LAMPS.off;
    c.fillStyle = color;
    c.beginPath();
    c.arc(post.x, post.y - lamp.post, lamp.r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}
export function beatZone(frame: BoardMotionFrame, facts: BoardFacts): ZoneId {
  if (frame.beat?.stage === "think") return "think";
  const action = frame.beat?.action;
  return action === "read" || action === "search"
    ? "explore"
    : action === "edit"
      ? "build"
      : action === "command" || action === "agent-check"
        ? "bench"
        : action === "message"
          ? "think"
          : (facts.activeZone ??
            facts.zones.find((z) => z.status === "fault")?.id ??
            facts.buildZone ??
            "brief");
}
export function zoneMachine(id: ZoneId) {
  return project(ZONE_BY_ID[id].machine.x, ZONE_BY_ID[id].machine.y);
}
