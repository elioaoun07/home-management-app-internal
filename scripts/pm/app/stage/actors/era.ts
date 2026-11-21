import { ART, TIMING } from "../config";
import { box, hexPrism, project } from "../iso";
import type { Sprite, StagePalette } from "../types";
import { eraShell } from "../palette";
export const ERA_SCALE = 1.6;
export type EraSpritePose = "upright" | "left" | "right" | "seated" | "down";
export interface EraSprites {
  poses: Record<EraSpritePose, Sprite>;
  hand: Sprite;
  thruster: HTMLCanvasElement;
}
function bake(p: StagePalette, pose: EraSpritePose): Sprite {
  const a = ART.era,
    canvas = document.createElement("canvas");
  canvas.width = a.width * 2;
  canvas.height = a.height * 2;
  const c = canvas.getContext("2d")!;
  c.scale(2, 2);
  c.translate(a.originX, a.originY);
  const seated = pose === "seated",
    down = pose === "down",
    lean = pose === "left" ? -0.12 : pose === "right" ? 0.12 : 0;
  c.rotate(lean);
  if (down) c.translate(0, 18);
  const shell = eraShell(p);
  hexPrism(c, shell, 0, 0, seated ? 12 : a.bodyZ, a.bodyR, seated ? 15 : 25);
  const z = seated ? 32 : a.headZ;
  hexPrism(c, shell, 0, 0, z, a.headR, a.headHeight);
  box(c, p.zones.build, -14, 11, z + 10, 28, 7, 14);
  box(c, p.trim, -3, -3, z + a.headHeight, 6, 6, 7);
  if (seated) {
    box(c, shell, -24, -2, 7, 16, 16, 10);
    box(c, shell, 7, -2, 7, 16, 16, 10);
  }
  return {
    image: canvas,
    x: -a.originX,
    y: -a.originY,
    width: a.width,
    height: a.height,
  };
}
export function bakeEra(
  p: StagePalette,
  thruster: HTMLCanvasElement,
): EraSprites {
  const poses = Object.fromEntries(
    (["upright", "left", "right", "seated", "down"] as EraSpritePose[]).map(
      (pose) => [pose, bake(p, pose)],
    ),
  ) as EraSprites["poses"];
  const image = document.createElement("canvas");
  image.width = 32;
  image.height = 40;
  const c = image.getContext("2d")!;
  c.translate(16, 30);
  hexPrism(c, eraShell(p), 0, 0, 0, ART.era.handR, 10);
  return {
    poses,
    hand: { image, x: -8, y: -15, width: 16, height: 20 },
    thruster,
  };
}
export function drawEra(
  c: CanvasRenderingContext2D,
  s: EraSprites,
  p: StagePalette,
  x: number,
  y: number,
  time: number,
  pose: EraSpritePose,
  options: { static?: boolean; ghost?: boolean; point?: boolean } = {},
) {
  c.save();
  c.translate(x, y);
  c.scale(ERA_SCALE, ERA_SCALE);
  x = y = 0;
  const a = ART.era,
    still = options.static || pose === "down",
    hover = still
      ? 0
      : Math.sin(((time * 1000) / TIMING.hover) * Math.PI * 2) * 2;
  const sprite = s.poses[pose],
    yy = y + hover;
  c.globalAlpha = options.ghost ? 0.3 : 1;
  c.drawImage(
    sprite.image,
    x + sprite.x,
    yy + sprite.y,
    sprite.width,
    sprite.height,
  );
  const seated = pose === "seated",
    eye = project(0, 16, (seated ? 32 : a.headZ) + 17),
    closed = !still && (time * 1000) % TIMING.blink < TIMING.blinkClosed;
  c.fillStyle = p.ink;
  const h = closed ? 1 : a.eyeH;
  const gaze = still ? 0 : Math.sin(time * 0.45) * 1.5;
  c.fillRect(x + eye.x - a.eyeGap / 2 + gaze, yy + eye.y, a.eyeW, h);
  c.fillRect(x + eye.x + a.eyeGap / 2 + gaze, yy + eye.y, a.eyeW, h);
  for (const direction of [-1, 1])
    c.drawImage(
      s.hand.image,
      x + direction * 25 - 8,
      yy - (seated ? 24 : 46) + (options.point && direction === 1 ? -8 : 0),
      16,
      20,
    );
  if (!seated && !still) {
    c.globalAlpha = 0.3;
    c.drawImage(s.thruster, x - 16, yy - 14, 32, 24);
  }
  c.globalAlpha = 1;
  c.restore();
}
