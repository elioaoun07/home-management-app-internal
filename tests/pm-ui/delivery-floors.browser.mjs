// Both floors of Local Delivery, driven through the same controls as the owner.
// Only the authenticated read responses are simulated. All writes are refused.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildApp } from "../../scripts/pm/app-build.mjs";
import { appAsset, buildAppShell } from "../../scripts/pm/app-shell.mjs";
import { boardRun, handover, passedChecks } from "./local-board-fixtures.ts";

const directory = process.env.ERA_FLOORS_EVIDENCE || ".pm/delivery-floors-evidence";
mkdirSync(directory, { recursive: true });
const origin = "http://127.0.0.1:4397";
const bundle = await buildApp();
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.ERA_CHROME_PATH || undefined, headless: true,
  args: process.env.ERA_BRAIN_HARDWARE === "1" ? [] : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [], writes = [], results = [];
const files = new Map([["src/clock.ts", "clockTick(17)"], ["src/frame.ts", "frameStep(42)"]]);

// Observe the real draw and subsequent GPU upload of the chosen fixture line.
// Wrappers always delegate to the browser, with the original arguments.
function observeProjection(tokens) {
  const labels = new WeakMap();
  window.floorUploads = [];
  const draw = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
    const token = tokens.find(value => String(text).includes(value));
    if (token) labels.set(this.canvas, token);
    return draw.call(this, text, ...args);
  };
  for (const name of ["texImage2D", "texSubImage2D"]) {
    const upload = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function (...args) {
      const result = upload.apply(this, args);
      const source = args.find(value => value && typeof value === "object" && labels.has(value));
      if (source && this.canvas.closest(".era-brain-viewport")) window.floorUploads.push(labels.get(source));
      return result;
    };
  }
}

async function move(page, mobile) {
  const viewport = page.locator(".era-brain-viewport");
  const before = await viewport.getAttribute("data-pose");
  assert.ok(before, "a real camera pose exists before movement");
  const moved = () => page.waitForFunction(({ prior, touch }) => {
    const pose = document.querySelector(".era-brain-viewport").dataset.pose.split(",");
    const [x, z, yaw] = prior.split(",");
    return (pose[0] !== x || pose[1] !== z) && (!touch || pose[2] !== yaw);
  }, { prior: before, touch: mobile });
  if (!mobile) {
    await viewport.focus();
    await page.keyboard.down("a");
    try { await moved(); } finally { await page.keyboard.up("a"); }
    return;
  }
  const { x, y, width, height } = await viewport.boundingBox();
  const client = await page.context().newCDPSession(page);
  const left = { x: x + width * .21, y: y + height * .54, id: 1 };
  const right = { x: x + width * .72, y: left.y, id: 2 };
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left, right] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...left, x: left.x - 38 }, { ...right, x: right.x + 24 }] });
    await moved();
  } finally {
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
  }
}

async function verify({ width, height, mobile }) {
  const profile = mobile ? "phone" : "desktop";
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block",
    reducedMotion: mobile ? "reduce" : "no-preference", hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(24_000);
  page.on("pageerror", error => errors.push(error.message));
  const now = Date.now();
  const run = boardRun({ run_id: "local-00000000-0000-4000-8000-000000000190", phase: "uat-ready", canMerge: true,
    base: "b".repeat(40), head: "c".repeat(40), current_head: "c".repeat(40), checks: passedChecks(),
    handover: handover(true), activity: ["Native session started", "src/clock.ts", "Ready for owner UAT"].map((summary, i) =>
      ({ at: new Date(now - 60_000 + i * 15_000).toISOString(), job_id: "fixture", kind: i === 1 ? "edit" : "status", seq: i, summary })) });
  const reads = [];
  await context.addInitScript(theme => {
    localStorage.setItem("pm-game-layer", "on");
    localStorage.setItem("pm-app-theme", theme);
  }, mobile ? "pink" : "blue");
  await context.route("**/*", route => {
    const req = route.request(), url = new URL(req.url()), params = url.searchParams;
    if (url.origin !== origin) return route.abort();
    if (req.method() === "HEAD" && url.pathname === "/api/health") return route.fulfill({ status: 200, body: "" });
    if (req.method() !== "GET") { writes.push(req.method()); return route.abort(); }
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: buildAppShell() });
    const asset = appAsset(url.pathname, bundle);
    if (asset) return route.fulfill({ contentType: asset.type, body: asset.body });
    if (/^\/assets\/transfer-[a-z0-9-]+\.webp$/u.test(url.pathname))
      return route.fulfill({ contentType: "image/webp", path: "scripts/pm" + url.pathname });
    if (url.pathname === "/api/data") return route.fulfill({ json: { files: [], generatedAt: new Date(now).toISOString() } });
    if (url.pathname.endsWith("/session")) return route.fulfill({ json: { paired: true, actor: "fixture", csrf: "fixture" } });
    if (url.pathname.endsWith("/local/run")) return route.fulfill({ json: run });
    if (url.pathname.endsWith("/events")) return route.fulfill({ contentType: "text/event-stream", body: ": fixture\n\n" });
    if (!url.pathname.endsWith("/local/comparison")) return route.fulfill({ json: { ok: true, runs: [], requests: [], sessions: [], handovers: [], queue: null } });
    assert.equal(params.get("id"), run.run_id);
    assert.equal(params.get("head"), run.head);
    const path = params.get("path");
    reads.push(path);
    if (!path) return route.fulfill({ json: { base: run.base, head: run.head, files: [...files.keys()].map(path => ({ path, status: "M" })) } });
    assert.ok(files.has(path));
    return route.fulfill({ json: { patch: `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-before()\n+${files.get(path)}\n` } });
  });
  await context.addInitScript(observeProjection, [...files.values()]);
  const room = page.locator(".era-brain");
  const viewport = room.locator(".era-brain-viewport");
  const station = room.getByRole("combobox", { name: "Go to station" });
  const shot = async name => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + " fits");
    await page.screenshot({ path: directory + "/" + profile + "-" + name + ".png" });
  };
  async function checkStepMotion(expectedMotion) {
    const signal = page.locator(".room-step-readout .room-step-signal");
    await signal.waitFor();
    const animation = await signal.evaluate(node => getComputedStyle(node, "::after").animationName);
    assert.equal(animation !== "none", expectedMotion, "the progress cue follows the motion preference");
  }
  async function floor(name) {
    await page.locator(`.era-brain[data-load="ready"][data-floor="${name}"] .era-brain-viewport[data-pose]:not([data-lift="moving"])`).waitFor();
  }
  async function tapLift(to) {
    await room.getByRole("button", { name: to === "owner" ? "Elevator to Owner room" : "Elevator to AI room", exact: true }).click();
    await floor(to);
  }
  async function assertMode(mode) {
    const group = room.getByRole("group", { name: "View", exact: true });
    await group.getByRole("button", { name: mode, exact: true }).click();
    await page.locator(`.era-brain[data-view="${mode === "Take seat" ? "seat" : mode.toLowerCase()}"]`).waitFor();
  }
  try {
    await page.goto(origin + "/#/delivery/run/" + run.run_id);
    // Handover runs open on the Owner board, including when entering 3D directly.
    const rooms = page.getByRole("navigation", { name: "Delivery rooms" });
    const ownerStations = page.getByRole("navigation", { name: "Owner workstations" });
    const merge = ownerStations.getByRole("button", { name: "Merge", exact: true });
    await page.locator(".owner-room[data-loaded=true]").waitFor();
    assert.equal(await merge.getAttribute("aria-current"), "step");
    await ownerStations.getByRole("button", { name: "Review", exact: true }).click();
    assert.equal(await merge.getAttribute("aria-current"), "step", "inspecting Review keeps the marker at Merge");
    assert.equal(await merge.getAttribute("aria-pressed"), "false");
    await page.getByRole("button", { name: "Close inspector", exact: true }).click();
    await checkStepMotion(!mobile);
    await shot("owner-board");
    await rooms.getByRole("button", { name: "AI room" }).click();
    await page.locator('.board-zone-name[data-zone="ship"][aria-current="step"]').waitFor();
    await checkStepMotion(!mobile);
    await shot("ai-board");
    await rooms.getByRole("button", { name: "Owner room" }).click();
    await page.getByRole("button", { name: "Explore 3D", exact: true }).click();
    await floor("owner");
    assert.equal(await room.getAttribute("data-active-station"), "merge");
    await ownerStations.getByRole("button", { name: "Test", exact: true }).click();
    assert.equal(await merge.getAttribute("aria-current"), "step");
    assert.equal(await room.getAttribute("data-active-station"), "merge");
    await page.getByRole("button", { name: "Close inspector", exact: true }).click();
    const handle = await viewport.locator("canvas").evaluateHandle(canvas => ({ canvas, gl: canvas.getContext("webgl2") }));
    const sameRoom = async () => {
      assert.equal(await viewport.locator("canvas").count(), 1);
      assert.ok(await handle.evaluate(({ canvas, gl }) => canvas === document.querySelector(".era-brain-viewport canvas")
        && gl && !gl.isContextLost() && gl === canvas.getContext("webgl2")), "the same live canvas and WebGL context survived the ride");
    };
    await move(page, mobile);
    await shot("owner-walk");
    await assertMode("Map");
    await shot("owner-map");
    await assertMode("Walk");
    await assertMode("Take seat");
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Close questions" }).click();
    await room.getByRole("button", { name: "Stand up", exact: true }).click();
    await station.selectOption("owner:merge");
    const inspect = room.getByRole("group", { name: "Room actions" }).getByRole("button", { name: "Merge", exact: true });
    await inspect.waitFor();
    if (mobile) await inspect.tap();
    else { await viewport.focus(); await viewport.press("e"); }
    const reader = page.getByRole("region", { name: "Station inspector" });
    await reader.getByRole("combobox", { name: "Changed file" }).selectOption("src/frame.ts");
    await reader.getByText("+frameStep(42)", { exact: true }).waitFor();
    await page.waitForFunction(() => window.floorUploads.includes("frameStep(42)"));
    await shot("merge-inspector");
    await reader.getByRole("button", { name: "Close inspector" }).click();
    await shot("merge-hologram");
    // Use the actual world-space lift target and interaction, as well as the
    // accessible direct-travel control on the return trip.
    await station.selectOption("lift");
    await room.locator(".era-brain-look-hud").getByText(/elevator/i).waitFor({ state: "attached" });
    if (mobile) await room.getByRole("group", { name: "Room actions" }).getByRole("button", { name: /elevator/i }).first().tap();
    else {
      await viewport.focus();
      await Promise.all([
        page.locator('.era-brain-viewport[data-lift="moving"]').waitFor(),
        viewport.press("e"),
      ]);
    }
    await floor("ai");
    assert.equal(await room.getAttribute("data-active-station"), "ship");
    await sameRoom();
    await move(page, mobile);
    await shot("ai-walk");
    await assertMode("Map");
    await assertMode("Walk");
    await assertMode("Take seat");
    await dialog.getByRole("button", { name: "Close questions" }).click();
    await room.getByRole("button", { name: "Stand up", exact: true }).click();
    const recorder = page.getByRole("slider", { name: "Replay", exact: true });
    if (!await recorder.isVisible()) await page.getByRole("button", { name: "Recorder", exact: true }).click();
    await recorder.focus(); await recorder.press("Home");
    const cursor = await recorder.getAttribute("aria-valuetext");
    assert.ok(cursor);
    const beforeReplay = reads.length;
    await tapLift("owner");
    await sameRoom();
    assert.equal(await ownerStations.locator('[aria-current="step"]').count(), 0, "an early replay frame precedes owner work");
    await station.selectOption("owner:merge");
    await inspect.click();
    await reader.getByText("Comparison available in Live", { exact: true }).waitFor();
    assert.equal(await reader.getByRole("combobox", { name: "Changed file" }).count(), 0);
    assert.equal(reads.length, beforeReplay, "replay did not request today's patch");
    await reader.getByRole("button", { name: "Close inspector" }).click();
    await tapLift("ai");
    await sameRoom();
    if (!await recorder.isVisible()) await page.getByRole("button", { name: /^Recorder$|^Replay$/ }).click();
    assert.equal(await recorder.getAttribute("aria-valuetext"), cursor, "lift preserved the exact replay cursor");
    await handle.dispose();
    await room.getByRole("button", { name: "Low motion", exact: true }).click();
    await room.getByRole("button", { name: "Board", exact: true }).click();
    await checkStepMotion(false);
    await page.locator(".board-replay-strip").getByRole("button", { name: "Live", exact: true }).click();
    await rooms.getByRole("button", { name: "Owner room" }).click();
    await checkStepMotion(false);
    results.push({ profile, reads, uploads: await page.evaluate(() => [...new Set(window.floorUploads)]) });
  } catch (error) {
    await page.screenshot({ path: directory + "/" + profile + "-failure.png" });
    throw error;
  } finally { await context.close(); }
}

try {
  for (const profile of [{ width: 1440, height: 900, mobile: false }, { width: 390, height: 844, mobile: true }]) await verify(profile);
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  writeFileSync(directory + "/results.json", JSON.stringify({ results, writes, errors }, null, 2));
  process.stdout.write("Delivery floors passed on desktop and mobile\n");
} finally { await browser.close(); }
