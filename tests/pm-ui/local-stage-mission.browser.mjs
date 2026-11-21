// R126 slice1 only: synthetic replay data, immutable app assets, no commands.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  chromiumExecutable,
  fixtureAssets,
  openBoard,
  profiles,
  profileKey,
  routeFixture,
  shiftCase,
  sourceSnapshot,
} from "./fixtures/local-stage-board.mjs";

const evidence = process.env.ERA_MISSION_EVIDENCE || ".pm/r126-evidence/slice1";
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const executable = chromiumExecutable();
assert.ok(executable, "an installed Chromium browser is required");
const headed = process.env.ERA_STAGE_HEADED === "1";
const browser = await chromium.launch({ headless: !headed, executablePath: executable, args: ["--mute-audio"] });
const checks = [], captures = [], layouts = [], errors = [], writes = [];
const tools = ["Activity", "Brief", "Verification", "Changes", "Worktree", "Host limits"];
const missionProfiles = [
  ...profiles.filter((profile) => profile.width === 390),
  { width: 1024, height: 768, dpr: 1 },
  ...profiles.filter((profile) => profile.width !== 390),
];

async function layout(page) {
  return page.locator(".board-workshop").evaluate((root) => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const board = box(root.querySelector(".board-region"));
    const camera = box(root.querySelector(".board-camera"));
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      root: box(root),
      bar: box(root.querySelector(".board-topbar")),
      board,
      camera,
      regionOccupancy: camera && board ? Math.max(camera.width / board.width, camera.height / board.height) : null,
      comms: box(root.querySelector(".board-comms:not([hidden])")),
      dock: box(root.querySelector(".board-dock")),
      dockRows: getComputedStyle(root.querySelector(".board-dock")).gridTemplateRows,
      telemetry: box(root.querySelector(".board-telemetry")),
      replay: box(root.querySelector(".board-replay-strip")),
      rail: box(root.querySelector(".board-rail")),
      railOpen: root.querySelector(".board-rail")?.dataset.open,
      drawer: box(root.querySelector(".board-console-drawer")),
      tabs: [...root.querySelectorAll('.board-dock [role="tab"]')].map((node) => ({
        text: node.querySelector("span")?.textContent,
        icon: !!node.querySelector("svg"),
        box: box(node),
      })),
      zoneLabels: [...root.querySelectorAll(".board-zone-name")].map((node) => {
        let scale = 1;
        for (let element = node; element; element = element.parentElement) {
          const transform = getComputedStyle(element).transform;
          if (transform !== "none") {
            const matrix = new DOMMatrixReadOnly(transform);
            scale *= Math.hypot(matrix.a, matrix.b);
          }
        }
        return { id: node.dataset.zone, text: node.textContent.trim(), box: box(node),
          screenFontSize: parseFloat(getComputedStyle(node).fontSize) * scale };
      }),
      zonePads: [...root.querySelectorAll(".board-zone")].map((node) => ({
        id: node.dataset.zone, name: node.getAttribute("aria-label"), box: box(node),
        clipPath: getComputedStyle(node).clipPath,
      })),
    };
  });
}

async function capture(page, name) {
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
  captures.push(name);
}

async function check(page, name, action) {
  try {
    await action();
    checks.push({ name, status: "passed" });
  } catch (error) {
    checks.push({ name, status: "failed", message: error.message, stack: error.stack });
    await capture(page, `${name}-failure`);
    process.stderr.write(`${name}: ${error.message}\n`);
  }
}

const closeDrawer = async (page) => {
  const drawer = page.locator(".board-console-drawer");
  const close = drawer.getByRole("button", { name: "Close", exact: true });
  if (await close.count()) await close.click();
  else await drawer.locator(":scope > summary").click();
};

try {
  for (const profile of missionProfiles) for (const theme of ["blue", "pink"]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, serviceWorkers: "block" });
    const run = shiftCase("failed-hook");
    run.work.id = "HUB-118";
    run.work.title = "HUB-118 Require host sign-in for guest records — criteria";
    const state = await routeFixture(context, assets, writes, run);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const key = `mission-${profileKey(profile)}-${theme}`;
    await check(page, `${key}-frame`, async () => {
      await openBoard(page, state, assets, run, theme);
      const facts = await layout(page);
      layouts.push({ key, ...facts });
      assert.equal(await page.locator(".app-header:visible,.mobile-nav:visible").count(), 0, "Game owns its shell");
      assert.equal(await page.locator(".run-page > .back:visible").count(), 0, "the old Back row is absent");
      assert.ok(Math.abs(facts.root.x) <= 1 && Math.abs(facts.root.y) <= 1, "stage starts at viewport origin");
      assert.ok(Math.abs(facts.root.width - profile.width) <= 1, "stage fills viewport width");
      assert.ok(Math.abs(facts.root.height - profile.height) <= 1, "stage fills viewport height");
      assert.equal(facts.scrollWidth, profile.width);
      if (profile.width >= 900) assert.equal(facts.scrollHeight, profile.height, "no desktop page scroll");
      assert.ok(Math.abs(facts.bar.height - 44) <= 1, "44 px bar");
      assert.ok(Math.abs(facts.dock.height - (profile.width === 390 ? 112 : 56)) <= 1, "56 px dock; two rows on phone");
      assert.ok(Math.abs(facts.dock.bottom - profile.height) <= 1, "dock anchors the window");
      assert.ok(facts.board.y >= facts.bar.bottom - 1 && facts.board.bottom <= facts.dock.y + 1, "board reserves bar and dock");
      if (profile.width === 390) assert.ok(facts.board.height >= 300, "phone board is at least 300 px");
      else assert.ok(Math.abs(facts.rail.width - (profile.width < 1100 ? 44 : 340)) <= 1, "rail starts at the declared width");
      if (profile.width < 1100) assert.equal(facts.railOpen, "false", "narrow rail starts collapsed");
      assert.deepEqual(facts.tabs.map((tab) => tab.text), tools);
      assert.ok(facts.tabs.every((tab) => tab.icon), "every dock tab has icon and label");
      for (const tab of facts.tabs) {
        assert.ok(Math.abs(tab.box.y - facts.tabs[0].box.y) <= 1, "six tabs occupy one horizontal dock row");
        assert.ok(tab.box.y >= facts.dock.y - 1 && tab.box.bottom <= facts.dock.bottom + 1,
          `${tab.text} stays inside the dock vertically`);
      }
      const topbar = page.locator(".board-topbar");
      assert.equal(await topbar.getByRole("link", { name: "Back", exact: true }).count(), 1);
      assert.equal(await topbar.locator(".board-title h1").innerText(), "Require host sign-in for guest records");
      assert.equal(await topbar.locator(".board-line,.board-clock").count(), 2);
      assert.equal(await topbar.getByRole("button", { name: "Theater", exact: true }).count(), 1);
      await capture(page, `${key}-frame`);
      const replay = page.getByRole("slider", { name: "Replay", exact: true });
      await replay.focus();
      await replay.press("Home");
      await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.replay === "true");
      const firstRow = Number(await replay.getAttribute("aria-valuenow"));
      await replay.press("ArrowRight");
      assert.ok(Number(await replay.getAttribute("aria-valuenow")) > firstRow, "dock preserves exact-row keyboard replay");
      await replay.press("End");
      await replay.press("l");
      await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.replay === "false");
    });
    await check(page, `${key}-rail`, async () => {
      const rail = page.locator(".board-rail");
      const toggle = rail.locator(".board-rail-heading button");
      if (await rail.getAttribute("data-open") === "true") await toggle.click();
      if (profile.width !== 390) assert.ok(Math.abs((await rail.boundingBox()).width - 44) <= 1, "collapsed strip is 44 px");
      await toggle.click();
      await page.waitForFunction(() => document.querySelector(".board-rail")?.dataset.open === "true");
      const box = await rail.boundingBox();
      if (profile.width === 390) {
        assert.ok(box.width >= profile.width - 32 && box.width <= profile.width, "phone rail is a bottom sheet");
        assert.ok(box.height > 44 && box.y > 44 && box.y + box.height <= profile.height + 1);
      } else assert.ok(Math.abs(box.width - 340) <= 1, "expanded rail is 340 px");
      await page.keyboard.press("n");
      assert.equal(await rail.evaluate((node) => node === document.activeElement), true);
      await capture(page, `${key}-rail`);
      await toggle.click();
    });
    await check(page, `${key}-drawer`, async () => {
      const dock = page.locator(".board-dock");
      for (const name of tools) {
        const tab = dock.getByRole("tab", { name, exact: !["Changes", "Verification"].includes(name) });
        await tab.click();
        await page.getByRole("tabpanel").waitFor();
        assert.equal(await tab.getAttribute("aria-selected"), "true");
        const facts = await layout(page);
        assert.ok(Math.abs(facts.drawer.height / facts.board.height - 0.45) <= 0.015, "drawer occupies the board's lower 45%");
        assert.ok(Math.abs(facts.drawer.bottom - facts.board.bottom) <= 1, "drawer stays above dock");
        assert.ok(facts.drawer.x >= facts.board.x - 1 && facts.drawer.right <= facts.board.right + 1);
      }
      await dock.getByRole("tab", { name: "Host limits", exact: true }).press("Home");
      assert.equal(await dock.getByRole("tab", { name: "Activity", exact: true }).getAttribute("aria-selected"), "true");
      await dock.getByRole("tab", { name: "Activity", exact: true }).press("ArrowRight");
      assert.equal(await dock.getByRole("tab", { name: "Brief", exact: true }).getAttribute("aria-selected"), "true");
      await capture(page, `${key}-drawer`);
      await closeDrawer(page);
      assert.equal(await page.getByRole("tabpanel").isVisible(), false);
      if (profile.width === 390) {
        for (const close of ["button", "escape"]) {
          await page.locator('.board-zone-name[data-zone="seal"]').click();
          await page.getByRole("tabpanel").waitFor();
          assert.equal(await page.locator(".board-rail").getAttribute("data-open"), "false",
            "a selected zone opens the phone drawer without its rail");
          if (close === "escape") await page.keyboard.press("Escape");
          else await closeDrawer(page);
          await page.waitForTimeout(150);
          assert.equal(await page.locator(".board-rail").getAttribute("data-open"), "false",
            "closing the drawer cannot reopen an old selected rail card");
          assert.equal(await page.getByRole("tabpanel").isVisible(), false);
        }
        await capture(page, `${key}-selected-zone-closed`);
      }
    });
    await check(page, `${key}-settings-calm`, async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.motion === "paused");
      await page.locator(".board-settings-trigger").click();
      const settings = page.getByRole("dialog", { name: "Settings", exact: true });
      const game = settings.getByRole("switch", { name: "Game layer", exact: true });
      assert.equal(await game.getAttribute("aria-checked"), "true", "Game switch remains reachable");
      await capture(page, `${key}-settings`);
      await game.click();
      await page.getByRole("region", { name: "Plan", exact: true }).waitFor();
      assert.equal(await page.locator(".app-header").isVisible(), true, "Calm retains the app shell");
    });
    if (profile.width === 1280) await check(page, `${key}-empty-rail`, async () => {
      const empty = structuredClone(run);
      empty.phase = "building";
      empty.head = null;
      empty.handover = null;
      empty.checks = [];
      empty.activity = [{ at: new Date().toISOString(), kind: "status", summary: "Native session started", seq: 0, job_id: "native" }];
      delete empty.error;
      delete empty.failure;
      delete empty.work.brief;
      await page.evaluate(() => localStorage.setItem("pm-game-layer", "on"));
      await openBoard(page, state, assets, empty, theme);
      const rail = page.locator(".board-rail");
      assert.equal(await page.locator(".board-workshop").getAttribute("data-attention"), "0");
      assert.equal(await rail.getAttribute("data-open"), "false", "empty wide rail starts collapsed");
      assert.ok(Math.abs((await rail.boundingBox()).width - 44) <= 1);
      await page.keyboard.press("n");
      await page.waitForFunction(() => document.querySelector(".board-rail")?.dataset.open === "true");
      await page.waitForTimeout(150);
      assert.equal(await rail.getAttribute("data-open"), "true", "manual N remains open without cards");
      assert.equal(await rail.evaluate((node) => node === document.activeElement), true);
      assert.ok(Math.abs((await rail.boundingBox()).width - 340) <= 1);
      await capture(page, `${key}-empty-rail-n`);
    });
    if ([390, 1280].includes(profile.width)) await check(page, `${key}-standby-back`, async () => {
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      let received = 0;
      await context.route((url) => url.pathname === "/api/delivery/v2/local/run", async (route) => {
        received++;
        await gate;
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Fixture standby failure"}' });
      });
      try {
        await page.evaluate(() => localStorage.setItem("pm-game-layer", "on"));
        await page.goto(`${assets.base}?mission-standby=${profile.width}-${theme}#/delivery/run/${run.run_id}`);
        const standby = page.locator(".foundry-standby");
        await standby.getByRole("heading", { name: "Loading", exact: true }).waitFor();
        for (let i = 0; i < 40 && !received; i++) await page.waitForTimeout(50);
        assert.ok(received > 0, "run read is held while the standby loads");
        const back = standby.getByRole("link", { name: "Back", exact: true });
        assert.equal(await back.isVisible(), true);
        assert.equal(await back.getAttribute("href"), "#/delivery");
        assert.equal(await back.evaluate((node) => {
          const r = node.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit === node || node.contains(hit);
        }), true, "loading Back receives pointer input");
        await capture(page, `${key}-loading-back`);
        release();
        await standby.getByRole("heading", { name: "Unavailable", exact: true }).waitFor();
        assert.equal(await back.isVisible(), true);
        await capture(page, `${key}-error-back`);
        await back.click();
        await page.waitForFunction(() => !document.querySelector(".foundry-standby"));
        assert.equal(new URL(page.url()).hash.startsWith("#/delivery/run/"), false,
          "failed-load Back returns to the delivery workspace");
      } finally {
        release();
      }
    });
    await context.close();
  }
} finally {
  const finalSourceFacts = sourceSnapshot();
  const changedSources = [...new Set([...Object.keys(assets.sourceFacts), ...Object.keys(finalSourceFacts)])]
    .filter((path) => assets.sourceFacts[path]?.sha256 !== finalSourceFacts[path]?.sha256);
  checks.push({ name: "immutable served source", status: changedSources.length ? "failed" : "passed", changedSources });
  const failures = checks.filter((item) => item.status === "failed");
  writeFileSync(`${evidence}/result.json`, JSON.stringify({ status: failures.length || errors.length || writes.length ? "failed" : "passed", slice: 1, headed, executable, checks, captures, layouts, errors, writes, bundleFacts: assets.bundleFacts, sourceFacts: assets.sourceFacts, finalSourceFacts, limits: ["Slice2 owns Overview85% occupancy and camera behavior.", "Owner actual FPS, physical device and motion comfort remain owner UAT."] }, null, 2));
  await browser.close();
  assert.equal(failures.length, 0, failures.map((item) => `${item.name}: ${item.message}`).join("\n"));
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
}
process.stdout.write(`R126 slice1 mission: ${checks.length} checks, ${captures.length} captures\n`);
