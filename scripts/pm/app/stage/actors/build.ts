import { ART } from "../config";
import { box, cylinder } from "../iso";
import { shade, color } from "../palette";
import { hash } from "../zones/shared";
import type { LocalScene } from "../../localRunScene";
import type { Sprite, StagePalette } from "../types";
export function bakeBuild(scene: LocalScene, p: StagePalette): Sprite {
  const image = document.createElement("canvas");
  image.width = 220;
  image.height = 300;
  const c = image.getContext("2d")!;
  c.scale(2, 2);
  c.translate(55, 132);
  const a = ART.build;
  cylinder(c, p.trim, 0, 0, 0, a.r, a.height);
  const nodes = scene.nodes
    .filter((node) => node.edited)
    .slice(0, 4 * a.layers);
  nodes.forEach((node, i) => {
    const area = node.area ?? "",
      tone = area
        ? color(
            shade(
              [
                110 + (hash(area) % 60),
                125 + (hash(area) % 35),
                145 + (hash(area) % 40),
                1,
              ],
              0,
            ),
          )
        : p.hull.top;
    box(
      c,
      { top: tone, left: p.hull.left, right: p.hull.right },
      -a.block + (i % 2) * (a.block + a.gap),
      -a.block + (Math.floor(i / 2) % 2) * (a.block + a.gap),
      a.height + Math.floor(i / 4) * (a.block + a.gap),
      a.block,
      a.block,
      a.block,
    );
  });
  if (scene.run.head) cylinder(c, p.zones.build, 0, 0, 6, a.r + 1, 4);
  scene.seals.forEach((seal, i) =>
    box(
      c,
      {
        top:
          seal.state === "passed"
            ? p.ok
            : seal.state === "failed"
              ? p.bad
              : seal.state === "inconclusive"
                ? p.warn
                : p.trim.right,
        left: p.trim.left,
        right: p.trim.right,
      },
      -18 + i * 10,
      19,
      5,
      6,
      6,
      5,
    ),
  );
  return { image, x: -55, y: -132, width: 110, height: 150 };
}
export function drawBuild(
  c: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
) {
  c.drawImage(
    sprite.image,
    x + sprite.x,
    y + sprite.y,
    sprite.width,
    sprite.height,
  );
}
