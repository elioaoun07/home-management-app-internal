import { BOARD, ZONE_BY_ID, type ZoneId } from "./config";
import { project } from "./iso";
import type { FreeRectangle } from "./camera";
import { createCameraDom } from "./cameraDom";
export { parseCameraTransform } from "./cameraDom";

export type BoardCameraMode = "overview" | "follow" | "inspect";
export type ZoomBucket = (typeof BOARD.camera.zoomBuckets)[number];
export interface BoardCameraPose {
  x: number;
  y: number;
  scale: number;
}
export interface BoardCameraObservation {
  nowMs: number;
  rowAgeMs: number | null;
  stagedZone: ZoneId | null;
  closed: boolean;
  frozen: boolean;
  reducedMotion: boolean;
}
export interface BoardCameraSettled {
  mode: BoardCameraMode;
  zone: ZoneId | null;
  zoom: number;
  bucket: ZoomBucket;
  pose: BoardCameraPose;
}
export interface BoardCameraOptions {
  now?: () => number;
  onSettled?: (value: BoardCameraSettled) => void;
}
export interface BoardCameraPort {
  paint(pose: BoardCameraPose, durationMs: number): void;
  capture(): BoardCameraPose | null;
  changed?(value: {
    mode: BoardCameraMode;
    zone: ZoneId | null;
    follow: boolean;
    zoom: number;
  }): void;
}

export function cameraOverview(rectangle: FreeRectangle): BoardCameraPose {
  const scale = Math.max(
    0.05,
    Math.min(
      (rectangle.width - BOARD.margin * 2) / BOARD.bounds.width,
      (rectangle.height - BOARD.margin * 2) / BOARD.bounds.height,
    ),
  );
  return {
    x: rectangle.x + (rectangle.width - BOARD.bounds.width * scale) / 2,
    y: rectangle.y + (rectangle.height - BOARD.bounds.height * scale) / 2,
    scale,
  };
}
export function cameraZonePose(
  zone: ZoneId,
  scale: number,
  rectangle: FreeRectangle,
): BoardCameraPose {
  const pad = ZONE_BY_ID[zone].pad;
  const point = project(
    pad.x + pad.width / 2,
    pad.y + pad.depth / 2,
    BOARD.pad.raise,
  );
  return {
    x: rectangle.x + rectangle.width / 2 - (point.x - BOARD.bounds.x) * scale,
    y: rectangle.y + rectangle.height / 2 - (point.y - BOARD.bounds.y) * scale,
    scale,
  };
}
export function cameraFollowPose(
  zone: ZoneId,
  regionWidth: number,
  rectangle: FreeRectangle,
) {
  const pad = ZONE_BY_ID[zone].pad;
  return cameraZonePose(
    zone,
    (regionWidth * BOARD.camera.followWidth) / (pad.width + pad.depth),
    rectangle,
  );
}
export function cameraZoomBucket(zoom: number): ZoomBucket {
  const buckets = BOARD.camera.zoomBuckets;
  return zoom < (buckets[0] + buckets[1]) / 2
    ? buckets[0]
    : zoom < (buckets[1] + buckets[2]) / 2
      ? buckets[1]
      : buckets[2];
}
const samePose = (a: BoardCameraPose, b: BoardCameraPose) =>
  Math.abs(a.x - b.x) < 0.000001 &&
  Math.abs(a.y - b.y) < 0.000001 &&
  Math.abs(a.scale - b.scale) < 0.000001;

/** Existing factual ticks choose shots. CSS performs the ease; no RAF lives here. */
export function createBoardCameraController(
  port: BoardCameraPort,
  options: BoardCameraOptions = {},
) {
  const now = options.now ?? (() => performance.now());
  let width = 1,
    height = 1;
  let rectangle: FreeRectangle = { x: 0, y: 0, width, height };
  let pose: BoardCameraPose = { x: 0, y: 0, scale: 1 };
  let mode: BoardCameraMode = "overview",
    zone: ZoneId | null = null;
  let inspectZone: ZoneId | null = null,
    stagedZone: ZoneId | null = null,
    inspectFit = 1,
    follow = true;
  let dragging = false,
    panned = false,
    manual = false,
    manualUntil = 0;
  let hasViewport = false,
    initialized = false,
    disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let observation: BoardCameraObservation = {
    nowMs: now(),
    rowAgeMs: null,
    stagedZone: null,
    closed: false,
    frozen: false,
    reducedMotion: false,
  };
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const receipt = (): BoardCameraSettled => {
    const zoom = pose.scale / cameraOverview(rectangle).scale;
    return {
      mode,
      zone,
      zoom,
      bucket: cameraZoomBucket(zoom),
      pose: { ...pose },
    };
  };
  let published: {
    mode: BoardCameraMode;
    zone: ZoneId | null;
    follow: boolean;
    zoom: number;
  } | null = null;
  const publish = () => {
    const value = { mode, zone, follow, zoom: receipt().zoom };
    if (
      !published ||
      value.mode !== published.mode ||
      value.zone !== published.zone ||
      value.follow !== published.follow ||
      Math.abs(value.zoom - published.zoom) > 0.000001
    ) {
      published = value;
      port.changed?.(value);
    }
  };
  const paint = (
    next: BoardCameraPose,
    nextMode: BoardCameraMode,
    nextZone: ZoneId | null,
    animate = true,
    force = false,
  ) => {
    mode = nextMode;
    zone = nextZone;
    if (!force && initialized && samePose(pose, next)) {
      publish();
      return;
    }
    cancel();
    const duration =
      initialized && animate && !observation.reducedMotion
        ? BOARD.camera.transitionMs
        : 0;
    pose = { ...next };
    initialized = true;
    port.paint({ ...pose }, duration);
    publish();
    if (duration === 0) options.onSettled?.(receipt());
    else
      timer = setTimeout(() => {
        timer = null;
        if (!disposed && !observation.frozen) options.onSettled?.(receipt());
      }, duration);
  };
  const capture = () => {
    cancel();
    pose = port.capture() ?? pose;
    port.paint({ ...pose }, 0);
    publish();
  };
  const choose = (at = now(), animate = true) => {
    if (disposed || observation.frozen) return;
    if (dragging) return;
    if (inspectZone) {
      if (!manual)
        paint(
          cameraZonePose(
            inspectZone,
            inspectFit * BOARD.camera.inspectZoom,
            rectangle,
          ),
          "inspect",
          inspectZone,
          animate,
        );
      return;
    }
    if (!follow) {
      if (!manual) paint(cameraOverview(rectangle), "overview", null, animate);
      return;
    }
    if (at < manualUntil) return;
    manual = false;
    if (
      observation.closed ||
      observation.rowAgeMs === null ||
      observation.rowAgeMs >= BOARD.camera.idleMs ||
      !stagedZone
    )
      paint(cameraOverview(rectangle), "overview", null, animate);
    else
      paint(
        cameraFollowPose(stagedZone, width, rectangle),
        "follow",
        stagedZone,
        animate,
      );
  };
  const overview = () => {
    if (disposed || observation.frozen) return;
    follow = false;
    inspectZone = null;
    manual = false;
    choose();
  };
  return {
    resize(
      w: number,
      h: number,
      free: FreeRectangle = { x: 0, y: 0, width: w, height: h },
    ) {
      if (disposed || !(w > 0 && h > 0 && free.width > 0 && free.height > 0))
        return;
      const firstViewport = !hasViewport;
      hasViewport = true;
      const viewportChanged = width !== w || height !== h;
      width = w;
      height = h;
      rectangle = { ...free };
      if (firstViewport && observation.frozen) {
        // An unavailable first visit has no fitted pose to preserve yet.
        // Compose its one Overview cut; initial engine allocation paints it.
        cancel();
        pose = cameraOverview(rectangle);
        mode = "overview";
        zone = null;
        inspectZone = null;
        manual = false;
        initialized = true;
        port.paint({ ...pose }, 0);
        publish();
        return;
      }
      if (viewportChanged && inspectZone)
        inspectFit = cameraOverview(rectangle).scale;
      choose(now(), !viewportChanged);
      publish();
    },
    observe(next: BoardCameraObservation) {
      if (disposed) return;
      const previous = observation;
      observation = { ...next };
      if (!previous.closed && next.closed) {
        inspectZone = null;
        manual = false;
        dragging = false;
        manualUntil = 0;
      }
      if (
        next.closed ||
        next.rowAgeMs === null ||
        next.rowAgeMs >= BOARD.camera.idleMs
      )
        stagedZone = null;
      else if (next.stagedZone) stagedZone = next.stagedZone;
      if (next.frozen) {
        if (!previous.frozen) capture();
        return;
      }
      if (next.reducedMotion && !previous.reducedMotion && timer !== null)
        paint(pose, mode, zone, false, true);
      choose(next.nowMs);
    },
    inspect(id: ZoneId) {
      if (disposed || observation.frozen) return;
      inspectZone = id;
      inspectFit = cameraOverview(rectangle).scale;
      follow = false;
      manual = false;
      choose();
    },
    overview,
    reset: overview,
    toggleFollow() {
      if (disposed || observation.frozen) return follow;
      follow = !follow;
      inspectZone = null;
      manual = false;
      choose();
      publish();
      return follow;
    },
    beginDrag() {
      if (disposed || observation.frozen || dragging) return;
      capture();
      dragging = true;
      panned = false;
    },
    pan(dx: number, dy: number) {
      if (disposed || observation.frozen) return;
      if (!dragging && !manual) capture();
      manual = true;
      panned = true;
      manualUntil = now() + BOARD.camera.manualHoldMs;
      paint({ ...pose, x: pose.x + dx, y: pose.y + dy }, mode, zone, false);
    },
    endDrag() {
      if (disposed) return;
      const wasDragging = dragging;
      dragging = false;
      if (panned) manualUntil = now() + BOARD.camera.manualHoldMs;
      panned = false;
      if (wasDragging && !observation.frozen && initialized)
        options.onSettled?.(receipt());
    },
    zoom(delta: number) {
      if (disposed || observation.frozen) return;
      capture();
      manual = true;
      manualUntil = now() + BOARD.camera.manualHoldMs;
      const fit = cameraOverview(rectangle).scale,
        current = pose.scale / fit;
      const zoom = Math.max(
        BOARD.camera.minZoom,
        Math.min(
          Math.max(BOARD.camera.maxZoom, current),
          current * Math.exp(-delta * 0.001),
        ),
      );
      const scale = fit * zoom,
        ratio = scale / pose.scale;
      const x = rectangle.x + rectangle.width / 2,
        y = rectangle.y + rectangle.height / 2;
      paint(
        { x: x - (x - pose.x) * ratio, y: y - (y - pose.y) * ratio, scale },
        mode,
        zone,
        false,
      );
    },
    scale: () => pose.scale,
    target: () => ({ ...pose }),
    mode: () => mode,
    settling: () => timer !== null,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}

/** The DOM adapter writes only when a shot or owner input invalidates the pose. */
export function createBoardCamera(
  wrapper: HTMLElement,
  options: BoardCameraOptions = {},
) {
  return createBoardCameraController(createCameraDom(wrapper), options);
}
