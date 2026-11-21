import { createBoardCamera, freeRectangle } from "./camera";
import { TIMING, ZONE_IDS, type ZoneId } from "./config";
import type { BoardCameraObservation, ZoomBucket } from "./boardCamera";

/** DOM measurements and input stay outside the single motion callback. */
export function createEngineCamera(
  root: HTMLElement,
  wrapper: HTMLElement,
  onBucket: (bucket: ZoomBucket) => void,
) {
  let disposed = false,
    frozen = false,
    dragging = false;
  let lastPointer = { x: 0, y: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const camera = createBoardCamera(wrapper, {
    onSettled(value) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed && !frozen && !camera.settling()) onBucket(value.bucket);
      }, TIMING.resize);
    },
  });
  const pointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (
      frozen ||
      event.button !== 0 ||
      !target.closest(".board-region") ||
      target.closest(
        "button,a,input,.board-zone-chip,.board-comms,.board-telemetry,.board-readouts",
      )
    )
      return;
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    camera.beginDrag();
    root.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!dragging || frozen) return;
    camera.pan(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
    lastPointer = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = () => {
    if (!dragging) return;
    dragging = false;
    camera.endDrag();
  };
  const wheel = (event: WheelEvent) => {
    if (
      frozen ||
      !(event.target as HTMLElement).closest(".board-region") ||
      (event.target as HTMLElement).closest(".board-readouts")
    )
      return;
    const page = document.scrollingElement;
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      page &&
      page.scrollHeight > window.innerHeight + 1
    )
      return;
    event.preventDefault();
    camera.zoom(event.deltaY);
  };
  const click = (event: MouseEvent) => {
    if (frozen) return;
    const zone = (event.target as Element).closest<HTMLElement>(
      ".board-zone,.board-zone-name",
    )?.dataset.zone;
    if (zone && ZONE_IDS.includes(zone as ZoneId))
      camera.inspect(zone as ZoneId);
  };
  const keydown = (event: KeyboardEvent) => {
    if (
      disposed ||
      frozen ||
      !root.isConnected ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.target instanceof Element &&
        event.target.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=dialog],.board-settings-panel",
        ))
    )
      return;
    if (event.key === "0" || event.key === "Escape") {
      // Escape also closes the existing React drawer; preserve its key event.
      if (event.key === "0") event.preventDefault();
      camera.overview();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      camera.toggleFollow();
    }
  };
  root.addEventListener("pointerdown", pointerDown);
  root.addEventListener("pointermove", pointerMove);
  root.addEventListener("pointerup", pointerUp);
  root.addEventListener("pointercancel", pointerUp);
  root.addEventListener("wheel", wheel, { passive: false });
  root.addEventListener("click", click);
  document.addEventListener("keydown", keydown);
  return {
    observe(value: BoardCameraObservation) {
      frozen = value.frozen;
      if (frozen && timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      camera.observe(value);
    },
    resize(width: number, height: number) {
      const region = root
        .querySelector<HTMLElement>(".board-region")!
        .getBoundingClientRect();
      const obstacles = [
        ...root.querySelectorAll<HTMLElement>(
          ".board-comms:not([hidden]),.board-telemetry,.board-replay-strip,.board-console-drawer[open],.board-console-drawer > summary,.board-rail,.board-readouts",
        ),
      ].flatMap((node) => {
        const r = node.getBoundingClientRect();
        return r.width && r.height
          ? [
              {
                x: r.left - region.left,
                y: r.top - region.top,
                width: r.width,
                height: r.height,
              },
            ]
          : [];
      });
      camera.resize(width, height, freeRectangle(width, height, obstacles));
    },
    overview: () => camera.overview(),
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      camera.dispose();
      root.removeEventListener("pointerdown", pointerDown);
      root.removeEventListener("pointermove", pointerMove);
      root.removeEventListener("pointerup", pointerUp);
      root.removeEventListener("pointercancel", pointerUp);
      root.removeEventListener("wheel", wheel);
      root.removeEventListener("click", click);
      document.removeEventListener("keydown", keydown);
    },
  };
}
