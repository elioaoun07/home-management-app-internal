import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromiumExecutable, fixtureAssets, openBoard, routeFixture, specimen } from "./fixtures/local-stage-board.mjs";

const evidence = ".pm/r131-evidence";
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: !process.env.ERA_STAGE_HEADED });
const writes = [], errors = [], receipts = [];

try {
  for (const { theme, width, height, dpr, reducedMotion } of [
    { theme: "blue", width: 1280, height: 640, dpr: 1, reducedMotion: "no-preference" },
    { theme: "pink", width: 390, height: 844, dpr: 1, reducedMotion: "reduce" },
    { theme: "blue", width: 1494, height: 934, dpr: 1.5, reducedMotion: "no-preference" },
    { theme: "pink", width: 2560, height: 1440, dpr: 2, reducedMotion: "no-preference" },
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion });
    const shot = `${evidence}/${width}-${theme}`;
    const at = new Date().toISOString();
    const run = specimen();
    const rows = [
      { at, job_id: "demo", seq: 41, kind: "edit", summary: "src/panel.ts" },
      { at, job_id: "demo", seq: 42, kind: "status", summary: "Host checks started" },
      { at, job_id: "demo", seq: 43, kind: "status", summary: "test: 0" },
      { at, job_id: "demo", seq: 44, kind: "status", summary: "Ready for owner UAT" },
    ];
    run.activity = rows.slice(0, 3);
    run.phase = "checking";
    run.handover = null;
    run.checks = [{ name: "test", exit: 0, stdout: "12 passed", stderr: "", error: null, started_at: at, finished_at: at }];
    run.work.brief = "# Fixture brief\n\nPreserve the recorded evidence.";
    const state = await routeFixture(context, assets, writes, run);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await openBoard(page, state, assets, run, theme);
    await page.getByRole("button", { name: "Take seat", exact: true }).click();
    const seat = page.getByRole("region", { name: "Transfer Room" });
    await seat.waitFor();
    assert.equal(await page.locator(".board-camera canvas").count(), 0);
    const image = await page.request.get(new URL("/assets/transfer-room.webp", assets.base).href);
    assert.equal(image.headers()["content-type"], "image/webp");
    assert.equal(image.ok(), true);
    await seat.getByRole("button", { name: "Plan", exact: true }).click();
    await seat.getByRole("heading", { name: "Fixture brief" }).waitFor();
    await page.screenshot({ path: `${shot}-plan.png` });
    await seat.getByRole("button", { name: "Close output" }).click();
    assert.equal(await seat.getByRole("button", { name: "Plan", exact: true }).evaluate((button) => document.activeElement === button), true);
    await seat.getByRole("button", { name: "All actions", exact: true }).click();
    await seat.locator('[data-room-action="demo:41"]').click();
    await seat.getByRole("button", { name: "Replay here" }).click();
    const wheel = seat.getByRole("slider", { name: "Recorded action" });
    assert.match(await wheel.getAttribute("aria-valuetext"), /^1 of 3/u);
    await seat.getByRole("button", { name: "Pin A" }).click();
    await wheel.focus();
    await wheel.press("ArrowRight");
    assert.match(await wheel.getAttribute("aria-valuetext"), /^2 of 3/u);
    assert.equal(await seat.getByText("12 passed", { exact: true }).count(), 0);
    await wheel.press("ArrowRight");
    await seat.getByText("12 passed", { exact: true }).waitFor();
    await seat.getByRole("button", { name: "Pin B" }).click();
    await seat.getByRole("button", { name: "Compare", exact: true }).click();
    await seat.getByRole("region", { name: "Moment A" }).getByText("test · pending").waitFor();
    if (width < 900) await seat.getByRole("button", { name: "B", exact: true }).click();
    await seat.getByRole("region", { name: "Moment B" }).getByText("12 passed", { exact: true }).waitFor();
    await page.screenshot({ path: `${shot}-comparison.png` });
    await seat.getByRole("button", { name: "Close comparison" }).click();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.locator('[data-renderer="solid-board"]').waitFor();
    await page.getByRole("button", { name: "Take seat", exact: true }).click();
    await seat.getByText("12 passed", { exact: true }).waitFor();
    const newAt = new Date().toISOString();
    state.run = { ...run, phase: "uat-ready", activity: [...run.activity, { ...rows[3], at: newAt }], handover: specimen().handover };
    await seat.locator(".room-now").getByText("Your turn", { exact: true }).waitFor({ timeout: 12_000 });
    await seat.getByText("12 passed", { exact: true }).waitFor();
    assert.equal(await seat.locator('[data-cassette="received"]').count(), 0);
    await seat.getByRole("button", { name: "Live", exact: true }).click();
    await seat.locator('[data-cassette="received"]').waitFor();
    const handoff = seat.getByRole("button", { name: "Handoff", exact: true });
    await handoff.scrollIntoViewIfNeeded();
    const hitTarget = await handoff.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.right - 3, box.y + box.height / 2);
      return hit === button || button.contains(hit) ? null : {
        hit: hit?.outerHTML.slice(0, 150), box: box.toJSON(),
      };
    });
    if (hitTarget) await page.screenshot({ path: `${shot}-handoff-hit.png` });
    assert.equal(hitTarget, null, JSON.stringify({ theme, hitTarget }));
    await handoff.click();
    await seat.getByRole("link", { name: "Test steps", exact: true }).waitFor();
    await seat.getByRole("button", { name: "Close output" }).click();
    await page.screenshot({ path: `${shot}-handoff.png`, animations: "disabled" });
    const layout = await seat.evaluate((element) => ({
      width: element.clientWidth,
      xOverflow: document.documentElement.scrollWidth - innerWidth,
      motion: getComputedStyle(element.querySelector(".room-sled")).transitionDuration,
    }));
    assert.equal(layout.xOverflow, 0);
    if (reducedMotion === "reduce") assert.equal(layout.motion, "0s");
    if (width < 900) {
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await seat.locator(".room-scene-label").getByText("Replay", { exact: true }).waitFor();
      await seat.locator(".room-bay").evaluate((bay) => {
        if (bay.dataset.cassette === "received") throw Error("Replay started in the future");
      });
      await seat.locator('[data-cassette="received"]').waitFor({ timeout: 22_000 });
      await seat.getByRole("button", { name: "Live", exact: true }).click();
    }
    if (width === 1280) {
      await seat.getByRole("button", { name: "Previous action" }).click();
      const questionAt = new Date().toISOString();
      state.run = {
        ...run,
        phase: "building",
        activity: [...run.activity, { at: questionAt, job_id: "demo", seq: 45, kind: "message", summary: "Waiting on the color choice" }],
        questions: [{
          id: "fixture-question",
          asked_at: questionAt,
          answers: null, answered_at: null, state: "open",
          questions: [{
            question: "Which material should I use?", header: "Material", multiSelect: false,
            options: [{ label: "Ceramic (Recommended)", description: "Match the room" }],
          }],
        }],
      };
      const question = seat.getByRole("button", { name: "Question", exact: true });
      await question.waitFor({ timeout: 12_000 });
      assert.equal(await page.getByRole("button", { name: "Send", exact: true }).count(), 0);
      await question.click();
      await page.getByRole("form", { name: "Question" }).getByRole("button", { name: "Send", exact: true }).waitFor();
    }
    receipts.push({ theme, viewport: { width, height, dpr }, reducedMotion, ...layout });
    await context.close();
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(errors, []);
  writeFileSync(`${evidence}/result.json`, JSON.stringify({ receipts, writes, errors }, null, 2));
} finally {
  await browser.close();
}
