import * as T from "three";
import { canStand, chair, spawn, stations, type Area } from "./layout";
import { makeRoom, makeSphere, point, release } from "./art";
import type { Pose, Presence, Signal, Target, WorldApi, WorldControls, WorldState } from "./protocol";

const MAX_FRAME = .05;
const standEye = 1.65;
const keys = new Set(["w", "a", "s", "d", "arrowleft", "arrowright", "arrowup", "arrowdown"]);

export function createWorld(host: HTMLElement, input: WorldControls, initial: WorldState): WorldApi {
  const renderer = new T.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  host.append(renderer.domElement);

  const scene = new T.Scene(), room = makeRoom();
  scene.add(room.outer, room.inner, room.light, room.key, room.warm);
  const camera = new T.PerspectiveCamera(65, 1, .08, 63);
  camera.rotation.order = "YXZ";
  const coreLight = new T.PointLight("#91bbff", 37, 10, 2);
  scene.add(coreLight);

  let state = initial, area: Area = "room", pose: Pose = { ...spawn };
  let interiorPose: Pose = { ...pose }, savedRoom: Pose = { ...pose };
  let resumeCore = false, enteredCore = false;
  let sphere = makeSphere(state.topic, state.finish === "illustrated");
  scene.add(sphere.orb);
  let presence: Presence = { target: null, zone: null, area };
  let disposed = false, visible = true, frame = 0, last = 0, renderNeeded = true;
  let transition: { start: number; position: T.Vector3; rotation: T.Quaternion } | null = null;
  let flight: { start: number; signal: Signal; path: T.CatmullRomCurve3 } | null = null;
  let latestSignal = initial.signal?.id ?? null;
  const start = performance.now(), motion = matchMedia("(prefers-reduced-motion: reduce)");
  const clean = new AbortController(), opts = { signal: clean.signal };
  const held = new Set<string>(), pad = { x: 0, y: 0 };
  let dragging: { id: number; side: "look" | "move"; x: number; y: number; travel: number } | null = null;

  const traceMaterial = new T.LineBasicMaterial({ color: sphere.tint, transparent: true, opacity: 0 });
  const traces = Array.from({ length: 3 }, () => {
    const geometry = new T.BufferGeometry().setAttribute("position", new T.BufferAttribute(new Float32Array(33 * 3), 3));
    const line = new T.Line(geometry, traceMaterial);
    line.frustumCulled = false; line.visible = false;
    scene.add(line); return line;
  });
  const impulse = new T.Mesh(new T.SphereGeometry(.082, 12, 8), new T.MeshBasicMaterial({ color: "#e0f1ff" }));
  impulse.visible = false; scene.add(impulse);

  function palette() {
    const style = getComputedStyle(host);
    const theme = new T.Color(style.getPropertyValue("--theme-bg").trim() || "#0a1628");
    const illustrated = state.finish === "illustrated";
    const blend = (base: string, amount: number) => new T.Color(base).lerp(theme, amount);
    scene.background = blend(illustrated ? "#15163b" : "#0b1722", .64);
    scene.fog = new T.Fog(scene.background, 23, 55);
    room.materials.hull.color.copy(blend(illustrated ? "#454b9d" : "#243441", .38));
    room.materials.floor.color.copy(blend(illustrated ? "#363e75" : "#303f50", .52));
    room.materials.panel.color.copy(blend(illustrated ? "#6267ad" : "#435b70", .28));
    room.materials.bevel.color.set(illustrated ? "#d09f70" : "#8a9fae");
    room.materials.pale.color.set(illustrated ? "#f1d7a1" : "#c0cdd9");
    room.light.intensity = illustrated ? 2.3 : 1.72;
    room.warm.intensity = illustrated ? 1.65 : 1.16;
    for (const material of Object.values(room.materials)) {
      material.roughness = illustrated ? 1 : .52;
    }
    traceMaterial.color.copy(sphere.tint);
    coreLight.color.copy(sphere.tint);
    invalidate();
  }

  const position = new T.Vector3(), direction = new T.Vector3(), targetRotation = new T.Quaternion();
  const Euler = new T.Euler(0, 0, 0, "YXZ");
  const goal = new T.PerspectiveCamera();
  const standLook = (target: { x: number; z: number }) => {
    pose.yaw = Math.atan2(pose.x - target.x, pose.z - target.z); pose.pitch = 0;
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
      position.set(pose.x, standEye, pose.z);
      targetRotation.setFromEuler(Euler.set(pose.pitch, pose.yaw, 0));
    }
  }
  function moveCamera(now: number) {
    wantCamera();
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

  function clear() {
    held.clear(); pad.x = 0; pad.y = 0;
    if (dragging && host.hasPointerCapture(dragging.id)) host.releasePointerCapture(dragging.id);
    dragging = null;
    if (document.pointerLockElement === host) document.exitPointerLock();
  }

  const active = () => state.view === "walk" && !state.paused && document.visibilityState !== "hidden";
  function walk(dt: number) {
    if (!active()) return;
    const spin = Number(held.has("arrowleft")) - Number(held.has("arrowright"));
    const tilt = Number(held.has("arrowup")) - Number(held.has("arrowdown"));
    look(spin * dt * 1.4, tilt * dt * 1.4);
    const forward = Number(held.has("w")) - Number(held.has("s")) - pad.y;
    const side = Number(held.has("d")) - Number(held.has("a")) + pad.x;
    const amount = Math.hypot(forward, side);
    if (!amount) return;
    const step = 2.4 * dt / Math.max(1, amount);
    const x = step * (-Math.sin(pose.yaw) * forward + Math.cos(pose.yaw) * side);
    const z = step * (-Math.cos(pose.yaw) * forward - Math.sin(pose.yaw) * side);
    if (canStand({ x: pose.x + x, z: pose.z }, area)) pose.x += x;
    if (canStand({ x: pose.x, z: pose.z + z }, area)) pose.z += z;
  }

  function look(yaw: number, pitch: number) {
    pose.yaw += yaw; pose.pitch = T.MathUtils.clamp(pose.pitch + pitch, -1.13, 1.13);
  }

  function locate() {
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
    host.dataset.pose = [pose.x, pose.z, pose.yaw, pose.pitch].map(v => v.toFixed(3)).join(",");
  }

  function moveToView() {
    clear();
    transition = state.quiet || motion.matches ? null : {
      start: performance.now(), position: camera.position.clone(), rotation: camera.quaternion.clone(),
    };
    // From a distant position, dissolve instead of flying through the well.
    if (state.view === "seat" && Math.hypot(pose.x - chair.x, pose.z - chair.z) > 2.6) transition = null;
    if (!state.quiet && !motion.matches) {
      renderer.domElement.animate([{ opacity: transition ? .86 : .2 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
    }
    invalidate();
  }

  function paintSignal(signal: Signal) {
    if (area !== "room" || state.quiet || motion.matches) { invalidate(); return; }
    const end = room.markers.get(signal.kind === "question" || signal.kind === "handover" ? "seat" : signal.zone);
    if (!end) return;
    const inside = point(0, 2.22, 0);
    let path = [inside, point(end.x * .19, .075, end.z * .19), point(end.x * .66, .048, end.z * .66), end];
    if (signal.kind === "read") path = path.reverse();
    const curve = new T.CatmullRomCurve3(path);
    flight = { signal, path: curve, start: performance.now() };
    let seed = 0;
    for (const char of signal.id) seed = (seed * 31 + char.charCodeAt(0)) | 0;
    for (const [index, trace] of traces.entries()) {
      const g = trace.geometry.getAttribute("position");
      for (let i = 0; i <= 32; i++) {
        const t = i / 32, p = curve.getPoint(t);
        const ripple = Math.sin(t * 21 + index * 2.2 + seed % 49) * Math.sin(Math.PI * t) * index * .092;
        g.setXYZ(i, p.x + ripple, p.y + Math.abs(ripple) * .34, p.z + ripple);
      }
      g.needsUpdate = true; trace.visible = index === 0 || signal.kind === "edit";
    }
    invalidate();
  }

  function paint(now: number) {
    const energy = ({ preparing: .44, building: 1.02, checking: 1.38, "uat-ready": .63, shipped: 1.15 } as Record<string, number>)[state.phase] ?? .3;
    const quiet = state.quiet || motion.matches;
    for (const wall of room.cutaway) wall.visible = state.view !== "map";
    room.marker.visible = state.view === "map";
    room.marker.position.set(pose.x, .11, pose.z);
    room.marker.rotation.z = pose.yaw;
    let boost = 0;
    let travel = 0;
    if (flight) {
      const ms = flight.signal.kind === "handover" ? 650 : flight.signal.kind === "edit" ? 500 : 315;
      travel = Math.min(1, (now - flight.start) / ms);
      boost = Math.sin(Math.PI * travel) * .58;
      impulse.position.copy(flight.path.getPoint(travel));
      impulse.visible = travel < 1 && !quiet;
      for (const trace of traces) trace.geometry.setDrawRange(0, Math.max(2, Math.ceil(33 * travel)));
      traceMaterial.opacity = quiet ? 0 : .60 * (1 - travel * travel);
      if (travel === 1 || quiet) { flight = null; for (const trace of traces) trace.visible = false; }
    } else {
      impulse.visible = false;
    }
    sphere.orb.scale.setScalar(area === "core" ? 2.10 : 1);
    sphere.orb.position.set(0, area === "core" ? 2.76 : 2.22, 0);
    sphere.fibers.rotation.y = !quiet && area === "core" ? Math.sin((now - start) / 3100) * .27 : 0;
    sphere.glow.emissiveIntensity = energy + boost + (quiet ? 0 : Math.sin((now - start) / 830) * .07);
    sphere.shell.uniforms.energy.value = energy + boost;
    sphere.shell.uniforms.tick.value = quiet ? 0 : (now - start) / 1250;
    sphere.aura.material.opacity = Math.min(.84, .31 + energy * .17 + boost * .26);
    sphere.nucleus.emissiveIntensity = .42 + boost * .93;
    coreLight.position.copy(sphere.orb.position);
    coreLight.intensity = 22 + energy * 13 + boost * 29;
    for (const [zone, machine] of room.machines) {
      if (zone === "exit" || zone === "previous" || zone === "next" || zone === "present") {
        machine.stamp.visible = zone === "exit" || state.core[zone === "previous" ? 0 : zone === "present" ? 1 : 2];
        continue;
      }
      const status = zone === "seat" || zone === "core" ? undefined : state.stamps[zone];
      machine.stamp.visible = !!status;
      const color = status === "failed" ? "#f4b475" : status === "inconclusive" ? "#dfc9e2" : status === "passed" ? "#c3ffd9" : sphere.tint;
      machine.light.emissive.set(color);
      machine.light.emissiveIntensity = status ? .6 : .08;
      if (machine.stamp.material instanceof T.MeshStandardMaterial) {
        machine.stamp.material.emissive.set(color);
        machine.stamp.material.emissiveIntensity = .64;
      }
      machine.stamp.scale.x = status?.includes("pending") ? .52 : 1;
      const contact = flight?.signal.zone === zone ? Math.sin(Math.PI * travel) : 0;
      machine.moving.position.z = contact ? contact * .23 : status && zone === "build" ? .12 : 0;
      machine.moving.scale.y = status === "failed" ? .70 : status === "inconclusive" ? .86 : 1;
    }
  }

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 670 ? 1.0 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = state.view === "map" && width < height ? 78 : 65;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function invalidate() {
    renderNeeded = true;
    if (!frame && visible && !disposed && document.visibilityState !== "hidden")
      frame = requestAnimationFrame(tick);
  }
  function tick(now: number) {
    frame = 0;
    if (disposed || !visible || document.visibilityState === "hidden") return;
    const dt = last ? Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    const moving = active() && (held.size > 0 || pad.x !== 0 || pad.y !== 0);
    if (moving) walk(dt);
    if (renderNeeded || moving || flight || transition || !state.quiet && !motion.matches && area === "core" && !state.paused) {
      moveCamera(now);
      locate();
      paint(now);
      renderer.render(scene, camera);
      renderNeeded = false;
    }
    if (moving || flight || transition || !state.quiet && !motion.matches && area === "core" && !state.paused) frame = requestAnimationFrame(tick);
    else last = 0;
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
    const key = event.key.toLowerCase();
    if (key === "q") { event.preventDefault(); return; }
    if (!active()) return;
    if (key === "e" && presence.target && !event.repeat) {
      event.preventDefault(); input.inspect(presence.target); return;
    }
    if (keys.has(key)) { event.preventDefault(); held.add(key); invalidate(); }
  }, opts);
  host.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    held.delete(key);
    if (key === "q" && !state.paused && !event.altKey && !event.metaKey && !event.ctrlKey) input.ask();
  }, opts);
  host.addEventListener("pointerdown", event => {
    if (event.button !== 0 || state.paused) return;
    host.focus({ preventScroll: true });
    if (state.view === "map") { clickMap(event); return; }
    if (!active() || dragging || document.pointerLockElement === host) return;
    const bounds = host.getBoundingClientRect();
    const side = event.pointerType === "touch" && event.clientX < bounds.left + bounds.width * .45 ? "move" : "look";
    dragging = { id: event.pointerId, side, x: event.clientX, y: event.clientY, travel: 0 };
    host.setPointerCapture(event.pointerId);
  }, opts);
  host.addEventListener("pointermove", event => {
    if (!active()) return;
    if (document.pointerLockElement === host) {
      look(-event.movementX * .0027, -event.movementY * .0027); invalidate(); return;
    }
    if (!dragging || dragging.id !== event.pointerId) return;
    const x = event.clientX - dragging.x, y = event.clientY - dragging.y;
    dragging.travel += Math.hypot(x, y);
    if (dragging.side === "move") {
      pad.x = T.MathUtils.clamp(x / 45, -1, 1); pad.y = T.MathUtils.clamp(y / 45, -1, 1);
    } else {
      look(-x * .007, -y * .007); dragging.x = event.clientX; dragging.y = event.clientY;
    }
    invalidate();
  }, opts);
  host.addEventListener("pointerup", event => {
    if (dragging?.id !== event.pointerId) return;
    const tap = dragging.travel < 6 && event.pointerType !== "mouse";
    dragging = null; pad.x = 0; pad.y = 0;
    if (tap && presence.target && active()) input.inspect(presence.target);
  }, opts);
  host.addEventListener("lostpointercapture", () => { dragging = null; pad.x = 0; pad.y = 0; }, opts);
  host.addEventListener("blur", clear, opts);
  document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement !== host) clear(); }, opts);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clear(); last = 0; } else invalidate(); }, opts);
  motion.addEventListener("change", invalidate, opts);
  renderer.domElement.addEventListener("webglcontextlost", event => {
    event.preventDefault(); input.failure();
  }, opts);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate(); else { clear(); last = 0; }
  });
  visibilityObserver.observe(host);
  const theme = new MutationObserver(palette);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  palette();
  resize();
  moveCamera(performance.now());
  return {
    update(next) {
      const viewChanged = state.view !== next.view;
      const remesh = state.finish !== next.finish || state.topic !== next.topic;
      const becamePaused = !state.paused && next.paused;
      const enteringQuiet = !state.quiet && next.quiet;
      state = next;
      if (becamePaused) clear();
      if (enteringQuiet) {
        transition = null;
        renderer.domElement.getAnimations().forEach(animation => animation.cancel());
      }
      if (remesh) {
        scene.remove(sphere.orb); release(sphere.orb);
        sphere = makeSphere(state.topic, state.finish === "illustrated"); scene.add(sphere.orb); palette();
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
          invalidate(); resize(); return;
        }
        moveToView(); resize();
      }
      if (next.signal?.id !== latestSignal) {
        latestSignal = next.signal?.id ?? null;
        if (next.signal && (next.signal.kind !== "question" || !next.quiet)) paintSignal(next.signal);
      }
      invalidate();
    },
    go(zone) {
      const station = stations.find(item => item.id === zone);
      if (!station) return;
      if (area === "core") this.exit();
      pose = { ...pose, ...station.arrival };
      standLook(station); clear(); transition = null; invalidate();
      host.focus({ preventScroll: true });
    },
    reset() { if (area === "core") this.exit(); pose = { ...spawn }; transition = null; invalidate(); },
    enter() {
      if (area === "core") return;
      savedRoom = { ...pose };
      pose = enteredCore ? { ...interiorPose } : { x: 0, z: 3.28, yaw: 0, pitch: 0 };
      enteredCore = true;
      area = "core"; room.outer.visible = false; room.inner.visible = true;
      flight = null; transition = null; clear();
      if (!state.quiet && !motion.matches) renderer.domElement.animate([{opacity:.12},{opacity:1}], 320);
      invalidate(); host.focus({ preventScroll: true });
    },
    exit() {
      if (area !== "core") return;
      interiorPose = { ...pose }; area = "room"; pose = { ...savedRoom };
      room.inner.visible = false; room.outer.visible = true;
      transition = null; clear();
      if (!state.quiet && !motion.matches) renderer.domElement.animate([{opacity:.12},{opacity:1}], 280);
      invalidate(); host.focus({ preventScroll: true });
    },
    play: paintSignal,
    dispose() {
      if (disposed) return;
      disposed = true; clear(); clean.abort(); cancelAnimationFrame(frame);
      resizeObserver.disconnect(); visibilityObserver.disconnect(); theme.disconnect();
      release(scene); traces.forEach(line => line.geometry.dispose()); traceMaterial.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
