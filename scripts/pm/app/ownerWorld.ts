import * as T from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { release } from "./brain/art";
import type { OwnerStation, OwnerStationState } from "./ownerStations";
import { buildOwnerWorkshop, ownerBerths } from "./ownerRoomArt";
import { mountPatchProjection } from "./ownerPatchProjection";

export interface OwnerWorldState {
  selected: OwnerStation;
  patch?: string | null;
  signals: Record<OwnerStation, OwnerStationState>;
}
export interface OwnerWorld {
  update(state: OwnerWorldState): void;
  stop(): void;
  dispose(): void;
}
export interface BerthLabel {
  id: OwnerStation;
  x: number;
  y: number;
}

// SVG is a geometry renderer for hosts that do not offer a WebGL context.
// Both board renderers pick from the same workstation meshes.
export function createOwnerWorld(
  host: HTMLElement,
  initial: OwnerWorldState,
  inspect: (station: OwnerStation) => void,
  placeLabels: (labels: BerthLabel[]) => void,
  onLoss: () => void,
): OwnerWorld {
  let renderer: T.WebGLRenderer | SVGRenderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0, 0);
  } catch {
    renderer = new SVGRenderer();
    renderer.setPrecision(2);
    renderer.setQuality("high");
  }
  const surface = renderer.domElement;
  surface.setAttribute("aria-hidden", "true");
  host.append(surface);
  const scene = new T.Scene(),
    workshop = buildOwnerWorkshop(renderer instanceof T.WebGLRenderer);
  scene.add(workshop.group);
  const projectPatch =
    renderer instanceof T.WebGLRenderer
      ? mountPatchProjection(workshop.machines.get("merge")!)
      : null;
  scene.add(new T.HemisphereLight("#e8f5ff", "#536278", 2.25));
  const sun = new T.DirectionalLight("#ffe9ca", 2.67);
  sun.position.set(-4, 8, 6);
  scene.add(sun);
  const rim = new T.DirectionalLight("#9acfff", 1.9);
  rim.position.set(7, 4, -6);
  scene.add(rim);
  const map = new T.OrthographicCamera(-8, 8, 6, -6, 0.1, 90);
  map.position.set(4.4, 17.0, 22.3);
  map.lookAt(0, 0.63, 0);
  map.updateMatrixWorld();
  const label = new T.Vector3(),
    ray = new T.Raycaster();
  const ids = Object.keys(ownerBerths) as OwnerStation[];
  const targets = Array.from(workshop.machines.values());
  let state = initial,
    width = 0,
    height = 0,
    frame = 0,
    disposed = false;
  let drag: {
    x: number;
    y: number;
    id: number;
    moved: boolean;
  } | null = null;

  function draw() {
    frame = 0;
    if (disposed || document.hidden || !width || !height) return;
    renderer.render(scene, map);
  }
  function invalidate() {
    if (!disposed && !frame && !document.hidden)
      frame = requestAnimationFrame(draw);
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (width < 1 || height < 1) return;
    projectPatch?.(
      state.selected === "merge" ? state.patch : null,
      width < 550,
    );
    const aspect = width / height;
    map.position.set(4.4, width < 550 ? 27 : 17, 22.3);
    map.lookAt(0, 0.63, 0);
    map.updateMatrixWorld();
    // Frame the complete hull at any ratio, leaving enough room for berth names.
    const halfHeight = Math.max(4.78, 8.12 / aspect);
    map.left = -halfHeight * aspect;
    map.right = halfHeight * aspect;
    map.top = halfHeight;
    map.bottom = -halfHeight;
    map.updateProjectionMatrix();
    if (renderer instanceof T.WebGLRenderer) {
      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio || 1,
          1.65,
          Math.sqrt(1550000 / (width * height)),
        ),
      );
      renderer.setSize(width, height, false);
    } else renderer.setSize(width, height);
    placeLabels(
      ids.map((id) => {
        const [x, z] = ownerBerths[id];
        label.set(x, width < 550 ? 0.41 : 0.13, z + 1.46).project(map);
        return { id, x: (label.x + 1) * 50, y: (1 - label.y) * 50 };
      }),
    );
    invalidate();
  }
  function apply(next: OwnerWorldState) {
    state = next;
    projectPatch?.(next.selected === "merge" ? next.patch : null, width < 550);
    for (const id of ids) {
      const status = next.signals[id];
      workshop.lamps
        .get(id)!
        .color.set(
          id === next.selected
            ? "#ffe0a6"
            : status === "done"
              ? "#66c7b9"
              : status === "current"
                ? "#b6dfff"
                : status === "stopped"
                  ? "#dfaf85"
                  : "#527182",
        );
    }
    invalidate();
  }
  function finishDrag() {
    if (drag && surface.hasPointerCapture(drag.id))
      surface.releasePointerCapture(drag.id);
    drag = null;
  }
  function down(e: Event) {
    const event = e as PointerEvent;
    if (!event.isPrimary || event.button !== 0) return;
    host.focus({ preventScroll: true });
    drag = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      moved: false,
    };
    surface.setPointerCapture(event.pointerId);
  }
  function move(e: Event) {
    const event = e as PointerEvent;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
  }
  function up(e: Event) {
    const event = e as PointerEvent;
    if (!drag || drag.id !== event.pointerId) return;
    const tap = !drag.moved && e.type === "pointerup";
    finishDrag();
    if (!tap) return;
    const rect = surface.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2(
        ((event.clientX - rect.left) * 2) / rect.width - 1,
        1 - ((event.clientY - rect.top) * 2) / rect.height,
      ),
      map,
    );
    let target: T.Object3D | null =
      ray.intersectObjects(targets, true)[0]?.object ?? null;
    while (target && !target.userData.station) target = target.parent;
    if (target) inspect(target.userData.station as OwnerStation);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const lost = () => onLoss();
  surface.addEventListener("pointerdown", down);
  surface.addEventListener("pointermove", move);
  surface.addEventListener("pointerup", up);
  surface.addEventListener("pointercancel", up);
  surface.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", invalidate);
  apply(initial);
  resize();
  return {
    update: apply,
    stop: finishDrag,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      finishDrag();
      document.removeEventListener("visibilitychange", invalidate);
      surface.removeEventListener("pointerdown", down);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", up);
      surface.removeEventListener("pointercancel", up);
      surface.removeEventListener("webglcontextlost", lost);
      release(scene);
      if (renderer instanceof T.WebGLRenderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      surface.remove();
    },
  };
}
