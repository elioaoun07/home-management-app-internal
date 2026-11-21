import assert from "node:assert/strict";
const profiles = [
  { width: 390, height: 844 },
  { width: 1280, height: 640 },
  { width: 1358, height: 696 },
  { width: 1494, height: 934 },
];
// Retained R120 session/Bridge state, theme, viewport and presence assertions.
export async function checkSessionMatrix({ page, open, selectTool, capture, core, waitState, controls, id, matrixScenes, firstFrameFacts, parkedFacts, stageFacts }) {
  if (!process.env.ERA_LOCAL_FAST) for (const { width, height } of profiles)
    for (const theme of ["blue", "pink"]) {
      await page.setViewportSize({ width, height });
      const key = `${width}-${theme}`;
      await open(`/delivery/run/${id}`, "failed", theme);
      await page
        .getByRole("alert")
        .filter({ hasText: "Agent could not start" })
        .waitFor();
      assert.equal(await page.locator(".delivery-workshop").count(), 1);
      assert.equal(await page.locator(".board-zone").count(), 11);
      assert.equal(await page.locator(".delivery-workshop").getAttribute("data-active"), "false");
      for (const name of ["Plan", "Verification", "Changes"])
        assert.equal(
          await page.getByRole("region", { name, exact: true }).count(),
          0,
        );
      await selectTool("Brief");
      await page.getByRole("region", { name: "Plan", exact: true }).waitFor();
      await page.getByText("Anonymous bulk read returns 401.", { exact: false }).waitFor();
      await capture(`${key}-brief`);
      await page.getByRole("button", { name: "Open verification", exact: true }).press("Enter");
      await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some(node => node.textContent.startsWith("Verification") && node.getAttribute("aria-selected") === "true"));
      assert.equal(await page.getByRole("tab", { name: "Verification", exact: false }).getAttribute("aria-selected"), "true");
      assert.equal(await page.getByText("Not run", { exact: true }).count(), 4);
      await capture(`${key}-verification`);
      await selectTool("Changes");
      await page.getByText("Candidate pending", { exact: true }).waitFor();
      await selectTool("Worktree");
      await page.getByRole("region", { name: "Worktree", exact: true }).waitFor();
      await page.getByText("C:/fixture/very-long-worktree-path/retained-failed-attempt/BUD-1", { exact: true }).waitFor();
      await capture(`${key}-worktree`);
      await selectTool("Host limits");
      await page.getByText("Credential scrub prevents accidents, not deliberate host access.", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Host limits", exact: true }).press("Home");
      assert.equal(await page.getByRole("tab", { name: "Activity", exact: true }).getAttribute("aria-selected"), "true");
      await page.getByRole("tab", { name: "Activity", exact: true }).press("ArrowRight");
      assert.equal(await page.getByRole("tab", { name: "Brief", exact: true }).getAttribute("aria-selected"), "true");
      await selectTool("Activity");
      if (await page.locator(".board-dock").count()) {
        const rail = page.locator(".board-rail");
        if (await rail.getAttribute("data-open") === "false")
          await rail.locator(".board-rail-heading button").click();
      }
      await page.getByText("Error details", { exact: true }).click();
      await capture(`${key}-failed-session`);
      const retry = page.getByRole("link", {
        name: "New attempt",
        exact: true,
      });
      assert.ok(
        (await retry.getAttribute("href")).includes("/deliver/Budget/BUD-1"),
      );
      assert.equal(
        await page.getByRole("button", { name: "Ship", exact: true }).count(),
        0,
        "failed run without a candidate has no Ship action",
      );
      await retry.click();
      await page.getByRole("button", { name: "Start", exact: true }).waitFor();
      await open(`/delivery/run/${id}`, "building", theme);
      await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
      assert.equal(await page.locator(".delivery-workshop").getAttribute("data-active"), "true");
      await selectTool("Activity");
      controls.toolEvent = { kind: "tool", summary: "Read" };
      await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.station === "source");
      await capture(`${key}-reading-session`);
      controls.toolEvent = { kind: "edit", summary: "src/features/fixture/panel.tsx" };
      await page.waitForFunction(() => document.querySelector(".delivery-workshop")?.dataset.station === "forge");
      await page.locator(".run-game-events").getByText("src/features/fixture/panel.tsx", { exact: true }).first().waitFor();
      await capture(`${key}-running-session`);
      await open(`/delivery/run/${id}`, "checking", theme);
      await selectTool("Verification");
      await page.getByText("Inconclusive", { exact: true }).waitFor();
      assert.equal(await page.getByText("Passed", { exact: true }).count(), 1);
      assert.equal(await page.locator(".delivery-workshop").getAttribute("data-station"), "lab");
      await open(`/delivery/run/${id}`, "uat-ready", theme);
      await page
        .getByRole("link", { name: "Test steps", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Ship", exact: true })
          .isDisabled(),
        true,
      );
      await capture(`${key}-uat-session`);
      assert.equal(await page.locator(".delivery-workshop").getAttribute("data-active"), "false");
      await open(`/delivery/run/${id}`, "interrupted", theme);
      await page.locator('[data-kind="lost"]').getByText("Signal lost", { exact: true }).waitFor();
      assert.equal(await page.locator(".delivery-workshop").getAttribute("data-active"), "false");
      await open("/bridge", "building", theme);
      await waitState("running");
      await page.waitForFunction(
        () => Number(document.querySelector(".bridge-core")?.dataset.rpm) > 100,
      );
      const angle = Number(await core().getAttribute("data-angle"));
      await page.waitForTimeout(300);
      assert.ok(
        Number(await core().getAttribute("data-angle")) > angle + 30,
        "sustained rotation with unrelated UAT",
      );
      await capture(`${key}-running-core`);
      // Poll the same mounted core: state/color/geometry must update without reload.
      controls.scene = "failed";
      await waitState("failed");
      assert.equal(
        await page
          .locator(".core-split-ring")
          .evaluate((el) => getComputedStyle(el).display),
        "block",
      );
      assert.equal(
        await core().evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--core-sat").trim(),
        ),
        "0%",
      );
      await capture(`${key}-failed-core`);
      await open("/bridge", "blocked", theme);
      await waitState("failed");
      await page.getByText("Launch blocked", { exact: true }).waitFor();
      await capture(`${key}-blocked-core`);
      await open("/bridge", "interrupted", theme);
      await waitState("failed");
      await open("/bridge", "attention", theme);
      await waitState("attention");
      await capture(`${key}-waiting-core`);
    }
  // Every row of the state table is exercised with the same synthetic evidence.
  if (process.env.ERA_LOCAL_FAST) await open("/bridge", "attention", "blue");
  const titleBeforeMatrix = await page.title();
  const iconsBeforeMatrix = await page.locator('link[rel="icon"]').count();
  const expectedState = value => value === "failed-hook" ? "failed" : value;
  const symbol = { live: "●", thinking: "●", quiet: "○", stale: "▲", "signal-lost": "▲", "link-down": "▲", "failed-hook": "✕", cancelled: "■", "your-turn": "◆", "push-pending": "◆", shipped: "✓", reverted: "↩" };
  if (!process.env.ERA_LOCAL_FAST || process.env.ERA_LOCAL_AMENDMENT) for (const { width, height } of profiles) for (const theme of ["blue", "pink"]) {
    await page.setViewportSize({ width, height });
    for (const next of matrixScenes) {
      await open(`/delivery/run/${id}`, next, theme);
      await page.waitForFunction(expected => document.querySelector(".delivery-workshop")?.dataset.liveness === expected, expectedState(next), { timeout: 25000 });
      const stage = page.locator(".delivery-workshop");
      assert.equal(await stage.count(), 1);
      assert.equal(await stage.getAttribute("data-plates"), "2", `${next} retains two edited files`);
      assert.equal(await stage.getAttribute("data-seals"), ["your-turn", "push-pending", "shipped", "reverted"].includes(next) ? "4" : "0");
      assert.equal(await stage.getAttribute("data-replay"), "false");
      if (next === "live" && process.env.ERA_LOCAL_AMENDMENT) {
        const initial = await stage.evaluate(el => {
          const art = el.querySelector(".stage-fx");
          return { width: art.width, height: art.height, renderer: el.dataset.renderer, state: el.dataset.liveness, camera: el.dataset.camera };
        });
        assert.ok(initial.width > 1 && initial.height > 1 && initial.renderer === "solid-board" && initial.state === "live", "initial world is composed without replaying historic beats");
        firstFrameFacts.push({ width, theme, ...initial });
      }
      const actCount = Number(await stage.getAttribute("data-attention"));
      assert.equal(await page.title(), `${actCount > 0 ? `◆ ${actCount} · BUD-1` : `${symbol[next]} BUD-1`} · Verify cockpit fixture`);
      assert.match(await page.locator('link[rel="icon"]').last().getAttribute("href"), /^data:image\/png/u);
      await page.locator(".board-settings-trigger").click();
      assert.equal(await page.getByRole("button", { name: "Sound", exact: true }).getAttribute("aria-pressed"), "false");
      assert.equal(await page.evaluate(() => window.__stageAudioCreated || 0), 0, "no audio context before a sound click");
      if (!(await page.evaluate(() => "documentPictureInPicture" in window))) assert.equal(await page.getByRole("button", { name: "Pocket ERA", exact: true }).count(), 0);
      await page.keyboard.press("Escape");
      if (next === "failed-hook") {
        await page.getByRole("alert").filter({ hasText: "Commit hook failed" }).waitFor();
        assert.equal(await page.locator(".stage-black-box").getByText(/\u001b/u).count(), 0);
        const details = page.getByText("Error details", { exact: true });
        await details.click();
        assert.ok((await page.locator(".stage-black-box").innerText()).includes("ELIFECYCLE Command failed with exit code 1."));
        assert.equal((await page.locator(".black-box-excerpt").innerText()).split("\n")[0], "ELIFECYCLE Command failed with exit code 1.");
        await details.click();
        await page.locator(".stage-black-box").evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
      }
      if (next === "stale") assert.equal(await page.locator(".board-rail > .run-game-commandbar").getAttribute("data-stale"), "true");
      if (next === "link-down") await stage.getByRole("button", { name: "Retry", exact: true }).waitFor();
      if (process.env.ERA_LOCAL_AMENDMENT && ["failed-hook", "signal-lost", "cancelled"].includes(next)) {
        await page.locator(".stage-fx").waitFor();
        const before = await stage.evaluate(el => ({ plates: el.dataset.plates, seals: el.dataset.seals, state: el.dataset.liveness }));
        await page.waitForTimeout(1050);
        const after = await stage.evaluate(el => ({ plates: el.dataset.plates, seals: el.dataset.seals, state: el.dataset.liveness }));
        assert.deepEqual(after, before, `${next}: wounded or standby life does not invent recorded facts`);
        parkedFacts.push({ width, theme, scene: next, before, after });
      }
      stageFacts.push({ width, theme, scene: next, state: await stage.getAttribute("data-liveness"), plates: await stage.getAttribute("data-plates"), seals: await stage.getAttribute("data-seals"), motion: await stage.getAttribute("data-motion") });
      await capture(`${width}-${theme}-state-${next}`);
    }
    if (process.env.ERA_LOCAL_AMENDMENT) {
      await open(`/delivery/run/${id}`, "shipped", theme);
      const replay = page.getByRole("slider", { name: "Replay", exact: true });
      await replay.press("Home");
      await replay.press("ArrowRight");
      await replay.press("ArrowRight");
      assert.equal(await page.locator(".delivery-workshop").getAttribute("data-seals"), "0");
      await capture(`amendment-${width}-${theme}-replay`);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForTimeout(250);
      await capture(`amendment-${width}-${theme}-replay-playing`);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    }
  }
  await page.evaluate(() => { location.hash = "/bridge"; });
  await core().waitFor();
  assert.equal(await page.title(), titleBeforeMatrix, "run unmount restores the previous tab title");
  assert.equal(await page.locator('link[rel="icon"]').count(), iconsBeforeMatrix, "run unmount restores favicon links");

}
