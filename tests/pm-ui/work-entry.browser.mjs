// Run fixtures/a5-browser.mjs --launchpad --arena first. Navigation only:
// all POSTs and external requests are blocked; Start is never clicked.
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
const evidence = ".pm/work-entry-evidence";
mkdirSync(evidence, { recursive: true });
const errors = [],
  writes = [],
  readinessReads = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  if (!["GET", "HEAD"].includes(request.method())) {
    writes.push(url.pathname);
    return route.abort();
  }
  if (url.pathname === "/api/delivery/v2/local/readiness") {
    readinessReads.push(url.pathname);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: false,
        facts: {
          source: { state: "pass", code: "fixture-source" },
          authentication: { state: "fail", code: "fixture-no-provider" },
          environment: { state: "pass", code: "fixture-environment" },
        },
      }),
    });
  }
  return route.continue();
});
const base = process.env.ERA_COCKPIT_URL || "http://127.0.0.1:4397/";
const open = async (path) => {
  await page.goto(`${base}#/${path}`);
  await page.locator("main").waitFor();
};
const active = async (label) => {
  const link = page.locator('.primary-nav a[aria-current="page"]:visible');
  assert.equal(await link.count(), 1);
  assert.equal((await link.innerText()).trim(), label);
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
    fullPage: true,
  });
};
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    for (const theme of ["blue", "pink"]) {
      await open("bridge");
      await page
        .getByRole("heading", { name: "Bridge", exact: true })
        .waitFor();
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page.getByRole("button", { name: `Use ${theme} theme` }).click();
      const navigation = page.locator(".primary-nav:visible");
      assert.deepEqual(
        await navigation
          .locator("a")
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
        ["#/bridge", "#/sprints", "#/sessions", "#/setup", "#/score"],
      );
      if (width === 390) {
        await page
          .getByRole("button", { name: "More navigation", exact: true })
          .click();
        await page.getByRole("link", { name: "Work", exact: true }).click();
      } else
        await page
          .getByRole("link", { name: "Search work", exact: true })
          .click();
      await page.getByLabel("Find work", { exact: true }).waitFor();
      await active("Plan");
      await page.getByLabel("Find work", { exact: true }).fill("BUD-1");
      const result = page
        .locator(".discovery-results .outcome-link")
        .filter({ hasText: "BUD-1" });
      await result.waitFor();
      assert.equal(await result.count(), 1);
      const searchHash = new URL(page.url()).hash;
      await capture(`work-${width}-${theme}`);
      await result.click();
      await page
        .getByRole("heading", { name: "Verify cockpit fixture", exact: true })
        .waitFor();
      await active("Plan");
      await page.getByText("What done looks like", { exact: true }).click();
      await page
        .getByText("The fixture completes.", { exact: false })
        .waitFor();
      const workHash = new URL(page.url()).hash;
      assert.match(workHash, /^#\/work\//);
      await capture(`work-detail-${width}-${theme}`);
      await page.getByRole("button", { name: "Deliver", exact: true }).click();
      await page.getByLabel(/Executor/).waitFor();
      assert.match(new URL(page.url()).hash, /^#\/(deliver|launch)\//);
      await active("Plan");
      assert.equal(
        await page
          .getByRole("button", { name: "Start", exact: true })
          .isDisabled(),
        false,
      );
      assert.equal(await page.getByRole("region", { name: "Local readiness", exact: true }).count(), 0);
      assert.equal(await page.getByText("fixture no provider", { exact: true }).count(), 0);
      await capture(`local-admission-${width}-${theme}`);
      // Return links must retain the exact selected work and search context.
      await page.getByRole("link", { name: "Back", exact: true }).click();
      await page.getByText("What done looks like", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, workHash);
      await page
        .getByRole("link", { name: "Back to your place", exact: true })
        .click();
      await page.getByLabel("Find work", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, searchHash);
      assert.equal(
        await page.getByLabel("Find work", { exact: true }).inputValue(),
        "BUD-1",
      );
      await open("launch");
      await page.getByLabel("Find work", { exact: true }).waitFor();
      await active("Plan");
      assert.equal(await page.getByLabel("Prompt", { exact: true }).count(), 0);
      await open("launch?file=Budget%2F4%20-%20Checklist.md&cb=0");
      await page.getByLabel(/Executor/).waitFor();
      await active("Plan");
      assert.match(new URL(page.url()).hash, /^#\/launch\?file=/);
      await open("setup");
      await page
        .getByRole("link", { name: "Prompt tools", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Prompt tools", exact: true })
        .waitFor();
      await page.getByLabel("Prompt", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, "#/skill-tools");
      await active("Setup");
      await capture(`prompt-utility-${width}-${theme}`);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(readinessReads, []);
  writeFileSync(
    `${evidence}/work-entry-result.json`,
    JSON.stringify(
      {
        ok: true,
        widths: [1440, 390],
        themes: ["blue", "pink"],
        workSearch: true,
        acceptanceVisible: true,
        contextualLocalAdmission: true,
        canonicalBack: true,
        workNavSelection: true,
        legacyLaunchFallback: true,
        legacyContextualLaunch: true,
        secondaryPromptUtility: true,
        readiness: "deferred until Start; Start never clicked",
        errors,
        writes,
        readinessReads,
      },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Work entry browser PASS: outcome search → acceptance → Local admission → exact return; Plan navigation, legacy Launch fallback and Setup prompt utility; zero dispatch/writes.\n",
  );
} catch (error) {
  writeFileSync(
    `${evidence}/work-entry-failure.txt`,
    `${error.stack}\n${await page.locator("body").innerText()}`,
  );
  await page.screenshot({
    path: `${evidence}/work-entry-failure.png`,
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
