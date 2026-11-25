import * as T from "three";
import type { OwnerStation } from "./ownerStations";
import type { StagePalette } from "./stage/palette";

// A cutaway of the same workshop the player enters at eye level.
export const ownerBerths: Record<OwnerStation, readonly [number, number]> = {
  test: [-4.15, -2.46],
  review: [0, -2.46],
  merge: [4.15, -2.46],
  commit: [4.15, 2.46],
  push: [0, 2.46],
  cleanup: [-4.15, 2.46],
};

type Point = readonly [number, number, number];
const point = (p: Point) => new T.Vector3(...p);
const enamel = () =>
  new T.MeshStandardMaterial({
    roughness: 0.54,
    metalness: 0.24,
    flatShading: true,
  });
const lamp = (color = "#ffffff") => new T.MeshBasicMaterial({ color });
const tau = Math.PI * 2;

function fit(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  material: T.Material,
  position: Point,
) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function block(
  parent: T.Object3D,
  material: T.Material,
  p: Point,
  size: Point,
) {
  return fit(parent, new T.BoxGeometry(...size), material, p);
}
function drum(
  parent: T.Object3D,
  m: T.Material,
  p: Point,
  r: number,
  h: number,
  bottom = r,
  sides = 16,
) {
  return fit(parent, new T.CylinderGeometry(r, bottom, h, sides), m, p);
}
function ring(
  parent: T.Object3D,
  m: T.Material,
  p: Point,
  r: number,
  tube: number,
) {
  return fit(parent, new T.TorusGeometry(r, tube, 6, 36), m, p);
}
function strut(
  parent: T.Object3D,
  material: T.Material,
  a: Point,
  b: Point,
  radius: number,
) {
  const start = point(a),
    end = point(b),
    vector = end.clone().sub(start);
  const rod = fit(
    parent,
    new T.CylinderGeometry(radius, radius, vector.length(), 8),
    material,
    [0, 0, 0],
  );
  rod.position.copy(start).lerp(end, 0.5);
  rod.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vector.normalize());
}
// Milled slabs have clipped corners and a shallow bevel so the deck reads at board scale.
function plateOutline(w: number, d: number) {
  const a = w / 2,
    b = d / 2,
    c = Math.min(w, d) * 0.14;
  const outline = new T.Shape();
  outline.moveTo(-a + c, -b);
  outline.lineTo(a - c, -b);
  outline.lineTo(a, -b + c);
  outline.lineTo(a, b - c);
  outline.lineTo(a - c, b);
  outline.lineTo(-a + c, b);
  outline.lineTo(-a, b - c);
  outline.lineTo(-a, -b + c);
  outline.closePath();
  return outline;
}
function plate(
  parent: T.Object3D,
  material: T.Material,
  p: Point,
  w: number,
  d: number,
  h: number,
) {
  const geometry = new T.ExtrudeGeometry(plateOutline(w, d), {
    depth: h,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.025,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return fit(parent, geometry, material, p);
}

function contactShade() {
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = 128;
  const g = sheet.getContext("2d")!;
  const shade = g.createRadialGradient(64, 64, 3, 64, 64, 64);
  shade.addColorStop(0, "rgba(8,15,24,.81)");
  shade.addColorStop(0.41, "rgba(8,15,24,.58)");
  shade.addColorStop(0.74, "rgba(8,15,24,.21)");
  shade.addColorStop(1, "rgba(8,15,24,0)");
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 128);
  const material = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(sheet),
    transparent: true,
    depthWrite: false,
  });
  return (parent: T.Group, p: Point, width: number, depth: number) => {
    const shadow = fit(parent, new T.PlaneGeometry(width, depth), material, p);
    shadow.rotation.x = -Math.PI / 2;
  };
}

export function buildOwnerWorkshop(textured: boolean, palette: StagePalette) {
  const group = new T.Group();
  const steel = enamel(), edge = enamel(), dark = enamel(), deck = enamel();
  const bone = edge, brass = enamel(), ceramic = enamel();
  const ink = lamp(), turquoise = lamp(), violet = lamp(), ice = lamp(), dim = lamp();
  const glass = new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0.17,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const halo = new T.MeshBasicMaterial({
    transparent: true,
    opacity: 0.1,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const machines = new Map<OwnerStation, T.Group>(),
    lamps = new Map<OwnerStation, T.MeshBasicMaterial>();
  function setPalette(p: StagePalette) {
    steel.color.set(p.hull.left);
    edge.color.set(p.hull.top);
    dark.color.set(p.board.right);
    deck.color.set(p.pad.top);
    ceramic.color.set(p.hull.top);
    brass.color.set(p.zones.test.left);
    ink.color.set(p.bg);
    turquoise.color.set(p.zones.ship.top);
    violet.color.set(p.zones.verify.top);
    ice.color.set(p.emissive);
    dim.color.set(p.trim.top);
    glass.color.set(p.emissive);
    halo.color.set(p.emissive);
  }
  setPalette(palette);
  const shade = textured ? contactShade() : null;
  shade?.(group, [0.22, -0.67, 0.08], 18.4, 13.9);
  plate(group, dark, [0, -0.62, 0], 14, 10.25, 0.3);
  plate(group, steel, [0, -0.32, 0], 13.86, 10.12, 0.055);
  plate(group, deck, [0, -0.255, 0], 13.82, 10.08, 0.21);
  const rimSize = [3.48, 3.14] as const;
  const currentRim = plate(group, ice, [0, 0.15, 0], ...rimSize, 0.04);
  const rimOutline = plateOutline(...rimSize).getPoints();
  currentRim.visible = false;
  for (const x of [-6.5, 6.5]) {
    block(group, steel, [x, 0.005, 0], [0.22, 0.05, 7.85]);
    for (const z of [-3.3, 0, 3.3])
      block(group, ice, [x, 0.04, z], [0.06, 0.015, 0.65]);
  }
  for (const z of [-4.79, 4.79]) {
    block(group, dark, [0, -0.002, z], [10.7, 0.058, 0.075]);
    for (const x of [-5.4, -1.5, 1.5, 5.4])
      block(group, brass, [x, 0.025, z], [0.24, 0.018, 0.11]);
  }
  // Two recessed power trunks and branch feeds connect the six plinths.
  for (const z of [-0.23, 0.23]) {
    block(group, dark, [0, -0.005, z], [11.9, 0.09, 0.24]);
    block(group, dim, [0, 0.047, z], [11.8, 0.015, 0.04]);
  }
  for (let x = -5.7; x <= 5.8; x += 0.48) {
    block(group, steel, [x, 0.052, 0], [0.19, 0.025, 0.37]);
  }
  for (const [id, location] of Object.entries(ownerBerths) as [
    OwnerStation,
    readonly [number, number],
  ][]) {
    const [x, z] = location,
      berth = new T.Group();
    group.add(berth);
    berth.position.set(x, 0, z);
    berth.userData.station = id;
    machines.set(id, berth);
    const signal = lamp("#445e6e");
    lamps.set(id, signal);
    const near = Math.sign(z);
    shade?.(group, [x + 0.12, -0.002, z + 0.08], 4.6, 4.2);
    block(group, dark, [x, 0, z * 0.5], [0.23, 0.07, Math.abs(z)]);
    block(group, signal, [x, 0.041, z * 0.5], [0.06, 0.025, Math.abs(z)]);
    plate(berth, dark, [0, 0.005, 0], 3.32, 2.99, 0.15);
    plate(berth, steel, [0, 0.18, 0], 3.19, 2.85, 0.12);
    plate(berth, deck, [0, 0.315, 0], 2.91, 2.57, 0.045);
    shade?.(berth, [0.06, 0.386, 0.06], 2.65, 2.3);
    for (const side of [-1, 1]) {
      block(berth, brass, [side * 1.4, 0.33, 0.49], [0.12, 0.055, 0.54]);
      block(berth, signal, [side * 1.3, 0.4, -0.35], [0.035, 0.035, 1.06]);
      for (let i = 0; i < 4; i++)
        block(
          berth,
          dark,
          [side * 1.21, 0.379, -0.69 + i * 0.12],
          [0.102, 0.019, 0.034],
        );
    }
    block(berth, signal, [0, 0.215, 1.438], [1.37, 0.06, 0.04]);
    for (const x of [-1.02, 1.02])
      drum(berth, edge, [x, 0.36, -0.92], 0.054, 0.026);
    block(berth, edge, [0, 0.06, -near * 1.52], [0.38, 0.04, 0.14]);
    const tool = new T.Group();
    tool.position.y = 0.39;
    berth.add(tool);
    switch (id) {
      case "test": {
        plate(tool, bone, [0, 0.02, 0], 1.95, 1.62, 0.29);
        const scope = new T.Group();
        tool.add(scope);
        scope.position.set(0, 1.02, -0.26);
        scope.rotation.x = -0.12;
        block(scope, steel, [0, 0, 0], [1.88, 1.27, 0.42]);
        block(scope, bone, [0, 0, 0.12], [1.96, 1.13, 0.29]);
        block(scope, ink, [-0.12, 0, 0.278], [1.4, 0.79, 0.025]);
        const trace: Point[] = [
          [-0.72, -0.07, 0.3],
          [-0.47, -0.07, 0.3],
          [-0.32, 0.08, 0.3],
          [-0.19, -0.23, 0.3],
          [-0.01, 0.24, 0.3],
          [0.11, -0.07, 0.3],
          [0.46, -0.07, 0.3],
        ];
        trace
          .slice(1)
          .forEach((p, i) => strut(scope, turquoise, trace[i], p, 0.023));
        for (const y of [-0.22, 0.09, 0.34]) {
          const dial = drum(
            scope,
            y > 0.3 ? violet : brass,
            [0.76, y, 0.31],
            0.092,
            0.06,
          );
          dial.rotation.x = Math.PI / 2;
        }
        for (const x of [-0.52, -0.2, 0.12, 0.44])
          block(tool, steel, [x, 0.35, 0.47], [0.21, 0.058, 0.14]);
        break;
      }
      case "review": {
        drum(tool, dark, [0, 0.13, 0], 0.88, 0.24, 0.96);
        drum(tool, brass, [0, 0.33, 0], 0.67, 0.16, 0.79);
        for (const x of [-0.69, 0.69])
          strut(tool, bone, [x * 0.72, 0.36, 0], [x, 1.34, 0], 0.115);
        const optic = new T.Group();
        optic.position.set(0, 1.37, 0);
        optic.rotation.set(-0.16, -0.24, 0.12);
        tool.add(optic);
        for (const [z, r, mat] of [
          [-0.31, 0.76, steel],
          [-0.16, 0.78, bone],
          [0.02, 0.71, brass],
          [0.19, 0.65, dark],
          [0.27, 0.61, ice],
        ] as const) {
          ring(optic, mat, [0, 0, z], r, z === 0.27 ? 0.035 : 0.095);
        }
        fit(optic, new T.CircleGeometry(0.59, 40), glass, [0, 0, 0.27]);
        ring(optic, turquoise, [0, 0, 0.3], 0.25, 0.018);
        for (const side of [-1, 1])
          strut(optic, ice, [side * 0.31, 0, 0.3], [side * 0.5, 0, 0.3], 0.018);
        break;
      }
      case "merge": {
        drum(tool, steel, [0, 0.14, 0], 0.87, 0.27, 1, 8);
        drum(tool, dark, [0, 0.34, 0], 0.73, 0.16, 0.79, 8);
        const emitter = ring(tool, ice, [0, 0.46, 0], 0.49, 0.044);
        emitter.rotation.x = -Math.PI / 2;
        fit(
          tool,
          new T.ConeGeometry(0.49, 1.13, 32, 1, true),
          halo,
          [0, 1.02, 0],
        ).rotation.z = Math.PI;
        for (const side of [-1, 1]) {
          const pane = new T.Group();
          tool.add(pane);
          pane.position.set(side * 0.53, 1.56, 0);
          pane.rotation.y = -side * 0.28;
          block(pane, glass, [0, 0, 0], [0.91, 1.32, 0.04]);
          const hue = side < 0 ? violet : turquoise;
          for (const y of [-0.66, 0.66])
            block(pane, hue, [0, y, 0], [0.91, 0.032, 0.04]);
          for (const x of [-0.45, 0.45])
            block(pane, hue, [x, 0, 0], [0.026, 1.32, 0.04]);
          // Branch traces are physical leads. Source code opens in the station reader.
          strut(
            pane,
            hue,
            [side * 0.27, -0.43, 0.04],
            [side * 0.27, 0.2, 0.04],
            0.026,
          );
          strut(
            pane,
            hue,
            [side * 0.27, -0.04, 0.04],
            [-side * 0.18, 0.27, 0.04],
            0.025,
          );
          for (const [x, y] of [
            [side * 0.27, -0.44],
            [-side * 0.18, 0.28],
            [side * 0.27, 0.28],
          ]) {
            fit(pane, new T.SphereGeometry(0.07, 8, 6), hue, [x, y, 0.04]);
          }
        }
        break;
      }
      case "commit": {
        plate(tool, steel, [0, 0.02, 0], 1.88, 1.51, 0.18);
        for (const x of [-0.67, 0.67]) {
          block(tool, bone, [x, 0.98, -0.12], [0.24, 1.77, 0.45]);
          block(tool, brass, [x, 1.02, 0.12], [0.12, 0.78, 0.075]);
        }
        plate(tool, bone, [0, 1.71, -0.11], 1.77, 0.81, 0.27);
        drum(tool, brass, [0, 1.46, -0.02], 0.22, 0.56);
        drum(tool, steel, [0, 1.18, -0.02], 0.43, 0.16, 0.46, 8);
        for (let i = 0; i < 3; i++) {
          plate(
            tool,
            i === 2 ? edge : steel,
            [0, 0.23 + i * 0.16, 0.19],
            1.06,
            0.93,
            0.09,
          );
          block(
            tool,
            i === 2 ? turquoise : dim,
            [0, 0.29 + i * 0.16, 0.67],
            [0.61, 0.028, 0.025],
          );
        }
        break;
      }
      case "push": {
        drum(tool, steel, [0, 0.14, 0], 0.74, 0.28, 0.93, 8);
        drum(tool, brass, [0, 0.39, 0], 0.42, 0.24, 0.56);
        strut(tool, bone, [0, 0.45, 0], [0.12, 1.18, -0.06], 0.19);
        const dish = new T.Group();
        dish.position.set(0.07, 1.17, -0.06);
        dish.rotation.set(0.93, -0.21, -0.32);
        tool.add(dish);
        const sections = [
          new T.Vector2(0.045, 0.01),
          new T.Vector2(0.3, 0.052),
          new T.Vector2(0.55, 0.14),
          new T.Vector2(0.82, 0.32),
          new T.Vector2(1, 0.51),
        ];
        ceramic.side = T.DoubleSide;
        fit(dish, new T.LatheGeometry(sections, 36), ceramic, [0, 0, 0]);
        ring(dish, brass, [0, 0.51, 0], 1, 0.04).rotation.x = -Math.PI / 2;
        for (let i = 0; i < 3; i++) {
          const a = (i * tau) / 3;
          strut(
            dish,
            steel,
            [Math.cos(a) * 0.91, 0.46, Math.sin(a) * 0.91],
            [0, 1.02, 0],
            0.025,
          );
        }
        drum(dish, turquoise, [0, 1.04, 0], 0.096, 0.17, 0.06);
        break;
      }
      case "cleanup": {
        plate(tool, steel, [0, 0.02, 0], 1.88, 1.63, 0.24);
        const drumGroup = new T.Group();
        tool.add(drumGroup);
        drumGroup.position.set(0, 0.96, -0.06);
        drumGroup.rotation.x = 0.12;
        const chamber = drum(drumGroup, dark, [0, 0, 0], 0.75, 0.88, 0.75, 12);
        chamber.rotation.x = Math.PI / 2;
        for (const z of [-0.45, 0.36, 0.48])
          ring(drumGroup, z === 0.36 ? brass : bone, [0, 0, z], 0.7, 0.093);
        for (let i = 0; i < 5; i++) {
          const a = (i * tau) / 5;
          const blade = block(
            drumGroup,
            steel,
            [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.45],
            [0.46, 0.23, 0.06],
          );
          blade.rotation.z = a + 0.4;
        }
        ring(drumGroup, turquoise, [0, 0, 0.51], 0.19, 0.032);
        for (const x of [-0.66, 0.66])
          block(tool, brass, [x, 0.37, 0], [0.16, 0.32, 0.6]);
        break;
      }
    }
  }
  return { group, machines, lamps, currentRim, rimOutline, setPalette };
}
