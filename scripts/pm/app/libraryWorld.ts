import * as T from "three";
import { release } from "./brain/art";
import { libraryDeck, type CabinetArt } from "./libraryArt";

export interface LibraryWorld {
  face(index: number): void;
  step(distance: number): void;
  dispose(): void;
}

export interface LibraryAssets {
  sky: HTMLCanvasElement;
  faces: HTMLCanvasElement[];
}

const tau = 2 * Math.PI;
const direction = (angle: number) => new T.Vector3(Math.sin(angle), 0, -Math.cos(angle));

export function createLibraryWorld(host: HTMLElement, cabinets: readonly CabinetArt[], assets: LibraryAssets,
  initial: number, onFocus: (index: number) => void, onOpen: (index: number) => void, onLoss: () => void): LibraryWorld {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  const surface = renderer.domElement;
  surface.setAttribute("aria-hidden", "true");
  const scene = new T.Scene();
  scene.background = new T.Color("#091122");
  const camera = new T.PerspectiveCamera(49, 1, .1, 100);
  camera.rotation.order = "YXZ";
  const spacing = tau / cabinets.length;
  const radius = Math.max(6.6, cabinets.length * .62);
  const faces: T.Mesh[] = [];
  const theme = getComputedStyle(host).getPropertyValue("--theme-bg").trim() || "#0a1628";
  const hull = new T.MeshStandardMaterial({ color: new T.Color("#506674").lerp(new T.Color(theme), .25), roughness: .67 });
  const bright = new T.MeshStandardMaterial({ color: "#b3a17b", roughness: .54 });
  const night = new T.MeshStandardMaterial({ color: "#22303d", roughness: .72 });
  const track = new T.MeshBasicMaterial({ color: "#899a9b" });
  const light = new T.MeshBasicMaterial({ color: "#f2d1a1" });
  const boxes = new Map<T.Material, T.Matrix4[]>();
  const placement = new T.Object3D();
  function box(material: T.Material, angle: number, radial: number, y: number, lateral: number, w: number, h: number, depth: number) {
    placement.position.set(Math.sin(angle) * radial + Math.cos(angle) * lateral, y,
      -Math.cos(angle) * radial + Math.sin(angle) * lateral);
    placement.rotation.y = -angle;
    placement.scale.set(w, h, depth);
    placement.updateMatrix();
    const batch = boxes.get(material) ?? [];
    batch.push(placement.matrix.clone());
    boxes.set(material, batch);
  }
  function rail(r: number, y: number, thickness: number, material: T.Material) {
    const mesh = new T.Mesh(new T.TorusGeometry(r, thickness, 6, 112), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    scene.add(mesh);
  }
  function texture(image: HTMLCanvasElement) {
    const map = new T.CanvasTexture(image);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const sky = new T.Mesh(new T.CylinderGeometry(65, 65, 74, 96, 1, true),
    new T.MeshBasicMaterial({ map: texture(assets.sky), side: T.BackSide }));
  sky.position.y = 12;
  scene.add(sky);
  const deck = new T.Mesh(new T.CylinderGeometry(radius + 2.8, radius + 3, .22, 96),
    new T.MeshStandardMaterial({ map: texture(libraryDeck(cabinets, radius)), roughness: .64 }));
  deck.position.y = -.16;
  scene.add(deck);
  // A circular brass inlay follows the aisle. Faceted window jambs frame the sky
  // beyond the cabinets, leaving the sun and planets above the shelf line.
  for (const r of [2.1, 2.16, radius - 1.19, radius - .98, radius + 1.74]) rail(r, -.045, .018, bright);
  for (const [height, thickness] of [[.17, .12], [.36, .024], [4.97, .055], [5.20, .16]]) {
    rail(radius + 2.28, height, thickness, height === 4.97 ? track : hull);
  }
  for (const [height, width] of [[5.05, .065], [5.14, .025]]) rail(radius + 1.8, height, width, light);
  const segments = Math.max(8, cabinets.length);
  for (let i = 0; i < segments; i++) {
    const a = (i + .5) * tau / segments;
    box(hull, a, radius + 2.26, 2.51, 0, .15, 5.02, .33);
    box(bright, a, radius + 2.08, 2.54, 0, .032, 4.86, .025);
    box(night, a, radius + 2.24, .22, 0, .43, .45, .53);
    box(hull, a, radius + 2.23, .56, 0, .26, .28, .45);
    box(track, a, radius + 2.0, .56, 0, .17, .026, .018);
    box(night, a, radius + 2.24, 4.87, 0, .43, .45, .53);
    box(hull, a, radius + .33, 5.23, 0, .27, .19, 4.22);
    box(track, a, radius - .66, -.027, 0, .024, .012, 1.9);
  }
  cabinets.forEach((cabinet, index) => {
    const a = index * spacing, w = 2.17, h = 2.51;
    const color = new T.MeshBasicMaterial({ color: cabinet.color });
    box(night, a, radius, h / 2, 0, w + .14, h, .49);
    box(hull, a, radius, .10, 0, w + .49, .2, .93);
    box(bright, a, radius, .22, 0, w + .26, .044, .66);
    box(hull, a, radius, h + .035, 0, w + .30, .14, .68);
    box(bright, a, radius - .30, h + .10, 0, w + .25, .034, .13);
    for (const side of [-1, 1]) {
      box(hull, a, radius - .16, h / 2, side * (w / 2 + .07), .09, h, .47);
      box(color, a, radius - .402, 1.56, side * (w / 2 + .07), .018, 1.55, .009);
    }
    const face = new T.Mesh(new T.PlaneGeometry(w, h - .22),
      new T.MeshBasicMaterial({ map: texture(assets.faces[index]) }));
    face.position.copy(direction(a).multiplyScalar(radius - .25));
    face.position.y = h / 2 + .09;
    face.rotation.y = -a;
    face.userData.index = index;
    scene.add(face);
    faces.push(face);
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = .20 + (448 - (175 + shelf * 119)) / 448 * (h - .22);
      box(bright, a, radius - .27, y, 0, w + .025, .024, .11);
    }
    box(color, a, radius - .61, -.024, 0, w * .59, .025, .038);
  });
  const cube = new T.BoxGeometry();
  for (const [material, matrices] of boxes) {
    const mesh = new T.InstancedMesh(cube, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    scene.add(mesh);
  }
  scene.add(new T.HemisphereLight("#dbe8f5", "#616775", 2.0));
  const sun = new T.DirectionalLight("#ffe3ad", 2.6);
  sun.position.set(9, 7, -7);
  scene.add(sun);

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let yaw = initial * spacing, aim = yaw, distance = .45, goalDistance = distance, pitch = .045;
  let frame = 0, last = 0, disposed = false;
  function paint(now: number) {
    frame = 0;
    if (disposed || document.hidden) return;
    const alpha = motion.matches ? 1 : 1 - Math.exp(-Math.min(70, last ? now - last : 16) / 88);
    last = now;
    yaw += (aim - yaw) * alpha;
    distance += (goalDistance - distance) * alpha;
    const moving = Math.abs(aim - yaw) > .001 || Math.abs(goalDistance - distance) > .003;
    if (!moving) { yaw = aim; distance = goalDistance; last = 0; }
    camera.position.copy(direction(yaw).multiplyScalar(distance));
    camera.position.y = 1.55;
    camera.rotation.set(pitch, -yaw, 0);
    renderer.render(scene, camera);
    if (moving) invalidate();
  }
  function invalidate() {
    if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(paint);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6, Math.sqrt(1900000 / (width * height))));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  const indexAt = (angle: number) => T.MathUtils.euclideanModulo(Math.round(angle / spacing), cabinets.length);
  const face = (index: number) => {
    aim = yaw + T.MathUtils.euclideanModulo(index * spacing - yaw + Math.PI, tau) - Math.PI;
    invalidate();
  };
  const ray = new T.Raycaster();
  let down: { id: number; x: number; y: number; yaw: number; pitch: number; dragged: boolean } | null = null;
  function start(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    down = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch, dragged: false };
    surface.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!down || down.id !== event.pointerId) return;
    const dx = event.clientX - down.x, dy = event.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) down.dragged = true;
    if (!down.dragged) return;
    aim = down.yaw - dx * .0048;
    yaw = aim;
    pitch = T.MathUtils.clamp(down.pitch + dy * .003, -.17, .32);
    invalidate();
  }
  function stop(event: PointerEvent) {
    if (!down || down.id !== event.pointerId) return;
    const wasDragging = down.dragged;
    down = null;
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    if (wasDragging || event.type === "pointercancel") {
      const index = indexAt(yaw);
      face(index);
      onFocus(index);
      return;
    }
    const rect = surface.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(2 * (event.clientX - rect.left) / rect.width - 1,
      1 - 2 * (event.clientY - rect.top) / rect.height), camera);
    const hit = ray.intersectObjects(faces, false)[0];
    if (hit) onOpen(Number(hit.object.userData.index));
  }
  host.append(surface);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  surface.addEventListener("pointerdown", start);
  surface.addEventListener("pointermove", move);
  surface.addEventListener("pointerup", stop);
  surface.addEventListener("pointercancel", stop);
  surface.addEventListener("webglcontextlost", onLoss);
  document.addEventListener("visibilitychange", invalidate);
  return { face, step(amount) { goalDistance = T.MathUtils.clamp(goalDistance + amount, -.9, radius - 2.4); invalidate(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", invalidate);
      surface.removeEventListener("pointerdown", start);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", stop);
      surface.removeEventListener("pointercancel", stop);
      surface.removeEventListener("webglcontextlost", onLoss);
      release(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      surface.remove();
    },
  };
}
