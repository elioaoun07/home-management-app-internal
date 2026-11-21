import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromiumExecutable, fixtureAssets, openBoard, routeFixture, specimen } from "./fixtures/local-stage-board.mjs";

const directory = process.env.ERA_BRAIN_EVIDENCE || ".pm/r132-evidence";
mkdirSync(directory, { recursive: true });
const assets = await fixtureAssets(directory);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true,
  args: process.env.ERA_BRAIN_HARDWARE === "1" ? [] : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const writes = [], errors = [], profiles = [];

async function lightingSequence() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const run = specimen();
  run.work = { ...run.work, id: "HUB-118", campaign: "Hub & ERA" };
  const row = (seq, kind, summary) => ({ at: new Date().toISOString(), job_id: "lighting", seq, kind, summary });
  run.phase = "preparing";
  run.activity = [row(0, "status", "Installing dependencies")];
  run.checks = [];
  run.head = null;
  run.handover = null;
  const state = await routeFixture(context, assets, writes, run);
  await openBoard(page, state, assets, run, "blue");
  await page.getByRole("button", { name: "Explore 3D" }).click();
  const room = page.locator(".era-brain");
  const canvas = room.locator("canvas");
  const endpoint = (zone) => page.locator(`.era-brain[data-load="ready"][data-active-station="${zone}"]`).waitFor();
  const record = (name) => page.screenshot({ path: `${directory}/${name}.png` });
  await endpoint("setup");
  const originalCanvas = await canvas.elementHandle();
  await record("01-preparing");
  const preparing = await canvas.screenshot();
  await page.waitForTimeout(530);
  assert.equal(preparing.equals(await canvas.screenshot()), false, "stationary preparation breath changes the rendered scene");
  // Capture the real canvas during local-only evidence updates, with the camera fixed.
  await canvas.evaluate(node => {
    if (!node.captureStream || typeof MediaRecorder === "undefined") return;
    const stream = node.captureStream(30);
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    node.finishClip = () => new Promise(resolve => {
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
      };
      recorder.stop();
    });
    recorder.start();
  });
  state.run = { ...run, phase: "building", activity: [...run.activity,
    row(1, "status", "Native session started"), row(2, "edit", "src/panel.ts")] };
  await endpoint("build");
  assert.equal(await originalCanvas.evaluate(node => node === document.querySelector(".era-brain-viewport canvas")), true, "a delivery poll preserves the existing WebGL world");
  await page.waitForTimeout(850);
  await record("02-building");
  const building = await canvas.screenshot();
  await page.waitForTimeout(470);
  assert.equal(building.equals(await canvas.screenshot()), false, "stationary Build keeps the orbit highlights moving");

  state.run = { ...state.run, activity: [...state.run.activity, row(3, "command", "pnpm typecheck")] };
  await endpoint("bench");
  await record("03-bench-command");
  state.run = { ...state.run, phase: "checking", activity: [...state.run.activity, row(4, "status", "Host checks started")] };
  await endpoint("verify");
  await record("04-verify-pending");
  const returned = row(5, "status", "test: 0");
  state.run = { ...state.run, activity: [...state.run.activity, returned],
    checks: [{ name: "test", exit: 0, stdout: "12 passed", stderr: "", error: null, finished_at: returned.at }] };
  await page.waitForFunction(() => [...document.querySelectorAll(".flight-tick")].some(node => node.dataset.kind === "check"));
  await page.waitForTimeout(620);
  await record("05-verify-returned");
  const clip = await canvas.evaluate(node => node.finishClip?.());
  if (clip?.length) writeFileSync(`${directory}/prepare-build-verify.webm`, Buffer.from(clip));

  const slider = page.getByRole("slider", { name: "Replay" });
  await slider.focus();
  await slider.press("End");
  await slider.press("ArrowLeft");
  await endpoint("verify");
  const beforeResult = await canvas.screenshot({ path: directory + "/paused-start.png" });
  await page.waitForTimeout(400);
  assert.equal(beforeResult.equals(await canvas.screenshot({ path: directory + "/paused-end.png" })), false, "the healthy collector keeps rotating at a held replay cursor");
  await endpoint("verify");
  await slider.press("ArrowLeft");
  await endpoint("bench");
  await slider.press("ArrowLeft");
  await endpoint("build");
  await page.locator(".room-now").getByText("Building", { exact: true }).waitFor();
  assert.equal(await page.locator(".room-now").getByText("Check passed", { exact: false }).count(), 0);
  await room.getByRole("button", { name: "Low motion" }).click();
  await page.waitForTimeout(150);
  const still = await canvas.screenshot();
  await page.waitForTimeout(400);
  assert.ok(still.equals(await canvas.screenshot()), "low motion freezes the collector");
  await room.getByRole("button", { name: "Map", exact: true }).click();
  assert.equal(await canvas.evaluate(node => node.getAnimations().length), 0, "changing camera never flashes the canvas");
  await record("06-building-map");
  await context.close();
  return { preparing: true, build: true, bench: true, verify: true, stationaryReplay: true, clipBytes: clip?.length ?? 0 };
}

async function failureSequence() {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, serviceWorkers: "block"});
  try {
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    const run = specimen();
    run.work = { ...run.work, id: "TRIP-33", campaign: "Trips" };
    run.phase = "failed";
    run.failure = { code: "commit-hook", step: "commit", detail: "Hook exited with code 1" };
    run.error = "git commit: hook failed";
    run.head = run.handover = null;
    run.checks = [];
    run.activity = run.activity.slice(0, run.activity.findIndex(event => event.summary === "Committing candidate") + 1);
    const state = await routeFixture(context, assets, writes, run);
    await openBoard(page, state, assets, run, "blue");
    await page.getByRole("button", { name: "Explore 3D" }).click();
    const room = page.locator('.era-brain[data-load="ready"]');
    const damaged = page.locator('.era-brain[data-core-state="damaged"][data-fault-station="seal"]');
    await damaged.waitFor();
    const view = page.getByRole("region", {name: "3D room"});
    await view.screenshot({ path: directory + "/failed-trips.png" });
    const slider = page.getByRole("slider", {name:"Replay"});
    await slider.focus(); await slider.press("End"); await slider.press("ArrowLeft");
    await page.locator('.era-brain[data-core-state="healthy"]:not([data-fault-station])').waitFor();
    await view.screenshot({ path: directory + "/recovered-before-failure.png" });
    await slider.press("End");
    await damaged.waitFor();
    await room.getByRole("button",{name:"Inspect break"}).click();
    await page.waitForTimeout(400);
    const canvas = view.locator("canvas");
    await canvas.evaluate(node => {
      const stream = node.captureStream(30), recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = event => chunks.push(event.data);
      node.stopFaultClip = () => new Promise(resolve => {
        recorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
        };
        recorder.stop();
      });
      recorder.start();
    });
    await room.getByRole("button",{name:"Low motion"}).click();
    await page.waitForTimeout(100);
    const bounds = await canvas.boundingBox();
    const clip = {x: Math.ceil(bounds.x + bounds.width * .1), y: Math.ceil(bounds.y + bounds.height * .10),
      width: Math.floor(bounds.width * .8), height: Math.floor(bounds.height * .78)};
    const floor = () => page.screenshot({clip});
    const quiet = await floor();
    writeFileSync(directory+"/broken-seal-cable.png", quiet);
    await page.waitForTimeout(350);
    assert.ok(quiet.equals(await floor()), "reduced motion holds the severed wire still");
    await room.getByRole("button",{name:"Low motion"}).click();
    const deadline = Date.now() + 8500;
    let strike = null, restored = false;
    while (Date.now() < deadline && !restored) {
      const frame = await floor();
      if (!quiet.equals(frame) && !strike) strike = frame;
      else if (strike && quiet.equals(frame)) restored = true;
    }
    assert.ok(strike && restored, "the damaged circuit discharges briefly and returns to the same dark frame");
    writeFileSync(directory + "/seal-sparks.png", strike);
    const bytes = await canvas.evaluate(node => node.stopFaultClip());
    writeFileSync(directory + "/seal-sparks.webm", Buffer.from(bytes));
    const nativeDetail = page.getByRole("button",{name:"Native detail"});
    if (await nativeDetail.isVisible()) {
      const next = await nativeDetail.getAttribute("aria-pressed") === "true" ? "false" : "true";
      await nativeDetail.click();
      await room.getByRole("button",{name:"Board",exact:true}).click();
      await page.getByRole("button",{name:"Explore 3D"}).click();
      await damaged.waitFor();
      assert.equal(await nativeDetail.getAttribute("aria-pressed"),next,"native detail persists across Walk visits");
      await nativeDetail.click();
    }
    return { station: "seal", rewindRestoredSphere: true, reducedMotionSteady: true, intermittentDischarge: true };
  } finally { await context.close(); }
}

try {
  const lighting = await lightingSequence();
  const failure = await failureSequence();
  for (const mobile of [false, true]) {
    const theme = mobile ? "pink" : "blue";
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      reducedMotion: mobile ? "reduce" : "no-preference",
      hasTouch: mobile,
    });
    const run = specimen();
    const at = new Date(Date.now() - 12000).toISOString();
    run.activity = [
      { at, job_id: "demo", seq: 41, kind: "edit", summary: "src/panel.ts" },
      { at, job_id: "demo", seq: 42, kind: "status", summary: "Host checks started" },
      { at, job_id: "demo", seq: 43, kind: "status", summary: "test: 0" },
      { at, job_id: "demo", seq: 44, kind: "status", summary: "Ready for owner UAT" },
    ];
    run.work = { ...run.work, id: "TRIP-33", campaign: "Trips" };
    run.checks = [{ name: "test", exit: 0, stdout: "12 passed", stderr: "", error: null, finished_at: at }];
    const state = await routeFixture(context, assets, writes, run);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await openBoard(page, state, assets, run, theme);
    await page.getByRole("button", { name: "Explore 3D" }).click();
    const room = page.locator(".era-brain");
    const viewport = page.getByRole("region", { name: "3D room" });
    await page.locator('.era-brain[data-load="ready"]').waitFor();
    assert.equal(await room.locator(".era-brain-identity .era-mark").getAttribute("aria-label"), "ERA Trip");
    await page.waitForFunction(() => !!document.querySelector(".era-brain-viewport")?.dataset.pose);
    assert.equal(await room.locator("canvas").count(), 1);
    await page.screenshot({ path: `${directory}/${theme}-walk.png` });
    const pose = () => viewport.getAttribute("data-pose");
    if (!mobile) {
      const before = await pose();
      await viewport.focus();
      await page.keyboard.down("w");
      await page.waitForFunction(value => document.querySelector(".era-brain-viewport").dataset.pose !== value, before);
      await page.keyboard.up("w");
      await viewport.click({ position: { x: 290, y: 140 } });
      await page.waitForFunction(() => document.pointerLockElement?.matches(".era-brain-viewport"));
      const yaw = (await pose()).split(",")[2];
      await page.mouse.move(380, 260, { steps: 4 });
      await page.waitForFunction(value => document.querySelector(".era-brain-viewport").dataset.pose.split(",")[2] !== value, yaw);
      await viewport.press("q");
      await page.getByRole("dialog").waitFor();
      await page.waitForFunction(() => document.pointerLockElement === null);
      await page.getByRole("button", { name: "Close questions" }).click();
    } else {
      await room.getByRole("button", { name: "Ask ERA" }).tap();
      await page.getByRole("dialog").getByRole("button", { name: "Close questions" }).tap();
      const before = await pose();
      const bounds = await viewport.boundingBox();
      const client = await context.newCDPSession(page);
      const x = bounds.x + bounds.width * .24, y = bounds.y + bounds.height * .54;
      const left = { x, y, id: 1 }, right = { x: x + bounds.width * .5, y, id: 2 };
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left, right] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...left, y: y - 43 }, { ...right, x: right.x + 28 }] });
      assert.equal(await viewport.getAttribute("data-thumb"), "true");
      await page.waitForFunction(value => {
        const [x, z, yaw] = document.querySelector(".era-brain-viewport").dataset.pose.split(",");
        const [priorX, priorZ, priorYaw] = value.split(",");
        return (x !== priorX || z !== priorZ) && yaw !== priorYaw;
      }, before);
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      assert.equal(await viewport.getAttribute("data-thumb"), null);
      await client.detach();
    }
    await room.getByLabel("Go to station").selectOption("build");
    await room.getByRole("button", { name: "Build", exact: true }).waitFor();
    const beforeSeat = await pose();
    if (mobile) await room.getByRole("button", { name: "Ask ERA" }).click();
    else { await viewport.focus(); await viewport.press("q"); }
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    if (mobile) await page.screenshot({ path: `${directory}/${theme}-questions.png` });
    await dialog.getByRole("button", { name: "What changed here?" }).click();
    await dialog.getByText("Edit recorded for src/panel.ts.").waitFor();
    await dialog.getByRole("button", { name: "Discuss at seat" }).click();
    await page.getByRole("heading", { name: "Talk with ERA" }).waitFor();
    await page.screenshot({ path: `${directory}/${theme}-seat.png` });
    await dialog.getByRole("button", { name: "src/panel.ts" }).click();
    const reader = page.getByRole("region", { name: "Room output" });
    await reader.getByText("src/panel.ts", { exact: true }).first().waitFor();
    await reader.getByRole("button", { name: "Pin A" }).click();
    await reader.getByRole("button", { name: "Close output" }).click();
    await room.getByRole("button", { name: "Stand up" }).click();
    await page.waitForFunction(expected => document.querySelector(".era-brain-viewport").dataset.pose === expected, beforeSeat);
    await page.getByRole("navigation", { name: "Room steps" }).getByRole("button", { name: "Verify" }).click();
    assert.equal(await reader.getByText("12 passed", { exact: true }).count(), 0);
    await reader.getByRole("button", { name: "Close output" }).click();
    await room.getByRole("button", { name: "Realistic" }).click();
    await page.locator('.era-brain[data-finish="illustrated"]').waitFor();
    await room.getByRole("button", { name: "Map", exact: true }).click();
    await page.waitForTimeout(480);
    await page.screenshot({ path: `${directory}/${theme}-illustrated-map.png` });
    await room.getByRole("button", { name: "Walk", exact: true }).click();
    await room.getByRole("button", { name: "Recenter" }).click();
    if (!mobile) {
      await page.keyboard.down("w");
      await room.getByRole("button", { name: "Inside ERA", exact: true }).waitFor();
      await page.keyboard.up("w");
      await room.getByRole("button", { name: "Inside ERA", exact: true }).click();
      await page.locator('.era-brain[data-area="core"]').waitFor();
      await page.screenshot({ path: `${directory}/blue-inside.png` });
      await room.getByRole("button", { name: "Back to room" }).click();
      await page.locator('.era-brain[data-area="room"]').waitFor();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (!mobile) {
      await page.locator(".era-brain canvas").evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
      await room.getByText("3D room unavailable").waitFor();
      await room.getByRole("button", { name: "Open board" }).click();
      await page.locator('[data-renderer="solid-board"]').waitFor();
    }
    profiles.push({ theme, mobile, room: true });
    await context.close();
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  writeFileSync(directory + "/result.json", JSON.stringify({ profiles, lighting, failure, writes, errors }, null, 2));
} finally {
  await browser.close();
}
