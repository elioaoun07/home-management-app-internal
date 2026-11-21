import type { WebGLRenderer } from "three";

interface RenderSample {
  at: number;
  cpu: number;
  update: number;
  submission: number;
  calls: number;
  triangles: number;
  gpu?: number;
}

export function createRoomProfiler(host: HTMLElement, renderer: WebGLRenderer) {
  const recording = new URLSearchParams(location.search).get("roomPerf") === "1";
  const context = renderer.getContext();
  const gl = context instanceof WebGL2RenderingContext ? context : null;
  const timer = gl?.getExtension("EXT_disjoint_timer_query_webgl2") as {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  if (!recording && !timer) return null;
  let gpuMs: number | undefined, sinceQuery = 0;
  const frames: RenderSample[] = [];
  const pending: { query: WebGLQuery; sample?: RenderSample }[] = [];
  let open: WebGLQuery | null = null;

  function discardQueries() {
    for (const { query } of pending) gl?.deleteQuery(query);
    pending.length = 0;
  }

  function beginRender() {
    if (!gl || !timer || gl.isContextLost()) return;
    // In normal play one asynchronous query every eight rendered frames is
    // enough to drive quality. A full per-frame trace is explicitly opt-in.
    if (!recording && ++sinceQuery < 8) return;
    sinceQuery = 0;
    if (gl.getParameter(timer.GPU_DISJOINT_EXT)) {
      discardQueries();
      gpuMs = undefined;
      return;
    }
    while (pending.length && gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
      const result = pending.shift();
      if (!result) break;
      gpuMs = Number(gl.getQueryParameter(result.query, gl.QUERY_RESULT)) / 1_000_000;
      if (result.sample) result.sample.gpu = gpuMs;
      gl.deleteQuery(result.query);
    }
    if (pending.length >= 4) return;
    open = gl.createQuery();
    if (open) gl.beginQuery(timer.TIME_ELAPSED_EXT, open);
  }

  function finishFrame(at: number, start: number, renderStart: number, end: number) {
    const { calls, triangles } = renderer.info.render;
    const sample = recording ? { at, cpu: end - start, update: renderStart - start, submission: end - renderStart, calls, triangles } : undefined;
    if (open && gl && timer) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      pending.push({ query: open, sample });
      open = null;
    }
    if (sample) {
      if (frames.length === 3600) frames.shift();
      frames.push(sample);
    }
  }

  const display = { mode: "settled" as "settled" | "moving", movementScale: 1, refinedScale: 1, cachedRoom: false };
  const probe = {
    read: () => ({
      css: [host.clientWidth, host.clientHeight],
      buffer: [renderer.domElement.width, renderer.domElement.height],
      dpr: devicePixelRatio,
      quality: { ...display },
      frames: frames.map(sample => ({ ...sample })),
    }),
    reset: () => { frames.length = 0; discardQueries(); },
  };
  const target = host as HTMLElement & { __eraRoomPerf?: typeof probe };
  if (recording) target.__eraRoomPerf = probe;
  return {
    recording,
    get gpuMs() { return gpuMs; },
    display,
    beginRender,
    finishFrame,
    dispose() {
      probe.reset();
      delete target.__eraRoomPerf;
    },
  };
}
