import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  openBoard,
  matrix,
  stageProfiles,
  stageThemes,
  profileKey,
  routeFixture,
  shiftCase,
} from "./local-stage-board.mjs";
import { captureBoard } from "./local-stage-runtime.mjs";

const names = [
  "01 BRIEF", "02 SETUP", "03 EXPLORE", "04 THINK", "05 BUILD",
  "06 BENCH", "07 SEAL", "08 VERIFY", "09 HANDOVER", "10 TEST", "11 SHIP",
];

async function openMissionRail(page) {
  if (!await page.locator(".board-dock").count()) return;
  const rail = page.locator(".board-rail");
  if (await rail.getAttribute("data-open") === "false")
    await rail.locator(".board-rail-heading button").click();
}

function failedRun() {
  const run = shiftCase("failed-hook");
  run.work.id = "HUB-118";
  run.work.title = "HUB-118 Require host sign-in — criteria";
  run.failure = {
    code: "commit-hook",
    step: "Committing candidate",
    detail: "FAIL tests/fixture.test.ts\nExpected true, received false",
  };
  run.error = "git commit: hook failed\nRaw hook output\nELIFECYCLE Command failed";
  return run;
}

// Test-only measurement: the actual screen size includes every CSS transform.
// Colour sampling is outside the product and never runs in a stage frame.
function labelReceipt() {
  const pixel = document.createElement("canvas");
  pixel.width = pixel.height = 1;
  const ctx = pixel.getContext("2d", { willReadFrequently: true });
  const rgba = (color) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
  };
  const over = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
  const luminance = (color) => color.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  return [...document.querySelectorAll(".board-zone-name")].map((node) => {
    const chain = [];
    let scale = 1;
    for (let element = node; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      chain.unshift(style);
      if (style.transform !== "none") {
        const matrix = new DOMMatrixReadOnly(style.transform);
        scale *= Math.hypot(matrix.a, matrix.b);
      }
    }
    let background = [0, 0, 0];
    for (const style of chain) background = over(rgba(style.backgroundColor), background);
    const style = getComputedStyle(node);
    const foreground = over(rgba(style.color), background);
    const light = luminance(foreground), dark = luminance(background);
    const box = node.getBoundingClientRect();
    return {
      text: node.textContent.trim(),
      fontSize: parseFloat(style.fontSize),
      screenFontSize: parseFloat(style.fontSize) * scale,
      color: style.color,
      background,
      contrast: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  });
}

export async function runCorrections(browser, assets, evidence, record, check, writes, errors) {
  const receipts = [];
  const profiles = stageProfiles();
  const orderedProfiles = [
    ...profiles.filter((profile) => profile.width === 390),
    ...profiles.filter((profile) => profile.width !== 390),
  ];
  for (const profile of orderedProfiles) for (const theme of stageThemes()) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.dpr,
      serviceWorkers: "block",
    });
    const run = failedRun();
    const state = await routeFixture(context, assets, writes, run);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const key = `r125-${profileKey(profile)}-${theme}`;
    await check(`${key} fit / labels / closed action / truth`, async () => {
      await openBoard(page, state, assets, run, theme);
      const layout = await captureBoard(page, evidence, key, record);
      const labels = await page.evaluate(labelReceipt);
      const scroll = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
      }));
      const receipt = { key, profile, theme, scroll, labels, layout };
      receipts.push(receipt);
      assert.equal(scroll.scrollWidth, scroll.innerWidth, "no horizontal page scroll");
      if (profile.width >= 900)
        assert.equal(scroll.scrollHeight, scroll.innerHeight, "no desktop page scroll");
      assert.deepEqual(labels.map((value) => value.text), names);
      for (const label of labels) {
        assert.ok(label.screenFontSize >= 10.999, `${label.text}: ${label.screenFontSize}px on screen`);
        assert.ok(label.contrast >= 4.5, `${label.text}: contrast ${label.contrast}`);
      }
      if (profile.width >= 900) for (const zone of layout.zones) {
        for (const hud of [layout.comms, layout.telemetry].filter(Boolean))
          assert.equal(zone.box.x < hud.right && zone.box.right > hud.x && zone.box.y < hud.bottom && zone.box.bottom > hud.y,
            false, `${zone.id} pad clear of HUD`);
      }
      assert.equal(await page.locator(".board-title h1").innerText(), "Require host sign-in");
      const title = await page.title();
      assert.equal((title.match(/HUB-118/gu) ?? []).length, 1, "tab has one work ID");
      assert.equal(title.includes("criteria"), false);
      assert.ok(title.includes("Require host sign-in"), "tab uses display title");
      await openMissionRail(page);
      const actions = page.locator(".board-rail > .run-game-commandbar");
      assert.equal(await actions.locator(".primary").count(), 1);
      assert.equal(await actions.getByRole("link", { name: "New attempt", exact: true }).count(), 1);
      assert.equal(await actions.getByRole("button", { name: "Review diff", exact: true }).count(), 0);
      assert.equal(await actions.getByRole("button", { name: "Ship", exact: true }).count(), 0);
      assert.equal(await page.locator(".board-telemetry time").count(), 0);
      assert.match(await page.locator(".board-counters").innerText(), /read/u);
      assert.equal(await page.locator(".black-box-excerpt").innerText(), run.failure.detail);
      const stopped = page.locator(".stage-black-box dt").filter({ hasText: "Stopped at" });
      assert.equal(await stopped.evaluate((node) => getComputedStyle(node).whiteSpace), "nowrap");
      assert.equal(await page.locator(".black-box-log").getAttribute("open"), null);
      await page.locator(".black-box-log > summary").click();
      assert.equal(await page.locator(".black-box-log pre").innerText(), run.error);
      await page.locator(".black-box-log > summary").click();
      const drawer = page.locator(".board-console-drawer");
      const mission = await page.locator(".board-dock").count() > 0;
      if (mission) await page.locator(".board-dock").getByRole("tab", { name: "Brief", exact: true }).click();
      else await drawer.locator(":scope > summary").click();
      await page.getByRole("tab", { name: "Brief", exact: true }).focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.getByRole("tab", { name: "Brief", exact: true }).getAttribute("aria-selected"), "true");
      const close = drawer.getByRole("button", { name: "Close", exact: true });
      if (mission && await close.count()) await close.click();
      else await drawer.locator(":scope > summary").click();
      if (profile.width >= 900)
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), profile.height, "drawer remains inside stage");
      if (profile.width === 390) {
        await openMissionRail(page);
        const attempt = actions.getByRole("link", { name: "New attempt", exact: true });
        await attempt.scrollIntoViewIfNeeded();
        assert.equal(await attempt.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return hit === node || node.contains(hit);
        }), true, "mobile navigation leaves New attempt reachable");
      }
    });
    if (profile.width === 1280) await check(`${key} failure-only / kept versus read`, async () => {
      const reasonOnly = failedRun();
      delete reasonOnly.error;
      await openBoard(page, state, assets, reasonOnly, theme);
      assert.equal(await page.locator(".black-box-excerpt").innerText(), reasonOnly.failure.detail);
      assert.equal(await page.locator(".black-box-log").count(), 0);
      await captureBoard(page, evidence, `${key}-failure-only`, record);
      const changes = shiftCase("summary-and-changes");
      await openBoard(page, state, assets, changes, theme);
      const expected = matrix.localCases.find((entry) => entry.name === "summary-and-changes")
        .expected.cards.find((card) => card.kind === "changes").detail;
      assert.equal(await page.locator('[data-kind="changes"] .board-attention-detail').innerText(), expected.replace(/\bfiles\b/u, "kept"));
      assert.match(await page.locator(".board-counters").innerText(), /read/u);
      await captureBoard(page, evidence, `${key}-kept-read`, record);
      const building = shiftCase("brief-look");
      await openBoard(page, state, assets, building, theme);
      assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).isVisible(), true,
        "building without a candidate retains Cancel");
    });
    if (profile.width === 390) await check(`${key} wheel scroll / Ctrl zoom`, async () => {
      const mission = await page.locator(".board-dock").count() > 0;
      // A phone bottom sheet intentionally covers the board. Exercise wheel
      // input on the actual board, after closing that previously tested rail.
      if (mission && await page.locator(".board-rail").getAttribute("data-open") === "true")
        await page.locator(".board-rail-heading button").click();
      const natural = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight }));
      let restore = null;
      // Mission layout can fit the phone too. Add disposable document space to
      // prove the retained scrollable-page rule with an actual native wheel.
      if (mission && natural.scrollHeight <= natural.innerHeight + 1) {
        restore = await page.evaluate(() => {
          const saved = { html: document.documentElement.style.cssText, body: document.body.style.cssText };
          document.documentElement.style.overflow = "auto";
          document.body.style.overflow = "visible";
          const spacer = document.createElement("div");
          spacer.id = "mission-wheel-fixture-space";
          spacer.style.height = `${innerHeight + 500}px`;
          spacer.style.width = "1px";
          spacer.style.pointerEvents = "none";
          document.body.append(spacer);
          return saved;
        });
        await page.waitForTimeout(300);
      }
      try {
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => scrollY === 0);
        // Drawer/rail and document-size invalidations can retarget the R126
        // 900 ms camera ease. Observe a settled pose before testing wheel input.
        if (mission) await page.waitForTimeout(1100);
        const region = page.locator(".board-region");
        const camera = page.locator(".board-camera");
        const before = await camera.evaluate((node) => getComputedStyle(node).transform);
        const box = await region.boundingBox();
        assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".board-region"),
          { x: box.x + box.width / 2, y: Math.min(box.y + box.height / 2, 700) }), true,
          "native wheel targets the uncovered board region");
        const scrollable = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight }));
        assert.ok(scrollable.scrollHeight > scrollable.innerHeight, "fixture page can scroll");
        await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, 700));
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(300);
        const plain = { scrollY: await page.evaluate(() => scrollY), camera: await camera.evaluate((node) => getComputedStyle(node).transform) };
        assert.ok(plain.scrollY > 0, "plain wheel scrolls narrow page");
        assert.equal(plain.camera, before, "plain wheel does not zoom scrollable page");
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => scrollY === 0);
        const controlBefore = await camera.evaluate((node) => getComputedStyle(node).transform);
        await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, 700));
        await page.keyboard.down("Control");
        await page.mouse.wheel(0, -120);
        await page.keyboard.up("Control");
        await page.waitForTimeout(300);
        const control = { scrollY: await page.evaluate(() => scrollY), camera: await camera.evaluate((node) => getComputedStyle(node).transform) };
        assert.notEqual(control.camera, controlBefore, "Ctrl wheel zooms stage");
        assert.equal(control.scrollY, 0, "Ctrl zoom is handled by stage");
        receipts.push({ key: `${key}-wheel`, natural, forcedScrollable: !!restore, scrollable, plain, control });
      } finally {
        if (restore) await page.evaluate((saved) => {
          document.getElementById("mission-wheel-fixture-space")?.remove();
          document.documentElement.style.cssText = saved.html;
          document.body.style.cssText = saved.body;
          scrollTo(0, 0);
        }, restore);
      }
    });
    await context.close();
  }
  writeFileSync(`${evidence}/corrections.json`, JSON.stringify(receipts, null, 2));
}
