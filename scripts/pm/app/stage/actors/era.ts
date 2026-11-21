import { dome, polygon } from "../iso";
import type { StagePalette, Vec2 } from "../types";

export type EraGesture = "idle" | "travel" | "scan" | "edit" | "wait" | "park";
export interface EraPose {
  gesture: EraGesture;
  facing: -1 | 1;
  extension: number;
  target?: Vec2;
  static?: boolean;
  ghost?: boolean;
}
interface Sole extends Vec2 { lift: number }
const planted: readonly Sole[] = [{ x: -7.3, y: -.15, lift: 0 }, { x: 8.1, y: .75, lift: 0 }];
const TAU = Math.PI * 2;
export const OPERATOR_BOUNDS = { x: -88, y: -126, width: 176, height: 160 } as const;
function oval(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, w, h, 0, 0, TAU);
  c.fill();
}
function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
function link(c: CanvasRenderingContext2D, a: Vec2, b: Vec2, radius: number, color: string) {
  c.save();
  c.translate(a.x, a.y);
  c.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  panel(c, -radius, -radius, Math.hypot(b.x - a.x, b.y - a.y) + 2 * radius, radius * 2, radius, color);
  c.restore();
}
// The fixed shade on the left and the dark right edge match the board's machine faces.
// Only the head turns. Lighting and footing stay in board coordinates.
function body(p: StagePalette, facing: number) {
  const image = document.createElement("canvas");
  image.width = 64 * 2; image.height = 78 * 2;
  const c = image.getContext("2d")!;
  c.scale(2, 2); c.translate(32, 74);
  // Low battery housing, a narrow waist bearing and the service hatch.
  panel(c, -11, -26, 23, 12, 6, p.trim.right);
  panel(c, -13, -27, 26, 5, 2, p.hull.right);
  dome(c, p.hull, 0, 0, 23, 16, 24);
  panel(c, -13, -39, 27, 13, 5, p.hull.top);
  panel(c, -6 + facing * 3, -35, 13, 5, 2, p.trim.left);
  panel(c, -4 + facing * 3, -34, 6, 2, 1, p.emissive);
  panel(c, -7, -46, 14, 5, 2, p.trim.right);
  // Spun shell, elastomer face gasket and a proud, single-piece glass visor.
  const glassX = facing > 0 ? -14 : -20;
  panel(c, -22, -70, 44, 28, 12, p.hull.right);
  panel(c, -22, -70, 42, 25, 11, p.hull.top);
  panel(c, -20, -70, 36, 11, 5, p.ink);
  panel(c, -19, -66, 34, 8, 3.5, p.hull.top);
  panel(c, glassX - 1, -65, 36, 19, 8, p.hull.left);
  panel(c, glassX, -64, 34, 17, 7, p.trim.right);
  panel(c, glassX + 2, -62.5, 27, 3, 1.5, p.trim.top);
  panel(c, glassX + (facing > 0 ? 9 : 5), -59.5, 4.2, 7.8, 2, p.emissive);
  panel(c, glassX + (facing > 0 ? 22 : 18), -59.5, 4.2, 7.8, 2, p.emissive);
  oval(c, -facing * 20, -56, 4, 6, p.hull.left);
  oval(c, -facing * 20, -56, 2.1, 3.8, p.zones.build.left);
  // A small inspection beacon set into the crown.
  oval(c, -facing * 9, -69, 5, 1.8, p.hull.right);
  oval(c, -facing * 9, -70, 3.5, 1.6, p.emissive);
  return image;
}
export function bakeEra(p: StagePalette) {
  // Compose only the operator's small footprint, keeping every joint under the same camera.
  const image = document.createElement("canvas");
  image.width = 2 * OPERATOR_BOUNDS.width; image.height = 2 * OPERATOR_BOUNDS.height;
  return { p, left: body(p, -1), right: body(p, 1), image, ctx: image.getContext("2d")! };
}
export type EraSprites = ReturnType<typeof bakeEra>;
export type OperatorOcclusion = (ctx: CanvasRenderingContext2D) => void;

function leg(c: CanvasRenderingContext2D, p: StagePalette, sole: Sole, side: number, bob: number) {
  const foot = { x: sole.x, y: sole.y - sole.lift };
  const hip = { x: side * 7, y: -18 + bob };
  const knee = { x: (hip.x + foot.x) / 2 - 1.8, y: (hip.y + foot.y) / 2 - 3 };
  link(c, hip, knee, 3.5, p.hull.right);
  link(c, knee, { x: foot.x, y: foot.y - 4 }, 2.7, p.hull.top);
  oval(c, knee.x, knee.y, 3.4, 3.1, p.trim.left);
  // Bottom of the sole is a level 2:1 ellipse, centred on the actual contact point.
  oval(c, foot.x, foot.y - 1.8, 7.4, 3.4, p.trim.right);
  oval(c, foot.x, foot.y - 3.2, 7.1, 3, p.hull.left);
  oval(c, foot.x - 1, foot.y - 4.4, 5.5, 2.2, p.hull.top);
}
function arm(c: CanvasRenderingContext2D, p: StagePalette, shoulder: Vec2, hand: Vec2, side: number) {
  const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.sqrt(Math.max(0, 12 * 12 - length * length / 4));
  const elbow = { x: (shoulder.x + hand.x) / 2 + side * dy / length * bend,
    y: (shoulder.y + hand.y) / 2 - side * dx / length * bend };
  link(c, shoulder, elbow, 3.1, p.hull.right);
  link(c, elbow, hand, 2.3, p.hull.top);
  oval(c, shoulder.x, shoulder.y, 4.4, 4.5, p.hull.top);
  oval(c, elbow.x, elbow.y, 2.8, 2.8, p.trim.left);
  panel(c, hand.x - 4.1, hand.y - 3.4, 8.2, 7.3, 2.7, p.hull.top);
  panel(c, hand.x - 3, hand.y + .7, 2.1, 4.7, 1, p.hull.left);
  panel(c, hand.x + 1.2, hand.y + .7, 2.1, 4.2, 1, p.hull.left);
}
export function drawEra(
  c: CanvasRenderingContext2D, sprites: EraSprites, x: number, y: number, seconds: number,
  pose: EraPose, feet: readonly Sole[] = planted, occlude?: OperatorOcclusion,
) {
  const { p, ctx: k, image } = sprites, { gesture, facing, target } = pose;
  k.setTransform(1, 0, 0, 1, 0, 0);
  k.clearRect(0, 0, image.width, image.height);
  k.setTransform(2, 0, 0, 2, -2 * OPERATOR_BOUNDS.x, -2 * OPERATOR_BOUNDS.y);
  const gait = feet[1].lift - feet[0].lift;
  const bob = gesture === "travel" ? -.23 * Math.abs(gait) : gesture === "park" ? 2 :
    pose.static ? 0 : .4 * Math.sin(seconds * 2);
  for (const foot of feet) {
    k.globalAlpha = 1 - foot.lift * .1;
    oval(k, foot.x, foot.y, 8.1, 3.7, p.shadow);
  }
  k.globalAlpha = 1;
  const shoulder = { x: 11 * facing, y: -36 + bob };
  const hand = { x: (16 + gait * .4) * facing, y: -22 + bob };
  if (gesture === "wait") { hand.x = 22 * facing; hand.y -= 7; }
  if ((gesture === "scan" || gesture === "edit") && target) {
    const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
    const reach = Math.min(1, 29 / Math.max(1, Math.hypot(dx, dy)));
    hand.x += (shoulder.x + dx * reach - hand.x) * pose.extension;
    hand.y += (shoulder.y + dy * reach - hand.y) * pose.extension;
    if (gesture === "scan" && pose.extension > .05) {
      k.globalAlpha = .22 * pose.extension;
      polygon(k, [{ x: hand.x, y: hand.y }, { x: target.x - 3, y: target.y - 1 },
        { x: target.x + 3, y: target.y + 1 }], p.emissive);
      k.globalAlpha = 1;
    }
  }
  leg(k, p, feet[0], -1, bob); leg(k, p, feet[1], 1, bob);
  arm(k, p, { x: -11 * facing, y: -37 + bob }, { x: (-17 - gait * .4) * facing, y: -24 + bob }, -facing);
  k.drawImage(facing > 0 ? sprites.right : sprites.left, -32, -74 + bob, 64, 78);
  arm(k, p, shoulder, hand, facing);
  if (gesture === "edit" || gesture === "scan")
    oval(k, hand.x + facing * 2.2, hand.y, 1.6, 1.4, p.emissive);
  if (occlude) {
    k.save();
    k.globalCompositeOperation = "destination-out";
    k.translate(-x, -y);
    occlude(k);
    k.restore();
  }
  c.save();
  if (pose.ghost) c.globalAlpha *= .36;
  c.drawImage(image, x + OPERATOR_BOUNDS.x, y + OPERATOR_BOUNDS.y, OPERATOR_BOUNDS.width, OPERATOR_BOUNDS.height);
  c.restore();
}
