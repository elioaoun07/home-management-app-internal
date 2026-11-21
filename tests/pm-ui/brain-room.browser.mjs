import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromiumExecutable, fixtureAssets, openBoard, routeFixture, specimen } from "./fixtures/local-stage-board.mjs";

const directory = ".pm/r132-evidence";
mkdirSync(directory, { recursive: true });
const assets = await fixtureAssets(directory);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const writes = [], errors = [], profiles = [];

try {
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
    } else {
      await room.getByRole("button", { name: "Ask ERA" }).tap();
      await page.getByRole("dialog").getByRole("button", { name: "Close questions" }).tap();
      const before = await pose();
      const bounds = await viewport.boundingBox();
      const client = await context.newCDPSession(page);
      const x = bounds.x + bounds.width * .24, y = bounds.y + bounds.height * .54;
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 43 }] });
      await page.waitForFunction(value => document.querySelector(".era-brain-viewport").dataset.pose !== value, before);
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
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
  writeFileSync(directory + "/result.json", JSON.stringify({ profiles, writes, errors }, null, 2));
} finally {
  await browser.close();
}
