import { ZONE_ART, zoneStrip } from "./board";
import type { BoardAssets } from "./boardAssets";
import { ART, BOARD, BUDGET, LAMPS, ZONES, ZONE_BY_ID, type ZoneId } from "./config";
import { box, cylinder, project } from "./iso";
import type { MachineEvidence } from "./machineEvidence";
import type { BoardFacts, BoardMotionFrame, Sprite, StagePalette, Vec2 } from "./types";
import { conveyorGates, paintGate, paintGateLamp } from "./zones/gates";

export type ScenePiece =
  | { depth: number; kind: "solid" | "lamp"; sprite: Sprite; zone: ZoneId }
  | { depth: number; kind: "part"; zone: ZoneId; point: Vec2; sprite?: Sprite };

export function blit(c: CanvasRenderingContext2D, sprite: Sprite) {
  c.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height);
}

/** Fact-dependent details are drawn once. The same solid pixels both show the
 * equipment on the state canvas and occlude anything passing behind it. */
export function buildBoardScene(
  p: StagePalette, facts: BoardFacts, parts: Partial<Record<ZoneId, Sprite>>, assets: BoardAssets,
  evidence: MachineEvidence, surfaces: Map<string, HTMLCanvasElement>,
) {
  const pieces: ScenePiece[] = [];
  const still: BoardMotionFrame = { beat: null, vitality: 0, heat: 0, elapsed: 0, tempo: 1, reducedMotion: true };
  function capture(key: string, at: Vec2, bounds: Omit<Sprite, "image">, draw: (c: CanvasRenderingContext2D) => void): Sprite {
    const dpr = BUDGET.staticDpr;
    let image = surfaces.get(key);
    if (!image) {
      image = document.createElement("canvas");
      image.width = bounds.width * dpr;
      image.height = bounds.height * dpr;
      surfaces.set(key, image);
    }
    const c = image.getContext("2d")!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, bounds.width, bounds.height);
    c.translate(-bounds.x, -bounds.y);
    draw(c);
    return { image, x: at.x + bounds.x, y: at.y + bounds.y, width: bounds.width, height: bounds.height };
  }
  for (const zone of ZONES) {
    const { id, machine } = zone, point = project(machine.x, machine.y);
    const palette = evidence.reached[id] ? p : assets.dimPalette;
    const body = assets.bodies[id][evidence.reached[id] ? "reached" : "off"];
    const part = parts[id];
    const solid = capture(id, point, body, c => {
      blit(c, body);
      if (!part?.stateBaked) ZONE_ART[id].state(c, { palette, zone: id, facts, frame: still, evidence, part });
      if (facts.attention?.some(item => item.zone === id && item.level === "look" && item.state === "open")) {
        c.fillStyle = p.emissive;
        c.fillRect(-3, (zone.pad.y < BOARD.front[0] ? -105 : -62) - 3, 6, 6);
      }
    });
    const depth = machine.x + machine.y;
    pieces.push({ depth, kind: "solid", sprite: solid, zone: id });
    const gate = id === "seal" ? conveyorGates.find(gate => gate.zone === "seal") :
      id === "verify" ? conveyorGates.find(gate => gate.zone === "verify" && gate.index === (evidence.runningCheck ?? 2)) : undefined;
    let partDepth = depth;
    if (gate && (id === "verify" || id === "seal")) {
      // The scanner and press hang above the load. Their near faces can
      // cover its top while the front post still stands in front of both.
      const [x, y, , width, length] = ART.parts[id][0];
      partDepth = gate.x + x + width / 2 + machine.y + y + length;
    }
    pieces.push({ depth: partDepth, kind: "part", zone: id, point, sprite: part });
    const lamp = ART.lamp, pos = project(machine.x + lamp.x, machine.y + lamp.y, 6);
    const status = facts.zones.find(f => f.id === id)?.status;
    const bulb = capture(id + "-lamp", pos, { x: -8, y: -21, width: 16, height: 27 }, c => {
      box(c, p.trim, -3, -3, 0, 6, 6, lamp.post);
      c.fillStyle = status === "fault" ? p.bad : status === "done" ? p.ok :
        status === "needs-you" ? p.warn : status === "active" ? p.emissive : LAMPS.off;
      c.beginPath();
      c.arc(0, -lamp.post, lamp.r, 0, Math.PI * 2);
      c.fill();
    });
    pieces.push({ depth: depth + lamp.x + lamp.y, kind: "lamp", sprite: bulb, zone: id });
  }
  for (const gate of conveyorGates) {
    const point = project(gate.x, gate.y);
    for (const side of ["rear", "front"] as const) {
      const palette = evidence.reached[gate.zone] ? p : assets.dimPalette;
      const reach = gate.halfDepth + gate.width / 2 + 3;
      const top = -gate.z - gate.height - 8 - Math.ceil(reach / 2) - 2;
      const sprite = capture(gate.zone + gate.index + side, point,
        { x: -reach, y: top, width: reach * 2, height: Math.ceil(reach / 2) + 2 - top }, c => {
        c.translate(-point.x, -point.y);
        paintGate(c, palette, gate, side);
        if (side === "front") paintGateLamp(c, palette, gate, facts);
      });
      pieces.push({ kind: "solid", sprite, zone: gate.zone, depth: gate.x + gate.y +
        (side === "front" ? 1 : -1) * (gate.halfDepth - gate.postDepth / 2) });
    }
  }
  return pieces.sort((a, b) => a.depth - b.depth);
}

export function paintGroundFacts(c: CanvasRenderingContext2D, p: StagePalette, facts: BoardFacts) {
  if (facts.snapshot.run.base) cylinder(c, p.hull, BOARD.main.x, BOARD.main.y, 0, 9, 6);
  for (const fact of facts.zones)
    if (fact.done || fact.status === "done") zoneStrip(c, p, ZONE_BY_ID[fact.id]);
}

/** Merge moving feet and pallets into the same back-to-front order as fixed
 * station pieces. Raised objects keep their ground depth while they animate. */
export function paintByDepth<S extends { depth: number }, M extends { depth: number }>(
  scenery: readonly S[], moving: M[], paintScenery: (piece: S) => void, paintMoving: (piece: M) => void,
) {
  moving.sort((a, b) => a.depth - b.depth);
  let next = 0;
  for (const piece of scenery) {
    while (next < moving.length && moving[next].depth < piece.depth) paintMoving(moving[next++]);
    paintScenery(piece);
  }
  while (next < moving.length) paintMoving(moving[next++]);
}
