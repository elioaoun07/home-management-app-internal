import * as T from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { release } from "./brain/art";
import type { OwnerStation, OwnerStationState } from "./ownerStations";
import { buildOwnerWorkshop, ownerBerths } from "./ownerRoomArt";
import { mountPatchProjection } from "./ownerPatchProjection";
import { resolveStagePalette } from "./stage/palette";

export interface OwnerWorldState {
  selected: OwnerStation;
  current: OwnerStation | null;
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
  rim: string;
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
  let palette = resolveStagePalette(host);
  if (renderer instanceof SVGRenderer) renderer.setClearColor(new T.Color(palette.bg), 1);
  const scene = new T.Scene(),
    workshop = buildOwnerWorkshop(renderer instanceof T.WebGLRenderer, palette);
  scene.add(workshop.group);
  const projectPatch =
    renderer instanceof T.WebGLRenderer
      ? mountPatchProjection(workshop.machines.get("merge")!)
      : null;
  scene.add(new T.HemisphereLight("#ffffff", "#97a3b4", 1.55));
  const sun = new T.DirectionalLight("#ffffff", 1.85);
  sun.position.set(-4, 8, 6);
  scene.add(sun);
  const rim = new T.DirectionalLight("#c6d4e5", 0.72);
  rim.position.set(7, 4, -6);
  scene.add(rim);
  const map = new T.OrthographicCamera(-8, 8, 6, -6, 0.1, 90);
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
    map.position.set(width < 550 ? 7.8 : 13.4, width < 550 ? 27 : 18.5, 22.3);
    map.lookAt(0, 0.63, 0);
    map.updateMatrixWorld();
    // Frame the complete hull at any ratio, leaving enough room for berth names.
    const halfHeight = Math.max(5.28, 8.95 / aspect);
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
        const rim = workshop.rimOutline.map(corner => {
          label.set(x + corner.x, 0.19, z - corner.y).project(map);
          return `${(label.x + 1) * 50},${(1 - label.y) * 50}`;
        }).join(" ");
        label.set(x, width < 550 ? 0.41 : 0.13, z + 1.46).project(map);
        return { id, x: (label.x + 1) * 50, y: (1 - label.y) * 50, rim };
      }),
    );
    invalidate();
  }
  function apply(next: OwnerWorldState) {
    state = next;
    projectPatch?.(next.selected === "merge" ? next.patch : null, width < 550);
    workshop.currentRim.visible = next.current !== null;
    if (next.current) {
      const [x, z] = ownerBerths[next.current];
      workshop.currentRim.position.set(x, 0.15, z);
    }
    for (const id of ids) {
      const status = next.signals[id];
      workshop.lamps
        .get(id)!
        .color.set(
          id === next.current
            ? palette.emissive
            : status === "done"
              ? palette.ok
              : status === "stopped"
                ? palette.warn
                : palette.trim.top,
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
  const theme = new MutationObserver(() => {
    const next = resolveStagePalette(host);
    if (next.top === palette.top && next.emissive === palette.emissive && next.bg === palette.bg) return;
    palette = next;
    if (renderer instanceof SVGRenderer) renderer.setClearColor(new T.Color(next.bg), 1);
    workshop.setPalette(next);
    apply(state);
  });
  for (let node: HTMLElement | null = host; node; node = node.parentElement) {
    theme.observe(node, { attributes: true, attributeFilter: ["data-theme", "data-color", "class", "style"] });
  }
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
      theme.disconnect();
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
