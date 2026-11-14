// Run fixtures/a5-browser.mjs --launchpad --arena first. No live services.
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
const page = await browser.newPage({
  serviceWorkers: "block",
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
const evidence = ".pm/r101-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [],
  writes = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.method() === "POST") writes.push(r.url());
});
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const open = async (path) => {
  await page.goto(`${base}#/${path}`);
  await page.locator(".cockpit").first().waitFor();
};
const capture = async (name) => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name}: horizontal overflow`,
  );
  await page.screenshot({
    path: `${evidence}/${name}.png`,
    animations: "disabled",
  });
};
try {
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const theme of ["blue", "pink"]) {
      await open("bridge");
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: `Use ${theme} theme` }).click();
      for (const screen of ["bridge", "launch", "sessions", "setup", "score"]) {
        await open(screen);
        await capture(`${screen}-${width}-${theme}`);
      }
    }
  }
  await open("launch");
  const skill = page.getByRole("button", { name: "New module new-module" });
  await skill.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getByLabel(/^Title/).inputValue(), "");
  assert.ok(
    await page.getByRole("button", { name: "Review prompt" }).isVisible(),
  );
  await capture("form-390");

  await open("setup");
  assert.equal(await page.locator(".setup-map").isVisible(), false);
  await page.getByLabel("Search setup").fill("start-task");
  assert.equal(await page.locator(".setup-entry").count(), 1);
  await page.locator(".setup-entry").click();
  await page.getByText("Connection map", { exact: true }).click();
  assert.ok(await page.locator(".setup-map").isVisible());
  await capture("setup-map-390");
  await open("setup?tab=map&rule=HR-22");
  assert.equal(await page.getByLabel("Setup category").inputValue(), "5");
  await open("setup?tab=conflicts");
  assert.ok((await page.locator(".conflict-groups > details").count()) > 0);
  assert.equal(await page.locator(".conflict-row:visible").count(), 0);
  await page.locator(".conflict-groups > details > summary").first().click();
  assert.ok((await page.locator(".conflict-row:visible").count()) > 0);
  await capture("conflicts-390");

  await open("sessions");
  await page.getByLabel("Search sessions").fill("no-such-session");
  await page.getByText("No matching sessions", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.locator(".session-card").nth(1).waitFor();
  await page.locator(".session-card .rule-verdicts summary").nth(1).click();
  const failure = page.getByRole("link", { name: "HR-22: fail", exact: true });
  const box = await failure.boundingBox();
  assert.ok(box.width >= 40 && box.height >= 40);
  await failure.click();
  await page.getByText("src/example.ts:7", { exact: true }).waitFor();
  assert.equal(await page.locator(".raw-evidence[open]").count(), 0);
  await page.getByRole("button", { name: "edits" }).click();
  await page.getByText("README.md", { exact: true }).first().waitFor();
  await capture("session-detail-390");
  await open("sessions");
  await page.locator(".session-card > button").nth(0).click();
  await page.locator(".session-card > button").nth(1).click();
  await page
    .getByRole("heading", { name: "Comparison", exact: true })
    .waitFor();
  await capture("comparison-390");

  // An empty recorder must retain useful Setup and Launch navigation.
  await page.route("**/api/data", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    assert.ok(data.cockpit, "fixture data contract");
    data.cockpit.records = [];
    data.cockpit.groups = [];
    await route.fulfill({ response, json: data });
  });
  await open("sessions");
  await page.reload();
  await page.getByText("No sessions recorded yet", { exact: true }).waitFor();
  await capture("sessions-empty-390");
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  writeFileSync(
    `${evidence}/result.json`,
    JSON.stringify(
      {
        ok: true,
      widths: [1440, 1024, 768, 390],
        themes: ["blue", "pink"],
        keyboard: true,
        ruleEvidence: true,
        comparison: true,
        emptyRecorder: true,
        errors,
        writes,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "R101 browser PASS: five destinations, Blue/Pink, desktop/390px, keyboard launch, setup search, rule evidence, comparison, empty recorder; zero writes.\n",
  );
} catch (error) {
  await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  writeFileSync(
    `${evidence}/failure.txt`,
    `${error.stack}\n${await page.locator("body").innerText()}`,
  );
  throw error;
} finally {
  await browser.close();
}
