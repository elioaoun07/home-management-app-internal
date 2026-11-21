import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { openBoard, shiftCase, specimen } from "./local-stage-board.mjs";
import {
  assertFrameBudget,
  installBoardProbe,
  probeReceipt,
  resetProbe,
} from "./local-stage-probe.mjs";

export async function boardLayout(page) {
  return page.locator(".board-workshop").evaluate((root) => {
    const box = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
    };
    return {
      root: box(root),
      topbar: box(root.querySelector(".board-topbar")),
      board: box(root.querySelector(".board-region")),
      rail: box(root.querySelector(".board-rail")),
      comms: box(root.querySelector(".board-comms:not([hidden])")),
      telemetry: box(root.querySelector(".board-telemetry")),
      dock: box(root.querySelector(".board-dock")),
      zones: [...root.querySelectorAll(".board-zone")].map((element) => ({
        id: element.dataset.zone,
        label: element.textContent.trim(),
        box: box(element),
      })),
      canvases: [...root.querySelectorAll("canvas[data-layer]")].map(
        (canvas) => ({
          layer: canvas.dataset.layer,
          width: canvas.width,
          height: canvas.height,
          cssWidth: parseFloat(canvas.style.width),
          cssHeight: parseFloat(canvas.style.height),
          box: box(canvas),
        }),
      ),
      attrs: { ...root.dataset },
      overflow: document.documentElement.scrollWidth > innerWidth,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      filters: [...root.querySelectorAll("canvas[data-layer]")].flatMap(
        (canvas) => {
          const result = [];
          for (let element = canvas; element; element = element.parentElement) {
            const s = getComputedStyle(element);
            if (s.filter !== "none" || s.backdropFilter !== "none")
              result.push({
                tag: element.tagName,
                className: element.className,
                filter: s.filter,
                backdropFilter: s.backdropFilter,
              });
          }
          return result;
        },
      ),
      scrollbars: [
        ...root.querySelectorAll(
          ".board-rail-body,.board-comms,.board-telemetry,.board-results,.stage-black-box,.stage-black-box pre",
        ),
      ].flatMap((node) => {
        const style = getComputedStyle(node);
        return style.display !== "none" &&
          /auto|scroll/u.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1 &&
          style.scrollbarWidth !== "none"
          ? [node.className]
          : [];
      }),
    };
  });
}
const intersects = (a, b) =>
  a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
export function assertLayout(layout) {
  const mission = !!layout.dock;
  assert.equal(layout.overflow, false, "no horizontal overflow");
  assert.equal(layout.topbar.height, mission ? 44 : 48);
  assert.equal(layout.zones.length, 11);
  assert.deepEqual(layout.filters, [], "canvas ancestors have no CSS filters");
  assert.deepEqual(layout.scrollbars, [], "no panel shows a scrollbar");
  if (layout.viewport.width >= 900) {
    assert.ok(
      layout.root.bottom <= layout.viewport.height + 1,
      "stage fits the desktop window without scrolling",
    );
    assert.ok(
      layout.board.right <= layout.rail.x + 0.5,
      "rail reserves a separate column",
    );
    assert.ok(
      (mission ? [44, 340] : [40, 300]).some((value) => Math.abs(layout.rail.width - value) <= 1),
    );
    for (const zone of layout.zones) {
      assert.ok(
        zone.box.x >= layout.board.x &&
          zone.box.right <= layout.board.right + 1 &&
          zone.box.y >= layout.board.y &&
          zone.box.bottom <= layout.board.bottom + 1,
        `${zone.id} stays inside the board`,
      );
      for (const hud of [layout.comms, layout.telemetry].filter(Boolean))
        assert.equal(
          intersects(zone.box, hud),
          false,
          `${zone.id} does not overlap a reserved HUD region`,
        );
    }
  } else if (!mission)
    assert.ok(
      layout.rail.y >= layout.board.bottom - 1,
      "narrow rail drops below the board",
    );
  for (const canvas of layout.canvases)
    assert.ok(
      canvas.width / canvas.cssWidth <=
        (canvas.layer === "motion" ? 1.5 : 2) + 0.001,
    );
}
export async function captureBoard(page, evidence, name, record) {
  const layout = await boardLayout(page);
  await page.screenshot({ path: `${evidence}/${name}-page.png` });
  await page
    .locator(".board-workshop")
    .screenshot({ path: `${evidence}/${name}-stage.png` });
  record(name);
  return { name, ...layout };
}
export async function attentionReceipt(page) {
  return page.locator(".board-workshop").evaluate((root) => ({
    actCount: Number(root.dataset.attention),
    turn: root.querySelector(".board-turn")?.textContent,
    title: document.title,
    badges: [...root.querySelectorAll(".board-result-badges li")].map(
      (node) => node.textContent,
    ),
    cards: [...root.querySelectorAll("[data-attention-id]")].map((node) => ({
      id: node.dataset.attentionId,
      kind: node.dataset.kind,
      zone: node.dataset.zone,
      level: node.dataset.level,
      state: node.dataset.state,
      title:
        node.querySelector("h2,h3")?.textContent ??
        node.querySelector("button")?.textContent,
      detail: node.querySelector(".board-attention-detail")?.textContent,
      text: node.textContent,
      href: node.querySelector("a")?.getAttribute("href"),
      primaryDisabled: node.querySelector("button.primary")?.disabled,
    })),
    sqlVisible: [
      ...root.querySelectorAll('[data-kind="sql"][data-state="open"]'),
    ].filter((node) => !node.closest("details:not([open])")).length,
    sqlMore: root.querySelector(".board-sql-more > summary")?.textContent,
  }));
}
export function assertAttention(receipt, expected) {
  assert.equal(receipt.actCount, expected.actCount, "real attention count");
  for (const card of expected.cards ?? []) {
    const actual = receipt.cards.find(
      (value) =>
        value.kind === card.kind && (!card.state || value.state === card.state),
    );
    assert.ok(actual, `${card.kind} ${card.state ?? "open"} card`);
    if (card.title) assert.ok(actual.title?.includes(card.title), card.title);
    if (card.zone) assert.equal(actual.zone, card.zone);
    if (card.level) assert.equal(actual.level, card.level);
    if (card.detail && card.kind !== "silent")
      assert.equal(actual.detail, card.kind === "changes" ? card.detail.replace(/\bfiles\b/u, "kept") : card.detail);
    if (card.detailIncludes)
      assert.ok(actual.text.includes(card.detailIncludes));
    if (card.detailAbsent && card.kind !== "failed")
      assert.equal(actual.detail, undefined);
    if (card.hrefAbsent) {
      assert.equal(actual.href, undefined);
      if (card.kind === "test")
        assert.equal(
          actual.primaryDisabled,
          true,
          "a missing handover cannot leave an inert Test action",
        );
    }
    if (card.action?.href) assert.equal(actual.href, card.action.href);
  }
  for (const kind of expected.mustNotRaiseKinds ?? [])
    assert.equal(
      receipt.cards.some((card) => card.kind === kind),
      false,
      kind + " must not be invented",
    );
  if (expected.sqlPaths)
    for (const path of expected.sqlPaths)
      assert.ok(receipt.cards.some((card) => card.detail === path));
  for (const path of expected.mustNotRaise ?? [])
    assert.equal(
      receipt.cards.some((card) => card.detail === path),
      false,
    );
  if (expected.visibleSql)
    assert.equal(receipt.sqlVisible, expected.visibleSql);
  if (expected.overflow) assert.equal(receipt.sqlMore, expected.overflow);
  if (expected.actCount > 0) assert.equal(receipt.turn, "YOUR TURN");
  if (expected.cleanDesk) assert.ok(receipt.badges.includes("Clean desk"));
}
export async function runRuntime(page, state, assets, evidence, record, check) {
  const facts = {};
  await check(
    "1494 DPR1.5 rest calls / facts-only layers / isolated clock leaves",
    async () => {
      const run = shiftCase("brief-look");
      run.activity[0].at = new Date(Date.now() - 1000).toISOString();
      await openBoard(page, state, assets, run, "blue");
      await page
        .locator(".board-workshop")
        .evaluate((root) => (root.dataset.debug = "true"));
      await page.setViewportSize({ width: 1495, height: 934 });
      await page.waitForTimeout(400);
      await page.setViewportSize({ width: 1494, height: 934 });
      await page.waitForTimeout(500);
      const bake = Number(
        await page.locator(".board-workshop").getAttribute("data-bake-ms"),
      );
      assert.ok(
        Number.isFinite(bake) && bake > 0 && bake <= 150,
        `actual product bake ${bake}ms`,
      );
      await resetProbe(page, true);
      const before = await page.evaluate(() => ({
        ...window.__boardProbe.total,
      }));
      await page.waitForTimeout(3200);
      const rest = await probeReceipt(page);
      facts.rest = { ...rest, bake };
      assertFrameBudget(rest, false);
      assert.equal(
        rest.total.static,
        before.static,
        "static does not draw between facts",
      );
      assert.equal(
        rest.total.state,
        before.state,
        "state does not draw between facts",
      );
      assert.deepEqual(
        rest.mutations,
        [],
        "only subscribed clock/counter leaves tick",
      );
      await page.keyboard.press("Shift+P");
      await page.locator(".board-perf:not([hidden])").waitFor();
      await page.waitForTimeout(2200);
      facts.meter = await page.locator(".board-perf").textContent();
      assert.match(facts.meter, /fps.*p95.*calls/u);
      await page.keyboard.press("Shift+P");
    },
  );
  await check("Full specimen replay call and scripting budgets", async () => {
    const run = specimen();
    run.phase = "shipped";
    run.activity.push({
      at: new Date(Date.now() - 1000).toISOString(),
      kind: "status",
      summary: "Owner shipped merge",
      job_id: "supervisor",
      seq: run.activity.length,
    });
    run.handover.acceptance.state = "accepted";
    await openBoard(page, state, assets, run, "pink");
    await page
      .locator(".board-workshop")
      .evaluate((root) => (root.dataset.debug = "true"));
    await page.getByRole("button", { name: "Full", exact: true }).click();
    await page.getByRole("slider", { name: "Replay", exact: true }).focus();
    await page.keyboard.press("Home");
    const camera = page.locator(".board-camera");
    if (await camera.getAttribute("data-camera-follow") === "false")
      await page.keyboard.press("f");
    facts.fullFollowEnabled = await camera.getAttribute("data-camera-follow");
    if (await page.locator(".board-dock").count())
      assert.equal(facts.fullFollowEnabled, "true", "Full runtime sample includes Follow camera shots");
    await resetProbe(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.locator(".board-workshop").scrollIntoViewIfNeeded();
    await page.waitForTimeout(18000);
    const sample = await probeReceipt(page);
    facts.fullDefaultSpeed = sample;
    assertFrameBudget(sample);
    assert.ok(sample.summary.observedMotionFps >= 55,
      `Full fixture motion FPS ${sample.summary.observedMotionFps.toFixed(2)}`);
    await captureBoard(page, evidence, "runtime-full-active", record);
    await page.getByRole("button", { name: "1×", exact: true }).click();
    await page.locator(".board-workshop").scrollIntoViewIfNeeded();
    await resetProbe(page);
    await page.waitForFunction(
      () =>
        document.querySelector(".flight-recorder")?.dataset.playing === "false",
      null,
      { timeout: 120000 },
    );
    const finish = await probeReceipt(page);
    facts.fullFastRemainder = finish;
    assertFrameBudget(finish);
    assert.ok(finish.summary.observedMotionFps >= 55,
      `Full fixture fast remainder FPS ${finish.summary.observedMotionFps.toFixed(2)}`);
    facts.fullStagedIds = [
      ...new Set(
        [...sample.frames, ...finish.frames]
          .map((frame) => frame.stagedId)
          .filter(Boolean),
      ),
    ];
    for (const row of run.activity)
      assert.ok(
        facts.fullStagedIds.includes(`${row.job_id}:${row.seq}`),
        `Full replay stages every real row, including tied start: ${row.summary}`,
      );
    await captureBoard(page, evidence, "runtime-full-finished", record);
    await page.waitForTimeout(4000);
    await resetProbe(page);
    await page.waitForTimeout(1500);
    facts.finished = await probeReceipt(page);
    assert.equal(
      facts.finished.summary.count,
      0,
      "finished run animation loop sleeps",
    );
  });
  await check(
    "reduced motion draws once and keeps paused replay static",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openBoard(page, state, assets, specimen(), "blue");
      await page.getByRole("button", { name: "Full", exact: true }).click();
      const slider = page.getByRole("slider", { name: "Replay", exact: true });
      await slider.focus();
      await page.keyboard.press("Home");
      await page.locator(".board-workshop").scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await resetProbe(page);
      const first = await page.locator('[data-layer="motion"]').screenshot();
      await page.waitForTimeout(1200);
      const second = await page.locator('[data-layer="motion"]').screenshot();
      facts.reduced = await probeReceipt(page);
      assert.equal(
        facts.reduced.summary.count,
        0,
        "reduced motion has no animation callback",
      );
      assert.ok(
        first.equals(second),
        "paused reduced canvas is pixel-identical",
      );
      const cursor = await slider.getAttribute("aria-valuenow");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForFunction(
        (before) =>
          document
            .querySelector('[role="slider"][aria-label="Replay"]')
            ?.getAttribute("aria-valuenow") !== before,
        cursor,
        { timeout: 10000 },
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
    },
  );
  for (const [phase, summary, delay] of [
    ["shipped", "Owner shipped merge", 1400],
    ["reverted", "Owner reverted merge", 500],
  ]) await check(`actual Full ${phase} capsule pose; initial closed visit sleeps`, async () => {
    const run = specimen(), now = Date.now();
    run.phase = phase;
    run.activity = [
      { at: new Date(now - 2000).toISOString(), kind: "status", summary: "Native session started", job_id: "supervisor", seq: 0 },
      { at: new Date(now - 1000).toISOString(), kind: "status", summary, job_id: "supervisor", seq: 1 },
    ];
    await openBoard(page, state, assets, run, phase === "shipped" ? "blue" : "pink");
    await page.waitForTimeout(1200);
    await resetProbe(page);
    await page.waitForTimeout(400);
    const closed = await probeReceipt(page);
    assert.equal(closed.summary.count, 0, "visiting a closed result never starts a launch/revert animation");
    assert.equal(await page.locator(".flight-recorder").getAttribute("data-playing"), "false");
    await captureBoard(page, evidence, `runtime-${phase}-closed`, record);
    await page.getByRole("button", { name: "Full", exact: true }).click();
    await page.getByRole("slider", { name: "Replay", exact: true }).focus();
    await page.keyboard.press("Home");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".board-workshop")?.dataset.stagedId === "supervisor:1",
      null, { timeout: 15000 });
    await page.waitForTimeout(delay);
    const replay = await page.locator(".board-workshop").evaluate((root) => ({
      phase: root.dataset.phase, stagedId: root.dataset.stagedId, replay: root.dataset.replay,
      playing: root.querySelector(".flight-recorder")?.dataset.playing,
    }));
    assert.equal(replay.stagedId, "supervisor:1");
    assert.equal(replay.replay, "true");
    assert.equal(replay.playing, "true");
    await captureBoard(page, evidence, `runtime-${phase}-capsule-mid-replay`, record);
    facts[`${phase}Capsule`] = { closed: closed.summary, replay, delayAfterRecordedRowMs: delay, recordedSummary: summary };
  });
  writeFileSync(
    `${evidence}/runtime.json`,
    JSON.stringify(
      {
        measurement:
          "whole actual product requestAnimationFrame callback, test counter overhead included; excludes unrelated event-loop tasks. Fixture FPS is not the owner's real-run acceptance.",
        ...facts,
      },
      null,
      2,
    ),
  );
  return facts;
}
export { installBoardProbe };
