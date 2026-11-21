import { BOARD } from "./config";
import type { BoardCameraPort, BoardCameraPose } from "./boardCamera";

/** Only input/shot invalidations read a matrix; a frame never samples the DOM. */
export function parseCameraTransform(value: string): BoardCameraPose | null {
  const match = /^matrix(3d)?\(([^)]+)\)$/.exec(value);
  if (!match) return null;
  const values = match[2].split(",").map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [scale, x, y] = match[1]
    ? [values[0], values[12], values[13]]
    : [values[0], values[4], values[5]];
  return values.length === (match[1] ? 16 : 6) && scale > 0
    ? { x, y, scale }
    : null;
}
interface CameraDomTarget {
  style: Pick<
    CSSStyleDeclaration,
    | "transformOrigin"
    | "width"
    | "height"
    | "transition"
    | "transform"
    | "setProperty"
  >;
  dataset: DOMStringMap;
}
export function cameraDomPort(
  wrapper: CameraDomTarget,
  readTransform: () => string,
): BoardCameraPort {
  const style = wrapper.style;
  style.transformOrigin = "0 0";
  style.width = `${BOARD.bounds.width}px`;
  style.height = `${BOARD.bounds.height}px`;
  const write = (pose: BoardCameraPose) => {
    style.setProperty("--board-scale", String(pose.scale));
    style.transform = `translate(${pose.x}px,${pose.y}px) scale(${pose.scale})`;
  };
  return {
    paint(pose, duration) {
      if (duration) {
        const current = parseCameraTransform(readTransform());
        if (current) {
          // Independent CSS properties can retain different timelines or use
          // different reversal shortening. Restart every changed shot from one
          // actual pose so inverse-scaled chips stay 11 px throughout the ease.
          style.transition = "none";
          write(current);
          readTransform(); // one event-only style flush before the new targets
        }
      }
      style.transition = duration
        ? `transform ${duration}ms ${BOARD.camera.ease}, --board-scale ${duration}ms ${BOARD.camera.ease}`
        : "none";
      write(pose);
    },
    capture: () => parseCameraTransform(readTransform()),
    changed(value) {
      wrapper.dataset.cameraMode = value.mode;
      wrapper.dataset.cameraZone = value.zone ?? "";
      wrapper.dataset.cameraFollow = String(value.follow);
      wrapper.dataset.cameraZoom = String(value.zoom);
    },
  };
}
export function createCameraDom(wrapper: HTMLElement) {
  return cameraDomPort(wrapper, () => getComputedStyle(wrapper).transform);
}
