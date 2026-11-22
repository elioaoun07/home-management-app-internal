import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { liftAngle, liftPoint, type Floor } from "./layout";

const metal = (color: string, metalness: number, roughness: number) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const light = (color: string) =>
  new T.MeshBasicMaterial({ color, toneMapped: false });
const smooth = (n: number) => {
  const t = T.MathUtils.clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};
export const liftDuration = 1860;
export function liftFrame(elapsed: number) {
  const t = T.MathUtils.clamp(elapsed / liftDuration, 0, 1);
  return {
    closed: smooth(t / 0.23) * (1 - smooth((t - 0.76) / 0.24)),
    travel: smooth((t - 0.22) / 0.55),
    arrived: t >= 0.53,
    done: t === 1,
  };
}

/** Build fixed parts per finish, keeping the moving doors independent. */
function fabrication(group: T.Group) {
  const stock = new Map<T.Material, T.BufferGeometry[]>();
  return {
    plate(
      material: T.Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) {
      const part = new T.BoxGeometry(w, h, d);
      part.translate(x, y, z);
      const pile = stock.get(material) ?? [];
      pile.push(part);
      stock.set(material, pile);
    },
    finish() {
      for (const [material, parts] of stock) {
        const geometry = mergeGeometries(parts);
        if (geometry) group.add(new T.Mesh(geometry, material));
        for (const part of parts) part.dispose();
      }
      stock.clear();
    },
  };
}

export function makeElevator() {
  const group = new T.Group(),
    center = liftPoint(0, 0);
  group.position.set(center.x, 0, center.z);
  group.rotation.y = liftAngle;
  const graphite = metal("#26323b", 0.65, 0.36),
    alloy = metal("#819499", 0.78, 0.34);
  const ceramic = metal("#b8c4c0", 0.37, 0.42),
    copper = metal("#b68a59", 0.75, 0.34);
  const rubber = metal("#17272c", 0.2, 0.82),
    ivory = light("#e9eada");
  const signal = light("#8ddbef");
  const cabin = fabrication(group);
  const cutaway = new T.Group();
  group.add(cutaway);
  const shell = fabrication(cutaway);
  cabin.plate(graphite, 0, 0.038, 0, 2.4, 0.074, 2.34);
  cabin.plate(alloy, 0, 0.083, 0.03, 2.19, 0.024, 2.08);
  cabin.plate(rubber, 0, 0.105, 0, 1.94, 0.02, 1.84);
  for (let x = -0.81; x < 0.83; x += 0.19)
    cabin.plate(alloy, x, 0.122, 0.01, 0.018, 0.008, 1.63);
  cabin.plate(copper, 0, 0.094, 1.09, 2.48, 0.04, 0.15);
  for (const side of [-1, 1]) {
    cabin.plate(graphite, side * 1.1, 1.43, -0.03, 0.18, 2.85, 2.2);
    cabin.plate(alloy, side * 0.994, 1.48, -0.17, 0.038, 2.46, 1.71);
    cabin.plate(ceramic, side * 0.966, 1.9, -0.25, 0.027, 1.25, 1.37);
    cabin.plate(rubber, side * 0.94, 0.98, -0.29, 0.08, 0.13, 1.37);
    cabin.plate(copper, side * 0.895, 1.02, -0.29, 0.046, 0.085, 1.4);
    for (const z of [-0.78, 0.37])
      cabin.plate(signal, side * 0.947, 2.01, z, 0.012, 1.11, 0.027);
    cabin.plate(alloy, side * 1.075, 1.45, 1.04, 0.32, 2.89, 0.26);
    cabin.plate(graphite, side * 1.08, 1.38, 1.193, 0.265, 2.71, 0.047);
    cabin.plate(copper, side * 1.08, 1.44, 1.225, 0.055, 2.5, 0.021);
    cabin.plate(signal, side * 0.908, 1.41, 1.15, 0.024, 2.62, 0.026);
  }
  shell.plate(graphite, 0, 1.4, -1.08, 2.24, 2.82, 0.16);
  shell.plate(ceramic, 0, 1.64, -0.98, 1.96, 1.95, 0.04);
  shell.plate(graphite, 0, 1.05, -0.902, 1.91, 0.11, 0.1);
  shell.plate(copper, 0, 1.075, -0.84, 1.8, 0.054, 0.056);
  shell.plate(graphite, 0, 2.81, -0.01, 2.43, 0.19, 2.43);
  shell.plate(alloy, 0, 2.675, -0.14, 2.03, 0.06, 1.83);
  shell.plate(ivory, 0, 2.63, -0.1, 1.63, 0.018, 1.12);
  shell.finish();
  cabin.plate(graphite, 0, 2.66, 1.09, 2.49, 0.35, 0.3);
  cabin.plate(copper, 0, 2.47, 1.12, 2.36, 0.036, 0.22);
  cabin.plate(graphite, -1.135, 1.41, 1.267, 0.25, 0.52, 0.09);
  cabin.plate(signal, -1.135, 1.44, 1.322, 0.136, 0.031, 0.025);
  cabin.plate(signal, -1.135, 1.38, 1.322, 0.098, 0.018, 0.025);
  cabin.finish();

  const display = document.createElement("canvas");
  display.width = 512;
  display.height = 88;
  const ctx = display.getContext("2d")!;
  const texture = new T.CanvasTexture(display);
  texture.colorSpace = T.SRGBColorSpace;
  const signage = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
  function sign(
    x: number,
    y: number,
    z: number,
    width: number,
    rotation: number,
  ) {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(width, (width * 88) / 512),
      signage,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    group.add(mesh);
  }
  sign(0, 2.67, 1.251, 1.87, 0);
  sign(0, 2.34, 0.924, 1.48, Math.PI);
  sign(0.948, 1.48, 0.12, 0.82, -Math.PI / 2);
  let displayed: Floor | null = null;
  function level(floor: Floor) {
    if (displayed === floor) return;
    displayed = floor;
    const accent = floor === "ai" ? "#9cdeec" : "#ebc887";
    signal.color.set(accent);
    ctx.fillStyle = "#14232a";
    ctx.fillRect(0, 0, display.width, display.height);
    ctx.fillStyle = accent;
    ctx.fillRect(2, 4, 7, 80);
    ctx.font = "600 27px system-ui";
    ctx.fillText("ELEVATOR", 25, 32);
    ctx.fillStyle = "#edf0e6";
    ctx.font = "600 39px system-ui";
    ctx.fillText(floor === "ai" ? "↑  Owner room" : "↓  AI room", 24, 73);
    texture.needsUpdate = true;
  }
  const doors = [-1, 1].map((side) => {
    const door = new T.Group(),
      parts = fabrication(door);
    // A band of wired glass sees the moving shaft lights while the doors are shut.
    parts.plate(alloy, 0, 0.62, 0, 0.86, 1.15, 0.095);
    parts.plate(ceramic, 0, 2.19, 0, 0.86, 0.55, 0.095);
    for (const x of [-0.403, 0.403])
      parts.plate(graphite, x, 1.55, 0, 0.054, 0.74, 0.088);
    parts.plate(copper, side * 0.34, 1.54, 0, 0.032, 0.75, 0.045);
    parts.plate(graphite, 0, 1.2, 0, 0.86, 0.08, 0.11);
    parts.plate(graphite, 0, 1.9, 0, 0.86, 0.08, 0.11);
    parts.plate(signal, -side * 0.37, 0.66, 0.0, 0.017, 0.84, 0.102);
    parts.finish();
    group.add(door);
    return door;
  });
  const shaft = new T.Group(),
    cladding = fabrication(shaft);
  cladding.plate(rubber, 0, 1.55, 1.39, 2.08, 0.89, 0.04);
  for (const side of [-1, 1])
    cladding.plate(alloy, side * 0.6, 1.56, 1.357, 0.06, 0.91, 0.022);
  cladding.finish();
  group.add(shaft);
  shaft.visible = false;
  const slit = new T.Mesh(new T.BoxGeometry(1.9, 0.055, 0.015), ivory);
  shaft.add(slit);
  function travel(closed: number, progress: number, up: boolean) {
    for (let i = 0; i < 2; i++)
      doors[i].position.set(
        (i ? 1 : -1) * (0.432 + 0.6 * (1 - closed)),
        0,
        1.045,
      );
    shaft.visible = closed > 0.98;
    slit.position.set(
      0,
      1.21 + (((up ? 1 - progress : progress) * 5.4) % 1) * 0.6,
      1.332,
    );
  }
  travel(0, 0, true);
  level("ai");
  return { group, cutaway, level, travel };
}
