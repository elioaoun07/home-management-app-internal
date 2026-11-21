import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bays, chair, stations, zoneNames } from "./layout";
import { topics, type Topic } from "./topics";
import type { Target } from "./protocol";

export const point = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
type Material = T.MeshStandardMaterial;

function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
function block(parent: T.Object3D, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  return mesh(parent, new T.BoxGeometry(w, h, d), material, x, y, z);
}
function ring(parent: T.Object3D, m: T.Material, radius: number, width: number) {
  return mesh(parent, new T.TorusGeometry(radius, width, 6, 72), m);
}
function strip(parent: T.Object3D, m: T.Material, points: T.Vector3[], radius = .027) {
  return mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, radius, 5, false), m);
}
const mat = (color: string, roughness = .62) => new T.MeshStandardMaterial({ color, roughness });

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

function surfaceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const px = ctx.createImageData(256, 256);
  let seed = 117;
  for (let i = 0; i < 256 * 256; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const grain = 209 + (seed >>> 28) * 2 + 7 * Math.sin((i % 256) * .12 + i / 650);
    px.data.set([grain, grain, grain, 255], i * 4);
  }
  ctx.putImageData(px, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

function batchPanels(source: T.Group) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  source.updateMatrixWorld(true);
  source.traverse(node => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material)) return;
    const group = batches.get(node.material) ?? [];
    node.geometry.applyMatrix4(node.matrixWorld);
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

function label(parent: T.Object3D, text: string, y: number, width = 1.32) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0d1828"; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#648698"; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 508, 124);
  ctx.fillStyle = "#eef6fa"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "600 63px system-ui"; ctx.fillText(text, 256, 63, 480);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return mesh(parent, new T.PlaneGeometry(width, width / 4), new T.MeshBasicMaterial({ map: texture }), 0, y, .38);
}

export function release(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) && !(object instanceof T.Sprite)) return;
    if (object instanceof T.Mesh) geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => {
    if ("map" in m && m.map instanceof T.Texture) m.map.dispose();
    m.dispose();
  });
}

export function makeRoom() {
  const outer = new T.Group(), inner = new T.Group();
  const hull = mat("#162338"), panel = mat("#344c62"), bevel = mat("#8297a6"), floor = mat("#1b2a3a");
  const pale = mat("#c5d4dc"), recess = mat("#101c2b");
  const line = new T.MeshStandardMaterial({ color: "#527590", emissive: "#274b67", emissiveIntensity: .25 });
  const roomMaterials = { hull, panel, bevel, floor, pale, recess, line };
  floor.map = surfaceTexture();
  const shade = new T.MeshBasicMaterial({ map: radialTexture(true), transparent: true, depthWrite: false, opacity: .78, polygonOffset: true, polygonOffsetFactor: -2 });
  function shadow(x: number, z: number, width: number, depth: number) {
    mesh(outer, new T.PlaneGeometry(width, depth), shade, x, .004, z).rotation.x = -Math.PI / 2;
  }
  const cutaway: T.Object3D[] = [];
  const frontWall = new T.Group(), backWall = new T.Group(), ceiling = new T.Group();
  outer.add(frontWall, backWall, ceiling);
  cutaway.push(frontWall, ceiling);
  const light = new T.HemisphereLight("#cfe4ff", "#533b32", 2.0);
  const key = new T.DirectionalLight("#e7f5ff", 2.5); key.position.set(2, 8, 7);
  const warm = new T.DirectionalLight("#ffc58e", 1.42); warm.position.set(-7, 3, -5);
  mesh(outer, new T.CylinderGeometry(12.45, 12.68, .3, 96), floor, 0, -.17);
  for (const r of [2.05, 3, 4.35, 6.4, 8.8, 9.95, 12.4]) {
    const rail = ring(outer, r === 4.35 ? line : panel, r, r === 4.35 ? .025 : .016);
    rail.rotation.x = -Math.PI / 2;
    rail.position.y = .012;
  }
  mesh(outer, new T.CylinderGeometry(2.02, 2.35, .47, 64), hull, 0, .2);
  shadow(0, 0, 7.6, 7.6);
  const well = ring(outer, bevel, 1.95, .055); well.rotation.x = Math.PI / 2; well.position.y = .46;
  mesh(outer, new T.CylinderGeometry(1.72, 1.72, .02, 64), recess, 0, .45);
  for (const [r, y, width] of [[9.8,4.68,.12], [8.55,4.50,.09], [6.82,4.29,.10], [3.54,4.72,.12], [2.92,4.68,.045]]) {
    const band = ring(ceiling, r === 2.92 ? line : panel, r, width);
    band.rotation.x = Math.PI / 2; band.position.y = y;
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const rib = new T.Group(); rib.rotation.y = a; ceiling.add(rib);
    const joint = block(rib, bevel, 0, 4.52, 6.2, .14, .20, 4.8);
    joint.rotation.x = -.065;
    block(rib, line, 0, 4.37, 6.2, .031, .027, 2.25);
  }
  for (let i = 0; i < 64; i++) {
    const a = i * Math.PI / 32;
    const bay = bays.find(b => Math.abs(Math.atan2(Math.sin(a - b.angle * Math.PI / 180), Math.cos(a - b.angle * Math.PI / 180))) < (b.name === "Build" ? .50 : .27));
    const r = bay ? 12.38 : 10.02;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    const wall = new T.Group();
    wall.position.set(x, 0, z); wall.rotation.y = -a;
    (z > 4 ? frontWall : backWall).add(wall);
    block(wall, hull, 0, 2.40, 0, r * .101, 4.8, .24);
    block(wall, panel, 0, .58, .15, r * .096, .88, .15);
    block(wall, i % 4 === 0 ? pale : panel, 0, 3.78, .16, r * .087, .035, .08);
    block(wall, recess, 0, 2.4, .16, r * .072, 2.09, .05);
    for (let slot = 0; slot < 3; slot++) {
      block(wall, panel, (slot-1)*.18, 2.18 + .21 * Math.sin(i * .78 + slot), .195, .10, 1.1, .026);
    }
    if (i % 2 === 0) block(wall, bevel, -.41, 2.45, .19, .043, 4.1, .07);
    if (i % 4 === 0) {
      const fixture = block(wall, pale, 0, 3.15, .25, .54, .04, .26);
      fixture.rotation.x = -.22;
    }
  }
  batchPanels(frontWall); batchPanels(backWall);
  for (const bay of bays) {
    const frame = new T.Group();
    const a = bay.angle * Math.PI / 180;
    frame.position.set(Math.sin(a) * 9.66, 0, -Math.cos(a) * 9.66);
    frame.rotation.y = -a;
    outer.add(frame);
    if (frame.position.z > 4) cutaway.push(frame);
    const width = bay.name === "Build" ? 6.9 : 3.35;
    for (const x of [-width / 2, width / 2]) {
      block(frame, panel, x, 1.54, 0, .24, 3.08, .48);
      block(frame, bevel, x, 1.74, .25, .049, 2.75, .05);
    }
    block(frame, hull, 0, 3.04, 0, width + .19, .28, .48);
    label(frame, bay.name, 3.07, 1.55);
  }

  const markers = new Map<Target, T.Vector3>();
  const machines = new Map<Target, { moving: T.Mesh; light: Material; stamp: T.Mesh }>();
  for (const s of stations) {
    const stand = new T.Group(); outer.add(stand);
    stand.position.set(s.x, 0, s.z); stand.rotation.y = -s.angle * Math.PI / 180;
    shadow(s.x, s.z, 2.8, 2.8);
    markers.set(s.id, point(s.x, 1.32, s.z));
    block(stand, recess, 0, .10, 0, 1.03, .20, .93);
    block(stand, panel, 0, .53, 0, .77, .72, .61);
    block(stand, hull, 0, .93, 0, 1.15, .14, .79);
    block(stand, bevel, 0, 1.004, 0, 1.10, .033, .75);
    const accent = new T.MeshStandardMaterial({ color: "#93c2de", emissive: "#94cbf2", emissiveIntensity: .08, roughness: .32 });
    let moving: T.Mesh;
    if (s.id === "brief") {
      for (let i = -1; i <= 1; i++) {
        const page = block(stand, pale, i * .24, 1.28, -.08, .30, .52, .052); page.rotation.z = i * -.21;
      }
      moving = block(stand, accent, 0, 1.35, -.013, .055, .42, .025);
    } else if (s.id === "verify" || s.id === "build" || s.id === "handover" || s.id === "test") {
      block(stand, pale, -.27, 1.27, 0, .48, .51, .16);
      moving = block(stand, accent, .28, 1.27, 0, .44, .51, .14);
    } else if (s.id === "think" || s.id === "explore" || s.id === "ship") {
      moving = ring(stand, accent, .26, .035); moving.position.set(0, 1.37, 0);
      block(stand, pale, 0, 1.20, -.16, .49, .33, .11);
    } else {
      for (let i = -2; i <= 2; i++) block(stand, pale, i * .16, 1.09, -.01, .078, .13, .41);
      moving = block(stand, accent, 0, 1.22, .02, .76, .06, .10);
    }
    const stamp = block(stand, accent.clone(), 0, 1.27, .16, .42, .075, .035);
    stamp.visible = false;
    label(stand, zoneNames[s.id], .76, .84);
    machines.set(s.id, { moving, light: accent, stamp });
  }
  const seat = new T.Group(); outer.add(seat);
  seat.position.set(chair.x, 0, chair.z); seat.rotation.y = .38;
  shadow(chair.x, chair.z, 2.5, 2.5);
  block(seat, hull, 0, .24, 0, 1.08, .42, .52);
  block(seat, bevel, 0, .47, -.03, 1.11, .15, .55);
  block(seat, panel, 0, .65, .26, 1.12, .54, .15);
  label(seat, "Seat", .72, .84);
  const ledge = new T.Group();
  ledge.position.set(chair.x * .73, 0, chair.z * .73); ledge.rotation.y = .38;
  outer.add(ledge);
  block(ledge, hull, 0, .41, 0, .72, .68, .20);
  const reader = block(ledge, bevel, 0, .80, 0, .85, .068, .39);
  reader.rotation.x = -.16;
  markers.set("seat", point(chair.x, .85, chair.z));
  label(outer, "Inside ERA", .91, 1.10).position.z = 2.16;
  markers.set("core", point(0, .92, 2.48));

  mesh(inner, new T.CylinderGeometry(5.15, 5.15, .38, 64), floor, 0, -.20);
  mesh(inner, new T.SphereGeometry(5.27, 48, 28), new T.MeshBasicMaterial({
    color: "#172446", side: T.BackSide, transparent: true, opacity: .55, depthWrite: false,
  }), 0, 1.4);
  for (const [angle, radius] of [[.31, 4.75], [-.39, 4.61], [.65, 4.42]]) {
    const orbital = ring(inner, line, radius, .027);
    orbital.rotation.set(Math.PI / 2 + angle, angle * .34, angle);
    orbital.position.y = 1.87;
  }
  for (const r of [1, 2.3, 3.9, 4.98]) {
    const rail = ring(inner, line, r, .024); rail.rotation.x = Math.PI / 2; rail.position.y = .016;
  }
  for (const [target, x, z, caption] of [
    ["previous", -3, -1.75, "Previous"], ["present", 0, -3.5, "Selected"],
    ["next", 3, -1.75, "Next"], ["exit", 0, 4, "Room"],
  ] as const) {
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
  return { outer, inner, markers, machines, light, key, warm, cutaway, marker, materials: roomMaterials };
}

export function makeSphere(topic: Topic, illustrated: boolean) {
  const orb = new T.Group(), fibers = new T.Group();
  orb.add(fibers);
  const hue = topics[topic][1] / 360;
  const tint = new T.Color().setHSL(hue, .56, .62);
  const glow = new T.MeshStandardMaterial({ color: tint.clone().multiplyScalar(.34), emissive: tint, emissiveIntensity: .84, roughness: illustrated ? .93 : .33 });
  const soft = new T.MeshBasicMaterial({ color: tint, transparent: true, opacity: .39, depthWrite: false });
  const aura = new T.Sprite(new T.SpriteMaterial({
    map: radialTexture(false), color: tint, opacity: .53,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  }));
  aura.scale.setScalar(3.65);
  orb.add(aura);
  const shell = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { tint: { value: tint }, energy: { value: .62 }, tick: { value: 0 }, painterly: { value: illustrated ? 1 : 0 } },
    vertexShader: `
      varying vec3 normalView;
      varying vec3 view;
      varying vec3 surface;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        normalView = normalize(normalMatrix * normal);
        view = -p.xyz;
        surface = position;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      varying vec3 normalView;
      varying vec3 view;
      varying vec3 surface;
      uniform vec3 tint;
      uniform float energy;
      uniform float tick;
      uniform float painterly;
      void main() {
        vec3 v = normalize(view);
        float facing = abs(dot(normalize(normalView), v));
        float rim = pow(1.0 - facing, 4.0);
        float wave = sin(surface.y * 15.0 + surface.x * 8.0 + sin(surface.z * 14.0 + tick) * 1.9);
        float thread = smoothstep(.92, .999, wave) * (.24 + .76 * smoothstep(-.20, 1.12, surface.y));
        float fill = .025 + .056 * pow(facing, 3.2);
        float sideLight = .34 + .66 * smoothstep(-.92,.98,surface.x);
        float opacity = fill + sideLight * rim * .24 + thread * .13 * energy;
        if (painterly > .5) opacity = floor(opacity * 20.0) / 20.0 + .015;
        gl_FragColor = vec4(tint * (.58 + sideLight * .59), opacity);
        #include <colorspace_fragment>
      }`,
  });
  mesh(orb, new T.SphereGeometry(1.58, 64, 40), shell);
  const nucleus = new T.MeshStandardMaterial({ color: tint.clone().lerp(new T.Color("#e3f7ff"), .26),
    emissive: tint, emissiveIntensity: .48, roughness: .39, metalness: .08 });
  mesh(orb, new T.SphereGeometry(.29, 40, 28), nucleus);
  for (let i = 0; i < 3; i++) {
    const hoop = ring(orb, i === 2 ? soft : glow, .61 + i * .43, .009 + i * .002);
    hoop.rotation.set(.1 + i * .68, .30 + i * .42, i * .36);
  }
  const bead = (x: number, y: number, z: number, size = .067) => mesh(fibers, new T.SphereGeometry(size, 16, 10), glow, x, y, z);
  const stroke = (points: [number, number, number][], radius?: number) => strip(fibers, glow, points.map(([x,y,z]) => point(x,y,z)), radius);
  switch (topic) {
    case "financial":
      stroke([[-.91,-.39,.25],[-.45,-.28,.35],[.14,.16,.40],[.86,.48,.20]]);
      bead(-.91,-.39,.25); bead(.86,.48,.20); break;
    case "recipe": case "meal":
      for (const x of [-.38, 0, .38]) stroke([[x,-.28,.31],[x-.09,.15,.49],[x+.16,.52,.38],[x+.04,.93,.22]], .031);
      for (let i = 0; i < (topic === "meal" ? 3 : 1); i++) {
        const bowl = ring(fibers, glow, .53 + .12*i, .021); bowl.rotation.x = Math.PI/2; bowl.position.y = -.38 - i*.17;
      } break;
    case "schedule":
      stroke([[0,0,.42],[.53,.62,.46]], .051); stroke([[0,0,.18],[-.56,.09,.25]], .043); break;
    case "trip":
      stroke([[0,-1,.19],[0,1,.19]], .047);
      for (const x of [-.26,.26]) stroke([[x,-.38,.19],[0,1,.19]], .032);
      ring(fibers, soft, .97, .024).rotation.y = .51; break;
    case "memory": case "chat":
      for (let i=0; i<(topic === "memory" ? 3 : 2); i++) {
        const loop = ring(fibers, glow, .55 + i*.13, .024);
        loop.position.z = (i - .7)*.29; loop.position.x = (i - .6)*.14; loop.rotation.y = i*.38;
      } break;
    case "health":
      stroke([[-1,-.08,.20],[-.51,-.08,.56],[-.30,.20,.65],[-.11,-.31,.71],[.14,.70,.69],[.34,-.43,.63],[.49,-.08,.50],[.98,-.08,.20]]); break;
    case "home":
      for (const z of [.48,-.38]) stroke([[-.78,-.2,z],[0,.67,z],[.78,-.2,z]], .047);
      break;
    case "fitness":
      for (let i=0;i<4;i++) {
        const a=i*Math.PI/2; stroke([[Math.cos(a)*.47,Math.sin(a)*.47,.2],[Math.cos(a)*.93,Math.sin(a)*.93,.3]], .061);
      } break;
    case "outfit":
      for (let i=0;i<5;i++) {
        const band = ring(fibers, glow, .92, .014); band.rotation.set(1,.34,.57); band.position.y = (i-2)*.055;
      } break;
    case "notifications":
      for (let i=0;i<3;i++) { const arc = mesh(fibers, new T.TorusGeometry(.52+i*.24,.025,6,54,4.2), glow); arc.rotation.z = -.53; }
      break;
    case "native":
      for (const [w,h,z] of [[.87,1.55,.4],[.58,.89,-.48]]) {
        stroke([[-w/2,-h/2,z],[-w/2,h/2,z],[w/2,h/2,z],[w/2,-h/2,z],[-w/2,-h/2,z]], .038);
      } break;
    case "delivery":
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        stroke([[Math.cos(a)*.94,Math.sin(a)*.94,.22],[Math.cos(a+.31)*.73,Math.sin(a+.31)*.73,.45],[Math.cos(a+.86)*.43,Math.sin(a+.86)*.43,.47]]);
      } break;
    case "tooling":
      for (let i=0;i<11;i++) { const a=i*Math.PI*2/11; bead(Math.cos(a)*.98,Math.sin(a)*.98,.27,.038+i*.002); }
      stroke([[-.22,-.85,.44],[0,.01,.55],[.25,.91,.44]]); break;
  }
  return { orb, fibers, tint, glow, shell, aura, nucleus };
}
