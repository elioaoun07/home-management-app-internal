import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOCAL_CHECKS } from "../localRunModel";
import type { ZoneId } from "../stage/config";
import { bays, chair, coreStations, roomPoint, stations, zoneNames, type BayName } from "./layout";
import { fitChamber, fitSeat } from "./chamber";
import { receiverMaterial } from "./receiver";
import { createFaultCable } from "./faultCable";
import { cassetteLaminate, checkSocketFace } from "./instruments";
import { makeSignage } from "./signage";
import { instrumentCase, workstationKit } from "./workstation";
export { makeSphere } from "./topicSphere";
import { fitPlaybackVault } from "./playbackVault";
import type { Target } from "./protocol";

export const point = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
type Material = T.MeshStandardMaterial;
const radialPoint = (angle: number, radius: number, height = .022) => {
  const { x, z } = roomPoint(angle, radius);
  return point(x, height, z);
};

function mesh<M extends T.Material>(parent: T.Object3D, geometry: T.BufferGeometry, material: M, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
function block<M extends T.Material>(parent: T.Object3D, material: M, x: number, y: number, z: number, w: number, h: number, d: number) {
  return mesh(parent, new T.BoxGeometry(w, h, d), material, x, y, z);
}
function ring<M extends T.Material>(parent: T.Object3D, m: M, radius: number, width: number) {
  return mesh(parent, new T.TorusGeometry(radius, width, 6, 72), m);
}
function strip(parent: T.Object3D, m: T.Material, points: T.Vector3[], radius = .027, segments = 24) {
  return mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), segments, radius, 5, false), m);
}
function inlay(parent: T.Object3D, material: Material, points: T.Vector3[]) {
  strip(parent, material, points.map(position => position.clone().add(point(0, -.048, 0))), .055);
}
const mat = (color: string, roughness = .62) => new T.MeshStandardMaterial({ color, roughness });
const filament = () => new T.MeshStandardMaterial({
  color: "#13232e", emissive: "#6bb7d7", emissiveIntensity: .045, roughness: .68,
});

function radialTexture(dark: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
  const rgb = dark ? "0,0,0" : "255,255,255";
  gradient.addColorStop(0, `rgba(${rgb},${dark ? ".74" : ".93"})`);
  gradient.addColorStop(.25, `rgba(${rgb},.48)`);
  gradient.addColorStop(.62, `rgba(${rgb},.11)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(canvas);
}

function batchPanels(source: T.Group) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  source.updateWorldMatrix(true, true);
  const space = source.matrixWorld.clone().invert();
  const transform = new T.Matrix4();
  source.traverse(node => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material)) return;
    const group = batches.get(node.material) ?? [];
    node.geometry.applyMatrix4(transform.multiplyMatrices(space, node.matrixWorld));
    group.push(node.geometry);
    batches.set(node.material, group);
  });
  source.clear();
  for (const [material, parts] of batches) {
    const merged = mergeGeometries(parts);
    if (merged) mesh(source, merged, material);
    parts.forEach(geometry => geometry.dispose());
  }
}

function archOutline(name: BayName, span: number) {
  const cap = span / 2;
  switch (name) {
    case "Plan": return [[-cap, .24], [-cap, 2.27], [-cap * .77, 2.88], [cap * .77, 2.88], [cap, 2.27], [cap, .24]];
    case "Setup": return [[-cap, .24], [-cap, 2.84], [-cap * .64, 2.84], [-cap * .64, 3.14], [cap * .64, 3.14], [cap * .64, 2.84], [cap, 2.84], [cap, .24]];
    case "Build": return [[-cap, .24], [-cap, 2.51], [-cap * .78, 3.17], [cap * .78, 3.17], [cap, 2.51], [cap, .24]];
    case "Verify": return [[-cap, .24], [-cap, 2.19], [-cap * .68, 2.98], [0, 3.25], [cap * .68, 2.98], [cap, 2.19], [cap, .24]];
    case "Test": return [[-cap, .24], [-cap * .86, 2.86], [cap * .86, 2.86], [cap, .24]];
    case "Ship": return [[-cap, .24], [-cap, 2.36], [-cap * .62, 2.92], [0, 3.4], [cap * .62, 2.92], [cap, 2.36], [cap, .24]];
  }
}

function beam(parent: T.Object3D, material: T.Material, from: T.Vector3, to: T.Vector3, width: number, depth: number) {
  const middle = from.clone().lerp(to, .5);
  const segment = block(parent, material, middle.x, middle.y, middle.z, from.distanceTo(to) + width * .28, width, depth);
  segment.quaternion.setFromUnitVectors(point(1, 0, 0), to.clone().sub(from).normalize());
}

type Circuit = {
  bay: Material;
  branch: Material;
  wash: T.MeshBasicMaterial;
  path: readonly T.Vector3[];
  witness: T.Mesh<T.BufferGeometry, Material>;
  skipped: T.Mesh;
};

export function release(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse((object) => {
    if (object instanceof T.DirectionalLight || object instanceof T.PointLight) {
      object.shadow.dispose();
    }
    if (!(object instanceof T.Mesh || object instanceof T.Sprite || object instanceof T.Line)) return;
    if (!(object instanceof T.Sprite)) geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => {
    for (const value of Object.values(m)) if (value instanceof T.Texture) textures.add(value);
    m.dispose();
  });
  textures.forEach(texture => texture.dispose());
}

export function makeRoom(refresh: () => void, software = false) {
  const outer = new T.Group(), inner = new T.Group();
  const hull = mat("#162338"), panel = mat("#344c62"), bevel = mat("#8297a6"), floor = mat("#1b2a3a");
  const pale = mat("#c5d4dc"), recess = mat("#101c2b");
  const line = new T.MeshStandardMaterial({ color: "#334956", emissive: "#375c67", emissiveIntensity: .14 });
  const roomMaterials = { hull, panel, bevel, floor, pale, recess, line };
  const label = makeSignage();
  const fitWorkstation = workstationKit(roomMaterials);
  const fixed = new T.Group(), props = new T.Group();
  outer.add(fixed, props);
  const shade = new T.MeshBasicMaterial({ map: radialTexture(true), transparent: true, depthWrite: false, opacity: .78, polygonOffset: true, polygonOffsetFactor: -2 });
  function shadow(x: number, z: number, width: number, depth: number) {
    mesh(fixed, new T.PlaneGeometry(width, depth), shade, x, .004, z).rotation.x = -Math.PI / 2;
  }
  shadow(0, 0, 5.6, 5.6);
  const chamber = fitChamber(outer, floor, refresh, software);
  const cutaway: T.Object3D[] = [...chamber.cutaway];
  const light = new T.HemisphereLight("#cfe4ff", "#533b32", 2.0);
  const key = new T.DirectionalLight("#d1e7f7", 1.5); key.position.set(-5.8, 8.7, 4.5);
  const warm = new T.DirectionalLight("#ffc58e", .44); warm.position.set(-7, 3, -5);
  mesh(fixed, new T.CylinderGeometry(12.45, 12.68, .3, 96), floor, 0, -.16);
  for (const r of [2.32, 6.45, 9.8, 12.38]) {
    const rail = ring(fixed, r === 6.45 ? line : recess, r, .017);
    rail.rotation.x = -Math.PI / 2;
    rail.position.y = .012;
  }
  mesh(fixed, new T.CylinderGeometry(2.02, 2.23, .44, 64), hull, 0, .19);
  const well = ring(fixed, panel, 1.97, .026); well.rotation.x = Math.PI / 2; well.position.y = .42;
  const receiver = receiverMaterial();
  mesh(fixed, new T.CylinderGeometry(1.94, 1.94, .026, 64), receiver, 0, .40);
  const glowMap = radialTexture(false);
  const bayCircuits = new Map<number, { bay: Material; wash: T.MeshBasicMaterial; trunk: T.Vector3[] }>();
  for (const bay of bays) {
    const frame = new T.Group();
    const a = T.MathUtils.degToRad(bay.angle);
    frame.position.copy(radialPoint(bay.angle, 9.92, 0));
    frame.rotation.y = -a;
    const arch = new T.Group();
    props.add(frame);
    if (frame.position.z > 4) {
      arch.position.copy(frame.position); arch.rotation.copy(frame.rotation);
      outer.add(arch); cutaway.push(arch);
    } else frame.add(arch);
    const width = Math.sin(bay.opening) * 18.8;
    const outline = archOutline(bay.name, width);
    const accents = filament();
    for (let i = 1; i < outline.length; i++) {
      const [x0, y0] = outline[i - 1], [x1, y1] = outline[i];
      beam(arch, hull, point(x0, y0, 0), point(x1, y1, 0), .31, .44);
      beam(arch, bevel, point(x0, y0, .23), point(x1, y1, .23), .078, .06);
      beam(arch, accents, point(x0, y0, .274), point(x1, y1, .274), .046, .033);
    }
    const plaqueY = Math.max(...outline.map(([, y]) => y)) - .34;
    const plaque = label(arch, bay.name, plaqueY + .07, 1.97, "lintel");
    block(arch, bevel, 0, plaqueY + .07, .27, 2.06, .59, .13);
    block(arch, recess, 0, plaqueY + .07, .342, 2.00, .54, .08);
    plaque.position.z = .384;
    if (frame.position.z > 4) batchPanels(arch);
    block(frame, recess, 0, .012, .14, width + .20, .05, .56);
    for (const side of [-1, 1]) block(frame, accents, side * width * .44, .041, .14, width * .13, .06, .41);
    const footprint = label(props, bay.name, .042, 2.02, "floor");
    footprint.position.copy(radialPoint(bay.angle + (bay.name === "Build" ? -17 : 11), 7.65, .043));
    footprint.rotation.x = -Math.PI / 2;
    const trunk = [
      radialPoint(bay.angle, 1.98, .45), radialPoint(bay.angle, 2.22, .36),
      radialPoint(bay.angle, 2.5, .052), radialPoint(bay.angle, 3.15, .026),
      radialPoint(bay.angle, 5, .026),
    ];
    inlay(fixed, recess, trunk);
    strip(outer, accents, trunk, .034);
    const wash = new T.MeshBasicMaterial({
      map: glowMap, color: "#74bbd7", transparent: true, opacity: 0,
      depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
    });
    const spot = mesh(outer, new T.PlaneGeometry(width + .9, 5.2), wash);
    spot.rotation.x = -Math.PI / 2;
    spot.rotation.z = a;
    spot.position.copy(radialPoint(bay.angle, 8.62, .018));
    bayCircuits.set(bay.angle, { bay: accents, wash, trunk });
  }
  for (const angle of [-157, -145, -110, -62, 6, 55, 102]) {
    const arrow = mesh(fixed, new T.CircleGeometry(.24, 3), line);
    arrow.position.copy(radialPoint(angle, 6.45, .029));
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = -T.MathUtils.degToRad(angle);
    arrow.scale.set(1.12, .61, 1);
  }

  const markers = new Map<Target, T.Vector3>();
  const machines = new Map<Target, { moving: T.Mesh; light: Material; stamp: T.Mesh }>();
  const circuits = new Map<ZoneId, Circuit>();
  const faultCable = createFaultCable(outer, recess);
  const checkStamps: T.Mesh<T.BufferGeometry, Material>[][] = [];
  const laminate = cassetteLaminate(refresh);
  for (const s of stations) {
    const stand = new T.Group(); outer.add(stand);
    stand.position.set(s.x, 0, s.z); stand.rotation.y = -s.angle * Math.PI / 180;
    const bench = new T.Group(); props.add(bench);
    bench.position.copy(stand.position);
    bench.rotation.copy(stand.rotation);
    shadow(s.x, s.z, 2.1, 2.25);
    const contact = radialPoint(s.angle, s.radius - .14, 1.19);
    markers.set(s.id, contact);
    fitWorkstation(bench, s.id);
    const accent = filament();
    let moving: T.Mesh;
    if (s.id === "brief") {
      for (let i = 0; i < 3; i++) {
        const page = block(bench, i < 2 ? panel : bevel, -.30 + i * .22, 1.27 + i * .071, -.07 - i * .065, .48, .54, .045);
        page.rotation.set(-.36, 0, -.24 + i * .19);
        mesh(page, new T.PlaneGeometry(.407,.457), laminate, 0, 0,.024);
      }
      moving = block(stand, accent, 0, 1.24, .145, .41, .09, .043);
    } else if (s.id === "setup" || s.id === "bench") {
      const caseHeight = s.id === "bench" ? .27 : .40;
      for (let i = -2; i <= 2; i++) {
        const socket = block(bench, hull, i * .185, 1.03,-.048,.164,.06,.47);
        const card = block(socket, i === 0 ? pale : panel, 0, caseHeight/2+.026, -.04, .137, caseHeight,.38);
        card.rotation.x = -.20;
        const spine = block(card, bevel, 0,caseHeight/2-.014,-.01,.141,.028,.35);
        for (const side of [-1,1]) block(spine, recess, 0,.015,side*.106,.076,.006,.033);
        block(card, recess, 0, .02,.193,.091,caseHeight*.55,.014);
        block(card, bevel, 0, .02,.202,.046,caseHeight*.44,.017);
      }
      moving = block(stand, accent, 0, 1.108, .236, .91, .029, .051);
    } else if (s.id === "verify") {
      const board = instrumentCase(bench, roomMaterials, 1.14, .50, .165);
      board.position.set(0, 1.32, -.116);
      board.rotation.x = -.19;
      moving = block(stand, accent, 0, 1.085, .09, 1.04, .047, .11);
      for (let i = 0; i < LOCAL_CHECKS.length; i++) {
        const x = -.39 + i * .26;
        const socket = block(bench, panel, x, 1.33, -.016, .214, .305, .045);
        socket.rotation.x = -.19;
        mesh(socket, new T.PlaneGeometry(.192,.278), checkSocketFace(LOCAL_CHECKS[i]),0,0,.024);
        const pass = new T.Group();
        beam(pass, accent, point(-.061, .001, 0), point(-.027, -.065, 0), .031, .022);
        beam(pass, accent, point(-.027, -.065, 0), point(.073, .055, 0), .031, .022);
        const fail = new T.Group();
        beam(fail, accent, point(-.06, -.06, 0), point(.06, .06, 0), .029, .022);
        beam(fail, accent, point(-.06, .06, 0), point(.06, -.06, 0), .029, .022);
        const shapes = [pass, fail].map(parts => {
          const sections = parts.children.map(part => {
            part.updateMatrix();
            return (part as T.Mesh).geometry.applyMatrix4(part.matrix);
          });
          const geometry = mergeGeometries(sections)!;
          sections.forEach(section => section.dispose());
          return geometry;
        });
        shapes.push(new T.TorusGeometry(.071, .012, 6, 16));
        checkStamps.push(shapes.map(geometry => {
          const badge = mesh(stand, geometry, accent.clone(), x, 1.34, .045);
          badge.rotation.x = -.19;
          badge.visible = false;
          return badge;
        }));
      }
    } else if (s.id === "build") {
      for (const x of [-.249, .249]) {
        const shoe = block(bench, hull, x,1.106,-.09,.48,.13,.32);
        for (const side of [-1,1]) block(shoe, bevel, side*.205,.082,.073,.050,.096,.090);
      }
      const tile = block(bench, bevel, -.249, 1.35, -.09, .454, .66, .105);
      tile.rotation.set(-.32, -.08, 0);
      mesh(tile, new T.PlaneGeometry(.40,.60), laminate, 0, 0,.056);
      // The reference side is cooled under load. The exposed card beside it
      // leaves its components accessible to the working head.
      const cooler = block(tile, hull, -.008, .077, .079, .327, .285, .043);
      for (let fin = -4; fin <= 4; fin++)
        block(cooler, bevel, fin * .034, 0, .039, .012, .262, .061);
      for (const side of [-1,1]) block(tile, bevel, side * .184, .077, .074, .024, .104, .04);
      moving = block(stand, hull, .249, 1.35, -.09, .454, .66, .105);
      moving.rotation.set(-.32, .08, 0);
      mesh(moving, new T.PlaneGeometry(.40,.60), laminate,0,0,.056);
      block(moving, accent, 0, -.308, .055, .161, .015, .012);
    } else if (s.id === "handover") {
      for (const x of [-.42, .42]) block(bench, bevel, x, 1.095, 0, .047, .09, .71);
      const mouth = block(bench, hull, 0, 1.19, -.22, .94, .33, .24);
      block(mouth, recess, 0, -.03, .125,.84,.185,.014);
      for (const x of [-.39,.39]) block(mouth, bevel, x,.026,.144,.035,.13,.050);
      moving = block(stand, accent, 0, 1.20, .06, .68, .13, .49);
    } else if (s.id === "test") {
      const plate = instrumentCase(bench, roomMaterials, .97, .51, .11);
      plate.position.set(0, 1.24, -.075);
      plate.rotation.x = -.55;
      for (let slot = 0; slot < 3; slot++) {
        const reader = block(plate, panel, (slot - 1) * .243, -.002, .063, .212, .287, .019);
        const tray = block(reader, recess, 0, .012, .011, .169, .195, .006);
        for (let contact = 0; contact < 4; contact++)
          block(tray, bevel, -.057 + contact * .038, -.061, .005, .017, .051, .006);
        block(reader, bevel, 0, -.111, .014, .11, .021, .017);
      }
      moving = block(stand, accent, 0, 1.41, -.148, .57, .075, .055);
    } else if (s.id === "explore" || s.id === "think") {
      const drum = new T.Group();
      drum.position.set(0,1.37,-.082); drum.rotation.x = -.22; bench.add(drum);
      const body = mesh(drum, new T.CylinderGeometry(.273,.24,.24,32), hull);
      body.rotation.x = Math.PI/2;
      const bezel = ring(drum,bevel,.25,.034); bezel.position.z=.128;
      const iris = mesh(drum,new T.CircleGeometry(.23,36),recess,0,0,.133);
      if (s.id === "explore") {
        const lens = mesh(iris,new T.SphereGeometry(.157,28,14),panel,0,0,.008);
        lens.scale.z=.32;
        ring(iris,bevel,.176,.009);
      } else {
        for (let i=-3; i<=3; i++) {
          const w = 2*Math.sqrt(.207**2-(i*.052)**2);
          block(iris,panel,0,i*.052,.009,w,.019,.014);
        }
      }
      moving = ring(stand, accent, s.id === "explore" ? .148 : .207, .012);
      moving.position.set(0,1.406,.071); moving.rotation.x = -.22;
    } else if (s.id === "ship") {
      const collar = mesh(bench, new T.TorusGeometry(.37, .065, 8, 60, Math.PI * 1.78), bevel, 0, 1.36, -.08);
      collar.rotation.z = .35;
      moving = mesh(stand, new T.TorusGeometry(.37, .064, 8, 14, Math.PI * .22), accent, 0, 1.36, -.08);
      moving.rotation.z = .35 - Math.PI * .22;
    } else {
      for (const x of [-.289, .289]) {
        mesh(bench, new T.CylinderGeometry(.064, .081, .48, 20), bevel, x, 1.28, -.09);
        mesh(bench, new T.CylinderGeometry(.086, .098, .13, 20), panel, x, 1.105, -.09);
        mesh(bench, new T.CylinderGeometry(.076, .084, .066, 20), recess, x, 1.445, -.09);
      }
      const head = instrumentCase(bench, roomMaterials, .79, .21, .167);
      head.position.set(0, 1.53, -.096);
      mesh(bench, new T.CylinderGeometry(.13, .089, .19, 24), bevel, 0, 1.38, -.081);
      mesh(bench, new T.CylinderGeometry(.19, .22, .047, 32), panel, 0, 1.048, -.081);
      moving = mesh(stand, new T.CylinderGeometry(.134, .161, .074, 32), accent, 0, 1.257, -.081);
    }
    const stamp = block(stand, accent.clone(), 0, 1.095, .31, .42, .059, .049);
    stamp.visible = false;
    const cartridge = block(bench, recess, 0, .888, .405, .91, .226, .066);
    cartridge.rotation.x = -.12;
    const stationTag = label(cartridge, zoneNames[s.id], 0, .79);
    stationTag.position.z = .035;
    machines.set(s.id, { moving, light: accent, stamp });
    const { bay, wash, trunk } = bayCircuits.get(s.bay)!;
    const branch = filament();
    const route = [
      trunk.at(-2)!.clone(),
      radialPoint((s.angle + s.bay) / 2, 5.32, .026),
      radialPoint(s.angle, s.radius - 1.14, .026),
      radialPoint(s.angle, s.radius - .38, .035),
      radialPoint(s.angle, s.radius - .31, .82),
      contact,
    ];
    if (s.angle === s.bay) route[0] = trunk.at(-1)!.clone();
    const path = [...trunk.slice(0, s.angle === s.bay ? -1 : -2), ...route];
    faultCable.register(s.id, route, path, branch);
    const witness = ring(stand, accent, .144, .027);
    witness.position.set(-.43, .031, .58);
    witness.rotation.x = -Math.PI / 2;
    witness.visible = false;
    const skipped = mesh(stand, new T.TorusGeometry(.144, .024, 6, 18, Math.PI * 1.26), bevel, -.43, .023, .58);
    skipped.rotation.set(-Math.PI / 2, 0, -.4);
    skipped.visible = false;
    circuits.set(s.id, { bay, wash, branch, path, witness, skipped });
  }
  faultCable.finish();
  batchPanels(props);
  const seat = new T.Group(); outer.add(seat);
  seat.position.set(chair.x, 0, chair.z); seat.rotation.y = .38;
  shadow(chair.x, chair.z, 2.5, 2.5);
  const ledge = new T.Group();
  ledge.position.set(chair.x * .73, 0, chair.z * .73); ledge.rotation.y = .38;
  outer.add(ledge);
  fitSeat(seat, ledge, roomMaterials);
  label(seat, "Seat", .89, .21, "engraving").position.z = .435;
  const seatTarget = point(chair.x, .85, chair.z);
  markers.set("seat", seatTarget);
  const seatAngle = T.MathUtils.radToDeg(Math.atan2(chair.x, -chair.z));
  const seatPath = [
    radialPoint(seatAngle, 1.98, .44), radialPoint(seatAngle, 2.26, .30),
    radialPoint(seatAngle, 2.51, .035), radialPoint(seatAngle, 2.91, .027), seatTarget,
  ];
  const seatBranch = filament();
  inlay(fixed, recess, seatPath);
  strip(outer, seatBranch, seatPath, .032);
  const seatCircuit = { branch: seatBranch, path: seatPath };
  batchPanels(fixed);
  const entrancePlaque = block(outer, recess, 0, .23, 2.19, 1.17, .34, .17);
  entrancePlaque.rotation.x = -.18;
  const engraving = label(entrancePlaque, "Inside ERA", 0, 1.03, "engraving");
  engraving.position.z = .092;
  markers.set("core", point(0, .92, 2.48));

  const vaultDeck = mat("#39454e", .62);
  mesh(inner, new T.CylinderGeometry(5.15, 5.15, .38, 64), vaultDeck, 0, -.20);
  fitPlaybackVault(inner);
  for (const [angle, radius] of [[.31, 4.75], [-.39, 4.61], [.65, 4.42]]) {
    const orbital = ring(inner, line, radius, .027);
    orbital.rotation.set(Math.PI / 2 + angle, angle * .34, angle);
    orbital.position.y = 1.87;
  }
  for (const r of [1, 2.3, 3.9, 4.98]) {
    const rail = ring(inner, line, r, .024); rail.rotation.x = Math.PI / 2; rail.position.y = .016;
  }
  for (const [target, x, z, caption] of coreStations) {
    const item = new T.Group(); inner.add(item); item.position.set(x, 0, z);
    item.rotation.y = Math.atan2(-x, -z);
    block(item, hull, 0, .5, 0, 1.1, 1.0, .47);
    const moving = block(item, pale, 0, 1.16, 0, .90, .36, .12);
    const stamp = block(item, line, 0, .99, 0, .80, .03, .22);
    label(item, caption, .8, .98);
    markers.set(target, point(x, 1.03, z));
    machines.set(target, { moving, light: line, stamp });
  }
  inner.visible = false;
  const marker = mesh(outer, new T.ConeGeometry(.22, .53, 3), new T.MeshBasicMaterial({ color: "#f7d7a0" }), 0, .095, 0);
  marker.rotation.x = -Math.PI / 2;
  return { outer, inner, markers, machines, circuits, seatCircuit, checkStamps, light, key, warm, cutaway, marker,
    receiver, faultCable, materials: roomMaterials,
    dispose() { faultCable.dispose(); chamber.dispose(); } };
}
