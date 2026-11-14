// Run fixtures/a5-browser.mjs first; repeat with --arena for synthetic comparison.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = await import(
  process.env.ERA_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ERA_CHROME_PATH
    ? { executablePath: process.env.ERA_CHROME_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage(),
  errors = [],
  writes = [];
const evidence = ".pm/a7-evidence";
const variant = process.argv.includes("--arena") ? "synthetic" : "empty";
const screenshot = (name) =>
  page.screenshot({
    path: `${evidence}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
mkdirSync(evidence, { recursive: true });
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.method() === "POST") writes.push(new URL(r.url()).pathname);
});
await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  return route.continue();
});
const url = process.env.ERA_A7_URL || "http://127.0.0.1:4397/#/score";
try {
  await page.goto(url);
  await page.getByRole("region", { name: "Measured progress" }).waitFor();
  const figures = () =>
    page.locator(".game-facts details").evaluateAll((els) =>
      els.map((e) => {
        const copy = e.cloneNode(true);
        copy.querySelector("summary").remove();
        return copy.textContent;
      }),
    );
  const plain = await figures();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "Game layer" });
  assert.equal(await toggle.getAttribute("aria-checked"), "false");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  const animation = await page.locator(".game-activation").evaluate((e) => ({
    duration: getComputedStyle(e).animationDuration,
    input: getComputedStyle(e).pointerEvents,
  }));
  assert.equal(animation.duration, "1.8s");
  assert.equal(animation.input, "none");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  assert.deepEqual(await figures(), plain);
  await screenshot("score-desktop");
  await page.reload();
  await page.getByText("Clean streak", { exact: true }).waitFor();
  for (const theme of ["blue", "pink"]) {
    if (theme === "pink")
      await page.getByRole("button", { name: "Use pink theme" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await screenshot(`score-390-${theme}`);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    assert.ok((await toggle.boundingBox()).height >= 40);
    await screenshot(`settings-390-${theme}`);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await toggle.click();
  assert.equal(
    await page
      .locator(".game-activation")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await page.getByRole("heading", { name: "Arena", exact: true }).waitFor();
  await page.getByText("Native launch blocked", { exact: true }).waitFor();
  if (!process.argv.includes("--arena")) {
    assert.equal(
      await page.getByLabel("Claude run").locator("option").count(),
      1,
    );
  } else {
    await page
      .getByLabel("Claude run")
      .locator("option")
      .nth(1)
      .waitFor({ state: "attached" });
    await page.getByLabel("Claude run").selectOption("arena-browser-fixture-0");
    await page.getByLabel("Codex run").selectOption("arena-browser-fixture-1");
    await page
      .getByText("Same frozen case · raw evidence", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".compare-grid > section > details").count(),
      12,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await screenshot("arena-390-synthetic");
    await page.setViewportSize({ width: 1440, height: 900 });
    await screenshot("arena-desktop-synthetic");
    await page
      .locator(".compare-grid > section > details > summary")
      .first()
      .click();
    assert.ok(
      await page.locator(".compare-grid .evidence-facts").first().isVisible(),
    );
    assert.equal(
      await page.locator(".compare-grid .raw-evidence[open]").count(),
      0,
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  writeFileSync(
    `${evidence}/browser-${variant}-result.json`,
    JSON.stringify(
      {
        ok: true,
        variant,
        syntheticScorecardsOnly: true,
        realArenaRuns: 0,
        togglePersistence: true,
        identicalFacts: true,
        animation,
        reducedMotion: true,
        widths: [1440, 390],
        themes: ["blue", "pink"],
        errors,
        writes,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    `A7 browser PASS: settings/persistence, identical facts, approved 1800ms activation, reduced motion, 390px Blue/Pink, ${variant} Arena; zero model runs\n`,
  );
} catch (e) {
  writeFileSync(
    `${evidence}/failure.txt`,
    `${e.stack}\n${await page.locator("body").innerText()}`,
  );
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  throw e;
} finally {
  await browser.close();
}
