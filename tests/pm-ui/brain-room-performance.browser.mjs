// Run beside the disposable A5 fixture. Its copied app sources are the baseline.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { chromiumExecutable, fixtureAssets, openBoard, routeFixture, sha256, specimen } from "./fixtures/local-stage-board.mjs";

const directory = process.env.ERA_ROOM_BENCH_DIR || ".pm/transfer-room-implementation/performance";
const repetitions = Number(process.env.ERA_ROOM_BENCH_RUNS || 3);
const headed = process.env.ERA_ROOM_BENCH_HEADED === "1";
const software = process.env.ERA_ROOM_BENCH_SOFTWARE === "1";
const profiles = [
  { name: "desktop", width: 1280, height: 720, dpr: 1, touch: false },
  { name: "high-dpi", width: 1920, height: 1080, dpr: 2, touch: false },
  { name: "wide-trips", width: 2560, height: 1280, dpr: 1, touch: false },
  { name: "narrow-emulated", width: 390, height: 844, dpr: 1.75, touch: true },
].filter(profile => !process.env.ERA_ROOM_BENCH_PROFILE || process.env.ERA_ROOM_BENCH_PROFILE === profile.name);
if (!Number.isInteger(repetitions) || repetitions < 1 || !profiles.length)
  throw new Error("Set a positive repeat count and a known room benchmark profile");

mkdirSync(directory, { recursive: true });
const candidate = await fixtureAssets(directory);
const builds = process.env.ERA_ROOM_BENCH_BASELINE_ONLY === "1" ? [] : [["candidate", candidate]];
if (process.env.ERA_ROOM_BENCH_CANDIDATE_ONLY !== "1") {
  const source = process.env.ERA_ROOM_BENCH_BASELINE || join(candidate.fixture.root, "scripts", "pm", "app-build.mjs");
  const { buildApp } = await import(pathToFileURL(source).href);
  const baseline = { ...candidate, bundle: await buildApp(), artDir: join(dirname(source), "assets") };
  if (builds.length && sha256(baseline.bundle.room) === sha256(candidate.bundle.room))
    throw new Error("Baseline fixture contains the candidate. Supply the earlier app-build.mjs path");
  builds.unshift(["baseline", baseline]);
}
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: chromiumExecutable(),
  headless: !headed,
  args: software ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [],
});

function observeRenderedFrames() {
  const capture = { enter: null, frames: [] };
  window.__roomBenchmark = capture;
  const raf = window.requestAnimationFrame.bind(window);
  let calls = 0, triangles = 0;
  let roomCanvas;
  const gl = WebGL2RenderingContext.prototype;
  for (const [name, countAt, instancesAt] of [
    ["drawElements", 1], ["drawArrays", 2], ["drawElementsInstanced", 1, 4], ["drawArraysInstanced", 2, 3],
  ]) {
    const original = gl[name];
    gl[name] = function (...args) {
      if (this.canvas === roomCanvas || this.canvas.closest?.(".era-brain-viewport")) {
        roomCanvas = this.canvas;
        calls++;
        if (args[0] === this.TRIANGLES) triangles += args[countAt] / 3 * (args[instancesAt] || 1);
      }
      return original.apply(this, args);
    };
  }
  window.requestAnimationFrame = callback => raf(at => {
    calls = 0; triangles = 0;
    const start = performance.now();
    callback(at);
    if (calls) capture.frames.push({ at, cpu: performance.now() - start, calls, triangles });
  });
}

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  const sample = sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return sample === undefined ? null : Number(sample.toFixed(2));
};
function stats(frames, ranges) {
  const segments = ranges.map(([start, end]) => frames.filter(({ at }) => at >= start && at <= end));
  const selected = segments.flat();
  const intervals = segments.flatMap(list => list.slice(1).map((frame, i) => frame.at - list[i].at));
  return {
    frames: selected.length,
    intervalMs: { p50: percentile(intervals, .5), p95: percentile(intervals, .95), p99: percentile(intervals, .99) },
    over50Ms: intervals.filter(value => value > 50).length,
    cpuP95Ms: percentile(selected.map(frame => frame.cpu), .95),
    updateP95Ms: percentile(selected.flatMap(frame => frame.update === undefined ? [] : [frame.update]), .95),
    submissionP95Ms: percentile(selected.flatMap(frame => frame.submission === undefined ? [] : [frame.submission]), .95),
    gpuP95Ms: percentile(selected.flatMap(frame => frame.gpu === undefined ? [] : [frame.gpu]), .95),
    callsP50: percentile(selected.map(frame => frame.calls), .5),
    trianglesP50: percentile(selected.map(frame => frame.triangles), .5),
  };
}

const now = page => page.evaluate(() => performance.now());
const writes = [], results = [];

// Reproduce the owner's view across the chamber from Setup. Travel uses the
// station selector and the same captured mouse deltas as ordinary walking.
async function faceCenterFromSetup(page, viewport) {
  await page.getByLabel("Go to station").selectOption("setup");
  await viewport.click({ position: { x: 150, y: 145 } });
  await page.waitForFunction(() => !!document.pointerLockElement);
  await viewport.evaluate(async host => {
    for (let pass = 0; pass < 5; pass++) {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const [x, z, yaw, pitch] = host.dataset.pose.split(",").map(Number);
      const movementX = Math.round((yaw - Math.atan2(x, z) - .36) / .0025);
      const movementY = Math.round((pitch - .065) / .0025);
      if (!movementX && !movementY) break;
      document.dispatchEvent(new MouseEvent("mousemove", { movementX, movementY, bubbles: true }));
    }
  });
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
}

async function captureEdges(page, view, prefix, nativeBuffer) {
  await view.focus();
  await page.waitForTimeout(350);
  const fixedPose = await view.getAttribute("data-pose");
  const state = () => view.evaluate(host => {
    const canvas = host.querySelector("canvas");
    return { pose: host.dataset.pose, mode: host.__eraRoomPerf?.read().quality.mode, buffer: [canvas.width,canvas.height] };
  });
  if (nativeBuffer) await page.waitForFunction(() =>
    document.querySelector(".era-brain-viewport").__eraRoomPerf?.read().quality.mode === "settled");
  const restState = await state();
  const rest = await view.screenshot({path:prefix+"-rest.png",scale:"css"});
  // Dispatch both turns together, so the moving render path draws the exact
  // camera used at rest. A separate real strafe verifies travel below.
  await view.evaluate(host => {
    for (const code of ["ArrowLeft","ArrowRight"])
      host.dispatchEvent(new KeyboardEvent("keydown", {key:code,code,bubbles:true}));
  });
  try {
    await page.waitForTimeout(500);
    if (nativeBuffer) await page.waitForFunction(() =>
      document.querySelector(".era-brain-viewport").__eraRoomPerf?.read().quality.mode === "moving");
    const heldState = await state();
    if (!fixedPose || restState.pose !== fixedPose || heldState.pose !== fixedPose)
      throw new Error("Edge comparison camera moved");
    const held = await view.screenshot({path:prefix+"-held.png",scale:"css"});
    if (!nativeBuffer) return;
    if ([restState,heldState].some(frame => frame.buffer.some((px,i) => px !== nativeBuffer[i])))
      throw new Error("Native detail edge capture changed the drawing buffer");
    // Physical Build lintel in the reproducible wide Setup viewpoint. Its
    // engraved text and rail lie inside the game and clear every DOM overlay.
    const crop = {left:458,top:412,width:138,height:76};
    const [a,b] = await Promise.all([rest,held].map(png =>
      sharp(png).extract(crop).removeAlpha().toColourspace("srgb").raw().toBuffer()));
    let changedPixels = 0, dark = 255, light = 0;
    for (let i = 0; i < a.length; i += 3) {
      if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2]) changedPixels++;
      const luma = .2126*a[i] + .7152*a[i+1] + .0722*a[i+2];
      dark = Math.min(dark,luma); light = Math.max(light,luma);
    }
    if (light-dark < 80) throw new Error("Native detail crop did not contain the contrasting sign");
    if (changedPixels) throw new Error(`Native detail changed ${changedPixels}/${crop.width*crop.height} sign pixels during input`);
    return {crop,changedPixels,channels:"RGB",rest:restState,held:heldState};
  } finally {
    await view.evaluate(host => {
      for (const code of ["ArrowLeft","ArrowRight"])
        host.dispatchEvent(new KeyboardEvent("keyup", {key:code,code,bubbles:true}));
    });
  }
}

async function runRoute(label, assets, profile, repetition) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr, hasTouch: profile.touch, serviceWorkers: "block",
  });
  const run = specimen(Date.now() + 176_000);
  const initial = { ...run, phase: "preparing", checks: [], reviewed_head: null, head: null, handover: null,
    work: { ...run.work, ...(profile.name === "wide-trips" ? { id: "TRIP-33", campaign: "Trips" } : { id: "HUB-118", campaign: "Hub & ERA" }) },
    activity: run.activity.slice(0, 1) };
  const state = await routeFixture(context, assets, writes, initial);
  await context.addInitScript(observeRenderedFrames);
  const page = await context.newPage();
  const errors = [];
  const artwork = new Set();
  page.on("response", response => {
    const name = new URL(response.url()).pathname;
    if (!name.startsWith("/assets/transfer-")) return;
    if (!response.ok()) errors.push(name + " returned " + response.status());
    artwork.add(name);
  });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (/Shader Error|INVALID_FRAMEBUFFER|GL_INVALID_OPERATION/i.test(message.text()))
      errors.push(message.text());
  });
  try {
    await openBoard(page, state, assets, initial, "blue");
    {
      await page.addInitScript(() => {
        if (!location.search.includes("roomPerf")) history.replaceState(null, "", location.pathname + "?roomPerf=1" + location.hash);
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".board-workshop").waitFor();
    }
    const button = page.getByRole("button", { name: "Explore 3D" });
    await button.evaluate(element => element.addEventListener("click", () => {
      window.__roomBenchmark.enter = performance.now();
    }, { once: true }));
    await button.click();
    const view = page.getByRole("region", { name: "3D room" });
    await page.waitForFunction(() => window.__roomBenchmark.frames.length > 0);
    await page.locator('.era-brain[data-load="ready"]').waitFor();
    const launch = await page.evaluate(() => window.__roomBenchmark.frames[0].at - window.__roomBenchmark.enter);
    const device = await view.evaluate(element => {
      const canvas = element.querySelector("canvas"), gl = canvas.getContext("webgl2");
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        css: [element.clientWidth, element.clientHeight], buffer: [canvas.width, canvas.height],
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: navigator.userAgent, visible: document.visibilityState,
      };
    });
    await page.waitForTimeout(1000);
    const path = join(directory, `${label}-${profile.name}-${repetition}`);
    if (repetition === 1) await view.screenshot({ path: path + "-spawn.png" });
    const idleStart = await now(page);
    await page.waitForTimeout(10_000);
    const idle = [idleStart, await now(page)];
    const route = profile.name === "high-dpi" || profile.name === "wide-trips" || software ? [
      [["w"], 1350], [["d"], 800], [["a"], 1600], [["d"], 800],
      [["ArrowLeft"], 600], [["ArrowRight"], 1200], [["ArrowLeft"], 600], [["s"], 1350],
    ] : [
      [["d"], 4000], [["w"], 4000], [["ArrowRight"], 2250],
      [["w", "a"], 3750], [["a"], 4000], [["w", "ArrowLeft"], 4000],
      [["s"], 4000], [["d", "ArrowRight"], 4000],
    ];
    await view.focus();
    const ranges = [];
    const walkingBuffers = [];
    for (const [index, [keys, ms]] of route.entries()) {
      if (index === 1) state.run = { ...initial, phase: "building", activity: run.activity.slice(0, 8) };
      if (index === 4) {
        const check = { at: new Date().toISOString(), summary: "Host checks started", kind: "status", job_id: "supervisor", seq: 61 };
        state.run = { ...state.run, phase: "checking", activity: [...state.run.activity, check] };
      }
      for (const key of keys) await page.keyboard.down(key);
      const start = await now(page);
      await page.waitForTimeout(ms);
      ranges.push([start, await now(page)]);
      walkingBuffers.push(await view.evaluate(host => {
        const canvas = host.querySelector("canvas");
        return [canvas.width, canvas.height];
      }));
      for (const key of keys) await page.keyboard.up(key);
    }
    const frames = await page.evaluate(() => window.__roomBenchmark.frames);
    const probe = await view.evaluate(element => element.__eraRoomPerf?.read());
    const native = probe?.frames || [];
    await page.getByLabel("Go to station").selectOption("build");
    await page.waitForTimeout(320);
    if (repetition === 1) await view.screenshot({ path: path + "-build.png" });
    let settled;
    if (profile.name === "wide-trips") {
      const slider = page.getByRole("slider", { name: "Replay" });
      await slider.focus(); await slider.press("End");
      await faceCenterFromSetup(page, view);
      await page.waitForTimeout(1800);
      settled = await view.evaluate(host => {
        const canvas = host.querySelector("canvas");
        return { pose: host.dataset.pose, css: [host.clientWidth, host.clientHeight], buffer: [canvas.width, canvas.height],
          quality: host.__eraRoomPerf?.read()?.quality };
      });
      if (label === "candidate" && settled.buffer.some((value, index) => value < settled.css[index] - 1))
        throw new Error("The resting scene did not resolve to the display at the wide Trips viewpoint");
      if (label === "candidate") {
        for (const material of ["access", "deck", "canopy", "observatory", "pcb"]) {
          if (!artwork.has("/assets/transfer-" + material + ".webp"))
            throw new Error("Trips did not load the " + material + " material");
        }
      }
      if (repetition === 1) await view.screenshot({ path: path + "-settled.png", scale: "css" });
      // Sample the moving image outside the timed route. Keep the input held
      // through the screenshot so the renderer cannot switch back to its idle mode.
      if (repetition === 1) {
        const lowMotion = page.getByRole("button", {name:"Low motion"});
        if (await lowMotion.getAttribute("aria-pressed") !== "true") await lowMotion.click();
        await captureEdges(page,view,path+"-edge");
        const full = label === "candidate" && software ? page.getByRole("button",{name:"Native detail"}) : null;
        if (full) {
          await full.click();
          await page.getByRole("button",{name:"Native detail",pressed:true}).waitFor();
          settled.nativeEdges = await captureEdges(page,view,path+"-native-edge",settled.buffer);
          await full.click();
        }
        await lowMotion.click();
        await view.focus();
        await page.keyboard.down("d");
        try {
          await page.waitForTimeout(220);
          await view.screenshot({ path: path + "-walking.png", scale: "css" });
        } finally { await page.keyboard.up("d"); }
        if (full) {
          await full.click();
          await view.focus();
          const [x,z] = (await view.getAttribute("data-pose")).split(",").map(Number);
          await page.keyboard.down("a");
          try {
            await page.waitForTimeout(350);
            await page.waitForFunction(([x,z]) => {
              const [toX,toZ] = document.querySelector(".era-brain-viewport").dataset.pose.split(",").map(Number);
              return Math.hypot(toX-x,toZ-z) > .05;
            },[x,z]);
            const buffer = await view.evaluate(host => {
              const canvas = host.querySelector("canvas");
              return [canvas.width,canvas.height];
            });
            if (String(buffer) !== String(settled.buffer)) throw new Error("Native detail changed size during input");
            const start = await now(page);
            await page.waitForTimeout(2100);
            const end = await now(page);
            const frames = await page.evaluate(() => window.__roomBenchmark.frames);
            settled.nativeStrafe = stats(frames, [[start,end]]);
            await view.screenshot({path:path+"-native-walking.png",scale:"css"});
            settled.nativeMotionBuffer = buffer;
          } finally { await page.keyboard.up("a"); }
          await full.click();
        }
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
    const result = {
      label, profile, repetition, input: "keyboard", roomSha256: sha256(assets.bundle.room),
      launchMs: Number(launch.toFixed(2)), device, finalBuffer: probe?.buffer, walkingBuffers, settled, artwork: [...artwork].sort(),
      idle: stats(frames, [idle]), movement: stats(frames, ranges),
      traversal: stats(frames, [[ranges[0][0], ranges.at(-1)[1]]]),
      profiler: native.length ? stats(native, ranges) : null,
    };
    results.push(result);
    writeFileSync(path + "-frames.json", JSON.stringify({ frames, native, ranges }, null, 2));
    writeFileSync(join(directory, "results.json"), JSON.stringify({ headed, software, results, writes }, null, 2));
    process.stdout.write(JSON.stringify(result) + "\n");
  } finally {
    await context.close();
  }
}

try {
  for (const profile of profiles)
    for (const [label, assets] of builds)
      for (let run = 1; run <= repetitions; run++) await runRoute(label, assets, profile, run);
  if (writes.length) throw new Error("Benchmark issued unexpected writes");
} finally {
  await browser.close();
}
