// R126 slice2: real exported camera in a test-only DOM, plus actual app wiring.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  chromiumExecutable, fixtureAssets, routeFixture, shiftCase, sourceSnapshot,
} from "./fixtures/local-stage-board.mjs";
import {
  cameraSample, command, controllerBundle, installController, waitFollowFrame,
} from "./fixtures/local-camera-controller.mjs";

const evidence = process.env.ERA_CAMERA_EVIDENCE || ".pm/r126-evidence/slice2";
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const harness = await controllerBundle(evidence);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const executablePath = chromiumExecutable();
assert.ok(executablePath);
const browser = await chromium.launch({ headless: true, executablePath, args: ["--mute-audio"] });
const allProfiles = [
  { width: 1280, height: 640, dpr: 1 }, { width: 1358, height: 696, dpr: 1.65 },
  { width: 1494, height: 934, dpr: 1.5 }, { width: 390, height: 844, dpr: 1 },
  { width: 2560, height: 1440, dpr: 2 },
];
const widths = process.env.ERA_CAMERA_WIDTHS?.split(",").map(Number);
const profiles = allProfiles.filter((profile) => !widths || widths.includes(profile.width));
const themes = process.env.ERA_CAMERA_THEMES?.split(",") || ["blue", "pink"];
const phase = process.env.ERA_CAMERA_PHASE || "all";
assert.ok(profiles.length && themes.every((theme) => ["blue", "pink"].includes(theme)));
assert.ok(["all", "controller", "app"].includes(phase));
const zones = ["brief", "setup", "explore", "think", "build", "bench", "seal", "verify", "handover", "test", "ship"];
const checks = [], captures = [], errors = [], writes = [], pure = [], integration = [];
async function capture(page, name) {
  const path = `${evidence}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  captures.push(path);
}
async function check(page, name, action) {
  try { await action(); checks.push({ name, status: "passed" }); }
  catch (error) {
    checks.push({ name, status: "failed", message: error.message, stack: error.stack });
    process.stderr.write(`${name}: ${error.stack}\n`);
    await capture(page, `${name}-failure`);
  }
}
const sample = (page, zone) => page.evaluate(cameraSample, zone);
const fonts = (value) => Math.min(...value.labels.map((label) => label.font));
const overviewFill = (value) => Math.max(value.wrapper.width / value.region.width, value.wrapper.height / value.region.height);
const waitMode = (page, mode, zone = "") => page.waitForFunction(({ mode, zone }) => {
  const data = document.querySelector(".board-camera")?.dataset;
  return data?.cameraMode === mode && (!zone || data.cameraZone === zone);
}, { mode, zone }, { timeout: 8000 });

async function pureChecks(profile, theme) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, serviceWorkers: "block" });
  const page = await installController(context, assets, harness, theme);
  page.on("pageerror", (error) => errors.push(error.message));
  const key = `controller-${profile.width}-${theme}`, facts = { key, follows: [] };
  await check(page, `${key}-eleven-follow`, async () => {
    const initial = await sample(page);
    assert.equal(initial.attrs.cameraMode, "overview");
    assert.ok(overviewFill(initial) >= 0.85);
    await capture(page, `${key}-overview`);
    let nowMs = 0;
    for (const zone of zones) {
      await command(page, { action: "observe", nowMs: nowMs += 1000, value: { stagedZone: zone, rowAgeMs: 0 } });
      const frame = await waitFollowFrame(page, zone);
      assert.ok(frame.elapsed <= 900, `${zone} framed in ${frame.elapsed}ms`);
      assert.ok(Math.abs(frame.ratio - 0.28) < 0.001, `${zone} width ${frame.ratio}`);
      assert.ok(frame.error < 2, `${zone} centred ${frame.error}px`);
      assert.ok(frame.minFont >= 10.99, `${zone} labels during ease ${frame.minFont}px`);
      const value = await sample(page, zone);
      assert.ok(fonts(value) >= 10.99, `${zone} labels ${fonts(value)}px`);
      facts.follows.push({ ...frame, font: fonts(value) });
      if (profile.width === 1494 && theme === "blue") await capture(page, `follow-zone-${zone}`);
    }
    for (const [index, zone] of ["build", "verify", "explore"].entries()) {
      await command(page, { action: "observe", nowMs: 20000 + index * 1000, value: { stagedZone: zone, rowAgeMs: 0 } });
      if (zone !== "explore") await page.waitForTimeout(100);
    }
    facts.rapidRetarget = await waitFollowFrame(page, "explore");
    assert.ok(facts.rapidRetarget.minFont >= 10.99, `rapid Follow retarget labels ${facts.rapidRetarget.minFont}px`);
  });
  await check(page, `${key}-inspect-hold-idle-freeze`, async () => {
    await command(page, { action: "overview" });
    await page.waitForTimeout(960);
    const fit = await sample(page);
    await command(page, { action: "inspect", zone: "verify" });
    await page.waitForTimeout(960);
    const inspect = await sample(page, "verify");
    assert.ok(Math.abs(inspect.scale / fit.scale - 2.2) < 0.002);
    await command(page, { action: "overview" });
    await command(page, { action: "follow" });
    await command(page, { action: "observe", nowMs: 50000, value: { stagedZone: "build", rowAgeMs: 0 } });
    await page.waitForTimeout(960);
    await command(page, { action: "drag", nowMs: 50000, dx: 37, dy: 19 });
    const held = await sample(page);
    await command(page, { action: "observe", nowMs: 54999, value: { stagedZone: "brief", rowAgeMs: 0 } });
    assert.equal((await sample(page)).transform, held.transform, "manual pan holds for4999ms");
    await command(page, { action: "observe", nowMs: 55000, value: { stagedZone: "brief", rowAgeMs: 0 } });
    await page.waitForTimeout(960);
    assert.equal((await sample(page)).attrs.cameraZone, "brief");
    await command(page, { action: "observe", nowMs: 56000, value: { stagedZone: "think", rowAgeMs: 0, reducedMotion: true } });
    const cut = await sample(page);
    assert.equal(cut.transition, "0s");
    assert.equal(cut.attrs.cameraZone, "think");
    await command(page, { action: "observe", nowMs: 57000, value: { frozen: true } });
    const frozen = await sample(page);
    for (const value of [{ action: "inspect", zone: "ship" }, { action: "zoom", delta: -500 }, { action: "drag", dx: 100, dy: 100 }, { action: "overview" }]) await command(page, value);
    assert.equal((await sample(page)).transform, frozen.transform);
    await command(page, { action: "observe", nowMs: 60000, value: { frozen: false, closed: false, stagedZone: "build", rowAgeMs: 19999 } });
    assert.equal((await sample(page)).attrs.cameraMode, "follow");
    await command(page, { action: "observe", nowMs: 60001, value: { rowAgeMs: 20000 } });
    assert.equal((await sample(page)).attrs.cameraMode, "overview");
    await command(page, { action: "observe", nowMs: 61000, value: { stagedZone: "ship", rowAgeMs: 0, closed: true } });
    assert.equal((await sample(page)).attrs.cameraMode, "overview");
    facts.inspectZoom = inspect.scale / fit.scale;
    facts.manualHoldBoundary = [4999, 5000]; facts.idleBoundary = [19999, 20000];
    facts.reducedCut = cut; facts.frozen = frozen;
    await capture(page, `${key}-cuts-and-overview`);
  });
  pure.push(facts);
  await context.close();
}

function liveRun() {
  const run = shiftCase("failed-hook");
  run.phase = "building"; run.error = undefined; run.failure = undefined;
  run.head = null; run.checks = []; run.handover = null;
  run.activity = [
    { at: new Date(Date.now() - 30000).toISOString(), kind: "status", summary: "Native session started", seq: 0, job_id: "native" },
    { at: new Date(Date.now() - 1000).toISOString(), kind: "command", summary: "Get-Content src/fixture/initial.ts", seq: 1, job_id: "native" },
  ];
  return run;
}
async function openApp(page, state, theme) {
  await page.goto(assets.base);
  await page.evaluate(({ theme, id }) => {
    localStorage.setItem("pm-app-theme", theme); localStorage.setItem("pm-game-layer", "on");
    localStorage.setItem(`pm-local-attention:${id}`, "[]");
  }, { theme, id: state.run.run_id });
  await page.goto(`${assets.base}?camera-fixture=${Date.now()}#/delivery/run/${state.run.run_id}`);
  await page.waitForFunction(() => document.querySelectorAll(".board-zone").length === 11 && document.querySelector(".board-camera")?.dataset.cameraMode);
  await page.waitForTimeout(400);
}
async function bakeReceipt(page) {
  return page.locator(".board-workshop").evaluate((root) => ({ bucket: Number(root.dataset.zoomBucket), bakeMs: Number(root.dataset.bakeMs), assetBakeMs: Number(root.dataset.assetBakeMs), staticDpr: Number(root.dataset.staticDpr), motionDpr: Number(root.dataset.motionDpr), at: performance.now() }));
}
function canvasCounter() {
  let count = 0;
  const create = document.createElement.bind(document);
  document.createElement = (tag, ...options) => {
    if (String(tag).toLowerCase() === "canvas") count++;
    return create(tag, ...options);
  };
  document.addEventListener("DOMContentLoaded", () => {
    const output = create("output"); output.hidden = true; output.id = "camera-fixture-canvas-count";
    document.body.append(output);
  }, { once: true });
  document.addEventListener("camera-fixture-count", () => {
    const output = document.getElementById("camera-fixture-canvas-count");
    if (output) output.textContent = String(count);
  });
}
const canvasCount = (page) => page.evaluate(() => {
  document.dispatchEvent(new Event("camera-fixture-count"));
  return Number(document.getElementById("camera-fixture-canvas-count").textContent);
});
async function traceBakes(page) {
  await page.locator(".board-workshop").evaluate((root) => {
    const output = document.createElement("ol"); output.hidden = true; output.id = "camera-fixture-bakes";
    document.body.append(output);
    new MutationObserver((records) => {
      if (!records.some((record) => record.attributeName === "data-bake-ms")) return;
      const row = document.createElement("li");
      row.textContent = JSON.stringify({ bucket: Number(root.dataset.zoomBucket), bakeMs: Number(root.dataset.bakeMs), assetBakeMs: Number(root.dataset.assetBakeMs), at: performance.now() });
      output.append(row);
    }).observe(root, { attributes: true, attributeFilter: ["data-bake-ms"] });
  });
}
async function waitBucket(page, bucket) {
  await page.waitForFunction((value) => Number(document.querySelector(".board-workshop")?.dataset.zoomBucket) === value, bucket, { timeout: 5000 });
  const value = await bakeReceipt(page);
  assert.ok(value.bakeMs > 0 && value.bakeMs < 4, `bucket${bucket} actual allocate+bake ${value.bakeMs}ms`);
  assert.ok(value.staticDpr <= 2 && value.motionDpr <= 1.5);
  return value;
}
async function wheelZoom(page, zoom) {
  const region = await page.locator(".board-region").boundingBox();
  const dpr = await page.evaluate(() => devicePixelRatio);
  const observed = page.evaluate(() => new Promise((resolve) => {
    document.querySelector(".board-workshop").addEventListener("wheel", (event) =>
      resolve({ deltaY: event.deltaY, control: event.ctrlKey, dpr: devicePixelRatio }), { once: true, capture: true });
  }));
  await page.mouse.move(region.x + 12, region.y + region.height / 2);
  await page.keyboard.down("Control");
  // Installed Chromium's CDP wheel reports device-scaled deltas at fractional
  // DPR. Compensate the test input, then retain the actual DOM wheel witness.
  await page.mouse.wheel(0, -Math.log(zoom) * 1000 * dpr);
  await page.keyboard.up("Control");
  return { requestedZoom: zoom, sentDelta: -Math.log(zoom) * 1000 * dpr, ...await observed };
}
async function appChecks(profile, theme) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, serviceWorkers: "block" });
  await context.addInitScript(canvasCounter);
  const state = await routeFixture(context, assets, writes, liveRun());
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const key = `app-${profile.width}-${theme}`, facts = { key, buckets: [], wheels: [] };
  await check(page, `${key}-inspect-labels-buckets`, async () => {
    await openApp(page, state, theme);
    const wrapper = page.locator(".board-camera");
    assert.equal(await wrapper.getAttribute("data-camera-mode"), "overview", "initial latest row does not start Follow");
    assert.ok(overviewFill(await sample(page)) >= 0.85);
    await traceBakes(page);
    await page.locator(".board-workshop").evaluate((root) => { root.dataset.debug = "true"; });
    await page.setViewportSize({ width: profile.width + 1, height: profile.height });
    await page.waitForTimeout(350);
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await page.waitForTimeout(350);
    facts.buckets.push(await waitBucket(page, 1));
    const before = await sample(page);
    facts.overview = before;
    const followBefore = await wrapper.getAttribute("data-camera-follow");
    await page.keyboard.press("f");
    assert.notEqual(await wrapper.getAttribute("data-camera-follow"), followBefore);
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false, "F never invokes Theater");
    await page.keyboard.press("f");
    facts.inspectSamples = await page.evaluate(async () => {
      const start = performance.now();
      document.querySelector('.board-zone-name[data-zone="build"]').click();
      const rows = [];
      for (const at of [100, 300, 600, 850]) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, at - (performance.now() - start))));
        const labels = [...document.querySelectorAll(".board-zone-name")].map((node) => {
          let scale = 1;
          for (let p = node; p; p = p.parentElement) {
            const transform = getComputedStyle(p).transform;
            if (transform !== "none") { const m = new DOMMatrixReadOnly(transform); scale *= Math.hypot(m.a, m.b); }
          }
          return { font: parseFloat(getComputedStyle(node).fontSize) * scale, height: node.getBoundingClientRect().height };
        });
        rows.push({ at: performance.now() - start, labels });
      }
      return rows;
    });
    for (const row of facts.inspectSamples) assert.ok(Math.min(...row.labels.map((label) => label.font)) >= 10.99, `Inspect+drawer font at${row.at}ms`);
    await page.waitForTimeout(300);
    const inspect = await sample(page, "build");
    facts.inspect = inspect;
    assert.equal(inspect.attrs.cameraMode, "inspect");
    assert.ok(Math.abs(inspect.scale / before.scale - 2.2) < 0.005, `Inspect ratio ${inspect.scale / before.scale}`);
    await capture(page, `${key}-inspect`);
    await page.keyboard.press("Escape");
    await waitMode(page, "overview");
    await page.waitForTimeout(1100);
    assert.equal(await page.getByRole("tabpanel").isVisible(), false);
    facts.buckets.push(await waitBucket(page, 1));
    facts.wheels.push(await wheelZoom(page, 1.5));
    await page.waitForTimeout(50);
    await page.keyboard.press("0");
    await page.waitForTimeout(210);
    assert.equal((await bakeReceipt(page)).bucket, 1, "a new900ms shot cancels the obsolete150ms bucket callback");
    await page.waitForTimeout(1000);
    await waitBucket(page, 1);
    for (const bucket of [1.5, 2.2]) {
      facts.wheels.push(await wheelZoom(page, bucket));
      await page.waitForTimeout(90);
      assert.equal((await bakeReceipt(page)).bucket, 1, "bucket rebake waits150ms after settle");
      facts.buckets.push(await waitBucket(page, bucket));
      await page.keyboard.press("0");
      await waitMode(page, "overview");
      await waitBucket(page, 1);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.motion === "paused");
    const beforeCanvases = await canvasCount(page);
    for (const bucket of [1.5, 2.2]) {
      facts.wheels.push(await wheelZoom(page, bucket));
      await waitBucket(page, bucket);
      await page.keyboard.press("0");
      await waitBucket(page, 1);
    }
    const afterCanvases = await canvasCount(page);
    assert.equal(afterCanvases, beforeCanvases, "paused zoom buckets reuse cached canvases/assets");
    facts.canvasReuse = { beforeCanvases, afterCanvases };
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await capture(page, `${key}-overview`);
  });
  await check(page, `${key}-recorded-follow-and-terminal`, async () => {
    if (await page.locator(".board-camera").getAttribute("data-camera-follow") !== "true") await page.keyboard.press("f");
    state.run.activity.push({ at: new Date().toISOString(), kind: "command", summary: "Get-Content src/fixture/follow.ts", seq: 2, job_id: "native" });
    await waitMode(page, "follow", "explore");
    await page.waitForTimeout(950);
    const value = await sample(page, "explore");
    assert.ok(Math.abs(value.pad.width / value.region.width - 0.28) < 0.002);
    facts.recordedFollow = value;
    await capture(page, `${key}-recorded-follow`);
    if ((profile.width === 1494 && theme === "blue") || (profile.width === 390 && theme === "pink")) {
      state.failed = true;
      await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.liveness === "link-down");
      const frozen = await sample(page);
      await page.keyboard.press("f"); await page.keyboard.press("0"); await wheelZoom(page, 1.5);
      await page.waitForTimeout(200);
      assert.equal((await sample(page)).transform, frozen.transform);
      assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
      facts.linkDown = frozen;
      state.failed = false;
      await page.locator(".board-workshop").getByRole("button", { name: "Retry", exact: true }).click();
      await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.liveness !== "link-down");
    }
    state.run.phase = "failed";
    state.run.error = "native session failed: Fixture terminal";
    await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.phase === "failed");
    await waitMode(page, "overview");
    facts.terminal = await sample(page);
    await capture(page, `${key}-terminal-overview`);
  });
  integration.push(facts);
  facts.bakeEvents = await page.locator("#camera-fixture-bakes li").allTextContents().then((rows) => rows.map((row) => JSON.parse(row)));
  await check(page, `${key}-all-bake-events`, async () => {
    assert.ok(facts.bakeEvents.length >= 3 && [1, 1.5, 2.2].every((bucket) => facts.bakeEvents.some((value) => value.bucket === bucket)),
      "all three zoom buckets have actual observed bake events");
    for (const value of facts.bakeEvents) {
      assert.ok(value.bakeMs > 0 && value.bakeMs < 4, `observed bucket${value.bucket} allocate+compose ${value.bakeMs}ms`);
      if (Number.isFinite(value.assetBakeMs)) assert.ok(value.assetBakeMs < 150, `cold assets ${value.assetBakeMs}ms`);
    }
  });
  await context.close();
}

try {
  for (const profile of profiles) for (const theme of themes) {
    if (phase !== "app") await pureChecks(profile, theme);
    if (phase !== "controller") await appChecks(profile, theme);
  }
} finally {
  const finalSourceFacts = sourceSnapshot();
  const changedSources = [...new Set([...Object.keys(assets.sourceFacts), ...Object.keys(finalSourceFacts)])].filter((path) => assets.sourceFacts[path]?.sha256 !== finalSourceFacts[path]?.sha256);
  checks.push({ name: "source identity", status: changedSources.length ? "failed" : "passed", changedSources });
  writeFileSync(`${evidence}/result.json`, JSON.stringify({ status: checks.some((row) => row.status === "failed") || errors.length || writes.length ? "failed" : "passed", phase, profiles, themes, checks, captures, pure, integration, errors, writes, sourceFacts: assets.sourceFacts, finalSourceFacts, bundleFacts: assets.bundleFacts, harnessHash: harness.sha256, limits: ["Headless fixture/controller measurements", "Owner FPS, physical devices and motion comfort remain unverified"] }, null, 2));
  await browser.close();
  assert.equal(checks.filter((row) => row.status === "failed").length, 0, checks.filter((row) => row.status === "failed").map((row) => row.name + ": " + row.message).join("\n"));
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
}
process.stdout.write(`R126 slice2 camera: ${checks.length} checks, ${captures.length} captures\n`);
