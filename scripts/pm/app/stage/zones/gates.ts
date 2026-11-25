import { ART, ZONE_BY_ID } from "../config";
import { box, project } from "../iso";
import type { BoardFacts, StagePalette } from "../types";

export interface ConveyorGate {
  zone: "verify" | "seal";
  index: number;
  x: number;
  y: number;
  halfDepth: number;
  postDepth: number;
  width: number;
  z: number;
  height: number;
}

// The posts straddle the return belt; the carrier is painted between them.
const frame = { y: ART.verify.y, halfDepth: ART.verify.depth / 2, postDepth: 4,
  width: ART.verify.width, z: ART.verify.z, height: ART.verify.height };
export const conveyorGates: ConveyorGate[] = [
  ...ART.verify.xs.map((x, index) => ({ ...frame, zone: "verify" as const, x, index })),
  { ...frame, zone: "seal", x: ZONE_BY_ID.seal.machine.x, width: 14, height: 67, index: 0 },
];

export function paintGate(c: CanvasRenderingContext2D, p: StagePalette, gate: ConveyorGate, side: "rear" | "front") {
  const { x, y, z, width, height, halfDepth, postDepth } = gate;
  const left = x - width / 2;
  const postY = side === "rear" ? y - halfDepth : y + halfDepth - postDepth;
  box(c, p.trim, left - 2, postY, 0, width + 4, postDepth, z);
  box(c, p.hull, left, postY, z, width, postDepth, height);
  if (side === "front")
    box(c, gate.zone === "verify" ? p.zones.verify : p.hull, left, y - halfDepth, z + height, width, halfDepth * 2, 8);
}

export function paintGateLamp(c: CanvasRenderingContext2D, palette: StagePalette, gate: ConveyorGate, facts: BoardFacts) {
  if (gate.zone !== "verify") return;
  const seal = facts.snapshot.seals[gate.index];
  const p = project(gate.x, gate.y, gate.z + gate.height + 8);
  c.fillStyle = seal?.state === "passed" ? palette.ok : seal?.state === "failed" ? palette.bad :
    seal?.state === "inconclusive" ? palette.warn : palette.trim.right;
  c.beginPath();
  c.arc(p.x, p.y, 4, 0, Math.PI * 2);
  c.fill();
}
