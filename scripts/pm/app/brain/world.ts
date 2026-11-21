import * as T from "three";
export { createLibraryWorld } from "../libraryWorld";
import { canStand, chair, spawn, stations, type Area } from "./layout";
import { makeRoom, makeSphere, release } from "./art";
import { chamberReflections } from "./chamber";
import { roomRenderBudget } from "./renderBudget";
import { ambientRegion } from "./ambientRegion";
import { stillFrame } from "./stillFrame";
import { motionAntialias } from "./motionAntialias";
import { createIllumination } from "./illumination";
import { advanceGait, advanceWalk, maxNavigationElapsed, movementKey, restingGait } from "./navigation";
import { createRoomProfiler } from "./profiler";
import { createRoomSound } from "./sound";
import { applySoftwareLighting } from "./softwareLighting";
import type { Pose, Presence, Signal, Target, WorldApi, WorldControls, WorldState } from "./protocol";

const standEye = 1.65;
const mouseSensitivity = .0025;

type Drag = { id: number; x: number; y: number; travel: number; paired: boolean };

let lastDeviceWasSoftware = false;

function openRoomRenderer() {
  const options = { alpha: false, powerPreference: "high-performance" as const };
  let renderer = new T.WebGLRenderer({ ...options, antialias: !lastDeviceWasSoftware, preserveDrawingBuffer: lastDeviceWasSoftware, stencil: lastDeviceWasSoftware });
  const gl = renderer.getContext(), device = gl.getExtension("WEBGL_debug_renderer_info");
  const software = !!device && /swiftshader|llvmpipe|software rasterizer|basic render driver/i.test(gl.getParameter(device.UNMASKED_RENDERER_WEBGL));
  // Antialiasing is a creation-only context option. CPU drivers rasterize
  // every MSAA sample in software. Negotiate once before attaching the canvas.
  if (software && !gl.getContextAttributes()?.preserveDrawingBuffer) {
    renderer.dispose();
    renderer.forceContextLoss();
    // Request packed depth/stencil explicitly. On ANGLE a depth-only default
    // surface still uses packed storage; a depth-only blit would be rejected.
    renderer = new T.WebGLRenderer({ ...options, antialias: false, preserveDrawingBuffer: true, stencil: true });
  }
  lastDeviceWasSoftware = software;
  return { renderer, software };
}

export function createWorld(host: HTMLElement, input: WorldControls, initial: WorldState): WorldApi {
  const { renderer, software } = openRoomRenderer();
  input.softwareRenderer?.(software);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  host.append(renderer.domElement);
  const profiler = createRoomProfiler(host, renderer);
  renderer.info.autoReset = false;
  const budget = roomRenderBudget(software);

  const scene = new T.Scene(), room = makeRoom(invalidate, software);
  const reflections = software ? null : chamberReflections();
  scene.environment = reflections;
  scene.environmentIntensity = .43;
  scene.add(room.outer, room.inner, room.light, room.key, room.warm);
  if (software) {
    applySoftwareLighting(room.outer);
    applySoftwareLighting(room.inner);
  }
  const camera = new T.PerspectiveCamera(65, 1, .08, 63);
  camera.rotation.order = "YXZ";
  const illumination = createIllumination(scene, room);
  const still = software ? stillFrame(renderer.getContext() as WebGL2RenderingContext) : null;
  const antialias = software ? motionAntialias(renderer) : null;
  const opticalLayer = 1;
  const opticalObjects: T.Object3D[] = [...illumination.opticalObjects, ...room.faultCable.opticalObjects];
  if (software) {
    room.outer.traverse(node => {
      if (node instanceof T.Mesh && node.material === room.receiver) opticalObjects.push(node);
    });
    for (const object of opticalObjects) object.layers.enable(opticalLayer);
    scene.traverse(node => { if (node instanceof T.Light) node.layers.enable(opticalLayer); });
  }

  let state = initial, area: Area = "room", pose: Pose = { ...spawn };
  let interiorPose: Pose = { ...pose }, savedRoom: Pose = { ...pose };
  let resumeCore = false, enteredCore = false;
  let sphere = makeSphere(state.topic, state.finish === "illustrated", software);
  if (software) sphere.orb.traverse(node => node.layers.enable(opticalLayer));
  scene.add(sphere.orb);
  let presence: Presence = { target: null, zone: null, area };
  let disposed = false, visible = true, frame = 0, last = 0, renderNeeded = true;
  let transition: { start: number; position: T.Vector3; rotation: T.Quaternion } | null = null;
  let latestSignal = initial.signal?.id ?? null;
  let faultWake = 0;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const clean = new AbortController(), opts = { signal: clean.signal };
  const sound = createRoomSound(host, clean.signal);
  const held = new Set<string>(), pad = { x: 0, y: 0, sprint: false };
  const velocity = { x: 0, z: 0 }, lookDelta = { yaw: 0, pitch: 0 };
  const gait = restingGait();
  const drags: Partial<Record<"move" | "look", Drag>> = {};
  let askHeld = false, lockPending = false;

  function palette() {
    const style = getComputedStyle(host);
    const theme = new T.Color(style.getPropertyValue("--theme-bg").trim() || "#0a1628");
    const illustrated = state.finish === "illustrated";
    const blend = (base: string, amount: number) => new T.Color(base).lerp(theme, amount);
    scene.background = blend(illustrated ? "#15163b" : "#0b1722", .64);
    scene.fog = new T.Fog(scene.background, 23, 55);
    room.materials.hull.color.copy(blend(illustrated ? "#515998" : "#4b5156", .16));
    room.materials.floor.color.copy(blend(illustrated ? "#8793cb" : "#929fa7", .17));
    room.materials.panel.color.copy(blend(illustrated ? "#7376b9" : "#64727b", .14));
    room.materials.bevel.color.set(illustrated ? "#d09f70" : "#8a9fae");
    room.materials.pale.color.set(illustrated ? "#f1d7a1" : "#c0cdd9");
    room.light.intensity = illustrated ? 1.12 : .60;
    room.key.intensity = illustrated ? 1.45 : 1.55;
    room.warm.intensity = illustrated ? .47 : .32;
    for (const material of Object.values(room.materials)) {
      material.roughness = illustrated ? .77 : .48;
    }
    room.materials.bevel.metalness = illustrated ? .35 : .79;
    room.materials.hull.metalness = illustrated ? .26 : .64;
    room.materials.floor.metalness = illustrated ? .21 : .49;
    room.materials.floor.roughness = illustrated ? .74 : .51;
    room.materials.panel.metalness = illustrated ? .20 : .50;
    invalidate();
  }

  const position = new T.Vector3(), direction = new T.Vector3(), targetRotation = new T.Quaternion();
  const euler = new T.Euler(0, 0, 0, "YXZ");
  const goal = new T.PerspectiveCamera();
  const standLook = (target: T.Vector3) => {
    pose.yaw = Math.atan2(pose.x - target.x, pose.z - target.z);
    pose.pitch = Math.atan2(target.y - standEye, Math.hypot(target.x - pose.x, target.z - pose.z));
  };

  function wantCamera() {
    if (state.view === "map" && area === "room") {
      goal.position.set(0, 19.6, 14.8);
      goal.lookAt(0, .24, -.45);
      position.copy(goal.position); targetRotation.copy(goal.quaternion);
    } else if (state.view === "seat") {
      position.set(chair.x, 1.15, chair.z);
      goal.position.copy(position); goal.lookAt(0, 2.02, 0);
      targetRotation.copy(goal.quaternion);
    } else {
      position.set(pose.x + Math.cos(pose.yaw) * gait.sway, standEye + gait.lift, pose.z - Math.sin(pose.yaw) * gait.sway);
      targetRotation.setFromEuler(euler.set(pose.pitch, pose.yaw, 0));
    }
  }
  function moveCamera(now: number) {
    wantCamera();
    const fov = baseFov + (state.view === "walk" ? gait.sprint * 3.5 : 0);
    if (Math.abs(camera.fov - fov) > .015 || !gait.sprint && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (transition) {
      const f = state.quiet || motion.matches ? 1 : Math.min(1, (now - transition.start) / 430);
      const ease = f * f * (3 - 2 * f);
      camera.position.copy(transition.position).lerp(position, ease);
      camera.quaternion.copy(transition.rotation).slerp(targetRotation, ease);
      if (f === 1) transition = null;
    } else {
      camera.position.copy(position); camera.quaternion.copy(targetRotation);
    }
  }

  function removeDrag(side: "move" | "look") {
    const drag = drags[side];
    if (!drag) return;
    delete drags[side];
    if (side === "move") {
      pad.x = 0; pad.y = 0; pad.sprint = false;
      delete host.dataset.thumb;
    }
    if (host.hasPointerCapture(drag.id)) host.releasePointerCapture(drag.id);
  }

  function resetInputs() {
    sound.silence();
    held.clear();
    askHeld = false;
    removeDrag("move"); removeDrag("look");
    velocity.x = 0; velocity.z = 0;
    lookDelta.yaw = 0; lookDelta.pitch = 0;
    Object.assign(gait, restingGait());
    last = 0;
    invalidate();
  }
  function clear() {
    resetInputs();
    if (document.pointerLockElement === host) document.exitPointerLock();
  }

  const active = () => state.view === "walk" && !state.paused && document.visibilityState !== "hidden";
  const navigationActive = () => active() && (
    (held.size > Number(held.has("ShiftLeft")) + Number(held.has("ShiftRight"))) ||
    pad.x !== 0 || pad.y !== 0 || velocity.x !== 0 || velocity.z !== 0 ||
    lookDelta.yaw !== 0 || lookDelta.pitch !== 0 || gait.weight !== 0
  );
  function walk(dt: number) {
    const spin = Number(held.has("arrowleft")) - Number(held.has("arrowright"));
    const tilt = Number(held.has("arrowup")) - Number(held.has("arrowdown"));
    const turnTime = dt <= maxNavigationElapsed ? dt : 0;
    pose.yaw += lookDelta.yaw + spin * turnTime * 1.4;
    pose.pitch = T.MathUtils.clamp(pose.pitch + lookDelta.pitch + tilt * turnTime * 1.4, -1.40, 1.40);
    lookDelta.yaw = 0; lookDelta.pitch = 0;
    const forward = Number(held.has("w")) - Number(held.has("s")) - pad.y;
    const side = Number(held.has("d")) - Number(held.has("a")) + pad.x;
    const sprint = held.has("ShiftLeft") || held.has("ShiftRight") || pad.sprint;
    const distance = forward || side || velocity.x || velocity.z
      ? advanceWalk(pose, velocity, area, forward, side, dt, sprint) : 0;
    sound.travel(distance, dt);
    if (!state.quiet && !motion.matches) advanceGait(gait, distance, dt);
  }

  async function captureMouse() {
    if (!active() || disposed || !visible || lockPending || !host.requestPointerLock || document.pointerLockElement) return;
    host.focus({ preventScroll: true });
    lockPending = true;
    try {
      await host.requestPointerLock({ unadjustedMovement: true });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotSupportedError" && active() && !disposed) {
        try { await host.requestPointerLock(); } catch { /* Drag look remains active. */ }
      }
    } finally {
      lockPending = false;
      if ((!active() || !visible || disposed || document.activeElement !== host) && document.pointerLockElement === host)
        document.exitPointerLock();
    }
  }

  function aim(yaw: number, pitch: number) {
    lookDelta.yaw += yaw; lookDelta.pitch += pitch;
    transition = null;
    invalidate();
  }

  let locatedView: WorldState["view"] | null = null;
  const locatedPosition = new T.Vector3(), locatedRotation = new T.Quaternion();
  const publishedPose = { x: NaN, z: NaN, yaw: NaN, pitch: NaN };
  let poseText = "";
  function locate() {
    if (pose.x !== publishedPose.x || pose.z !== publishedPose.z ||
        pose.yaw !== publishedPose.yaw || pose.pitch !== publishedPose.pitch) {
      Object.assign(publishedPose, pose);
      const text = `${pose.x.toFixed(3)},${pose.z.toFixed(3)},${pose.yaw.toFixed(3)},${pose.pitch.toFixed(3)}`;
      if (text !== poseText) { poseText = text; host.dataset.pose = text; }
    }
    if (locatedView === state.view && presence.area === area &&
        locatedPosition.equals(camera.position) && locatedRotation.equals(camera.quaternion)) return;
    locatedView = state.view;
    locatedPosition.copy(camera.position); locatedRotation.copy(camera.quaternion);
    let target: Target | null = null, zone: Presence["zone"] = null;
    if (state.view === "walk") {
      let nearest = Infinity, forward = .83;
      camera.getWorldDirection(direction);
      for (const station of stations) {
        if (area !== "room") break;
        const d = Math.hypot(pose.x - station.x, pose.z - station.z);
        if (d < nearest && d < 3.25) { nearest = d; zone = station.id; }
      }
      for (const [key, marker] of room.markers) {
        if ((["previous", "present", "next", "exit"].includes(key)) !== (area === "core")) continue;
        const offset = position.copy(marker).sub(camera.position);
        const range = key === "core" ? 2.0 : 2.2;
        if (offset.lengthSq() > range * range) continue;
        const dot = offset.normalize().dot(direction);
        if (dot > forward) { target = key; forward = dot; }
      }
      if (!target && area === "room" && Math.hypot(pose.x, pose.z - 2.48) < 1.65) target = "core";
    }
    if (presence.target !== target || presence.area !== area || presence.zone !== zone) {
      presence = { area, target, zone }; input.presence(presence);
    }
  }

  function moveToView(previousView: WorldState["view"]) {
    clear();
    const overheadCut = state.view === "map" || previousView === "map";
    const distantSeat = Math.hypot(pose.x - chair.x, pose.z - chair.z) > 2.6;
    transition = state.quiet || motion.matches || overheadCut || distantSeat ? null : {
      start: performance.now(), position: camera.position.clone(), rotation: camera.quaternion.clone(),
    };
    invalidate();
  }

  const canAnimate = () => !state.paused && !state.quiet && !motion.matches;
  const roomAlive = () => canAnimate() && (!state.lighting.failed || (area === "room" && !!state.lighting.faultZone));
  function paintSignal(signal: Signal) {
    if (!state.lighting.failed && area === "room" && canAnimate() && visible && !document.hidden) {
      illumination.play(signal, performance.now());
    }
    invalidate();
  }

  function paint(now: number) {
    sound.position(pose, state.lighting.energy, state.lighting.working,
      active() && visible && document.hasFocus() && !state.replay && !state.quiet && !motion.matches);
    for (const wall of room.cutaway) wall.visible = state.view !== "map";
    room.marker.visible = state.view === "map";
    room.marker.position.set(pose.x, .11, pose.z);
    room.marker.rotation.z = pose.yaw;
    const working = state.lighting.working && (!state.replay || state.playing);
    illumination.paint(now, state, sphere, area, canAnimate(), canAnimate() && working);
  }

  let bufferWidth = 0, bufferHeight = 0, sizeDirty = true, baseFov = 65;
  let appliedScale = 0, lastMotionAt = -Infinity, wasMoving = false, wasFlying = false;
  let lastSteady = false;
  const damage = ambientRegion();
  const noPath: readonly T.Vector3[] = [];
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    budget.resize(width, height, devicePixelRatio);
    sizeDirty ||= width !== bufferWidth || height !== bufferHeight;
    bufferWidth = width; bufferHeight = height;
    baseFov = state.view === "map" && width < height ? 78 : 65;
    const aspect = width / height;
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }

  function schedule() {
    if (faultWake) { window.clearTimeout(faultWake); faultWake = 0; }
    if (!frame && visible && !disposed && document.visibilityState !== "hidden")
      frame = requestAnimationFrame(tick);
  }
  function invalidate() {
    renderNeeded = true;
    schedule();
  }
  function tick(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const frameStart = profiler?.recording ? performance.now() : 0;
    const dt = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    const moving = navigationActive();
    if (moving) walk(dt);
    if (moving || transition) lastMotionAt = now;
    // Avoid resizing on every brief key release or mouse event. The final
    // frame after travel always reaches the display's resting resolution.
    const motionFrame = now - lastMotionAt < 260;
    const refined = !motionFrame && wasMoving;
    if (renderNeeded || moving || illumination.flying || transition || roomAlive() || refined) {
      const invalidated = renderNeeded;
      renderNeeded = false;
      if (motionFrame && wasMoving) budget.sample(dt * 1000, profiler?.gpuMs);
      const scale = motionFrame && !state.nativeMotion ? budget.scale : budget.restingScale;
      if (profiler?.recording) {
        profiler.display.mode = motionFrame ? "moving" : "settled";
        profiler.display.movementScale = motionFrame ? scale : budget.scale;
        profiler.display.refinedScale = budget.restingScale;
      }
      const resized = sizeDirty || scale !== appliedScale;
      // Resizing a WebGL canvas clears it. Allocate and paint in the same
      // animation frame, including on window resize and quality changes.
      if (resized && bufferWidth && bufferHeight) {
        renderer.setDrawingBufferSize(bufferWidth, bufferHeight, scale);
        appliedScale = scale;
        sizeDirty = false;
      }
      moveCamera(now);
      locate();
      paint(now);
      const renderStart = profiler?.recording ? performance.now() : 0;
      const activePath = state.lighting.failed ? room.faultCable.damagePath : state.lighting.endpoint === "seat" ? room.seatCircuit.path :
        state.lighting.endpoint ? room.circuits.get(state.lighting.endpoint)?.path : undefined;
      const cached = !!still?.supported && !motionFrame && !illumination.flying && illumination.steady && roomAlive();
      if (!cached || invalidated || resized || wasFlying || lastSteady !== illumination.steady) still?.invalidate();
      renderer.info.reset();
      profiler?.beginRender();
      const rebuild = cached && !!still && !still.valid;
      if (rebuild && still) {
        const movingObjects = [sphere.orb, ...opticalObjects].filter(object => object.visible);
        for (const object of movingObjects) object.visible = false;
        renderer.render(scene, camera);
        still.store();
        for (const object of movingObjects) object.visible = true;
      }
      if (cached && still?.valid) {
        const w = renderer.domElement.width, h = renderer.domElement.height;
        const region = damage(camera, w, h, sphere.orb.position, area === "core" ? .96 : 2.06, area === "room" ? activePath ?? noPath : noPath)
          ?? { x: 0, y: 0, width: w, height: h };
        if (region.width && region.height) {
          const bottom = h - region.y - region.height;
          still.restore(region.x, bottom, region.width, region.height);
          const background = scene.background;
          scene.background = null;
          renderer.autoClear = false;
          camera.layers.set(opticalLayer);
          if (state.nativeMotion) {
            const dpr = renderer.getPixelRatio();
            renderer.setScissor(region.x / dpr, bottom / dpr, region.width / dpr, region.height / dpr);
            renderer.setScissorTest(true);
          }
          renderer.render(scene, camera);
          if (state.nativeMotion) renderer.setScissorTest(false);
          camera.layers.set(0);
          renderer.autoClear = true;
          scene.background = background;
          if (state.nativeMotion && !rebuild) antialias?.drawNative(region.x, bottom, region.width, region.height);
        }
        if (state.nativeMotion && rebuild) antialias?.drawNative();
      } else {
        renderer.render(scene, camera);
        if (state.nativeMotion) antialias?.drawNative();
        else if (motionFrame) antialias?.draw();
      }
      if (profiler?.recording) profiler.display.cachedRoom = cached && !!still?.valid;
      profiler?.finishFrame(now, frameStart, renderStart, profiler.recording ? performance.now() : 0);
      lastSteady = illumination.steady;
      wasFlying = illumination.flying;
    }
    wasMoving = motionFrame;
    if (renderNeeded || motionFrame || illumination.flying || transition) schedule();
    else if (roomAlive()) {
      const delay = state.lighting.failed ? room.faultCable.nextWake(now / 1000) : 0;
      if (delay === 0) schedule();
      else if (Number.isFinite(delay)) {
        last = 0;
        faultWake = window.setTimeout(schedule, Math.max(12, Math.ceil(delay * 1000)));
      }
    } else { last = 0; budget.resetTiming(); }
  }

  function suspend() {
    window.clearTimeout(faultWake); faultWake = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    clear();
    illumination.clear();
    illumination.resetClock();
    budget.resetTiming();
  }

  function clickMap(event: PointerEvent) {
    const bounds = host.getBoundingClientRect();
    let nearest: Target | null = null, distance = 31;
    for (const [id, marker] of room.markers) {
      if (id === "core" || ["previous", "next", "present", "exit"].includes(id)) continue;
      const where = marker.clone().project(camera);
      const d = Math.hypot((where.x + 1) * bounds.width / 2 - (event.clientX - bounds.left), (1 - where.y) * bounds.height / 2 - (event.clientY - bounds.top));
      if (d < distance) { nearest = id; distance = d; }
    }
    if (nearest) input.inspect(nearest);
  }

  host.addEventListener("keydown", event => {
    if (state.paused || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!event.repeat && active()) sound.activate();
    if (event.key === "Escape" && document.pointerLockElement === host) {
      clear();
      return;
    }
    if (event.code === "KeyQ") {
      event.preventDefault();
      if (!event.repeat) askHeld = true;
      return;
    }
    if (!active()) return;
    if (event.code === "KeyE" && presence.target && !event.repeat) {
      event.preventDefault(); input.inspect(presence.target); return;
    }
    const action = movementKey(event.code, event.key);
    if (action) {
      event.preventDefault();
      if (event.repeat && !held.has(action)) return;
      transition = null;
      held.add(action); invalidate();
    }
  }, opts);
  host.addEventListener("keyup", event => {
    held.delete(movementKey(event.code, event.key));
    if (event.code === "KeyQ" && askHeld) {
      askHeld = false;
      if (!state.paused && !event.altKey && !event.metaKey && !event.ctrlKey) input.ask();
    }
  }, opts);
  host.addEventListener("pointerdown", event => {
    if (event.button !== 0 || state.paused) return;
    if (active()) sound.activate();
    host.focus({ preventScroll: true });
    if (state.view === "map") { clickMap(event); return; }
    if (!active()) return;
    if (document.pointerLockElement === host) {
      if (presence.target) input.inspect(presence.target);
      return;
    }
    const bounds = host.getBoundingClientRect();
    const side = event.pointerType === "touch" && event.clientX < bounds.left + bounds.width * .45 ? "move" : "look";
    if (drags[side]) return;
    const other = drags[side === "move" ? "look" : "move"];
    if (other) other.paired = true;
    drags[side] = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0, paired: !!other };
    if (side === "move") {
      host.style.setProperty("--stick-x", (event.clientX - bounds.left) + "px");
      host.style.setProperty("--stick-y", (event.clientY - bounds.top) + "px");
      host.style.setProperty("--stick-dx", "0px");
      host.style.setProperty("--stick-dy", "0px");
      host.dataset.thumb = "true";
    }
    host.setPointerCapture(event.pointerId);
  }, opts);
  document.addEventListener("mousemove", event => {
    if (active() && document.pointerLockElement === host)
      aim(-event.movementX * mouseSensitivity, -event.movementY * mouseSensitivity);
  }, opts);
  host.addEventListener("pointermove", event => {
    if (!active() || document.pointerLockElement === host) return;
    const dragging = drags.move?.id === event.pointerId ? drags.move :
      drags.look?.id === event.pointerId ? drags.look : undefined;
    if (!dragging) return;
    const x = event.clientX - dragging.x, y = event.clientY - dragging.y;
    const travel = Math.hypot(x, y);
    if (dragging === drags.move) {
      dragging.travel = Math.max(dragging.travel, travel);
      const amount = T.MathUtils.clamp((travel - 4) / 41, 0, 1);
      // A radial pad maps a diagonal thumb movement to the same top speed.
      pad.x = travel ? x * amount / travel : 0;
      pad.y = travel ? y * amount / travel : 0;
      pad.sprint = -y > 70 && pad.y < -.65;
      host.style.setProperty("--stick-dx", (pad.x * 26).toFixed(1) + "px");
      host.style.setProperty("--stick-dy", (pad.y * 26).toFixed(1) + "px");
      transition = null;
      invalidate();
    } else {
      dragging.travel += travel;
      dragging.x = event.clientX; dragging.y = event.clientY;
      const sensitivity = event.pointerType === "touch" ? .0057 : mouseSensitivity;
      aim(-x * sensitivity, -y * sensitivity);
    }
  }, opts);
  function finishDrag(event: PointerEvent) {
    const side = drags.move?.id === event.pointerId ? "move" :
      drags.look?.id === event.pointerId ? "look" : null;
    if (!side) return;
    const dragging = drags[side];
    const released = event.type === "pointerup";
    const tap = released && dragging && dragging.travel < 6 && !dragging.paired;
    removeDrag(side);
    if (!released && side === "move") { velocity.x = 0; velocity.z = 0; }
    if (tap && active()) {
      if (event.pointerType === "mouse") void captureMouse();
      else if (presence.target) input.inspect(presence.target);
    }
    invalidate();
  }
  host.addEventListener("pointerup", finishDrag, opts);
  host.addEventListener("pointercancel", finishDrag, opts);
  host.addEventListener("lostpointercapture", finishDrag, opts);
  host.addEventListener("blur", clear, opts);
  window.addEventListener("blur", clear, opts);
  window.addEventListener("resize", resize, opts);
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === host) host.dataset.mouseLook = "true";
    else if (host.dataset.mouseLook) { delete host.dataset.mouseLook; clear(); }
  }, opts);
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else invalidate(); }, opts);
  motion.addEventListener("change", () => {
    if (motion.matches) { transition = null; Object.assign(gait, restingGait()); }
    invalidate();
  }, opts);
  renderer.domElement.addEventListener("webglcontextlost", event => {
    event.preventDefault(); input.failure();
  }, opts);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate(); else suspend();
  });
  visibilityObserver.observe(host);
  const theme = new MutationObserver(palette);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  palette();
  resize();
  moveCamera(performance.now());
  return {
    captureMouse,
    update(next) {
      const previous = state;
      const viewChanged = state.view !== next.view;
      const remesh = state.finish !== next.finish || state.topic !== next.topic;
      const becamePaused = !state.paused && next.paused;
      const enteringQuiet = !state.quiet && next.quiet;
      state = next;
      if (next.paused || next.replay || next.quiet || next.view !== "walk") sound.silence();
      if (becamePaused) clear();
      const frozenReplay = next.replay && !next.playing &&
        (!previous.replay || previous.playing || previous.cursor !== next.cursor);
      if (becamePaused || enteringQuiet || frozenReplay || previous.lighting.failed !== next.lighting.failed) {
        illumination.clear();
        illumination.resetClock();
      }
      if (enteringQuiet) {
        transition = null;
        Object.assign(gait, restingGait());
      }
      if (remesh) {
        scene.remove(sphere.orb); release(sphere.orb);
        sphere = makeSphere(state.topic, state.finish === "illustrated", software);
        if (software) sphere.orb.traverse(node => node.layers.enable(opticalLayer));
        scene.add(sphere.orb); palette();
      }
      if (viewChanged) {
        if (state.view !== "walk" && area === "core") {
          resumeCore = true;
          interiorPose = { ...pose }; area = "room"; pose = { ...savedRoom };
          room.inner.visible = false; room.outer.visible = true;
        } else if (state.view === "walk" && resumeCore) {
          resumeCore = false;
          savedRoom = { ...pose }; pose = { ...interiorPose }; area = "core";
          room.inner.visible = true; room.outer.visible = false;
          clear(); transition = null;
        }
        if (area === "room") moveToView(previous.view);
        resize();
      }
      if (next.signal && next.signal.id !== latestSignal) {
        latestSignal = next.signal.id;
        if (next.replay ? next.playing : !previous.replay && (
          next.lighting.working || next.lighting.owner ||
          ["ship", "revert", "failure"].includes(next.signal.kind)
        )) paintSignal(next.signal);
      }
      invalidate();
    },
    go(zone) {
      const station = stations.find(item => item.id === zone);
      if (!station) return;
      if (area === "core") this.exit();
      pose = { ...pose, ...station.arrival };
      const target = room.markers.get(zone);
      if (target) standLook(target);
      clear(); transition = null; invalidate();
      host.focus({ preventScroll: true });
    },
    inspectBreak() {
      const zone = state.lighting.faultZone;
      if (!zone || state.view !== "walk" || area !== "room") return;
      room.faultCable.set(zone);
      const tip = room.faultCable.supplyPath.at(-1);
      const station = room.markers.get(zone);
      if (!tip || !station) return;
      const outward = tip.clone().setY(0).normalize();
      const side = new T.Vector3(-outward.z, 0, outward.x);
      const vantage = tip.clone().addScaledVector(outward, -2.5).addScaledVector(side, .85);
      if (canStand(vantage, area)) { pose.x = vantage.x; pose.z = vantage.z; }
      standLook(tip.clone().lerp(station, .24));
      clear(); transition = null; invalidate(); host.focus({ preventScroll: true });
    },
    reset() {
      if (area === "core") this.exit();
      clear(); pose = { ...spawn }; transition = null; invalidate();
    },
    enter() {
      if (area === "core") return;
      savedRoom = { ...pose };
      pose = enteredCore ? { ...interiorPose } : { x: 1.16, z: 3.42, yaw: .327, pitch: .14 };
      enteredCore = true;
      area = "core"; room.outer.visible = false; room.inner.visible = true;
      illumination.clear(); transition = null; resetInputs();
      invalidate(); host.focus({ preventScroll: true });
    },
    exit() {
      if (area !== "core") return;
      interiorPose = { ...pose }; area = "room"; pose = { ...savedRoom };
      room.inner.visible = false; room.outer.visible = true;
      transition = null; resetInputs();
      invalidate(); host.focus({ preventScroll: true });
    },
    play: paintSignal,
    dispose() {
      if (disposed) return;
      disposed = true; clear(); clean.abort(); cancelAnimationFrame(frame); window.clearTimeout(faultWake);
      resizeObserver.disconnect(); visibilityObserver.disconnect(); theme.disconnect();
      profiler?.dispose();
      still?.dispose();
      antialias?.dispose();
      room.dispose(); reflections?.dispose(); release(scene);
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
