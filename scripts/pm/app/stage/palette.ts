import type { Material } from "./types";
import { ZONE_HUES, LAMPS, type ZoneGroup } from "./config";
export type RGBA = [number, number, number, number];
export interface StagePalette extends Material {
  hull: Material;
  trim: Material;
  pad: Material;
  board: Material;
  zones: Record<ZoneGroup, Material>;
  emissive: string;
  ink: string;
  muted: string;
  line: string;
  bg: string;
  ok: string;
  warn: string;
  bad: string;
  shadow: string;
}
export const alpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], c[3] * a];
export const shade = (c: RGBA, n: number): RGBA =>
  [
    ...c.slice(0, 3).map((v) => (n >= 0 ? v + (255 - v) * n : v * (1 + n))),
    c[3],
  ] as RGBA;
export const color = (c: RGBA) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
const mix = (a: RGBA, b: RGBA, t: number): RGBA =>
  a.map((v, i) => v * t + b[i] * (1 - t)) as RGBA;
const material = (c: RGBA, left = -0.18, right = -0.36): Material => ({
  top: color(c),
  left: color(shade(c, left)),
  right: color(shade(c, right)),
});
function parse(value: string): RGBA {
  const hex = value.match(/^#([a-f\d]{6})$/iu);
  if (hex)
    return [0, 2, 4]
      .map((i) => parseInt(hex[1].slice(i, i + 2), 16))
      .concat(1) as RGBA;
  const values = value.match(/[\d.]+/gu)?.map(Number) ?? [];
  if (value.startsWith("color(srgb"))
    return [values[0] * 255, values[1] * 255, values[2] * 255, values[3] ?? 1];
  return [values[0] ?? 128, values[1] ?? 128, values[2] ?? 128, values[3] ?? 1];
}
export function stagePaletteFromColors(
  surface: RGBA,
  accent: RGBA,
  ink: RGBA,
  muted: RGBA,
  soft: RGBA,
  bg: RGBA,
  warn: RGBA,
): StagePalette {
  const hull = {
    top: color(mix(ink, surface, 0.58)),
    left: color(mix(ink, surface, 0.42)),
    right: color(mix(ink, surface, 0.26)),
  };
  const zones = {} as StagePalette["zones"];
  for (const group of Object.keys(ZONE_HUES) as ZoneGroup[])
    zones[group] = material(
      group === "build" ? accent : parse(ZONE_HUES[group]),
    );
  return {
    ...hull,
    hull,
    trim: {
      top: color(shade(surface, 0.1)),
      left: color(surface),
      right: color(shade(surface, -0.2)),
    },
    pad: material(soft, -0.25, -0.4),
    board: material(mix(surface, bg, 0.6), -0.3, -0.45),
    zones,
    emissive: color(accent),
    ink: color(ink),
    muted: color(muted),
    line: color(soft),
    bg: color(bg),
    ok: LAMPS.done,
    warn: color(warn),
    bad: LAMPS.fault,
    shadow: "rgba(0,0,0,.28)",
  };
}
export function resolveStagePalette(root: HTMLElement): StagePalette {
  const probe = document.createElement("span");
  probe.style.display = "none";
  root.appendChild(probe);
  const token = (name: string) => {
    probe.style.color = `var(${name})`;
    return parse(getComputedStyle(probe).color);
  };
  const palette = stagePaletteFromColors(
    token("--surface"),
    token("--accent"),
    token("--ink"),
    token("--ink-muted"),
    token("--surface-soft"),
    token("--theme-bg"),
    parse(ZONE_HUES.test),
  );
  probe.remove();
  return palette;
}

/** Preserve hue/lightness while reducing HSL saturation by the requested share. */
export function desaturateColor(value: string, amount = 0.35): string {
  const rgba = parse(value), gray = (Math.max(...rgba.slice(0, 3)) + Math.min(...rgba.slice(0, 3))) / 2;
  return color([rgba[0] + (gray - rgba[0]) * amount, rgba[1] + (gray - rgba[1]) * amount, rgba[2] + (gray - rgba[2]) * amount, rgba[3]]);
}
export function desaturatePalette(p: StagePalette): StagePalette {
  const dim = (m: Material): Material => ({ top: desaturateColor(m.top), left: desaturateColor(m.left), right: desaturateColor(m.right) });
  return { ...p, ...dim(p), hull: dim(p.hull), trim: dim(p.trim), pad: dim(p.pad), board: dim(p.board),
    zones: Object.fromEntries(Object.entries(p.zones).map(([id, m]) => [id, dim(m)])) as StagePalette["zones"],
    emissive: desaturateColor(p.emissive), ok: desaturateColor(p.ok), warn: desaturateColor(p.warn), bad: desaturateColor(p.bad) };
}
/** ERA keeps the theme hue at full saturation, with the same top-left key light. */
export function eraShell(p: StagePalette): Material {
  const rgba = parse(p.emissive), low = Math.min(...rgba.slice(0, 3)), high = Math.max(...rgba.slice(0, 3));
  const vivid: RGBA = high > low
    ? [(rgba[0] - low) * 255 / (high - low), (rgba[1] - low) * 255 / (high - low), (rgba[2] - low) * 255 / (high - low), rgba[3]] : rgba;
  return material(vivid, -0.2, -0.4);
}
