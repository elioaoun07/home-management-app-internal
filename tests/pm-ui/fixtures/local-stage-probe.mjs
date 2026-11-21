import assert from "node:assert/strict";

/** Installed only by the browser test, before the product bundle loads. */
export function installBoardProbe() {
  const methods = [
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
    "quadraticCurveTo",
    "bezierCurveTo",
    "rect",
    "clip",
    "fillText",
    "strokeText",
    "createLinearGradient",
    "createRadialGradient",
    "getImageData",
  ];
  const total = { static: 0, state: 0, motion: 0 };
  const probe = (window.__boardProbe = {
    frames: [],
    mutations: [],
    total,
    active: false,
    epoch: 0,
    methods: {},
  });
  for (const method of methods) {
    const original = CanvasRenderingContext2D.prototype[method];
    if (!original) continue;
    CanvasRenderingContext2D.prototype[method] = function (...args) {
      const layer = this.canvas.dataset.layer;
      if (Object.hasOwn(total, layer)) {
        total[layer]++;
        if (probe.active)
          probe.methods[method] = (probe.methods[method] || 0) + 1;
      }
      return original.apply(this, args);
    };
  }
  const nativeFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    nativeFrame((at) => {
      const before = { ...total },
        start = performance.now();
      probe.methods = {};
      probe.active = true;
      try {
        return callback(at);
      } finally {
        const ms = performance.now() - start;
        probe.active = false;
        if (total.motion > before.motion) {
          const root = document.querySelector(".board-workshop");
          probe.frames.push({
            at,
            ms,
            static: total.static - before.static,
            state: total.state - before.state,
            calls: total.motion - before.motion,
            methods: probe.methods,
            particles: Number(root?.dataset.particles ?? 0),
            beat: root?.dataset.beat,
            zone: root?.dataset.zone,
            stateName: root?.dataset.liveness,
            stagedId: root?.dataset.stagedId,
          });
          if (probe.frames.length > 15000) probe.frames.shift();
        }
      }
    });
  new MutationObserver((rows) => {
    if (!probe.epoch) return;
    for (const row of rows) {
      const target =
        row.target instanceof Element ? row.target : row.target.parentElement;
      const root = target?.closest(".run-game");
      if (!root) continue;
      if (
        target.closest(
          ".board-clock,.board-telemetry,.board-attention-age,.board-perf",
        )
      )
        continue;
      if (
        row.type === "attributes" &&
        target.matches(".board-workshop") &&
        row.attributeName?.startsWith("data-") &&
        target.dataset.debug === "true"
      )
        continue;
      probe.mutations.push({
        at: performance.now(),
        type: row.type,
        tag: target.tagName,
        className:
          typeof target.className === "string" ? target.className : "svg",
        attribute: row.attributeName,
        oldValue: row.oldValue,
        value:
          row.type === "attributes"
            ? target.getAttribute(row.attributeName)
            : target.textContent?.slice(0, 100),
      });
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
  });
}
export async function resetProbe(page, mutations = false) {
  await page.evaluate((observe) => {
    const probe = window.__boardProbe;
    probe.frames = [];
    probe.mutations = [];
    probe.epoch = observe ? performance.now() : 0;
    return { ...probe.total };
  }, mutations);
}
export async function probeReceipt(page) {
  return page.evaluate(() => {
    const probe = window.__boardProbe,
      frames = probe.frames;
    const values = frames.map((frame) => frame.ms).sort((a, b) => a - b);
    const intervals = frames
      .slice(1)
      .map((frame, i) => frame.at - frames[i].at);
    return {
      frames,
      mutations: probe.mutations,
      total: { ...probe.total },
      summary: {
        count: frames.length,
        p95:
          values[
            Math.min(values.length - 1, Math.floor(values.length * 0.95))
          ] ?? 0,
        max: Math.max(0, ...values),
        average:
          values.reduce((sum, value) => sum + value, 0) /
          Math.max(1, values.length),
        maxCalls: Math.max(0, ...frames.map((frame) => frame.calls)),
        maxStatic: Math.max(0, ...frames.map((frame) => frame.static)),
        maxState: Math.max(0, ...frames.map((frame) => frame.state)),
        maxParticles: Math.max(0, ...frames.map((frame) => frame.particles)),
        observedMotionFps: intervals.length
          ? 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length)
          : 0,
      },
    };
  });
}
export function assertFrameBudget(receipt, beat = true) {
  const { summary, frames } = receipt;
  assert.ok(summary.count >= 20, "a real visible motion sample is required");
  assert.ok(
    summary.maxCalls <= (beat ? 150 : 60),
    `motion calls ${summary.maxCalls}`,
  );
  assert.equal(
    summary.maxStatic,
    0,
    "static canvas must not draw inside animation callbacks",
  );
  assert.equal(
    summary.maxState,
    0,
    "state canvas must not draw inside animation callbacks",
  );
  assert.ok(
    summary.maxParticles <= 150,
    `particle cap ${summary.maxParticles}`,
  );
  assert.ok(
    summary.p95 <= 3,
    `whole animation callback p95 ${summary.p95.toFixed(3)} ms`,
  );
  for (const frame of frames) {
    for (const banned of [
      "createLinearGradient",
      "createRadialGradient",
      "getImageData",
    ])
      assert.equal(
        frame.methods[banned] ?? 0,
        0,
        banned + " in animation callback",
      );
    assert.ok(
      (frame.methods.stroke ?? 0) <= 20,
      "at most twenty light-line strokes",
    );
  }
}
