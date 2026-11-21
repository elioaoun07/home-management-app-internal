// Credential-free, recorded fixture only. No command reaches the backend.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  chromiumExecutable,
  fixtureAssets,
  openBoard,
  routeFixture,
  specimen,
} from "./fixtures/local-stage-board.mjs";

const evidence = ".pm/r129-evidence";
mkdirSync(evidence, { recursive: true });
const assets = await fixtureAssets(evidence);
const { chromium } = await import(process.env.ERA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const results = [], errors = [], writes = [];

async function measure(page) {
  return page.locator(".board-workshop").evaluate((root) => {
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const intersection = (a, b) => ({
      left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom),
    });
    const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const visibleRect = (node, initial) => {
      let r = intersection(initial ?? rect(node), viewport);
      for (let p = node; p && p !== root.parentElement; p = p.parentElement) {
        const css = getComputedStyle(p);
        if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0 || css.clipPath === "inset(50%)") return null;
        if (/(hidden|clip|auto|scroll)/.test(`${css.overflowX} ${css.overflowY}`)) r = intersection(r, rect(p));
      }
      return r.right - r.left > 1 && r.bottom - r.top > 1 ? r : null;
    };
    const rgba = (value) => {
      const values = value.match(/[\d.]+/g)?.map(Number);
      return values?.length >= 3 ? [values[0], values[1], values[2], values[3] ?? 1] : null;
    };
    const luminance = (rgb) => rgb.slice(0, 3).map((c) => c / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = (node) => {
      const css = getComputedStyle(node), fg = rgba(css.color);
      let opacity = 1, bg;
      for (let p = node; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        opacity *= Number(s.opacity);
        const c = rgba(s.backgroundColor);
        const gradient = s.backgroundImage.match(/rgba?\([^)]+\)/g)?.map(rgba);
        if (!bg && gradient?.length) {
          // Use the least contrasting gradient endpoint, not a transparent
          // backgroundColor that incorrectly reads as the card beneath it.
          bg = gradient.reduce((a, b) => {
            const ink = luminance(fg), contrastTo = (v) => (Math.max(ink, luminance(v)) + 0.05) / (Math.min(ink, luminance(v)) + 0.05);
            return contrastTo(a) < contrastTo(b) ? a : b;
          });
        }
        if (!bg && c?.[3] === 1) bg = c;
      }
      if (!fg || !bg) return null;
      const ink = fg.slice(0, 3).map((c, i) => c * fg[3] * opacity + bg[i] * (1 - fg[3] * opacity));
      const a = luminance(ink), b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), text = [];
    while (walker.nextNode()) {
      const node = walker.currentNode, value = node.textContent.trim(), parent = node.parentElement;
      if (!value || parent.closest("svg,script,style,.stage-announcement,.board-zone-track,.board-console-drawer:not([open])")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = visibleRect(parent, range.getBoundingClientRect());
      if (!r) continue;
      let scale = 1;
      for (let p = parent; p; p = p.parentElement) {
        const transform = getComputedStyle(p).transform;
        if (transform !== "none") { const m = new DOMMatrixReadOnly(transform); scale *= Math.hypot(m.a, m.b); }
      }
      text.push({ value, font: parseFloat(getComputedStyle(parent).fontSize) * scale, contrast: contrast(parent), selector: parent.className });
    }
    const board = rect(root.querySelector(".board-region"));
    const readouts = [...root.querySelectorAll(".board-readout,.board-last-signal")].map((node) => {
      const box = rect(node), hit = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
      return { text: node.textContent.trim(), box, occluded: !hit || (hit !== node && !node.contains(hit)) };
    });
    const zones = [...root.querySelectorAll(".board-zone-name,.board-zone-chip")].map((node) => ({ text: node.textContent.trim(), box: visibleRect(node) })).filter((n) => n.box);
    const collisions = [];
    for (let i = 0; i < readouts.length; i++) {
      const a = readouts[i];
      for (const b of [...readouts.slice(i + 1), ...zones]) if (overlaps(a.box, b.box)) collisions.push([a.text, b.text]);
    }
    const dockLabels = [...root.querySelectorAll('.board-counters > span,.board-flow strong,.board-badge-count,.board-dock [role="tab"]')]
      .map((node) => ({ text: node.textContent.trim(), box: rect(node) }));
    for (let i = 0; i < dockLabels.length; i++) for (const other of dockLabels.slice(i + 1)) {
      if (overlaps(dockLabels[i].box, other.box)) collisions.push([dockLabels[i].text, other.text]);
    }
    return { text, readouts, collisions, board, documentWidth: document.documentElement.scrollWidth, camera: root.querySelector(".board-camera").dataset.cameraMode };
  });
}

try {
  for (const profile of [{ width: 1280, height: 640, dpr: 1 }, { width: 1358, height: 849, dpr: 1.65 }, { width: 390, height: 844, dpr: 1 }]) {
    for (const theme of ["blue", "pink"]) {
      const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, serviceWorkers: "block" });
      const run = specimen();
      run.phase = "checking";
      run.base = "b".repeat(40);
      run.merge = "d".repeat(40);
      run.branch = `delivery/${run.work.id}-retry`;
      // Include every conditional plate in the stress specimen as well as the
      // four counts and host-check names/results cited by the review.
      for (let i = 0; i < 50; i++) run.activity.push({
        at: run.activity[2].at, kind: "edit", summary: `src/fixture/extra-${i}.ts`,
        seq: 100 + i, job_id: "native",
      });
      const state = await routeFixture(context, assets, writes, run);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      for (const railOpen of [false, true]) {
        for (const mode of ["overview", "follow"]) {
          // Follow deliberately returns to Overview on a closed or idle run.
          // Supply a fresh, explicitly recorded host row for a genuine Follow
          // shot instead of merely asserting that its preference is enabled.
          const live = structuredClone(run);
          live.activity.push({ at: new Date().toISOString(), kind: "status", summary: "lint started", seq: 1000, job_id: "supervisor" });
          await openBoard(page, state, assets, live, theme);
          const rail = page.locator(".board-rail");
          if ((await rail.getAttribute("data-open") === "true") !== railOpen) await rail.locator(".board-rail-heading button").click();
          await page.keyboard.press(mode === "overview" ? "0" : "f");
          if (mode === "follow") {
            // The app intentionally does not animate an initial history row.
            // A later recorded row must arrive through its ordinary poll.
            state.run.activity.push({ at: new Date().toISOString(), kind: "command", summary: "Get-Content src/fixture/follow.ts", seq: 1001, job_id: "native" });
            await page.waitForFunction(() => document.querySelector(".board-camera")?.dataset.cameraMode === "follow", null, { timeout: 12000 });
          }
          await page.waitForTimeout(900);
          const key = `${profile.width}-${theme}-${railOpen ? "open" : "closed"}-${mode}`;
          const facts = await measure(page);
          const floor = profile.width === 390 ? 10 : 11;
          const problems = [
            ...facts.text.filter((t) => t.font < floor - 0.05).map((t) => `small ${t.value}: ${t.font}`),
            ...facts.text.filter((t) => t.contrast !== null && t.contrast < 4.5).map((t) => `contrast ${t.value}: ${t.contrast}`),
            ...facts.collisions.map((c) => `collision ${c.join(" / ")}`),
            ...facts.readouts.filter((r) => r.occluded).map((r) => `occluded ${r.text}`),
            ...facts.readouts.filter(({ box: b }) => !Object.values(b).every(Number.isFinite) || b.left < facts.board.left - 1 || b.right > facts.board.right + 1 || b.top < facts.board.top - 1 || b.bottom > facts.board.bottom + 1).map((r) => `outside ${r.text}`),
          ];
          if (facts.camera !== mode) problems.push(`camera ${facts.camera} instead of ${mode}`);
          if (facts.documentWidth > profile.width) problems.push("horizontal page scroll");
          results.push({ key, problems, ...facts });
          await page.screenshot({ path: `${evidence}/${key}.png` });
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${evidence}/result.json`, JSON.stringify({ results, errors, writes }, null, 2));
}
assert.deepEqual(errors, []);
assert.deepEqual(writes, []);
assert.deepEqual(results.filter((r) => r.problems.length).map((r) => ({ key: r.key, problems: r.problems })), []);
process.stdout.write(`R129: ${results.length} browser profiles passed\n`);
