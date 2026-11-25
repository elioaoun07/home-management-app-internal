import { ART, MACHINE_PARTS, type BoxPart, type ZoneId } from "./config";

/** Native drawing envelopes, derived from the projected corners of the art.
 * Cropping the cached images also keeps empty pixels out of the mask pass. */
function boxBounds(boxes: readonly BoxPart[], margin: number, extraTop = Infinity) {
  const left = Math.floor(Math.min(...boxes.map(([x, y, , , d]) => x - y - d)) - margin);
  const right = Math.ceil(Math.max(...boxes.map(([x, y, , w]) => x + w - y)) + margin);
  const top = Math.floor(Math.min(extraTop, ...boxes.map(([x, y, z, , , h]) => (x + y) / 2 - z - h)) - margin);
  const bottom = Math.ceil(Math.max(...boxes.map(([x, y, z, w, d]) => (x + y + w + d) / 2 - z)) + margin);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function bodyBounds(zone: ZoneId) {
  // Include control panels, drawer fronts and the elevated attention indicator.
  return boxBounds(MACHINE_PARTS[zone], 9, -110);
}

export function partBounds(zone: ZoneId) {
  if (zone === "think") {
    const { r, z, railR } = ART.orb;
    return { x: -railR - 4, y: -z - r - 4, width: 2 * (railR + 4), height: 2 * (r + 4) };
  }
  // The briefing can have an arbitrary number of objective marks.
  if (zone === "brief") return { x: -ART.sprite.originX, y: -ART.sprite.originY,
    width: ART.sprite.width, height: ART.sprite.height };
  return boxBounds(ART.parts[zone], 12);
}
