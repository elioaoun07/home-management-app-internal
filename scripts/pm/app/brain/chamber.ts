import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { angularDistance, bays, stations } from "./layout";
import { apertureGlass, canopySectors, deckIrradiance, galleryGlass, soffitGeometry } from "./observatory";

const tau = Math.PI * 2;
const unitBox = () => new T.BoxGeometry();
const rad = T.MathUtils.degToRad;
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const alloy = (color: string, metalness: number, roughness: number) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });

// The kit is assembled in local bay space and baked once per material/cutaway layer.
// This lets all the small physical edges, fasteners and vents share draw calls.
function bake(layer: T.Group, staticMetals?: Map<T.Material, T.Material>) {
  layer.updateWorldMatrix(true, true);
  const inverse = layer.matrixWorld.clone().invert();
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  const source = new Set<T.BufferGeometry>();
  layer.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    source.add(object.geometry);
    // These indexed primitives share the vertices of each quad, bevel and
    // cylinder. Expanding every triangle triples vertex work on CPU renderers.
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(
      new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
    );
    const painted = staticMetals?.get(object.material);
    if (painted && object.material instanceof T.MeshStandardMaterial)
      bakeFixtureLight(geometry, object.material, painted instanceof T.MeshBasicMaterial);
    const material = painted ?? object.material;
    const group = parts.get(material) ?? [];
    group.push(geometry);
    parts.set(material, group);
  });
  layer.clear();
  for (const [material, pieces] of parts) {
    const merged = mergeGeometries(pieces, false);
    if (merged) layer.add(new T.Mesh(merged, material));
    for (const piece of pieces) piece.dispose();
  }
  for (const geometry of source) geometry.dispose();
}

// Batch metal colours by finish. Accelerated drivers reflect the room's
// fixtures on those surfaces; on CPU drivers their light is baked per vertex.
// The roof and gallery keep their photographic material maps on both paths.
function bakeFixtureLight(geometry: T.BufferGeometry, material: T.MeshStandardMaterial, prelit: boolean) {
  const normals = geometry.getAttribute("normal"), positions = geometry.getAttribute("position");
  const colors = new Float32Array(normals.count * 3);
  const albedo = material.color, lamp = material.emissive;
  for (let index = 0; index < normals.count; index++) {
    const at = 3 * index;
    if (!prelit) {
      albedo.toArray(colors, at);
      continue;
    }
    const nx = normals.getX(index), ny = normals.getY(index), nz = normals.getZ(index);
    const key = Math.max(0, -.56 * nx + .73 * ny + .38 * nz);
    const rim = Math.max(0, .76 * nx + .43 * ny - .47 * nz);
    const sky = .41 + .23 * ny;
    const distance = Math.hypot(positions.getX(index), positions.getZ(index));
    const bounce = Math.max(0, 1 - distance / 14) * .12;
    const sheen = material.metalness * (.035 + .15 * key ** 7 + .07 * rim ** 4);
    colors[at] = albedo.r * (sky + key * .65 + rim * .59 + bounce) + sheen + lamp.r * material.emissiveIntensity;
    colors[at + 1] = albedo.g * (sky + key * .82 + rim * .34 + bounce) + sheen * 1.06 + lamp.g * material.emissiveIntensity;
    colors[at + 2] = albedo.b * (sky + key + rim * .19 + bounce) + sheen * 1.14 + lamp.b * material.emissiveIntensity;
  }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
}

function attach(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  material: T.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const part = new T.Mesh(geometry, material);
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}
function block(
  group: T.Object3D,
  material: T.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const part = attach(group, unitBox(), material, x, y, z);
  part.scale.set(w, h, d);
  return part;
}
function rounded(
  group: T.Object3D,
  material: T.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  edge = 0.055,
) {
  // Sub-centimetre bevels on small fixtures are subpixel from the aisle.
  if (edge < .025) return block(group, material, x, y, z, w, h, d);
  const radius = Math.min(edge, w / 2, h / 2, d / 2);
  const geo = new T.BoxGeometry(1, 1, 1, 3, 3, 3);
  const points = geo.getAttribute("position"), normals = geo.getAttribute("normal");
  const normal = new T.Vector3();
  for (let i = 0; i < points.count; i++) {
    normal.fromBufferAttribute(points, i);
    const sx = Math.sign(normal.x), sy = Math.sign(normal.y), sz = Math.sign(normal.z);
    normal.set(normal.x - sx / 6, normal.y - sy / 6, normal.z - sz / 6).normalize();
    points.setXYZ(i, sx * (w / 2 - radius) + radius * normal.x, sy * (h / 2 - radius) + radius * normal.y, sz * (d / 2 - radius) + radius * normal.z);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return attach(group, geo, material, x, y, z);
}
function frame(parent: T.Object3D, angle: number, radius: number) {
  const group = new T.Group();
  group.position.set(radius * Math.sin(angle), 0, -radius * Math.cos(angle));
  group.rotation.y = -angle;
  parent.add(group);
  return group;
}
function section(
  group: T.Object3D,
  mat: T.Material,
  a: T.Vector3,
  b: T.Vector3,
  width: number,
  depth: number,
) {
  const middle = a.clone().lerp(b, 0.5);
  const part = block(
    group,
    mat,
    middle.x,
    middle.y,
    middle.z,
    width,
    a.distanceTo(b),
    depth,
  );
  part.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
}
function profile(
  group: T.Object3D,
  mat: T.Material,
  points: number[][],
  segments = 96,
) {
  return attach(
    group,
    new T.LatheGeometry(
      points.map(([x, y]) => new T.Vector2(x, y)),
      segments,
    ),
    mat,
  );
}

function positioningArm(
  rack: T.Group,
  ceramic: T.Material,
  iron: T.Material,
  bronze: T.Material,
) {
  const base = v(-0.48, 1.1, -0.17),
    shoulder = v(-0.56, 1.61, -0.22);
  const elbow = v(-0.24, 1.86, -0.18),
    wrist = v(0.06, 1.79, 0.025);
  const pins = [base, shoulder, elbow, wrist];
  const metalRod = (
    from: T.Vector3,
    to: T.Vector3,
    bottom: number,
    top: number,
    material: T.Material,
  ) => {
    const path = to.clone().sub(from);
    const joint = attach(
      rack,
      new T.CylinderGeometry(top, bottom, path.length(), 16),
      material,
    );
    joint.position.copy(from).lerp(to, 0.5);
    joint.quaternion.setFromUnitVectors(v(0, 1, 0), path.normalize());
  };
  attach(
    rack,
    new T.CylinderGeometry(0.125, 0.16, 0.085, 24),
    iron,
    base.x,
    1.04,
    base.z,
  );
  for (let i = 1; i < pins.length; i++) {
    const from = pins[i - 1],
      to = pins[i],
      radius = 0.074 - (i - 1) * 0.013;
    const start = from.clone().lerp(to, 0.1),
      end = from.clone().lerp(to, 0.87);
    metalRod(start, end, radius * 1.3, radius, ceramic);
    const axis = v(0, 0, radius * 1.11);
    metalRod(
      to.clone().sub(axis),
      to.clone().add(axis),
      radius * 1.3,
      radius * 1.3,
      iron,
    );
    metalRod(
      to.clone().add(axis),
      to.clone().addScaledVector(axis, 1.13),
      radius * 0.7,
      radius * 0.7,
      bronze,
    );
  }
  const hose = new T.CatmullRomCurve3([
    v(-0.57, 1.11, -0.24),
    v(-0.67, 1.42, -0.25),
    v(-0.66, 1.68, -0.25),
    v(-0.27, 1.94, -0.23),
    v(-0.02, 1.88, -0.04),
    v(0.06, 1.79, 0.005),
  ]);
  attach(rack, new T.TubeGeometry(hose, 26, 0.018, 6, false), iron);
  metalRod(wrist, v(0.06, 1.66, 0.06), 0.05, 0.03, iron);
  metalRod(v(0.06, 1.66, 0.06), v(0.06, 1.58, 0.07), 0.03, 0.009, bronze);
}

export function chamberReflections() {
  // A small linear HDR probe describes the real fixtures visible in the chamber.
  // PMREM derives reflections at different roughnesses for all the metal and glass.
  const width = 256,
    height = 128;
  const data = new Uint16Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const elevation = Math.PI * ((y + 0.5) / height - 0.5);
    for (let x = 0; x < width; x++) {
      const angle = ((x + 0.5) / width) * tau;
      const panes = 0.18 + 0.82 * Math.pow(Math.abs(Math.cos(angle * 3)), 9);
      const windows = Math.exp(-Math.pow((elevation - 0.11) / 0.2, 4)) * panes;
      const softbox =
        Math.exp(-Math.pow((elevation - 0.95) / 0.11, 2)) *
        (0.18 + 0.82 * Math.cos(angle * 2) ** 8);
      const bronze = Math.exp(
        -Math.pow(angularDistance(angle, 1.1) / 0.37, 2) -
          Math.pow((elevation - 0.46) / 0.27, 2),
      );
      const sky = Math.max(0, Math.sin(elevation));
      const offset = (y * width + x) * 4;
      const intensity = 0.07 + sky * 0.13;
      const values = [
        intensity + 1.9 * windows + 3.5 * softbox + 3.1 * bronze,
        intensity * 1.12 + 2.12 * windows + 4.1 * softbox + 1.54 * bronze,
        intensity * 1.25 + 2.35 * windows + 4.48 * softbox + 0.61 * bronze,
        1,
      ];
      values.forEach((value, index) => {
        data[offset + index] = T.DataUtils.toHalfFloat(value);
      });
    }
  }
  const probe = new T.DataTexture(
    data,
    width,
    height,
    T.RGBAFormat,
    T.HalfFloatType,
  );
  probe.mapping = T.EquirectangularReflectionMapping;
  probe.minFilter = probe.magFilter = T.LinearFilter;
  probe.needsUpdate = true;
  return probe;
}

export function fitChamber(
  outer: T.Group,
  floor: T.MeshStandardMaterial,
  refresh: () => void,
  software = false,
) {
  const front = new T.Group(),
    back = new T.Group(),
    canopy = new T.Group(),
    deck = new T.Group(),
    vista = new T.Group();
  outer.add(front, back, canopy, deck, vista);
  const iron = alloy("#495158", 0.72, 0.38),
    titanium = alloy("#899098", 0.77, 0.35);
  const ceramic = alloy("#8e8a7e", 0.41, 0.54),
    gasket = alloy("#1a242b", 0.34, 0.57);
  const bronze = alloy("#91704d", 0.74, 0.42);
  const porcelain = new T.MeshStandardMaterial({
    color: "#e7efe8",
    emissive: "#c8e9f3",
    emissiveIntensity: 2.4,
    roughness: 0.36,
  });
  const amber = new T.MeshStandardMaterial({
    color: "#b89760",
    emissive: "#ffaf5a",
    emissiveIntensity: 1.32,
    roughness: 0.4,
  });
  const gallery = new T.MeshBasicMaterial({
    color: "#202c38",
    side: T.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  const jacket = alloy("#a1a8ae", 0.33, 0.6);
  const soffit = new T.MeshBasicMaterial({ color: "#cdd2d4", vertexColors: true });
  const windowGlass = galleryGlass();
  const gate = { open: true };
  const loader = new T.TextureLoader();
  // Keep the deck dark during first paint and when an image cannot be loaded.
  const fallbackDeck = new T.DataTexture(
    new Uint8Array([93, 102, 110, 255]),
    1,
    1,
  );
  fallbackDeck.colorSpace = T.SRGBColorSpace;
  fallbackDeck.needsUpdate = true;
  floor.map = fallbackDeck;
  floor.lightMap = deckIrradiance();
  floor.lightMapIntensity = 2.4;
  const load = (url: string, ready: (map: T.Texture) => void) => {
    loader.load(
      url,
      (map) => {
        if (!gate.open) {
          map.dispose();
          return;
        }
        map.colorSpace = T.SRGBColorSpace;
        map.anisotropy = software ? 2 : 8;
        ready(map);
        refresh();
      },
      undefined,
      () => {
        /* The built metal shell remains usable when a plate is unavailable. */
      },
    );
  };
  load("/assets/transfer-observatory.webp", (map) => {
    gallery.color.set("#90a6b0");
    gallery.map = map;
    gallery.needsUpdate = true;
  });
  load("/assets/transfer-deck.webp", (map) => {
    fallbackDeck.dispose();
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(11, 11);
    floor.map = map;
    floor.needsUpdate = true;
  });
  load("/assets/transfer-access.webp", (map) => {
    jacket.map = map;
    jacket.needsUpdate = true;
  });
  load("/assets/transfer-canopy.webp", (map) => {
    soffit.map = map;
    soffit.needsUpdate = true;
  });

  // Beyond the sill is an actual service void. Mullions, pipes and balustrades
  // sit several metres in front of the distant gallery, so movement has parallax.
  const wallCount = 48;
  for (let i = 0; i < wallCount; i++) {
    const a = (tau * i) / wallCount;
    const bay = bays.find(
      (b) => angularDistance(a, rad(b.angle)) <= b.opening + 0.045,
    );
    const radius = bay ? 12.47 : 10.09;
    const side = -Math.cos(a) * radius > 4 ? front : back;
    const wall = frame(side, a, radius);
    const width = 2 * radius * Math.tan(Math.PI / wallCount);
    block(wall, iron, 0, 0.48, -0.12, width + 0.05, 0.96, 0.38);
    block(wall, ceramic, 0, 0.66, 0.085, width - 0.055, 0.35, 0.09);
    block(wall, titanium, 0, 0.98, 0.02, width + 0.035, 0.085, 0.3);
    attach(
      wall,
      new T.PlaneGeometry(width * 0.91, 0.35),
      jacket,
      0,
      0.66,
      0.134,
    );
    block(wall, gasket, 0, 1.22, -0.12, width + 0.02, 0.13, 0.2);
    rounded(wall, iron, 0, 4.22, -0.04, width + 0.04, 0.5, 0.33, .048);
    block(wall, titanium, 0, 4.0, 0.075, width + 0.04, 0.056, 0.2);
    const soffitY = radius > 12 ? 4.75 : 5.45;
    // Continue the pressure glass from the sill into the clerestory above
    // the transom. This also seals the shallower wall sections under the dome.
    const glassPanel = new T.PlaneGeometry(width + .018, soffitY - .98);
    const glazingUv = glassPanel.getAttribute("uv");
    for (let j = 0; j < glazingUv.count; j++) glazingUv.setX(j, ((i % 4) + glazingUv.getX(j)) / 4);
    attach(wall, glassPanel, windowGlass, 0, (soffitY + .98) / 2, -.058);
    // The projecting observation bays step out of the circular aisle. Close
    // the return jamb at each change of depth, including the short side pane.
    const boundary = a - Math.PI / wallCount;
    const previous = bays.find(b => angularDistance(a - tau / wallCount, rad(b.angle)) <= b.opening + .045);
    const priorRadius = previous ? 12.47 : 10.09;
    if (radius !== priorRadius) {
      const returnWall = frame(side, boundary, (radius + priorRadius) / 2);
      const length = Math.abs(radius - priorRadius) + .10;
      rounded(returnWall, iron, 0, .48, 0, .23, .96, length, .035);
      block(returnWall, titanium, 0, .98, 0, .28, .082, length);
      rounded(returnWall, iron, 0, 4.22, 0, .29, .50, length, .045);
      const facing = radius > priorRadius ? 1 : -1;
      const sideGlass = new T.PlaneGeometry(length, 1);
      const vertices = sideGlass.getAttribute("position");
      for (let j = 0; j < vertices.count; j++) {
        const upper = vertices.getX(j) * facing > 0 ? 4.75 : 5.45;
        vertices.setY(j, vertices.getY(j) > 0 ? upper : .98);
      }
      const pane = attach(returnWall, sideGlass, windowGlass, 0, 0, 0);
      pane.rotation.y = facing * Math.PI / 2;
    }
    // Pair the panes between load-bearing mullions to retain a clear prospect.
    if (i % 2 === 0) {
      block(wall, gasket, width / 2, 2.56, -.12, .105, 3.07, .22);
      block(wall, titanium, width / 2, 2.59, -.015, .035, 2.97, .065);
    }
    if (i % 6 === 0) {
      const left = -width * 0.33;
      section(
        wall,
        titanium,
        v(left, 1.0, -0.03),
        v(left + width * 0.74, 3.98, -0.03),
        0.073,
        0.12,
      );
      block(wall, bronze, left + 0.1, 1.19, 0.032, 0.21, 0.15, 0.058);
      block(wall, gasket, 0, 0.38, 0.093, width * 0.67, 0.12, 0.045);
      for (let j = 0; j < 6; j++)
        block(
          wall,
          iron,
          (j - 2.5) * width * 0.098,
          0.38,
          0.12,
          0.042,
          0.096,
          0.024,
        );
    }
    if (i % 4 === 1) {
      block(wall, gasket, 0, 4.19, 0.2, width * 0.86, 0.24, 0.23);
      block(
        wall,
        i % 8 === 1 ? porcelain : amber,
        0,
        4.13,
        0.324,
        width * 0.71,
        0.055,
        0.022,
      );
    }
    const galleryRadius = 42;
    const tangent = frame(vista, a, galleryRadius);
    const image = new T.PlaneGeometry(
      2 * galleryRadius * Math.tan(Math.PI / wallCount) + 0.035,
      21.5,
    );
    const uv = image.getAttribute("uv");
    // The horizon lies well beyond the working gallery and its real mullions.
    // Mirror the return view at the bulkhead to keep the horizon continuous.
    const panorama = (i + wallCount / 2) % wallCount;
    const start = (panorama % 16) / 16;
    for (let j = 0; j < uv.count; j++) {
      const u = start + uv.getX(j) / 16;
      uv.setX(j, Math.floor(panorama / 16) === 1 ? 1 - u : u);
    }
    attach(tangent, image, gallery, 0, 3.45, 0);
    if (angularDistance(a, Math.PI) < 0.17) {
      // The entrance pressure bulkhead closes the gallery behind the chair.
      const shield = frame(side, a, radius + 0.66);
      const span = 2 * (radius + 0.66) * Math.tan(Math.PI / wallCount);
      rounded(shield, gasket, 0, 2.67, 0, span + 0.05, 5.12, 0.21, 0.04);
      attach(
        shield,
        new T.PlaneGeometry(span * 0.95, 2.8),
        jacket,
        0,
        2.61,
        0.112,
      );
      block(shield, bronze, 0, 3.97, 0.14, span * 0.58, 0.038, 0.042);
    }
    if (i % 8 === 0) {
      const service = frame(side, a + 0.025, radius + 1.4);
      block(service, iron, 0, 2.05, 0, 0.24, 5.58, 0.31);
      for (const x of [-1.1, 1.12])
        block(service, iron, x, 1.77, 0, 0.1, 2.36, 0.18);
      for (const y of [0.62, 2.89])
        block(service, iron, 0, y, 0, 2.29, 0.11, 0.16);
      section(service, iron, v(-1.1, 0.62, 0), v(1.12, 2.89, 0), 0.09, 0.16);
      const duct = attach(
        service,
        new T.CylinderGeometry(0.15, 0.15, 5.9, 12),
        bronze,
        0.58,
        2.62,
        -0.1,
      );
      for (let n = 0; n < 3; n++)
        attach(
          service,
          new T.CylinderGeometry(0.185, 0.185, 0.081, 12),
          titanium,
          duct.position.x,
          0.74 + n * 1.62,
          duct.position.z,
        );
    }
  }
  // Individual ceramic soffits spring from the compression collar. The
  // recessed diffusers, inner lens and rafters have depth at grazing angles.
  const lens = apertureGlass();
  iron.side = T.DoubleSide;
  for (let i = 0; i < canopySectors; i++) {
    attach(canopy, soffitGeometry(i), soffit);
    const rib = frame(canopy, i * tau / canopySectors, 0);
    section(rib, iron, v(0,6.11,-2.98), v(0,6.47,-4.32), .20, .16);
    section(rib, iron, v(0,6.48,-4.32), v(0,6.45,-5.5), .20, .16);
    section(rib, iron, v(0,6.45,-5.5), v(0,4.41,-12.96), .21, .16);
    section(rib, bronze, v(0,6.36,-5.60), v(0,4.41,-12.75), .054, .039);
    if (i % 2 === 0) {
      section(rib, gasket, v(0,6.28,-5.96), v(0,5.04,-10.48), .38, .13);
      section(rib, ceramic, v(0,6.20,-5.98), v(0,4.99,-10.42), .29, .07);
      section(rib, i % 4 === 0 ? porcelain : amber, v(0,6.16,-6.04), v(0,4.99,-10.32), .16, .043);
    }
  }
  profile(canopy, ceramic, [[1.87,5.96],[2.00,5.83],[2.44,5.83],[2.71,5.98],[2.93,6.14],[3.06,6.18]]);
  profile(canopy, bronze, [[2.55,5.896],[2.62,5.93],[2.68,5.974]]);
  profile(canopy, gasket, [[1.79,5.98],[1.85,5.82],[1.95,5.78],[2.09,5.80],[2.15,5.87]]);
  profile(canopy, porcelain, [[1.82,5.845],[1.86,5.796],[1.90,5.79]]);
  const optic = attach(canopy, new T.CircleGeometry(1.84, 96), lens, 0,5.886,0);
  optic.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const boss = frame(canopy, i * tau / 12, 2.28);
    rounded(boss, titanium, 0,5.837,0, .15,.10,.24,.029);
    block(boss, gasket, 0,5.783, .014, .055,.012,.105);
  }
  // Slotted deck drains and interrupted bronze kerbs follow the walking ring.
  profile(deck, gasket, [
    [4.89, 0.002],
    [4.86, 0.012],
    [4.58, 0.012],
    [4.56, 0.002],
  ]);
  profile(deck, iron, [
    [4.6, 0.019],
    [4.58, 0.019],
    [4.56, 0.003],
  ]);
  profile(deck, iron, [
    [4.89, 0.003],
    [4.87, 0.019],
    [4.84, 0.019],
  ]);
  for (let i = 0; i < 144; i++) {
    const slit = frame(deck, (i * tau) / 144, 4.72);
    const bar = block(slit, iron, 0, 0.016, 0, 0.042, 0.008, 0.247);
    bar.rotation.y = 0.28;
    if (i % 12 === 0) block(slit, bronze, 0.066, 0.019, 0, 0.077, 0.009, 0.247);
  }
  // Machine packing under the glass leaves the globe visible from the aisle.
  profile(deck, titanium, [
    [2.16, 0.13],
    [2.15, 0.21],
    [2.08, 0.27],
    [1.95, 0.3],
  ]);
  profile(deck, gasket, [
    [1.95, 0.43],
    [1.87, 0.55],
    [1.53, 0.55],
    [1.43, 0.44],
  ]);
  profile(deck, bronze, [
    [1.57, 0.51],
    [1.55, 0.56],
    [1.47, 0.56],
    [1.45, 0.49],
  ]);
  for (let i = 0; i < 36; i++) {
    const housing = frame(deck, (i * tau) / 36, 1.8);
    const clamp = rounded(
      housing,
      i % 3 === 0 ? ceramic : iron,
      0,
      0.49,
      0.03,
      0.23,
      0.135,
      0.37,
      0.026,
    );
    clamp.rotation.x = -0.19;
    if (i % 3 === 0) {
      attach(
        housing,
        new T.CylinderGeometry(0.044, 0.044, 0.027, 6),
        gasket,
        0,
        0.568,
        0.035,
      );
      block(housing, amber, 0, 0.49, -0.177, 0.108, 0.022, 0.014);
    }
  }

  // The positioning arm occupies the service end of the Build instrument.
  const build = stations.find(station => station.id === "build");
  if (build) {
    const rack = frame(deck, rad(build.angle), build.radius);
    positioningArm(rack, ceramic, iron, bronze);
  }

  const enamel = new T.MeshBasicMaterial({ vertexColors: true });
  const brushed = software ? enamel : new T.MeshStandardMaterial({ vertexColors: true, metalness: .73, roughness: .41 });
  const brushedBothSides = brushed.clone();
  brushedBothSides.side = T.DoubleSide;
  const ceramicFinish = software ? enamel : new T.MeshStandardMaterial({ vertexColors: true, metalness: .32, roughness: .61 });
  const staticMetals = new Map<T.Material, T.Material>([
    [iron, brushedBothSides], [titanium, brushed], [bronze, brushed],
    [gasket, ceramicFinish], [ceramic, ceramicFinish], [amber, enamel], [porcelain, enamel],
  ]);
  for (const group of [deck, canopy, front, back, vista]) bake(group, staticMetals);
  // The distant gallery wraps the building. Shading it after the interior
  // lets the CPU rasterizer reject the roof, frames and opaque consoles first.
  if (software) vista.traverse(part => {
    if (part instanceof T.Mesh && part.material === gallery) part.renderOrder = 10;
  });
  for (const material of staticMetals.keys()) material.dispose();
  if (!software) {
    const practical = new T.PointLight("#e9efff", 34, 14, 2);
    practical.position.set(-4.8, 4.35, -2);
    const rim = new T.PointLight("#ffb47a", 38, 16, 2);
    rim.position.set(6.5, 3.65, -.3);
    outer.add(practical, rim);
  }
  return {
    cutaway: [front, canopy, vista],
    dispose() {
      gate.open = false;
    },
  };
}

// Human-scale chair and console with a shell, split cushions and exposed adjustment hardware.
export function fitSeat(
  seat: T.Group,
  consoleFrame: T.Group,
  materials: {
    hull: T.MeshStandardMaterial;
    panel: T.MeshStandardMaterial;
    bevel: T.MeshStandardMaterial;
  },
) {
  const rubber = alloy("#373c3f", 0.09, 0.83),
    saddle = alloy("#695349", 0.12, 0.72);
  attach(
    seat,
    new T.CylinderGeometry(0.23, 0.34, 0.11, 28),
    materials.bevel,
    0,
    0.06,
    0.01,
  );
  attach(
    seat,
    new T.CylinderGeometry(0.1, 0.14, 0.28, 18),
    materials.hull,
    0,
    0.22,
    0.02,
  );
  rounded(seat, materials.bevel, 0, 0.365, 0, 0.91, 0.13, 0.66);
  rounded(seat, saddle, 0, 0.459, -0.02, 0.81, 0.14, 0.58);
  for (const x of [-0.4, 0.4]) {
    section(
      seat,
      materials.bevel,
      v(x, 0.35, 0.16),
      v(x, 0.88, 0.34),
      0.07,
      0.11,
    );
    rounded(seat, rubber, x, 0.63, -0.02, 0.115, 0.075, 0.46, 0.022);
  }
  // Form the rear load-bearing shell around the cushion, with a tapered
  // waist and a through handle. This is the first seat surface seen on entry.
  const shape = new T.Shape();
  shape.moveTo(-.21,-.30);
  shape.bezierCurveTo(-.34,-.27,-.36,-.12,-.39,.015);
  shape.bezierCurveTo(-.42,.16,-.49,.25,-.405,.32);
  shape.bezierCurveTo(-.26,.40,.26,.40,.405,.32);
  shape.bezierCurveTo(.49,.25,.42,.16,.39,.015);
  shape.bezierCurveTo(.36,-.12,.34,-.27,.21,-.30);
  shape.bezierCurveTo(.09,-.34,-.09,-.34,-.21,-.30);
  const handle = new T.Path();
  handle.moveTo(-.19,.22);
  handle.quadraticCurveTo(-.23,.27,-.18,.28);
  handle.quadraticCurveTo(0,.32,.18,.28);
  handle.quadraticCurveTo(.23,.27,.19,.22);
  handle.quadraticCurveTo(0,.251,-.19,.22);
  shape.holes.push(handle);
  const geometry = new T.ExtrudeGeometry(shape, {
    depth:.08, bevelEnabled:true, bevelSegments:2, bevelSize:.018, bevelThickness:.021, curveSegments:6,
  });
  const backshell = attach(seat, geometry, materials.panel, 0,.80,.243);
  backshell.rotation.x = -.15;
  const insert = rubber.clone();
  insert.color.set("#263338");
  const cover = rounded(seat, insert, 0,.824,.365,.66,.31,.072,.062);
  cover.rotation.x = -.15;
  // The vent embossing on this side seats the heat exchanger for the console.
  for (let i = 0; i < 4; i++) {
    const height = .744 + i * .023;
    const vent = rounded(seat, rubber, 0,height,.415 - i*.003, .31+i*.035,.013,.012,.004);
    vent.rotation.z = -.055;
  }
  for (const x of [-.33,.33]) {
    const carrier = new T.CatmullRomCurve3([
      v(x*.55,.43,.185),v(x*.80,.54,.341),v(x,.74,.374),v(x*1.14,.97,.32),
    ]);
    attach(seat, new T.TubeGeometry(carrier,12,.028,7,false), materials.bevel);
    const pivot = attach(seat, new T.CylinderGeometry(.044,.044,.025,16), materials.bevel,x*.80,.54,.358);
    pivot.rotation.x = Math.PI / 2;
    const pad = rounded(seat, saddle, x*.54,.794,.153,.335,.49,.124,.059);
    pad.rotation.x = -.15;
  }
  rounded(consoleFrame, materials.hull, 0, 0.1, 0.01, 0.55, 0.19, 0.35);
  section(
    consoleFrame,
    materials.bevel,
    v(0, 0.16, 0),
    v(0, 0.68, -0.08),
    0.13,
    0.17,
  );
  const slab = rounded(
    consoleFrame,
    materials.hull,
    0,
    0.76,
    -0.01,
    0.79,
    0.135,
    0.45,
    0.043,
  );
  slab.rotation.x = -0.26;
  const inset = rounded(
    consoleFrame,
    rubber,
    0,
    0.829,
    -0.01,
    0.66,
    0.026,
    0.33,
    0.016,
  );
  inset.rotation.x = -0.26;
  for (let i = 0; i < 3; i++)
    block(
      consoleFrame,
      materials.bevel,
      -0.23 + i * 0.15,
      0.842,
      0.09,
      0.087,
      0.022,
      0.044,
    );
  bake(seat);
  bake(consoleFrame);
}
