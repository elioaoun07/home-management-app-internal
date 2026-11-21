import type { BoardFacts, BoardMotionFrame, Vec2 } from "./types";

export const CAPSULE_LIFT = 60;
/** The existing single capsule transfers only on a recorded terminal ceremony. */
export function capsulePoint(facts: BoardFacts, frame: BoardMotionFrame, point: Vec2): Vec2 {
  if (frame.reducedMotion || ["linkdown", "signallost"].includes(facts.state.toLowerCase().replace(/[\s-]/gu, ""))) return point;
  const ceremony = frame.ceremony;
  if (!ceremony || !((facts.snapshot.phase === "shipped" && ceremony.kind === "launch") ||
    (facts.snapshot.phase === "reverted" && ceremony.kind === "reverted"))) return point;
  const progress = Math.max(0, Math.min(1, ceremony.progress));
  if (progress === 0 || progress === 1) return point;
  return { x: point.x, y: point.y - Math.sin(progress * Math.PI) * CAPSULE_LIFT };
}
