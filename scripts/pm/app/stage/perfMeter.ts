import { TIMING } from "./config";
import "./perf-meter.css";
export interface FrameReceipt {
  fps: number;
  average: number;
  p95: number;
  calls: number;
  particles: number;
}
const METHODS = [
  "clearRect",
  "drawImage",
  "fillRect",
  "beginPath",
  "moveTo",
  "lineTo",
  "closePath",
  "fill",
  "stroke",
  "arc",
  "ellipse",
  "save",
  "restore",
  "translate",
  "scale",
  "rotate",
  "setTransform",
] as const;
/** Counting is activated explicitly; production contexts retain their native methods. */
export function createPerfMeter(
  root: HTMLElement,
  contexts: CanvasRenderingContext2D[],
) {
  const panel = document.createElement("output");
  panel.className = "board-perf";
  panel.hidden = true;
  root.appendChild(panel);
  let visible = false,
    counting = false,
    calls = 0,
    lastPublish = 0;
  const samples: { at: number; ms: number }[] = [];
  let receipt: FrameReceipt = {
    fps: 0,
    average: 0,
    p95: 0,
    calls: 0,
    particles: 0,
  };
  const originals = contexts.map((c) =>
    METHODS.map((method) => c[method].bind(c)),
  );
  function toggleCounting(enabled: boolean) {
    if (enabled === counting) return;
    counting = enabled;
    contexts.forEach((ctx, i) =>
      METHODS.forEach((method, j) => {
        Object.defineProperty(ctx, method, {
          configurable: true,
          value: enabled
            ? (...args: unknown[]) => {
                calls++;
                return (originals[i][j] as (...args: unknown[]) => unknown)(
                  ...args,
                );
              }
            : originals[i][j],
        });
      }),
    );
  }
  const debug = () => root.dataset.debug === "true";
  const sync = () => toggleCounting(visible || debug());
  const key = (e: KeyboardEvent) => {
    if (e.shiftKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      visible = !visible;
      panel.hidden = !visible;
      sync();
    }
  };
  window.addEventListener("keydown", key);
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ["data-debug"] });
  sync();
  return {
    start() {
      calls = 0;
      return performance.now();
    },
    end(start: number, particles: number) {
      const now = performance.now();
      samples.push({ at: now, ms: now - start });
      while (samples.length && samples[0].at < now - TIMING.perfWindow)
        samples.shift();
      if (now - lastPublish < TIMING.perfWindow) return;
      lastPublish = now;
      const values = samples.map((s) => s.ms).sort((a, b) => a - b);
      const elapsed = now - (samples[0]?.at ?? now);
      receipt = {
        fps: elapsed ? Math.max(0, ((samples.length - 1) * 1000) / elapsed) : 0,
        average: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length),
        p95:
          values[
            Math.min(values.length - 1, Math.floor(values.length * 0.95))
          ] ?? 0,
        calls,
        particles,
      };
      if (visible)
        panel.textContent = `${receipt.fps.toFixed(0)} fps · ${receipt.average.toFixed(1)} ms · p95 ${receipt.p95.toFixed(1)} · ${calls} calls · ${particles}`;
    },
    sleep() {
      samples.length = 0;
      receipt = { ...receipt, fps: 0, calls: 0, particles: 0 };
      if (visible) panel.textContent = "0 fps · 0 calls · 0";
    },
    get receipt() {
      return receipt;
    },
    get calls() {
      return calls;
    },
    get enabled() {
      return visible || debug();
    },
    dispose() {
      window.removeEventListener("keydown", key);
      observer.disconnect();
      toggleCounting(false);
      panel.remove();
    },
  };
}
