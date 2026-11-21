import * as T from "three";
import { bays, chair, roomPoint, stations } from "./layout";

const tau = Math.PI * 2;
export const canopySectors = 16;

// Each ceramic cassette follows the dome. Its UVs run across one fitted part
// from the inner compression collar to the outer lintel.
export function soffitGeometry(sector: number) {
  const rows = [
    [3.03, 6.21], [3.50, 6.38], [4.30, 6.58], [5.50, 6.55],
    [7.40, 6.12], [9.82, 5.45], [11.84, 4.83], [13.05, 4.49],
  ];
  const segments = 8, positions = [], colors = [], uvs = [], indices = [];
  const start = sector * tau / canopySectors;
  for (let row = 0; row < rows.length; row++) {
    const [radius, height] = rows[row];
    const t = (radius - rows[0][0]) / (rows.at(-1)![0] - rows[0][0]);
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const a = start + u * tau / canopySectors;
      const arch = Math.sin(Math.PI * u);
      positions.push(radius * Math.sin(a), height + .09 * arch, -radius * Math.cos(a));
      uvs.push(u, t);
      // Reflected blue window light and warm service lights fall off towards
      // the shadow in each rib. Slow, broad gradients survive mipmapping.
      const sky = .5 + .5 * Math.cos(a + 1.1);
      const edge = .73 + .27 * arch;
      const light = (.22 + .23 * t + .18 * Math.sin(t * Math.PI)) * edge;
      colors.push(light * (.80 + .18 * (1 - sky)), light * (.90 + .15 * sky), light * (1.02 + .36 * sky));
      if (row < rows.length - 1 && i < segments) {
        const index = row * (segments + 1) + i;
        indices.push(index, index + segments + 1, index + 1, index + 1, index + segments + 1, index + segments + 2);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** The milled Fresnel collector sits above ERA. The rings, soft aperture and
 * warm edge are baked into a mipmapped optic carried on the stepped housing. */
export function apertureGlass() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const glow = ctx.createRadialGradient(231, 196, 7, 256, 256, 256);
  for (const [at, color] of [
    [0, "#f2f8ee"], [.15,"#d9eae3"], [.33,"#b0ccce"], [.54,"#7e9a9d"],
    [.69,"#627c80"], [.80,"#8b9e99"], [.91,"#c9c1a8"], [1,"#344c51"],
  ] as const) glow.addColorStop(at, color);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 512);
  for (let r = 24; r < 248; r += 8) {
    ctx.beginPath(); ctx.arc(256, 256, r, 0, tau);
    ctx.strokeStyle = "rgba(31,51,59,.24)"; ctx.lineWidth = 2.3; ctx.stroke();
    ctx.beginPath(); ctx.arc(256, 256, r + 2, 0, tau);
    ctx.strokeStyle = "rgba(246,253,235,.30)"; ctx.lineWidth = 1.7; ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({ map: texture, color: "#c1d3d3" });
}

// The soft internal reflection sits on the near glass, several metres ahead
// of the external gantry. Four panes share one continuous fixture reflection.
export function galleryGlass() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const glass = ctx.createLinearGradient(0, 0, 0, 128);
  glass.addColorStop(0, "rgba(24,46,57,.64)");
  glass.addColorStop(.19, "rgba(72,101,112,.15)");
  glass.addColorStop(.58, "rgba(81,123,137,.05)");
  glass.addColorStop(1, "rgba(36,60,66,.34)");
  ctx.fillStyle = glass; ctx.fillRect(0, 0, 256, 128);
  const reflection = ctx.createLinearGradient(85, 0, 162, 58);
  for (const [at, alpha] of [[0,0],[.29,0],[.36,.10],[.55,.12],[.58,.02],[.67,0],[1,0]]) {
    reflection.addColorStop(at, `rgba(204,227,227,${alpha})`);
  }
  ctx.fillStyle = reflection; ctx.fillRect(0, 0, 256, 128);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
}

/**
 * A low-frequency irradiance bake in floor-cap UV space. All positioning reads
 * from the same station and chair coordinates as collision. Opaque structures
 * leave contact shadows, the perimeter receives window light and the central
 * well stays quiet enough to read the live topic reflection.
 */
export function deckIrradiance() {
  const canvas = document.createElement("canvas");
  const size = 384, radius = 12.45;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#727473"; ctx.fillRect(0, 0, size, size);
  // Three's cylinder cap maps world +z to U and world +x to V.
  const scale = size / (2 * radius);
  ctx.setTransform(0, -scale, scale, 0, size / 2, size / 2);
  function penumbra(x: number, z: number, width: number, depth: number, angle: number, color: string) {
    ctx.save(); ctx.translate(x, z); ctx.rotate(angle); ctx.scale(width, depth);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, color); gradient.addColorStop(.43, color); gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i + .50) * tau / 16;
    const x = Math.sin(angle), z = -Math.cos(angle);
    penumbra(x * 8, z * 8, 1.6, 5.4, angle, i % 4 === 2 ? "rgba(242,180,113,.72)" : "rgba(138,192,221,.65)");
    penumbra(x * 9.5 + .24, z * 9.5, .34, 3.35, angle + .13, "rgba(33,48,60,.40)");
  }
  for (const bay of bays) {
    for (const side of [-1, 1]) {
      const angle = bay.angle + side * bay.opening * 180 / Math.PI;
      const { x, z } = roomPoint(angle, 9.88);
      penumbra(x, z, .48, 1.60, angle * Math.PI / 180, "rgba(22,35,45,.63)");
    }
  }
  for (const fixture of [...stations, { ...chair, angle: .38 * 180 / Math.PI }]) {
    penumbra(fixture.x + .12, fixture.z - .10, 1.23, .93, fixture.angle * Math.PI / 180, "rgba(22,31,38,.80)");
  }
  penumbra(0, 0, 3.05, 3.05, 0, "rgba(23,33,42,.86)");
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.NoColorSpace;
  return map;
}
