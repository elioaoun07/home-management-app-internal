import {
  ART,
  BOARD,
  BUDGET,
  TIMING,
  ZONE_BY_ID,
  type BoardPoint,
} from "./config";
import { project } from "./iso";
import { beatZone } from "./board";
import type { BoardFacts, BoardMotionFrame } from "./types";
const ease = (t: number) => {
  const n = Math.max(0, Math.min(1, t));
  return n * n * (3 - 2 * n);
};
const lerp = (a: BoardPoint, b: BoardPoint, t: number): BoardPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export function buildStop(facts: BoardFacts): BoardPoint {
  if (facts.atMain) return BOARD.main;
  if (facts.buildZone === "verify") {
    const fault =
      facts.snapshot.seals?.findIndex(
        (s) => s.state === "failed" || s.state === "inconclusive",
      ) ?? -1;
    const gate =
      fault >= 0
        ? fault
        : Math.min(ART.verify.xs.length - 1, facts.buildGate ?? 0);
    return { x: ART.verify.xs[gate], y: ART.verify.y };
  }
  return (
    ZONE_BY_ID[facts.buildZone ?? "setup"].buildStop ??
    ZONE_BY_ID.build.buildStop!
  );
}
export function eraDestination(
  facts: BoardFacts,
  frame: BoardMotionFrame,
): BoardPoint {
  const act = facts.attention?.find(
    (item) => item.level === "act" && item.state === "open",
  );
  const zone =
    facts.state === "Cancelled" || facts.state === "cancelled"
      ? "brief"
      : (act?.zone ?? beatZone(frame, facts));
  const config = ZONE_BY_ID[zone];
  return config.eraStand ?? { x: config.machine.x + 40, y: BOARD.belt.walkway };
}
/** Coordinates are choreography of recorded facts, never a progress estimate. */
export function createMotionState() {
  let worker: BoardPoint = { x: 104, y: 160 },
    from = { ...worker },
    destination = { ...worker },
    travel = 1,
    lastKey = "";
  let previousBuild: BoardPoint | null = null,
    buildFrom: BoardPoint | null = null,
    buildTime = 1;
  let slowFrames = 0,
    cap: number = BUDGET.particles,
    skip = false,
    alternate = false;
  const costs: number[] = [];
  return {
    worker(facts: BoardFacts, frame: BoardMotionFrame, dt: number) {
      const waiting =
        frame.beat &&
        ["think", "decide"].includes(frame.beat.stage) &&
        !facts.attention?.some((i) => i.level === "act" && i.state === "open");
      const target = waiting ? worker : eraDestination(facts, frame),
        key = `${target.x}:${target.y}`;
      if (key !== lastKey) {
        lastKey = key;
        from = { ...worker };
        destination = target;
        travel = 0;
      }
      travel = Math.min(
        1,
        travel + (dt * 1000) / (TIMING.travel * frame.tempo),
      );
      worker = lerp(from, destination, ease(travel));
      return project(worker.x, worker.y, 7);
    },
    build(facts: BoardFacts, frame: BoardMotionFrame, dt: number) {
      const target = buildStop(facts);
      if (!previousBuild) {
        previousBuild = { ...target };
        buildFrom = { ...target };
      }
      if (target.x !== previousBuild.x || target.y !== previousBuild.y) {
        buildFrom = { ...previousBuild };
        previousBuild = { ...target };
        buildTime = 0;
      }
      buildTime =
        frame.ceremony &&
        ["launch", "reverted", "handover", "verify"].includes(frame.ceremony.kind) &&
        buildTime < 1
          ? frame.ceremony.progress
          : Math.min(
              1,
              buildTime + (dt * 1000) / (ART.beltTravel * frame.tempo),
            );
      const from = buildFrom!,
        u = ease(buildTime);
      let point: BoardPoint;
      if (from.y === BOARD.belt.outbound && target.y === BOARD.belt.return) {
        const route = (finish: BoardPoint, amount: number) => {
          const turn = BOARD.belt.turnEnd,
            depth = BOARD.belt.return - BOARD.belt.outbound,
            d = amount * (turn - from.x + depth + turn - finish.x);
          return d < turn - from.x
            ? { x: from.x + d, y: BOARD.belt.outbound }
            : d < turn - from.x + depth
              ? { x: turn, y: BOARD.belt.outbound + d - (turn - from.x) }
              : {
                  x: turn - (d - (turn - from.x + depth)),
                  y: BOARD.belt.return,
                };
        };
        const seal = ZONE_BY_ID.seal.buildStop!;
        point =
          frame.ceremony?.kind === "verify"
            ? u < 0.55
              ? route(seal, u / 0.55)
              : u < 0.75
                ? seal
                : lerp(seal, target, (u - 0.75) / 0.25)
            : route(target, u);
      } else point = lerp(from, target, u);
      return {
        point: project(
          point.x,
          point.y,
          facts.buildZone === "test"
            ? 37
            : facts.buildZone === "ship"
              ? 19
              : ART.build.standZ,
        ),
        moving: buildTime < 1,
      };
    },
    sample(cost: number) {
      costs.push(cost);
      if (costs.length > TIMING.slowFrames) costs.shift();
      if (
        costs.reduce((sum, value) => sum + value, 0) / costs.length >
        BUDGET.frameMs
      )
        slowFrames++;
      else slowFrames = 0;
      if (slowFrames >= TIMING.slowFrames) {
        if (cap > BUDGET.particles / 2) cap = Math.floor(cap / 2);
        else skip = true;
        slowFrames = 0;
      }
    },
    drawThisFrame() {
      alternate = !alternate;
      return !skip || alternate;
    },
    get cap() {
      return cap;
    },
    get travelling() {
      return travel < 1 || buildTime < 1;
    },
    reset() {
      worker = { x: 104, y: 160 };
      from = { ...worker };
      destination = { ...worker };
      lastKey = "";
      previousBuild = null;
      buildFrom = null;
      travel = 1;
      buildTime = 1;
    },
  };
}
export function needsBoardAnimation(
  facts: BoardFacts,
  frame: BoardMotionFrame,
  travelling = false,
) {
  if (
    frame.reducedMotion ||
    ["linkdown", "signallost"].includes(
      facts.state.toLowerCase().replace(/[\s-]/gu, ""),
    )
  )
    return false;
  if (frame.beat || frame.ceremony || travelling) return true;
  if (
    ["failed", "cancelled", "shipped", "reverted"].includes(
      facts.snapshot.phase,
    )
  )
    return false;
  return frame.vitality > 0.1;
}
