import { ART, BOARD, ZONES, ZONE_BY_ID, type ZoneId } from "./config";
import { box, polygon, project } from "./iso";
import { CROSSINGS, CROSSING_WIDTH, deckHeight } from "./serviceWalk";
import { partBounds } from "./spriteBounds";
import type {
  BoardFacts,
  BoardMotionFrame,
  BoardPlacement,
  Sprite,
  StagePalette,
  ZoneArt,
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
import { floorShadow } from "./zones/shared";
import { conveyorGates, paintGate } from "./zones/gates";
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
    const p = boardPoint(zone.pad.x, zone.pad.y, BOARD.pad.raise);
    return {
      id: zone.id,
      x: p.x - zone.pad.depth,
      y: p.y - ART.label.offsetY,
      width: zone.pad.width + zone.pad.depth,
      height: (zone.pad.width + zone.pad.depth) / 2 + ART.label.height,
    };
  });
}
const depthOrder = [...ZONES].sort((a, b) => a.machine.x + a.machine.y - b.machine.x - b.machine.y);
export function zoneStrip(c: CanvasRenderingContext2D, p: StagePalette, zone: (typeof ZONES)[number]) {
  const notch = zone.pad.width * 0.42;
  box(c, p.zones[zone.group], zone.pad.x + (zone.pad.width - notch) / 2,
    zone.pad.y + zone.pad.depth - ART.stripe.front, BOARD.pad.raise, notch, 2, ART.stripe.height);
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
  const aisleWidth = BOARD.belt.return - BOARD.belt.outbound - BOARD.belt.width;
  box(c, p.board, 0, BOARD.belt.walkway - aisleWidth / 2, 0, BOARD.belt.turnStart, aisleWidth, 1);
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
    for (let x = 30; x < BOARD.belt.turnEnd; x += 48) {
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
  // The operator's rear service lane and crossings share the geometry used by the feet.
  box(c, p.board, 0, 97, -.5, BOARD.belt.turnStart, 22, .5);
  for (let x = 8; x < BOARD.belt.turnStart; x += 32)
    box(c, p.trim, x, 116, 0, 12, 1.3, .3);
  const y = BOARD.belt.outbound, half = BOARD.belt.width / 2;
  for (const x of CROSSINGS) {
    const left = x - CROSSING_WIDTH / 2, right = x + CROSSING_WIDTH / 2;
    const ends = [y - half - 9, y - half, y + half, y + half + 9];
    for (let i = 0; i < 3; i++) {
      const near = ends[i], far = ends[i + 1];
      const a = deckHeight({ x, y: near }), b = deckHeight({ x, y: far });
      polygon(c, [project(left, near, a), project(right, near, a), project(right, far, b), project(left, far, b)], p.pad.top);
      polygon(c, [project(right, near, a), project(right, far, b), project(right, far), project(right, near)], p.pad.right);
    }
    for (const edge of [left + 1, right - 2.5])
      box(c, p.hull, edge, y - half, 5, 1.5, BOARD.belt.width, .3);
  }
  for (const zone of depthOrder) {
    const at = project(zone.machine.x, zone.machine.y);
    c.save();
    c.translate(at.x, at.y);
    floorShadow(c, { palette: p, zone: zone.id });
    c.restore();
  }
  if (!machines) return;
  const solid = { ...p, shadow: "transparent" };
  const fixtures = depthOrder.map(zone => ({
    depth: zone.machine.x + zone.machine.y,
    paint: () => {
      const at = project(zone.machine.x, zone.machine.y);
      c.save();
      c.translate(at.x, at.y);
      ZONE_ART[zone.id].bake(c, { palette: solid, zone: zone.id });
      c.restore();
    },
  }));
  for (const gate of conveyorGates)
    for (const side of ["rear", "front"] as const)
      fixtures.push({ depth: gate.x + gate.y + (side === "front" ? 1 : -1) * (gate.halfDepth - gate.postDepth / 2),
        paint: () => paintGate(c, p, gate, side) });
  fixtures.sort((a, b) => a.depth - b.depth).forEach(fixture => fixture.paint());
}
export function bakeZonePart(id: ZoneId, p: StagePalette): Sprite | undefined {
  const draw = ZONE_ART[id].bakePart;
  if (!draw) return;
  const size = partBounds(id),
    image = document.createElement("canvas");
  image.width = size.width * 2;
  image.height = size.height * 2;
  const c = image.getContext("2d")!;
  c.scale(2, 2);
  c.translate(-size.x, -size.y);
  draw(c, { palette: p, zone: id });
  return {
    image,
    x: size.x,
    y: size.y,
    width: size.width,
    height: size.height,
  };
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
