import * as T from "three";
import { mountPatchProjection } from "../ownerPatchProjection";
import { OWNER_STATIONS, type OwnerStation, type OwnerStationState } from "../ownerStations";
import { ownerStations3D } from "./layout";
import type { WorldState } from "./protocol";
import { batchPanels, beam, block, mesh, point, ring, strip } from "./roomGeometry";
import type { makeSignage } from "./signage";
import { instrumentCase, type workstationKit } from "./workstation";

type Stock = Parameters<typeof workstationKit>[0];
type Owner = NonNullable<WorldState["owner"]>;
const signalColors: Record<OwnerStationState, string> = {
  current: "#ffca88", done: "#8adabb", stopped: "#e9ad89", optional: "#a6b3ce", pending: "#8da7b4",
};

// The instruments bolt to the observatory's original workbench castings. The
// optical heads, controls and sockets face the same walkable side as the SDK kit.
function fitInstrument(berth: T.Group, id: OwnerStation, stock: Stock, alloy: T.Material, accent: T.Material) {
  const { hull, panel, bevel, recess, pale } = stock;
  function axle(parent: T.Object3D, m: T.Material, x: number, y: number, z: number, radius: number, depth: number) {
    const pin = mesh(parent, new T.CylinderGeometry(radius, radius, depth, 24), m, x, y, z);
    pin.rotation.x = Math.PI / 2;
    return pin;
  }
  if (id === "test") {
    const scope = instrumentCase(berth, stock, 1.12, .61, .27);
    scope.position.set(0, 1.40, -.10);
    scope.rotation.x = -.16;
    block(scope, hull, -.116, .005, .147, .71, .41, .015);
    for (let i = -2; i <= 2; i++) {
      block(scope, panel, -.116 + i * .123, .005, .16, .006, .368, .007);
      block(scope, panel, -.116, .005 + i * .074, .16, .653, .006, .007);
    }
    const wave = [-.038, -.038, .00, -.045, .144, -.11, .032, -.038, -.038];
    for (let i = 1; i < wave.length; i++) {
      beam(scope, accent, point(-.424 + (i - 1) * .077, wave[i-1], .175),
        point(-.424 + i * .077, wave[i], .175), .014, .012);
    }
    for (const y of [-.09, .09]) {
      axle(scope, alloy, .352, y, .158, .070, .061);
      axle(scope, recess, .352, y, .193, .049, .016);
      block(scope, pale, .352, y + .024, .203, .009, .033, .008);
    }
  } else if (id === "review") {
    const tray = instrumentCase(berth, stock, .90, .57, .13);
    tray.rotation.x = -.68;
    tray.position.set(0, 1.24, .008);
    for (const side of [-1, 1]) {
      const slide = block(tray, pale, side * .183, 0, .085, .323, .354, .030);
      for (let i = 0; i < 4; i++) {
        block(slide, i === 1 ? accent : panel, -.017, .105 - .064 * i, .018, .176 + .028 * (i % 2), .015, .005);
      }
    }
    beam(berth, alloy, point(-.38, 1.07, -.22), point(-.38, 1.65, -.25), .079, .095);
    beam(berth, bevel, point(-.38, 1.65, -.25), point(.10, 1.65, .04), .069, .085);
    const loupe = ring(berth, bevel, .174, .030);
    loupe.position.set(.10, 1.64, .05);
    loupe.rotation.x = -.95;
    const optic = mesh(loupe, new T.SphereGeometry(.155, 24, 12), accent);
    optic.scale.z = .18;
  } else if (id === "merge") {
    // Twin input rails converge on a single projector lens under the glass.
    for (const side of [-1, 1]) {
      const rail = block(berth, hull, side * .33, 1.095, -.005, .215, .153, .47);
      for (let i = 0; i < 4; i++) block(rail, bevel, 0, .080, -.13 + i * .085, .17, .025, .025);
      beam(berth, alloy, point(side * .34, 1.145, -.17), point(0, 1.255, -.055), .074, .085);
    }
    for (const [r, h, y, m] of [
      [.235, .085, 1.09, panel], [.187, .09, 1.17, alloy], [.145, .065, 1.247, recess], [.107, .026, 1.293, accent],
    ] as const) mesh(berth, new T.CylinderGeometry(r, r * 1.06, h, 32), m, 0, y, -.05);
    const glass = new T.MeshStandardMaterial({ color: "#afd7df", emissive: "#5aafb9", emissiveIntensity: .26,
      transparent: true, opacity: .20, depthWrite: false, roughness: .18, metalness: .25 });
    for (const side of [-1, 1]) {
      const pane = block(berth, glass, side * .105, 1.57, -.084 - side * .035, .56, .32, .012);
      pane.rotation.z = side * .11;
      block(pane, accent, -.15 * side, .15, .011, .22, .012, .01);
    }
  } else if (id === "commit") {
    const cap = instrumentCase(berth, stock, .89, .248, .278);
    cap.position.set(0, 1.67, -.09);
    for (const side of [-1, 1]) {
      mesh(berth, new T.CylinderGeometry(.051, .068, .50, 20), bevel, side * .351, 1.3, -.09);
      mesh(berth, new T.CylinderGeometry(.079, .095, .09, 20), alloy, side * .351, 1.085, -.09);
    }
    mesh(berth, new T.CylinderGeometry(.105, .117, .18, 24), alloy, 0, 1.47, -.075);
    block(berth, panel, 0, 1.345, -.075, .37, .095, .235);
    const die = block(berth, hull, 0, 1.085, .035, .60, .117, .39);
    block(die, alloy, 0, .075, .035, .36, .039, .225);
    block(die, accent, 0, .099, .035, .215, .012, .072);
  } else if (id === "push") {
    const dish = new T.Group();
    dish.position.set(0, 1.44, -.06); dish.rotation.set(.95, 0, -.18);
    berth.add(dish);
    const profile = [[.025,0], [.12,.02], [.23,.058], [.36,.132], [.449,.202], [.449,.227], [.36,.157], [.23,.081], [.12,.04], [.025,.023]];
    mesh(dish, new T.LatheGeometry(profile.map(([x, y]) => new T.Vector2(x, y)), 40), pale);
    const rim = ring(dish, bevel, .449, .016); rim.position.y = .215; rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * Math.PI / 3;
      beam(dish, alloy, point(.42 * Math.sin(a), .202, .42 * Math.cos(a)), point(0, .44, 0), .018, .020);
    }
    mesh(dish, new T.CylinderGeometry(.052, .042, .09, 16), accent, 0, .447);
    for (const side of [-1, 1]) beam(berth, panel, point(side * .24, 1.05, -.10), point(side * .12, 1.45, -.075), .102, .115);
  } else {
    const drive = instrumentCase(berth, stock, 1.04, .50, .29);
    drive.position.set(0, 1.35, -.10); drive.rotation.x = -.20;
    for (const side of [-1, 1]) {
      axle(drive, bevel, side * .216, .026, .164, .150, .045);
      axle(drive, panel, side * .216, .026, .192, .123, .014);
      axle(drive, alloy, side * .216, .026, .204, .039, .016);
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3;
        axle(drive, recess, side * .216 + .077 * Math.sin(a), .026 + .077 * Math.cos(a), .203, .026, .012);
      }
    }
    const slot = block(berth, recess, 0, 1.095, .168, .72, .11, .25);
    block(slot, alloy, 0, .045, .036, .46, .045, .18);
    block(slot, accent, -.215, -.008, .131, .115, .015, .01);
  }
}

export function makeOwnerFloor(stock: Stock, fit: ReturnType<typeof workstationKit>, label: ReturnType<typeof makeSignage>, shade: T.Material) {
  const group = new T.Group(), furniture = new T.Group(), projector = new T.Group();
  group.add(furniture, projector);
  const lamps = new Map<OwnerStation, T.MeshStandardMaterial>();
  const routes = new Map<OwnerStation, T.CatmullRomCurve3>();
  const alloy = new T.MeshStandardMaterial({ color: "#b49570", metalness: .68, roughness: .38 });
  for (const [i, station] of ownerStations3D.entries()) {
    const bench = new T.Group();
    furniture.add(bench);
    bench.position.set(station.x, 0, station.z); bench.rotation.y = -station.angle * Math.PI / 180;
    fit(bench, station.id === "test" ? "verify" : "setup");
    const accent = new T.MeshStandardMaterial({ color: "#63929c", emissive: "#89c4c7", emissiveIntensity: .32, roughness: .36 });
    lamps.set(station.id, accent);
    fitInstrument(bench, station.id, stock, alloy, accent);
    mesh(bench, new T.PlaneGeometry(2.1, 2.25), shade, 0, .004).rotation.x = -Math.PI / 2;
    const plaque = block(bench, stock.recess, 0, .888, .405, .91, .226, .066);
    plaque.rotation.x = -.12;
    label(plaque, OWNER_STATIONS[i].label, 0, .79).position.z = .035;
    const route = [point(0,.028,station.radius-5), point(0,.028,1.15), point(0,.038,.48), point(0,.19,.32)];
    strip(bench, stock.recess, route.map(p => point(p.x,p.y-.032,p.z)), .042, 24);
    strip(bench, accent, route, .017, 24);
    bench.updateMatrix();
    routes.set(station.id, new T.CatmullRomCurve3(route.map(p => p.clone().applyMatrix4(bench.matrix))));
    if (station.id === "merge") {
      projector.position.copy(bench.position);
      projector.rotation.copy(bench.rotation);
    }
  }
  batchPanels(furniture);
  const project = mountPatchProjection(projector);
  function update(owner: Owner | undefined, compact: boolean, aspect: number) {
    for (const [id, lamp] of lamps) {
      const signal = owner?.signals[id] ?? "pending";
      lamp.emissive.set(signalColors[signal]);
      lamp.emissiveIntensity = owner?.current === id ? 1.3 : signal === "done" ? .45 : .12;
    }
    project(owner?.selected === "merge" ? owner.patch : null, compact, aspect);
  }
  return { group, lamps, routes, update };
}
