// Credential-free A5 fixture only. All session responses are synthetic; every
// write is blocked. Recorded diffs are served by the fixture.
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve } from "node:path";
import { installLocalSessionFixture, stateScenes } from "./local-session-fixture.mjs";
import { checkSessionMatrix } from "./local-session-matrix.mjs";
import { checkSessionRegressions } from "./local-session-regressions.mjs";
const frozenBundle = await (await import("../../scripts/pm/app-build.mjs")).buildApp();
const bundleFacts = frozenBundle ? Object.fromEntries(Object.entries(frozenBundle).map(([kind, text]) => [kind, { sha256: createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text), characters: text.length }])) : null;
const walkSources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walkSources(join(dir,entry.name)) : [join(dir,entry.name)]);
const sourceFacts = Object.fromEntries(walkSources("scripts/pm/app").filter(path => /\.(?:ts|tsx|css)$/u.test(path)).map(path => [relative(".",path).replaceAll("\\","/"), { sha256: createHash("sha256").update(readFileSync(path)).digest("hex"), bytes: statSync(path).size, modifiedAt: statSync(path).mtime.toISOString() }]));
const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  args: ["--mute-audio"],
  ...(process.env.ERA_CHROME_PATH
    ? { executablePath: process.env.ERA_CHROME_PATH }
    : {}),
});
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 1440, height: 960 },
});
await context.addInitScript(() => {
  if (localStorage.getItem("pm-game-layer") === null)
    localStorage.setItem("pm-game-layer", "on");
  const NativeAudio = window.AudioContext;
  if (NativeAudio) window.AudioContext = class extends NativeAudio {
    constructor(...args) { super(...args); window.__stageAudioCreated = (window.__stageAudioCreated || 0) + 1; }
  };
});
const page = await context.newPage();
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const origin = new URL(base).origin;
const fixture = JSON.parse(readFileSync(".pm/a5-evidence/fixture.json", "utf8"));
assert.match(basename(fixture.root), /^era-a5-browser-/u);
assert.notEqual(resolve(fixture.root), resolve("."));
assert.equal(origin, new URL(fixture.url).origin, "legacy suite requires the isolated A5 fixture");
const evidence = process.env.ERA_LOCAL_EVIDENCE || ".pm/r123-evidence/legacy-session";
mkdirSync(evidence, { recursive: true });
writeFileSync(`${evidence}/served-pm.js`, frozenBundle.js);
writeFileSync(`${evidence}/served-pm.css`, frozenBundle.css);
const errors = [],
  writes = [],
  observations = [],
  stageFacts = [],
  firstFrameFacts = [],
  parkedFacts = [];
page.on("pageerror", (error) => errors.push(error.message));
let sequence = 0;
const matrixScenes = process.env.ERA_LOCAL_AMENDMENT ? ["live", "stale", "failed-hook", "signal-lost", "cancelled"] : stateScenes;
const resultName = process.env.ERA_LOCAL_RESULT_NAME || "result";
const assertionChanges = [
  "R123 replaces four station hooks with eleven named board zones; the four legacy accessible tab-opening names survive.",
  "R123 Settings portals Sound/Notify/Tempo/Rank/Pocket ERA; theater remains in the top bar.",
  "R122 floating Mission/Terminal/results/burst art is retired; reserved Comms, zone chips, rail results and deduplicated cues replace those assertions.",
  "R122 runtime gallery/pixel/bloom/quality instrumentation and headless scripting claims are retired; local-stage-art.browser.mjs owns R123 DPR1.5 canvas/performance budgets.",
  "The retained suite preserves action admission, exact-row replay/future masking, tab restoration, sound opt-in, hidden/offscreen/reduced freeze, Calm and diff run isolation.",
];
const controls = await installLocalSessionFixture(page, { origin, frozenBundle, writes });
const { id, otherId, iso } = controls;
async function open(path, next, theme) {
  controls.scene = next;
  controls.toolEvent = null;
  controls.extraRows = [];
  controls.localResponses = 0;
  controls.at = new Date(Date.now() - 2000).toISOString();
  if (!page.url().startsWith(origin)) await page.goto(base);
  await page.evaluate(value => localStorage.setItem("pm-app-theme", value), theme);
  await page.goto(`${base}?local-scene=${++sequence}#${path}`);
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    theme,
  );
  if (path.startsWith("/delivery/run/")) {
    if (await page.evaluate(() => localStorage.getItem("pm-game-layer") === "off")) {
      await page.locator(".local-run-page").waitFor();
      await page.locator(".calm-evidence > summary").click();
      return;
    }
    const ai = page.getByRole("button", { name: "AI room", exact: true });
    await ai.waitFor();
    if (await ai.getAttribute("aria-pressed") === "false") await ai.click();
    await page.locator(".board-workshop").waitFor();
    if (["shipped", "replay-gap", "replay-stale-gap"].includes(next))
      await page.getByRole("button", { name: "Recorder", exact: true }).click();
    // The dedicated mission suite checks initial collapse. Retained checks
    // deliberately open the rail to inspect the same visible evidence/cards.
    if (await page.locator(".board-dock").count()) {
      const rail = page.locator(".board-rail");
      if (await rail.getAttribute("data-open") === "false")
        await rail.locator(".board-rail-heading button").click();
    }
  }
}
async function selectTool(name) {
  if (await page.locator(".board-dock").count()) {
    const tab = page.locator(".board-dock").getByRole("tab", { name, exact: name !== "Verification" });
    if (await tab.getAttribute("aria-expanded") !== "true") await tab.click();
    await page.getByRole("tabpanel").waitFor();
    return;
  }
  const drawer = page.locator(".board-console-drawer");
  if ((await drawer.getAttribute("open")) === null) await drawer.locator(":scope > summary").click();
  await page.getByRole("tab", { name, exact: name !== "Verification" }).click();
  await page.getByRole("tabpanel").waitFor();
}
async function openOwnerDiff() {
  await page.getByRole("button", { name: "Owner room", exact: true }).click();
  await page.locator(".owner-room-stations").getByRole("button", { name: "Review", exact: true }).click();
}
async function capture(name) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name}: no horizontal overflow`,
  );
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
  observations.push(name);
}
const core = () => page.locator(".bridge-core");
const waitState = (state) =>
  page.waitForFunction(
    (expected) =>
      document.querySelector(".bridge-core")?.dataset.state === expected,
    state,
  );
try {
  await checkSessionMatrix({ page, open, selectTool, capture, core, waitState, controls, id, matrixScenes, firstFrameFacts, parkedFacts, stageFacts });
  await page.setViewportSize({ width: 1440, height: 960 });
  await open(`/delivery/run/${id}`, "shipped", "blue");
  const recorder = page.getByRole("slider", { name: "Replay", exact: true });
  await recorder.focus();
  await recorder.press("Home");
  await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.replay === "true");
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-seals"), "0", "replay does not borrow future checks");
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-plates"), "0");
  const firstValue = Number(await recorder.getAttribute("aria-valuenow"));
  await recorder.press("ArrowRight");
  assert.ok(Number(await recorder.getAttribute("aria-valuenow")) > firstValue);
  assert.match(await recorder.getAttribute("aria-valuetext"), /Read route.ts/u);
  await recorder.press("ArrowRight");
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-plates"), "2");
  await capture("replay-keyboard-middle");
  await recorder.press("End");
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-seals"), "4");
  await recorder.press("Home");
  await recorder.press(" ");
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await capture("replay-playing");
  await page.getByRole("button", { name: "1×", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 12000 });
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-seals"), "4");
  await recorder.focus();
  await recorder.press("l");
  await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.replay === "false");
  await capture("replay-returned-live");

  if (process.env.ERA_LOCAL_AMENDMENT) {
    await open(`/delivery/run/${id}`, "replay-gap", "blue");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.liveness === "quiet", null, { timeout: 25000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    assert.equal(await page.locator(".delivery-workshop").getAttribute("data-replay"), "true");
    await capture("replay-recorded-silence");
    await open(`/delivery/run/${id}`, "replay-stale-gap", "blue");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".stage-announcement")?.textContent?.startsWith("No signal for "), null, { timeout: 25000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    assert.match(await page.locator(".stage-announcement").innerText(), /^No signal for [45] minutes$/u, "replay announcement follows virtual time rather than wall-clock age");
    await capture("replay-recorded-stale-announcement");
  }

  // A single poll carrying nine observations produces nine separate cue beats.
  await open(`/delivery/run/${id}`, "live", "blue");
  await page.locator(".delivery-workshop").waitFor();
  await page.evaluate(() => {
    window.__stageBeats = [];
    document.querySelector(".delivery-workshop").addEventListener("pm-stage-cue", event => window.__stageBeats.push({ at: performance.now(), kind: event.detail.kind }));
  });
  controls.extraRows = Array.from({ length: 9 }, (_, index) => ({ at: iso(-1000 + index * 10), kind: "edit", summary: `src/fixture/batch-${index}.ts`, seq: 100 + index, job_id: "native" }));
  await page.waitForFunction(() => window.__stageBeats.length >= 9, null, { timeout: 12000 });
  const beats = await page.evaluate(() => window.__stageBeats);
  const frameBudget = null, canvasDpr = null; // R123 performance is measured by the dedicated board harness.
  assert.equal(beats.length, 9);
  assert.ok(beats.at(-1).at - beats[0].at <= 3000, "nine-row burst uses the R122350ms montage beats");
  assert.ok(beats.at(-1).at - beats[0].at >= 2400, "all nine rows retain visible staging");
  await capture("nine-row-cue-batch");
  await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.backlog === "0", null, { timeout: 5000 });
  controls.extraRows.push(...Array.from({ length: 9 }, (_, index) => ({ at: new Date(Date.now()+index).toISOString(), kind: "edit", summary: `src/fixture/second-batch-${index}.ts`, seq: 200+index, job_id: "native" })));
  await page.waitForFunction(() => window.__stageBeats.length >= 18, null, { timeout: 12000 });
  const secondBurstFacts = { cues: (await page.evaluate(() => window.__stageBeats)).length };
  assert.equal(secondBurstFacts.cues, 18, "a second nine-row poll observes only its nine new rows");
  await capture("second-nine-row-burst");
  await page.locator(".board-settings-trigger").click();
  await page.getByRole("button", { name: "Sound", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__stageAudioCreated), 1);
  assert.equal(await page.getByRole("button", { name: "Sound", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Sound", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Sound", exact: true }).getAttribute("aria-pressed"), "false");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Theater", exact: true }).click();
  await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 1000 }).catch(() => {});
  const fullscreen = await page.evaluate(() => document.fullscreenElement?.classList.contains("delivery-workshop") || false);
  if (fullscreen) {
    // F is Follow in the mission camera. Exercise the retained Theater toggle
    // through its own visible control on both entry and exit.
    await page.getByRole("button", { name: "Theater", exact: true }).click();
    await page.waitForFunction(() => !document.fullscreenElement);
  }
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-motion"), "paused");
  const frozenPixels = await page.locator(".stage-fx").evaluate(el => el.toDataURL());
  await page.waitForTimeout(150);
  assert.equal(await page.locator(".stage-fx").evaluate(el => el.toDataURL()), frozenPixels, "hidden R123 motion canvas is static");
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await checkSessionRegressions({ page, open, selectTool, openOwnerDiff, capture, controls, id });
  await open(`/delivery/run/${id}`, "checking", "blue");
  await openOwnerDiff();
  await page.getByRole("region", { name: "Code diff" }).getByText("+fixture-only-first-run", { exact: true }).waitFor();
  await page.evaluate(nextId => { location.hash = `/delivery/run/${nextId}`; }, otherId);
  await page.locator(".run-game-tag").filter({ hasText: "BUD-2" }).first().waitFor();
  await openOwnerDiff();
  const otherDiff = page.getByRole("region", { name: "Code diff" });
  await otherDiff.getByText("+fixture-only-second-run", { exact: true }).waitFor();
  assert.ok(!(await otherDiff.innerText()).includes("fixture-only-first-run"), "another run cannot inherit the first run's diff");
  await capture("diff-run-isolation");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(`/delivery/run/${id}`, "building", "blue");
  await page.locator(".delivery-workshop").waitFor();
  assert.equal(await page.locator(".delivery-workshop").getAttribute("data-motion"), "paused");
  await capture("reduced-workshop");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".delivery-workshop").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.motion === "active");
  await selectTool("Activity");
  // The console now stays inside the stage. Move the observed stage offscreen
  // directly, preserving the visibility contract without restoring page scroll.
  await page.locator(".delivery-workshop").evaluate(el => { el.style.transform = "translateY(1500px)"; });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.motion === "paused");
  // The calm surface keeps the original structured review over the same evidence.
  await page.evaluate(() => localStorage.setItem("pm-game-layer", "off"));
  await open(`/delivery/run/${id}`, "building", "blue");
  for (const [tab, name] of [["Brief", "Plan"], ["Verification", "Verification"], ["Activity", "Activity"], ["Changes", "Changes"]]) {
    await page.getByRole("tab", { name: tab, exact: tab !== "Verification" }).click();
    await page.getByRole("region", { name, exact: true }).waitFor();
  }
  await capture("calm-review");
  await page.evaluate(() => localStorage.setItem("pm-game-layer", "on"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open("/bridge", "building", "blue");
  await waitState("running");
  await page.waitForTimeout(200);
  assert.equal(
    Number(await core().getAttribute("data-rpm")),
    0,
    "reduced motion stays static",
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  writeFileSync(
    `${evidence}/${resultName}.json`,
    JSON.stringify(
      { observations, stageFacts, firstFrameFacts, parkedFacts, beats, secondBurstFacts, frameBudget, canvasDpr, fullscreen, errors, writes, reducedMotion: true, bundleFacts, sourceFacts, assertionChanges },
      null,
      2,
    ),
  );
  process.stdout.write(
    `Local session browser checks passed: ${observations.length} screenshots, no writes or runtime errors\n`,
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(
    `${evidence}/failure.json`,
    JSON.stringify(
      {
        url: page.url(),
        bundleFacts,
        sourceFacts,
        errors,
        writes,
        text: await page.locator("body").innerText(),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
