import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  stageProfiles,
  stageThemes,
  profileKey,
  shiftCase,
  routeFixture,
  openBoard,
} from "./local-stage-board.mjs";
import { assertLayout, captureBoard } from "./local-stage-runtime.mjs";

export async function runNoticeChecks(
  browser,
  assets,
  evidence,
  writes,
  record,
  check,
) {
  const facts = [],
    simulated = [];
  for (const profile of stageProfiles())
    for (const theme of stageThemes()) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dpr,
        serviceWorkers: "block",
      });
      const state = await routeFixture(
        context,
        assets,
        writes,
        shiftCase("summary-and-changes"),
      );
      const page = await context.newPage();
      await check(
        `cached LinkDown fits ${profileKey(profile)} ${theme}`,
        async () => {
          await openBoard(
            page,
            state,
            assets,
            shiftCase("summary-and-changes"),
            theme,
          );
          const counts = await page.locator(".board-counters").textContent();
          state.failed = true;
          await page.waitForFunction(
            () =>
              document.querySelector(".board-workshop")?.dataset.liveness ===
              "link-down",
          );
          assert.equal(
            await page.locator(".error-notice").count(),
            0,
            "duplicate poll notice is omitted only for the cached Game",
          );
          assert.equal(
            await page.locator(".board-counters").textContent(),
            counts,
            "last recorded counters are retained",
          );
          const name = `cached-linkdown-${profileKey(profile)}-${theme}`;
          const layout = await captureBoard(page, evidence, name, record);
          facts.push({ name, layout, counts });
          assertLayout(layout);
        },
      );
      await context.close();
    }
  const context = await browser.newContext({
    viewport: { width: 1494, height: 934 },
    deviceScaleFactor: 1.5,
    serviceWorkers: "block",
  });
  const state = await routeFixture(
    context,
    assets,
    writes,
    shiftCase("summary-and-changes"),
  );
  const page = await context.newPage();
  let sequence = 0;
  const initialFailure = async (name, session) => {
    state.failed = !session;
    state.sessionFailed = session;
    await page.goto(
      assets.base +
        "?notice-failure=" +
        ++sequence +
        "#/delivery/run/" +
        state.run.run_id,
    );
    await page.locator(".foundry-standby").waitFor();
    await page.locator(".board-standby-error > summary").click();
    const text = await page.locator(".board-standby-error").textContent();
    await page.screenshot({ path: `${evidence}/${name}.png` });
    record(name);
    facts.push({ name, text });
    assert.ok(text.trim().length > 0);
    assert.match(text, session ? /Fixture session failure/u : /fixture request failure/u);
    assert.equal(await page.locator(".foundry-standby").getByRole("link", { name: "Back", exact: true }).count(), 1);
    assert.equal(await page.locator(".board-workshop").count(), 0);
  };
  await check("Game without cached data preserves the poll error", async () => {
    await initialFailure("initial-poll-error", false);
  });
  await check("session errors remain visible", async () => {
    await initialFailure("session-error", true);
  });
  await check("Calm cached poll errors remain visible", async () => {
    state.failed = false;
    state.sessionFailed = false;
    await openBoard(
      page,
      state,
      assets,
      shiftCase("summary-and-changes"),
      "blue",
    );
    await page.evaluate(() => localStorage.setItem("pm-game-layer", "off"));
    await page.reload();
    await page.waitForFunction(
      () =>
        !document.querySelector(".board-workshop") &&
        document.querySelector(".local-run-page"),
    );
    state.failed = true;
    await page.locator(".error-notice").waitFor();
    const text = await page.locator(".error-notice").textContent();
    await page.screenshot({ path: `${evidence}/calm-poll-error.png` });
    record("calm-poll-error");
    facts.push({ name: "calm-poll-error", text });
    assert.ok(text.trim().length > 0);
  });
  await check(
    "command errors remain visible and no real command is sent",
    async () => {
      await page.evaluate(() => localStorage.setItem("pm-game-layer", "on"));
      state.sessionFailed = false;
      state.commandFailure = true;
      await openBoard(
        page,
        state,
        assets,
        shiftCase("uat-required-review"),
        "blue",
      );
      await page
        .locator(".board-rail > footer")
        .getByRole("button", { name: "Review diff", exact: true })
        .click();
      await page.locator(".error-notice").waitFor();
      const text = await page.locator(".error-notice").textContent();
      assert.match(text, /Fixture review refused/u);
      assert.equal(state.simulated.length, 1);
      simulated.push(...state.simulated);
      await page.locator(".error-notice").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}/command-error.png` });
      record("command-error");
      facts.push({ name: "command-error", text });
    },
  );
  await context.close();
  writeFileSync(
    `${evidence}/notice.json`,
    JSON.stringify(
      {
        facts,
        simulated,
        effect:
          "All API writes blocked except one browser-only fulfilled review refusal; no backend request reached the fixture",
      },
      null,
      2,
    ),
  );
  return { facts, simulated };
}
