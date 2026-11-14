import { useCallback, useEffect, useRef } from "react";
import { createCoreDynamics, kickCore, stepCoreDynamics } from "./coreDynamics";
import { createCoreParticles } from "./coreParticles";
import type { CoreSessionState } from "./coreState";

/** One clock owns phase, inertia, vibration and emissions; no React frame renders. */
export function useCoreMotion(state: CoreSessionState["state"]) {
  const section = useRef<HTMLElement>(null);
  const initialMotion = createCoreDynamics();
  if (state === "failed") initialMotion.speed = 0;
  const motion = useRef(initialMotion);
  const currentState = useRef(state);
  const failedOrigin = useRef(0);
  const reduced = useRef(false);
  useEffect(() => {
    if (state === "failed" && currentState.current !== "failed")
      failedOrigin.current = motion.current.angle;
    currentState.current = state;
  }, [state]);

  const throttle = useCallback(() => {
    if (reduced.current) return;
    kickCore(motion.current);
    if (section.current) section.current.dataset.throttle = "true";
  }, []);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const wheel = root.querySelector<HTMLElement>(".core-wheel")!;
    const rotor = root.querySelector<SVGElement>(".core-rotor")!;
    const counter = root.querySelector<SVGElement>(".core-counter-rotor")!;
    const split = root.querySelector<SVGElement>(".core-split-ring")!;
    split.style.transformOrigin = "150px 150px";
    const heat = root.querySelector<HTMLElement>(".core-heat")!;
    const halo = root.querySelector<HTMLElement>(".core-friction-halo")!;
    const canvas = root.querySelector<HTMLCanvasElement>(".core-exhaust")!;
    const particles = createCoreParticles(canvas);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    let frame = 0;
    let last = 0;

    const paint = (dt: number) => {
      const m = motion.current;
      const failed = currentState.current === "failed";
      const energy = reduced.current ? 0 : m.energy;
      const t = m.elapsed;
      const vibration = Math.pow(energy, 1.3);
      // Non-periodic-feeling engine shudder, localized to the wheel. Position
      // and amplitude ease with energy instead of snapping at throttle release.
      const x = (Math.sin(t * 83) + Math.sin(t * 137) * 0.45) * vibration * 2;
      const y = (Math.cos(t * 101) + Math.sin(t * 61) * 0.5) * vibration * 1.55;
      const twist = Math.sin(t * 73) * vibration * (failed ? 1.7 : 0.6);
      wheel.style.transform = `translate(${x}px, ${y}px) rotate(${twist}deg)`;
      rotor.style.transform = `rotate(${m.angle % 360}deg)`;
      counter.style.transform = `rotate(${-(m.angle / 1.7) % 360}deg)`;
      // Failure changes the geometry immediately, but any momentum that was
      // already visible carries the broken ring gently toward a natural stop.
      split.style.transform = `rotate(${failed ? (m.angle - failedOrigin.current) % 360 : 0}deg)`;
      wheel.style.setProperty(
        "--core-heat-mix",
        `${failed ? 0 : energy * 100}%`,
      );
      const hue =
        currentState.current === "attention"
          ? 43
          : currentState.current === "success"
            ? 155
            : currentState.current === "running"
              ? 12
              : 205;
      // Take the short route around the hue circle. Blue -> red must pass
      // through violet, not the green reserved for successful completion.
      const heatHueDelta = ((12 - hue + 540) % 360) - 180;
      wheel.style.setProperty(
        "--wheel-hue",
        String(hue + heatHueDelta * energy),
      );
      heat.style.opacity = String(energy * (0.62 + Math.sin(t * 7) * 0.07));
      heat.style.transform = `rotate(${m.angle % 360}deg) scale(${1 + energy * 0.04})`;
      halo.style.opacity = String(energy * 0.6);
      halo.style.transform = `scale(${0.96 + energy * 0.1 + Math.sin(t * 9) * energy * 0.02})`;
      const count = particles.draw(dt, energy, m.angle);
      root.dataset.throttle = String(
        m.throttleRemaining > 0 && !reduced.current,
      );
      root.dataset.rpm = (reduced.current ? 0 : m.speed / 6).toFixed(2);
      root.dataset.energy = energy.toFixed(4);
      root.dataset.angle = m.angle.toFixed(3);
      root.dataset.particles = String(count);
      root.dataset.phase =
        m.throttleRemaining > 0
          ? "throttle"
          : currentState.current === "running"
            ? "running"
            : energy > 0.025
              ? "cooldown"
              : "rest";
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.064) : 0;
      last = now;
      stepCoreDynamics(motion.current, currentState.current, dt);
      paint(dt);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      reduced.current = preference.matches;
      const active =
        inView && document.visibilityState !== "hidden" && !reduced.current;
      root.dataset.motion = active ? "active" : "paused";
      if (reduced.current) {
        motion.current.energy = 0;
        motion.current.throttleRemaining = 0;
        particles.clear();
        paint(0);
      }
      if (active) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    const resize = new ResizeObserver(() =>
      particles.resize(wheel.clientWidth),
    );
    resize.observe(wheel);
    particles.resize(wheel.clientWidth);
    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
      particles.clear();
    };
  }, []);

  return { section, throttle };
}
