import { BOARD, ZONE_BY_ID, type BoardPoint } from "./config";
import { project } from "./iso";

const rearLane = ZONE_BY_ID.brief.eraStand!.y;
const aisle = BOARD.belt.walkway;
export const CROSSINGS = [128, 384, 640] as const;
export const CROSSING_WIDTH = 22;
const distance = (a: BoardPoint, b: BoardPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const blend = (a: BoardPoint, b: BoardPoint, t: number) =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The back service bays and the centre aisle meet at raised conveyor crossings. */
export function serviceRoute(start: BoardPoint, end: BoardPoint) {
  const points = [start];
  if (start.y !== end.y) {
    const crossing = start.y !== rearLane && start.y !== aisle ? start.x :
      CROSSINGS.reduce<number>((best, x) => {
        const cost = (via: number) => Math.abs(start.x - via) + Math.abs(end.x - via);
        return cost(x) < cost(best) ? x : best;
      }, CROSSINGS[0]);
    points.push({ x: crossing, y: start.y }, { x: crossing, y: end.y });
  }
  points.push(end);
  const legs = points.slice(1).map((to, index) =>
    ({ from: points[index], to, length: distance(points[index], to) })).filter(leg => leg.length > 0);
  const length = legs.reduce((sum, leg) => sum + leg.length, 0);
  return { length, at(along: number): BoardPoint {
    let cursor = Math.max(0, along);
    for (const leg of legs) {
      if (cursor < leg.length) return blend(leg.from, leg.to, cursor / leg.length);
      cursor -= leg.length;
    }
    return end;
  } };
}
export function deckHeight(point: BoardPoint) {
  const { outbound, walkway, width, return: back } = BOARD.belt;
  if (CROSSINGS.some(x => Math.abs(x - point.x) <= CROSSING_WIDTH / 2)) {
    const gap = Math.abs(point.y - outbound) - width / 2;
    if (gap <= 0) return 5;
    if (gap < 9) return 5 - gap * (point.y < outbound ? 5 : 4) / 9;
  }
  return point.y >= walkway - (back - outbound - width) / 2 ? 1 : 0;
}
const stance = [{ x: -3.8, y: 3.5 }, { x: 4.8, y: -3.3 }] as const;
type Foot = BoardPoint & { lift: number };
const restFeet = (p: BoardPoint): Foot[] => stance.map(offset =>
  ({ x: p.x + offset.x, y: p.y + offset.y, lift: 0 }));
export function createServiceWalk() {
  const spawn = ZONE_BY_ID.brief.eraStand!;
  let center = spawn, end = spawn, route = serviceRoute(spawn, spawn);
  let feet = restFeet(center), initialFeet = feet;
  let elapsed = 0, travelled = 0, firstSwing = 0, heading: -1 | 1 = 1;
  function update(target: BoardPoint, dt: number, tempo: number, snap: boolean) {
    if (target.x !== end.x || target.y !== end.y) {
      end = target;
      route = serviceRoute(center, end);
      initialFeet = feet;
      firstSwing = feet[1].lift > feet[0].lift ? 1 : 0;
      elapsed = 0;
      travelled = 0;
    }
    const was = center;
    // Short moves take fewer steps. A long crossing can continue into the work beat.
    const duration = Math.max(.32, route.length / 175) * tempo;
    elapsed = snap ? duration : Math.min(duration, elapsed + dt);
    const t = elapsed / duration;
    travelled = route.length * (t * t * (3 - 2 * t));
    center = route.at(travelled);
    const dx = (center.x - was.x) - (center.y - was.y);
    if (Math.abs(dx) > .001) heading = dx < 0 ? -1 : 1;
    if (travelled >= route.length) {
      feet = restFeet(center);
    } else {
      const steps = Math.max(2, Math.ceil(route.length / 20));
      const step = travelled / route.length * steps;
      const index = Math.min(steps - 1, Math.floor(step)), u = step - index;
      const landing = (i: number, leg: number): Foot => {
        if (i < 0) return initialFeet[leg];
        const p = route.at((i >= steps - 2 ? steps : i + 1.5) / steps * route.length);
        return { x: p.x + stance[leg].x, y: p.y + stance[leg].y, lift: 0 };
      };
      feet = stance.map((_, leg) => {
        if (leg !== (index + firstSwing) % 2) return landing(index - 1, leg);
        const from = landing(index - 2, leg), to = landing(index, leg);
        return { ...blend(from, to, u * u * (3 - 2 * u)), lift: from.lift * (1 - u) + Math.sin(Math.PI * u) ** 2 * 5 };
      });
    }
    return project(center.x, center.y, deckHeight(center));
  }
  return { update, get center() { return center; }, get heading() { return heading; },
    get moving() { return travelled < route.length; },
    get feet() {
      const root = project(center.x, center.y, deckHeight(center));
      return feet.map(p => {
        const ground = project(p.x, p.y, deckHeight(p));
        return { x: ground.x - root.x, y: ground.y - root.y, lift: p.lift };
      });
    },
  };
}
